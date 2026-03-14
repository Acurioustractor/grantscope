#!/usr/bin/env node

/**
 * Donation ABN Linker
 *
 * Backfills donor_abn on political_donations by:
 *   1. Self-join: match unlinked donor_name to already-linked donor_name+abn pairs
 *   2. Entity match: match remaining to gs_entities.canonical_name
 *   3. Fuzzy match: trigram matching for close misses
 *
 * Usage:
 *   node --env-file=.env scripts/link-donation-abns.mjs [--apply] [--phase=1|2|3]
 */

import { createClient } from '@supabase/supabase-js';

const SUPABASE_URL = process.env.SUPABASE_URL;
const SUPABASE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;
const APPLY = process.argv.includes('--apply');
const PHASE = parseInt(process.argv.find(a => a.startsWith('--phase='))?.split('=')[1] || '0');

if (!SUPABASE_URL || !SUPABASE_KEY) {
  console.error('Missing SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY');
  process.exit(1);
}

const db = createClient(SUPABASE_URL, SUPABASE_KEY);

async function main() {
  const stats = { phase1: 0, phase2: 0, phase3: 0 };

  // ── Phase 1: Self-join — match unlinked names to already-linked name+abn pairs ──
  if (PHASE === 0 || PHASE === 1) {
    console.log('Phase 1: Self-join matching...');

    // Get all known name→abn mappings from donations that DO have ABNs
    const { data: knownMappings } = await db
      .from('political_donations')
      .select('donor_name, donor_abn')
      .not('donor_abn', 'is', null)
      .not('donor_abn', 'eq', '')
      .limit(50000);

    // Build name→abn map (case-insensitive, prefer most common ABN per name)
    const nameToAbn = new Map();
    const nameAbnCounts = new Map();
    for (const row of (knownMappings || [])) {
      const key = row.donor_name.toLowerCase().trim();
      const countKey = `${key}|${row.donor_abn}`;
      nameAbnCounts.set(countKey, (nameAbnCounts.get(countKey) || 0) + 1);
    }
    // Pick the most frequent ABN for each name
    for (const [countKey, count] of nameAbnCounts) {
      const [name, abn] = countKey.split('|');
      if (!nameToAbn.has(name) || count > nameToAbn.get(name).count) {
        nameToAbn.set(name, { abn, count });
      }
    }
    console.log(`  Built ${nameToAbn.size} name→ABN mappings from existing data`);

    // Get unlinked donations
    const { data: unlinked } = await db
      .from('political_donations')
      .select('id, donor_name')
      .or('donor_abn.is.null,donor_abn.eq.')
      .limit(50000);

    let matched = 0;
    const updates = [];
    for (const row of (unlinked || [])) {
      const key = row.donor_name?.toLowerCase().trim();
      if (key && nameToAbn.has(key)) {
        matched++;
        updates.push({ id: row.id, donor_abn: nameToAbn.get(key).abn });
      }
    }

    console.log(`  Phase 1: ${matched} donations can be linked from self-join`);
    stats.phase1 = matched;

    if (APPLY && updates.length) {
      const BATCH = 500;
      for (let i = 0; i < updates.length; i += BATCH) {
        const batch = updates.slice(i, i + BATCH);
        for (const u of batch) {
          await db.from('political_donations').update({ donor_abn: u.donor_abn }).eq('id', u.id);
        }
        if (i % 5000 === 0) console.log(`    Applied ${i}/${updates.length}...`);
      }
      console.log(`    Applied ${updates.length} updates`);
    }

    // Get more if we need to paginate
    if ((unlinked || []).length === 50000) {
      console.log('  Note: More than 50K unlinked records — run again for additional batches');
    }
  }

  // ── Phase 2: Entity match — match remaining to gs_entities.canonical_name ──
  if (PHASE === 0 || PHASE === 2) {
    console.log('\nPhase 2: Entity name matching...');

    // Get distinct unlinked donor names
    const { data: unlinkedNames } = await db.rpc('exec_sql', { query: 'SELECT 1' });
    // Can't use RPC, do it client-side
    const { data: unlinked2 } = await db
      .from('political_donations')
      .select('id, donor_name')
      .or('donor_abn.is.null,donor_abn.eq.')
      .limit(50000);

    // Dedupe by name
    const nameToIds = new Map();
    for (const row of (unlinked2 || [])) {
      const name = row.donor_name?.trim();
      if (!name || name.length < 3) continue;
      if (!nameToIds.has(name)) nameToIds.set(name, []);
      nameToIds.get(name).push(row.id);
    }

    console.log(`  ${nameToIds.size} unique unlinked donor names`);

    let matched = 0;
    const SEARCH_BATCH = 20;
    const names = [...nameToIds.keys()];

    for (let i = 0; i < names.length; i += SEARCH_BATCH) {
      const batch = names.slice(i, i + SEARCH_BATCH);

      for (const name of batch) {
        // Search significant words
        const words = name.split(/\s+/).filter(w => w.length > 3 && !['pty', 'ltd', 'inc', 'the', 'and', 'for'].includes(w.toLowerCase()));
        if (!words.length) continue;

        let query = db.from('gs_entities').select('abn, canonical_name').not('abn', 'is', null).limit(5);
        for (const word of words.slice(0, 3)) {
          query = query.ilike('canonical_name', `%${word}%`);
        }

        const { data: candidates } = await query;
        if (!candidates?.length) continue;

        // Score
        const nameLower = name.toLowerCase();
        let bestMatch = null;
        let bestScore = 0;
        for (const c of candidates) {
          const score = trigramSimilarity(nameLower, c.canonical_name.toLowerCase());
          if (score > bestScore) {
            bestScore = score;
            bestMatch = c;
          }
        }

        if (bestMatch && bestScore >= 0.5) {
          matched++;
          const ids = nameToIds.get(name);
          if (APPLY) {
            for (const id of ids) {
              await db.from('political_donations').update({ donor_abn: bestMatch.abn }).eq('id', id);
            }
          }
          if (matched <= 20) {
            console.log(`    ${bestScore.toFixed(3)} | "${name}" → "${bestMatch.canonical_name}" (${bestMatch.abn}) [${ids.length} records]`);
          }
        }
      }

      if (i % 200 === 0 && i > 0) console.log(`    Processed ${i}/${names.length} names, ${matched} matched...`);
    }

    console.log(`  Phase 2: ${matched} donor names matched to entities`);
    stats.phase2 = matched;
  }

  // Summary
  const { data: finalStats } = await db
    .from('political_donations')
    .select('id', { count: 'exact', head: true });
  const { data: linkedStats } = await db
    .from('political_donations')
    .select('id', { count: 'exact', head: true })
    .not('donor_abn', 'is', null)
    .not('donor_abn', 'eq', '');

  const total = finalStats?.length ?? 0; // count is in the response
  // Use a simpler query
  console.log(`\nDone. Phase 1: ${stats.phase1}, Phase 2: ${stats.phase2}${APPLY ? ' (applied)' : ' (dry run)'}`);
}

function trigramSimilarity(a, b) {
  const tA = new Set(trigrams(a));
  const tB = new Set(trigrams(b));
  let intersection = 0;
  for (const t of tA) { if (tB.has(t)) intersection++; }
  const union = tA.size + tB.size - intersection;
  return union === 0 ? 0 : intersection / union;
}

function trigrams(s) {
  const padded = `  ${s} `;
  const result = [];
  for (let i = 0; i < padded.length - 2; i++) result.push(padded.slice(i, i + 3));
  return result;
}

main().catch(err => { console.error('Fatal:', err); process.exit(1); });
