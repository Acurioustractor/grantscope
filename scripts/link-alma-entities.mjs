#!/usr/bin/env node

/**
 * ALMA Entity Linker — fuzzy matches alma_interventions to gs_entities
 *
 * Strategy:
 *   1. Get all unlinked ALMA orgs
 *   2. For each, search gs_entities using ILIKE with key words
 *   3. Score candidates with pg_trgm similarity()
 *   4. Link if similarity > threshold
 *
 * Usage:
 *   node --env-file=.env scripts/link-alma-entities.mjs [--apply] [--threshold=0.35]
 */

import { createClient } from '@supabase/supabase-js';

const SUPABASE_URL = process.env.SUPABASE_URL;
const SUPABASE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;
const APPLY = process.argv.includes('--apply');
const THRESHOLD = parseFloat(process.argv.find(a => a.startsWith('--threshold='))?.split('=')[1] || '0.35');

if (!SUPABASE_URL || !SUPABASE_KEY) {
  console.error('Missing SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY');
  process.exit(1);
}

const db = createClient(SUPABASE_URL, SUPABASE_KEY);

async function main() {
  // 1. Get unlinked ALMA orgs
  const { data: unlinked } = await db
    .from('alma_interventions')
    .select('id, operating_organization')
    .is('gs_entity_id', null)
    .not('operating_organization', 'is', null)
    .not('operating_organization', 'like', 'http%');

  if (!unlinked?.length) {
    console.log('All ALMA interventions already linked.');
    return;
  }

  // Dedupe by org name
  const orgMap = new Map();
  for (const row of unlinked) {
    const org = row.operating_organization?.trim();
    if (!org || org.length < 4) continue;
    if (!orgMap.has(org)) orgMap.set(org, []);
    orgMap.get(org).push(row.id);
  }

  console.log(`${orgMap.size} unique unlinked organizations (${unlinked.length} interventions)`);

  let matched = 0;
  let linked = 0;
  let skipped = 0;
  const results = [];

  for (const [orgName, interventionIds] of orgMap) {
    // 2. Build search terms — use significant words
    const stopWords = new Set(['the', 'and', 'for', 'with', 'from', 'that', 'this', 'department', 'government']);
    const words = orgName.split(/[^a-zA-Z]+/).filter(w => w.length > 3 && !stopWords.has(w.toLowerCase()));
    if (!words.length) { skipped++; continue; }

    // Try multiple search strategies and combine candidates
    const allCandidates = new Map();

    // Strategy 1: Full org name ILIKE
    const { data: c1 } = await db
      .from('gs_entities')
      .select('id, canonical_name, gs_id, abn')
      .ilike('canonical_name', `%${words[0]}%`)
      .limit(20);
    for (const c of c1 || []) allCandidates.set(c.id, c);

    // Strategy 2: If >1 word, try first two words together
    if (words.length > 1) {
      const { data: c2 } = await db
        .from('gs_entities')
        .select('id, canonical_name, gs_id, abn')
        .ilike('canonical_name', `%${words[0]}%`)
        .ilike('canonical_name', `%${words[1]}%`)
        .limit(20);
      for (const c of c2 || []) allCandidates.set(c.id, c);
    }

    const candidates = [...allCandidates.values()];
    if (!candidates?.length) { skipped++; continue; }

    // 3. Score with local similarity (simple trigram approximation)
    const orgLower = orgName.toLowerCase();
    let bestMatch = null;
    let bestScore = 0;

    for (const candidate of candidates) {
      const candLower = candidate.canonical_name.toLowerCase();
      const score = trigramSimilarity(orgLower, candLower);
      if (score > bestScore) {
        bestScore = score;
        bestMatch = candidate;
      }
    }

    if (bestMatch && bestScore >= THRESHOLD) {
      matched++;
      results.push({
        org: orgName,
        match: bestMatch.canonical_name,
        gs_id: bestMatch.gs_id,
        score: bestScore.toFixed(3),
        interventions: interventionIds.length,
      });

      if (APPLY) {
        // 4. Link all interventions for this org
        const { error } = await db
          .from('alma_interventions')
          .update({ gs_entity_id: bestMatch.id })
          .in('id', interventionIds);

        if (error) {
          console.error(`  Error linking "${orgName}": ${error.message}`);
        } else {
          linked += interventionIds.length;
        }
      }
    } else {
      skipped++;
    }
  }

  // Print results sorted by score
  results.sort((a, b) => b.score - a.score);
  console.log('\n--- Top Matches ---');
  for (const r of results.slice(0, 50)) {
    console.log(`  ${r.score} | "${r.org}" → "${r.match}" (${r.gs_id}) [${r.interventions} interventions]`);
  }

  if (results.length > 50) {
    console.log(`  ... and ${results.length - 50} more`);
  }

  console.log(`\nSummary: ${matched} orgs matched, ${linked} interventions linked${APPLY ? '' : ' (dry run)'}, ${skipped} skipped`);

  // Final stats
  const { data: stats } = await db.rpc('exec_sql', {
    query: "SELECT COUNT(*) as total, COUNT(gs_entity_id) as linked FROM alma_interventions"
  }).single();

  if (stats) {
    // Use direct query instead
  }
  const { count: totalCount } = await db.from('alma_interventions').select('*', { count: 'exact', head: true });
  const { count: linkedCount } = await db.from('alma_interventions').select('*', { count: 'exact', head: true }).not('gs_entity_id', 'is', null);
  console.log(`\nOverall: ${linkedCount}/${totalCount} interventions linked (${((linkedCount / totalCount) * 100).toFixed(1)}%)`);
}

/**
 * Simple trigram similarity — approximates pg_trgm's similarity()
 */
function trigramSimilarity(a, b) {
  const trigramsA = new Set(trigrams(a));
  const trigramsB = new Set(trigrams(b));
  let intersection = 0;
  for (const t of trigramsA) {
    if (trigramsB.has(t)) intersection++;
  }
  const union = trigramsA.size + trigramsB.size - intersection;
  return union === 0 ? 0 : intersection / union;
}

function trigrams(s) {
  const padded = `  ${s} `;
  const result = [];
  for (let i = 0; i < padded.length - 2; i++) {
    result.push(padded.slice(i, i + 3));
  }
  return result;
}

main().catch(err => {
  console.error('Fatal:', err);
  process.exit(1);
});
