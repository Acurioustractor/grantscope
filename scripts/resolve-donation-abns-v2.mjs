#!/usr/bin/env node
/**
 * Donation ABN Resolver v2
 *
 * Matches political donations lacking donor_abn to gs_entities using:
 *   Phase 1: Exact name match against gs_entities.canonical_name
 *   Phase 2: Fuzzy match using local trigram similarity (>0.7 threshold)
 *   Phase 3: ABR API lookup for remaining (rate-limited)
 *
 * After running, re-run resolve-donor-entities.mjs to rebuild relationships.
 *
 * Usage:
 *   node --env-file=.env scripts/resolve-donation-abns-v2.mjs [--apply] [--limit=5000] [--phase=1|2|3]
 */

import { createClient } from '@supabase/supabase-js';
import { logStart, logComplete, logFailed } from './lib/log-agent-run.mjs';

const SUPABASE_URL = process.env.SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL;
const SUPABASE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;
const ABN_LOOKUP_GUID = process.env.ABN_LOOKUP_GUID;

if (!SUPABASE_URL || !SUPABASE_KEY) {
  console.error('Missing SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY');
  process.exit(1);
}

const APPLY = process.argv.includes('--apply');
const LIMIT = parseInt(process.argv.find(a => a.startsWith('--limit='))?.split('=')[1] || '0', 10);
const PHASE_FILTER = process.argv.find(a => a.startsWith('--phase='))?.split('=')[1];
const FUZZY_THRESHOLD = 0.7;

const db = createClient(SUPABASE_URL, SUPABASE_KEY);

// ─── Trigram similarity (mirrors pg_trgm) ────────────────────────────────

function trigrams(s) {
  const padded = `  ${s} `;
  const result = [];
  for (let i = 0; i < padded.length - 2; i++) {
    result.push(padded.slice(i, i + 3));
  }
  return result;
}

function trigramSimilarity(a, b) {
  const setA = new Set(trigrams(a.toLowerCase()));
  const setB = new Set(trigrams(b.toLowerCase()));
  let intersection = 0;
  for (const t of setA) if (setB.has(t)) intersection++;
  const union = setA.size + setB.size - intersection;
  return union === 0 ? 0 : intersection / union;
}

// ─── ABR API lookup ──────────────────────────────────────────────────────

async function lookupABR(name) {
  if (!ABN_LOOKUP_GUID) return null;
  const url = `https://abr.business.gov.au/json/MatchingNames.aspx?name=${encodeURIComponent(name)}&maxResults=1&guid=${ABN_LOOKUP_GUID}`;
  try {
    const res = await fetch(url);
    const text = await res.text();
    // ABR returns JSONP — extract the JSON
    const jsonStr = text.replace(/^callback\(/, '').replace(/\)$/, '');
    const data = JSON.parse(jsonStr);
    if (data.Names?.length > 0) {
      const match = data.Names[0];
      const abn = match.Abn;
      const score = parseFloat(match.Score || '0');
      if (abn && score >= 80) return abn;
    }
  } catch (err) {
    // Silently skip ABR failures
  }
  return null;
}

// ─── Main ────────────────────────────────────────────────────────────────

async function main() {
  const run = await logStart(db, 'resolve-donation-abns-v2', 'Resolve Donation ABNs v2');

  try {
    // 1. Get donations without ABN
    console.log('=== Donation ABN Resolver v2 ===');
    console.log(`  Mode: ${APPLY ? 'APPLY' : 'DRY RUN'}`);
    if (PHASE_FILTER) console.log(`  Phase filter: ${PHASE_FILTER}`);
    console.log();

    let query = db
      .from('political_donations')
      .select('id, donor_name')
      .is('donor_abn', null)
      .not('donor_name', 'is', null)
      .order('amount', { ascending: false });

    if (LIMIT) query = query.limit(LIMIT);

    const { data: donations, error } = await query;
    if (error) throw error;

    if (!donations?.length) {
      console.log('No unmatched donations found.');
      await logComplete(db, run.id, { items_found: 0, items_new: 0 });
      return;
    }

    // Dedupe by donor name
    const nameMap = new Map();
    for (const d of donations) {
      const name = d.donor_name.trim();
      if (!name || name.length < 3) continue;
      if (!nameMap.has(name)) nameMap.set(name, []);
      nameMap.get(name).push(d.id);
    }

    console.log(`${nameMap.size} unique donor names (${donations.length} donations)`);

    // Build entity name index for exact matching
    console.log('\nBuilding entity name index...');
    const entityIndex = new Map();
    let offset = 0;
    const pageSize = 5000;
    while (true) {
      const { data: entities } = await db
        .from('gs_entities')
        .select('id, canonical_name, abn')
        .not('abn', 'is', null)
        .range(offset, offset + pageSize - 1);

      if (!entities?.length) break;
      for (const e of entities) {
        entityIndex.set(e.canonical_name.toLowerCase(), e.abn);
      }
      if (entities.length < pageSize) break;
      offset += pageSize;
    }
    console.log(`  ${entityIndex.size} entities with ABNs indexed`);

    let phase1Matches = 0;
    let phase2Matches = 0;
    let phase3Matches = 0;
    const updates = [];

    // Phase 1: Exact name match
    if (!PHASE_FILTER || PHASE_FILTER === '1') {
      console.log('\n--- Phase 1: Exact Name Match ---');
      for (const [name, ids] of nameMap) {
        const abn = entityIndex.get(name.toLowerCase());
        if (abn) {
          phase1Matches++;
          updates.push({ ids, abn, method: 'exact_name' });
          nameMap.delete(name); // Remove from further processing
        }
      }
      console.log(`  ${phase1Matches} exact matches`);
    }

    // Phase 2: Fuzzy matching
    if (!PHASE_FILTER || PHASE_FILTER === '2') {
      console.log('\n--- Phase 2: Fuzzy Name Match ---');
      const entityNames = [...entityIndex.keys()];
      let checked = 0;
      for (const [name, ids] of nameMap) {
        const nameLower = name.toLowerCase();
        let bestMatch = null;
        let bestScore = 0;

        for (const entityName of entityNames) {
          // Quick length-ratio filter to avoid unnecessary trigram computation
          const lenRatio = nameLower.length / entityName.length;
          if (lenRatio < 0.5 || lenRatio > 2.0) continue;

          const score = trigramSimilarity(nameLower, entityName);
          if (score > bestScore) {
            bestScore = score;
            bestMatch = entityName;
          }
        }

        if (bestMatch && bestScore >= FUZZY_THRESHOLD) {
          phase2Matches++;
          const abn = entityIndex.get(bestMatch);
          updates.push({ ids, abn, method: 'fuzzy_name', score: bestScore.toFixed(3) });
          nameMap.delete(name);
        }

        checked++;
        if (checked % 1000 === 0) console.log(`  Checked ${checked}/${nameMap.size}...`);
      }
      console.log(`  ${phase2Matches} fuzzy matches (threshold: ${FUZZY_THRESHOLD})`);
    }

    // Phase 3: ABR API lookup
    if ((!PHASE_FILTER || PHASE_FILTER === '3') && ABN_LOOKUP_GUID) {
      console.log('\n--- Phase 3: ABR API Lookup ---');
      const remaining = [...nameMap.entries()].slice(0, 2000); // Cap API calls
      let checked = 0;
      for (const [name, ids] of remaining) {
        const abn = await lookupABR(name);
        if (abn) {
          phase3Matches++;
          updates.push({ ids, abn, method: 'abr_api' });
        }
        checked++;
        if (checked % 100 === 0) console.log(`  Checked ${checked}/${remaining.length}...`);
        await new Promise(r => setTimeout(r, 500)); // Rate limit
      }
      console.log(`  ${phase3Matches} ABR API matches`);
    }

    // Apply updates
    if (APPLY && updates.length > 0) {
      console.log(`\nApplying ${updates.length} matches...`);
      let applied = 0;
      for (const { ids, abn, method } of updates) {
        const { error: updateError } = await db
          .from('political_donations')
          .update({
            donor_abn: abn,
            properties: db.rpc ? undefined : undefined, // Can't merge JSONB via supabase-js easily
          })
          .in('id', ids);

        if (updateError) {
          console.error(`  Error: ${updateError.message}`);
        } else {
          applied += ids.length;
        }
      }
      console.log(`  ${applied} donations updated`);
    }

    const totalMatches = phase1Matches + phase2Matches + phase3Matches;
    const totalDonationsMatched = updates.reduce((sum, u) => sum + u.ids.length, 0);

    console.log(`\n=== Summary ===`);
    console.log(`Phase 1 (exact): ${phase1Matches} names`);
    console.log(`Phase 2 (fuzzy): ${phase2Matches} names`);
    console.log(`Phase 3 (ABR):   ${phase3Matches} names`);
    console.log(`Total: ${totalMatches} names matched → ${totalDonationsMatched} donations`);
    if (!APPLY) console.log('(DRY RUN — use --apply to write changes)');

    await logComplete(db, run.id, {
      items_found: donations.length,
      items_new: totalDonationsMatched,
      items_updated: APPLY ? totalDonationsMatched : 0,
    });

  } catch (err) {
    console.error('Fatal:', err);
    await logFailed(db, run.id, err);
    process.exit(1);
  }
}

main();
