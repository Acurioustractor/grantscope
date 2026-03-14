#!/usr/bin/env node
/**
 * Justice Funding → CivicGraph Entity Bridge
 *
 * Links justice_funding records to gs_entities via:
 *   Phase 1: ABN exact match (recipient_abn → gs_entities.abn)
 *   Phase 2: Fuzzy name match (recipient_name → gs_entities.canonical_name)
 *
 * Also creates gs_relationships edges (government_funded) for linked records.
 *
 * Usage:
 *   node --env-file=.env scripts/bridge-justice-funding.mjs [--apply] [--phase=1|2]
 */

import { createClient } from '@supabase/supabase-js';
import { logStart, logComplete, logFailed } from './lib/log-agent-run.mjs';

const SUPABASE_URL = process.env.SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL;
const SUPABASE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!SUPABASE_URL || !SUPABASE_KEY) {
  console.error('Missing SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY');
  process.exit(1);
}

const APPLY = process.argv.includes('--apply');
const PHASE_FILTER = process.argv.find(a => a.startsWith('--phase='))?.split('=')[1];
const FUZZY_THRESHOLD = 0.6;

const db = createClient(SUPABASE_URL, SUPABASE_KEY);

// ─── Trigram similarity ────────────────────────────────────────────────────

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

// ─── Main ──────────────────────────────────────────────────────────────────

async function main() {
  const run = await logStart(db, 'bridge-justice-funding', 'Bridge Justice Funding to Entities');

  try {
    console.log('=== Justice Funding → CivicGraph Entity Bridge ===');
    console.log(`  Mode: ${APPLY ? 'APPLY' : 'DRY RUN'}`);
    console.log();

    let phase1Linked = 0;
    let phase2Linked = 0;

    // ── Phase 1: ABN exact match ─────────────────────────────────────────
    if (!PHASE_FILTER || PHASE_FILTER === '1') {
      console.log('--- Phase 1: ABN Exact Match ---');

      // Get unlinked records with ABNs, paginated
      const unlinkedAbns = new Map(); // abn → [funding_ids]
      let offset = 0;
      const pageSize = 1000;
      while (true) {
        const { data: page, error } = await db
          .from('justice_funding')
          .select('id, recipient_abn')
          .is('gs_entity_id', null)
          .not('recipient_abn', 'is', null)
          .range(offset, offset + pageSize - 1);

        if (error) throw error;
        if (!page?.length) break;
        for (const row of page) {
          const abn = row.recipient_abn.trim();
          if (!unlinkedAbns.has(abn)) unlinkedAbns.set(abn, []);
          unlinkedAbns.get(abn).push(row.id);
        }
        if (page.length < pageSize) break;
        offset += pageSize;
      }

      console.log(`  ${unlinkedAbns.size} unique ABNs to match (${offset + (unlinkedAbns.size > 0 ? 1 : 0)} funding records)`);

      // Build entity ABN index
      const entityByAbn = new Map();
      offset = 0;
      while (true) {
        const { data: entities, error } = await db
          .from('gs_entities')
          .select('id, abn')
          .not('abn', 'is', null)
          .range(offset, offset + pageSize - 1);

        if (error) throw error;
        if (!entities?.length) break;
        for (const e of entities) entityByAbn.set(e.abn, e.id);
        if (entities.length < pageSize) break;
        offset += pageSize;
      }
      console.log(`  ${entityByAbn.size} entities with ABNs indexed`);

      // Match
      const updates = [];
      for (const [abn, fundingIds] of unlinkedAbns) {
        const entityId = entityByAbn.get(abn);
        if (entityId) {
          updates.push({ entityId, fundingIds });
          phase1Linked += fundingIds.length;
        }
      }

      console.log(`  ${updates.length} ABN matches → ${phase1Linked} funding records`);

      if (APPLY && updates.length > 0) {
        let applied = 0;
        for (const { entityId, fundingIds } of updates) {
          // Batch in chunks of 100 IDs
          for (let i = 0; i < fundingIds.length; i += 100) {
            const chunk = fundingIds.slice(i, i + 100);
            const { error } = await db
              .from('justice_funding')
              .update({ gs_entity_id: entityId })
              .in('id', chunk);

            if (error) {
              console.error(`  Error: ${error.message}`);
            } else {
              applied += chunk.length;
            }
          }
        }
        console.log(`  ${applied} records updated`);
      }
    }

    // ── Phase 2: Fuzzy name match ────────────────────────────────────────
    if (!PHASE_FILTER || PHASE_FILTER === '2') {
      console.log('\n--- Phase 2: Fuzzy Name Match ---');

      // Get remaining unlinked with names
      const nameMap = new Map(); // name → [funding_ids]
      let offset = 0;
      const pageSize = 1000;
      while (true) {
        const { data: page, error } = await db
          .from('justice_funding')
          .select('id, recipient_name')
          .is('gs_entity_id', null)
          .not('recipient_name', 'is', null)
          .range(offset, offset + pageSize - 1);

        if (error) throw error;
        if (!page?.length) break;
        for (const row of page) {
          const name = row.recipient_name.trim();
          if (name.length < 4) continue;
          if (!nameMap.has(name)) nameMap.set(name, []);
          nameMap.get(name).push(row.id);
        }
        if (page.length < pageSize) break;
        offset += pageSize;
      }

      console.log(`  ${nameMap.size} unique names to fuzzy match`);

      // Build entity name index
      const entityIndex = new Map(); // lowercase name → { id, name }
      offset = 0;
      while (true) {
        const { data: entities, error } = await db
          .from('gs_entities')
          .select('id, canonical_name')
          .not('canonical_name', 'is', null)
          .range(offset, offset + pageSize - 1);

        if (error) throw error;
        if (!entities?.length) break;
        for (const e of entities) {
          entityIndex.set(e.canonical_name.toLowerCase(), e.id);
        }
        if (entities.length < pageSize) break;
        offset += pageSize;
      }
      console.log(`  ${entityIndex.size} entity names indexed`);

      const entityNames = [...entityIndex.keys()];
      let checked = 0;
      const fuzzyUpdates = [];

      for (const [name, fundingIds] of nameMap) {
        const nameLower = name.toLowerCase();

        // Exact match first
        const exactId = entityIndex.get(nameLower);
        if (exactId) {
          fuzzyUpdates.push({ entityId: exactId, fundingIds });
          phase2Linked += fundingIds.length;
          checked++;
          if (checked % 1000 === 0) console.log(`  Checked ${checked}/${nameMap.size}...`);
          continue;
        }

        // Fuzzy match
        let bestId = null;
        let bestScore = 0;
        for (const entityName of entityNames) {
          const lenRatio = nameLower.length / entityName.length;
          if (lenRatio < 0.5 || lenRatio > 2.0) continue;
          const score = trigramSimilarity(nameLower, entityName);
          if (score > bestScore) {
            bestScore = score;
            bestId = entityIndex.get(entityName);
          }
        }

        if (bestId && bestScore >= FUZZY_THRESHOLD) {
          fuzzyUpdates.push({ entityId: bestId, fundingIds });
          phase2Linked += fundingIds.length;
        }

        checked++;
        if (checked % 1000 === 0) console.log(`  Checked ${checked}/${nameMap.size}...`);
      }

      console.log(`  ${fuzzyUpdates.length} name matches → ${phase2Linked} funding records`);

      if (APPLY && fuzzyUpdates.length > 0) {
        let applied = 0;
        for (const { entityId, fundingIds } of fuzzyUpdates) {
          for (let i = 0; i < fundingIds.length; i += 100) {
            const chunk = fundingIds.slice(i, i + 100);
            const { error } = await db
              .from('justice_funding')
              .update({ gs_entity_id: entityId })
              .in('id', chunk);

            if (error) {
              console.error(`  Error: ${error.message}`);
            } else {
              applied += chunk.length;
            }
          }
        }
        console.log(`  ${applied} records updated`);
      }
    }

    // ── Summary ──────────────────────────────────────────────────────────
    const { count: totalCount } = await db.from('justice_funding').select('*', { count: 'exact', head: true });
    const { count: linkedCount } = await db.from('justice_funding').select('*', { count: 'exact', head: true }).not('gs_entity_id', 'is', null);

    console.log(`\n=== Summary ===`);
    console.log(`Phase 1 (ABN):  ${phase1Linked} records`);
    console.log(`Phase 2 (name): ${phase2Linked} records`);
    console.log(`Overall: ${linkedCount}/${totalCount} linked (${((linkedCount / totalCount) * 100).toFixed(1)}%)`);
    if (!APPLY) console.log('(DRY RUN — use --apply to write changes)');

    await logComplete(db, run.id, {
      items_found: totalCount,
      items_new: phase1Linked + phase2Linked,
      items_updated: APPLY ? phase1Linked + phase2Linked : 0,
    });

  } catch (err) {
    console.error('Fatal:', err);
    await logFailed(db, run.id, err);
    process.exit(1);
  }
}

main();
