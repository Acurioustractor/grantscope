#!/usr/bin/env node
/**
 * create-ground-truth.mjs
 *
 * Generates a labeled dataset for entity resolution evaluation.
 *
 * Sources:
 * 1. Positive (label=1): Exact ABN matches from donor_entity_matches (confidence 1.0)
 * 2. Negative (label=0): Similar names with different ABNs (confusable) + random pairs
 * 3. Hard cases: Normalized matches (confidence 0.85) exported for manual review
 *
 * Output: scripts/benchmark/data/entity-resolution-ground-truth.jsonl
 *
 * Usage:
 *   node scripts/benchmark/create-ground-truth.mjs
 *   node scripts/benchmark/create-ground-truth.mjs --export-hard-cases  # also export CSV for manual labeling
 */

import 'dotenv/config';
import { createClient } from '@supabase/supabase-js';
import { writeFileSync, mkdirSync } from 'fs';
import { dirname, join } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const DATA_DIR = join(__dirname, 'data');
const OUTPUT_FILE = join(DATA_DIR, 'entity-resolution-ground-truth.jsonl');
const HARD_CASES_CSV = join(DATA_DIR, 'hard-cases-for-review.csv');

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

const args = process.argv.slice(2);
const exportHardCases = args.includes('--export-hard-cases');

function log(msg) {
  console.log(`[ground-truth] ${msg}`);
}

/** Paginate through a Supabase query */
async function paginate(table, select, filters = {}, limit = 1000) {
  const results = [];
  let offset = 0;
  while (true) {
    let query = supabase.from(table).select(select).range(offset, offset + limit - 1);
    if (filters.eq) for (const [col, val] of Object.entries(filters.eq)) query = query.eq(col, val);
    if (filters.not) for (const [col, op, val] of filters.not) query = query.not(col, op, val);
    if (filters.gte) for (const [col, val] of Object.entries(filters.gte)) query = query.gte(col, val);
    if (filters.order) query = query.order(filters.order.col, { ascending: filters.order.asc ?? true });
    if (filters.limit) query = query.limit(filters.limit);
    const { data, error } = await query;
    if (error) { log(`  Error: ${error.message}`); break; }
    if (!data?.length) break;
    results.push(...data);
    if (data.length < limit || (filters.limit && results.length >= filters.limit)) break;
    offset += data.length;
  }
  return results;
}

function normalizeName(name) {
  return name
    .toUpperCase()
    .replace(/\s+/g, ' ')
    .replace(/\bPTY\b\.?\s*/g, '')
    .replace(/\bLTD\b\.?\s*/g, '')
    .replace(/\bLIMITED\b/g, '')
    .replace(/\bINC\b\.?\s*/g, '')
    .replace(/\bCO\b\.?\s*/g, '')
    .replace(/\bTHE\b\s+/g, '')
    .replace(/\bATF\b\s+.*/g, '')
    .replace(/\bAS TRUSTEE FOR\b.*/gi, '')
    .replace(/\bTRUSTEE\b.*/gi, '')
    .replace(/[^A-Z0-9\s]/g, '')
    .replace(/\s+/g, ' ')
    .trim();
}

/** Simple trigram similarity for finding confusable names */
function trigrams(s) {
  const padded = `  ${s.toLowerCase()}  `;
  const set = new Set();
  for (let i = 0; i < padded.length - 2; i++) set.add(padded.slice(i, i + 3));
  return set;
}

function trigramSimilarity(a, b) {
  const ta = trigrams(a);
  const tb = trigrams(b);
  let intersection = 0;
  for (const t of ta) if (tb.has(t)) intersection++;
  const union = ta.size + tb.size - intersection;
  return union === 0 ? 0 : intersection / union;
}

async function main() {
  mkdirSync(DATA_DIR, { recursive: true });

  const groundTruth = [];

  // ─── 1. Positive matches: exact ABN matches (high confidence) ───
  log('Loading exact ABN matches (positives)...');
  const exactMatches = await paginate('donor_entity_matches', 'donor_name, matched_abn, matched_entity_name, match_method, match_confidence', {
    eq: { match_method: 'exact' },
  });
  log(`  Found ${exactMatches.length} exact matches`);

  // Sample up to 500 exact matches as positive examples
  const shuffledExact = exactMatches.sort(() => Math.random() - 0.5);
  const positiveExact = shuffledExact.slice(0, 500);

  for (const m of positiveExact) {
    groundTruth.push({
      donor_name: m.donor_name,
      candidate_abn: m.matched_abn,
      candidate_name: m.matched_entity_name,
      label: 1,
      source: 'exact_abn',
      difficulty: 'easy',
      original_confidence: Number(m.match_confidence),
    });
  }
  log(`  Added ${positiveExact.length} exact positive pairs`);

  // ─── 2. Positive matches: normalized matches (medium confidence) ───
  log('Loading normalized matches (positives, medium difficulty)...');
  const normalizedMatches = await paginate('donor_entity_matches', 'donor_name, matched_abn, matched_entity_name, match_method, match_confidence', {
    eq: { match_method: 'normalized' },
  });
  log(`  Found ${normalizedMatches.length} normalized matches`);

  const shuffledNorm = normalizedMatches.sort(() => Math.random() - 0.5);
  const positiveNorm = shuffledNorm.slice(0, Math.min(300, normalizedMatches.length));

  for (const m of positiveNorm) {
    groundTruth.push({
      donor_name: m.donor_name,
      candidate_abn: m.matched_abn,
      candidate_name: m.matched_entity_name,
      label: 1,
      source: 'normalized',
      difficulty: 'medium',
      original_confidence: Number(m.match_confidence),
    });
  }
  log(`  Added ${positiveNorm.length} normalized positive pairs`);

  // ─── 3. Negative matches: confusable names (similar but different ABNs) ───
  log('Building confusable negatives...');

  // Load a sample of entities with ABNs for negative pair generation
  const entitiesWithAbn = await paginate('gs_entities', 'canonical_name, abn, entity_type', {
    not: [['abn', 'is', null]],
    limit: 5000,
  });
  log(`  Loaded ${entitiesWithAbn.length} entities with ABNs`);

  // For each exact match, find a confusable entity with a DIFFERENT ABN
  const confusableNegatives = [];
  const matchedNames = positiveExact.slice(0, 200); // Use first 200 for confusable search

  for (const m of matchedNames) {
    if (confusableNegatives.length >= 300) break;

    let bestSim = 0;
    let bestEntity = null;

    for (const e of entitiesWithAbn) {
      if (e.abn === m.matched_abn) continue; // Same entity, skip
      const sim = trigramSimilarity(m.donor_name, e.canonical_name);
      if (sim > bestSim && sim > 0.3 && sim < 0.9) {
        bestSim = sim;
        bestEntity = e;
      }
    }

    if (bestEntity) {
      confusableNegatives.push({
        donor_name: m.donor_name,
        candidate_abn: bestEntity.abn,
        candidate_name: bestEntity.canonical_name,
        label: 0,
        source: 'confusable',
        difficulty: bestSim > 0.6 ? 'hard' : 'medium',
        trigram_similarity: Math.round(bestSim * 1000) / 1000,
      });
    }
  }
  log(`  Generated ${confusableNegatives.length} confusable negative pairs`);
  groundTruth.push(...confusableNegatives);

  // ─── 4. Negative matches: random pairs (easy negatives) ───
  log('Generating random negative pairs...');
  const randomNegatives = [];
  const entityList = entitiesWithAbn.sort(() => Math.random() - 0.5);

  for (let i = 0; i < 200 && i < entityList.length - 1; i++) {
    const donor = positiveExact[i % positiveExact.length];
    const randomEntity = entityList[i];
    if (randomEntity.abn === donor.matched_abn) continue;

    randomNegatives.push({
      donor_name: donor.donor_name,
      candidate_abn: randomEntity.abn,
      candidate_name: randomEntity.canonical_name,
      label: 0,
      source: 'random',
      difficulty: 'easy',
    });
  }
  groundTruth.push(...randomNegatives);
  log(`  Added ${randomNegatives.length} random negative pairs`);

  // ─── 5. Write ground truth JSONL ───
  const lines = groundTruth.map(g => JSON.stringify(g));
  writeFileSync(OUTPUT_FILE, lines.join('\n') + '\n');

  const positiveCount = groundTruth.filter(g => g.label === 1).length;
  const negativeCount = groundTruth.filter(g => g.label === 0).length;
  log(`\nGround truth written to: ${OUTPUT_FILE}`);
  log(`  Total pairs: ${groundTruth.length}`);
  log(`  Positives: ${positiveCount}`);
  log(`  Negatives: ${negativeCount}`);
  log(`  Difficulty: ${groundTruth.filter(g => g.difficulty === 'easy').length} easy, ${groundTruth.filter(g => g.difficulty === 'medium').length} medium, ${groundTruth.filter(g => g.difficulty === 'hard').length} hard`);

  // ─── 6. Export hard cases for manual review ───
  if (exportHardCases) {
    log('\nExporting hard cases for manual review...');

    // Get unmatched donors with high donation counts (worth resolving)
    const { data: unmatchedDonors } = await supabase
      .from('political_donations')
      .select('donor_name')
      .or('donor_abn.is.null,donor_abn.eq.')
      .limit(2000);

    if (unmatchedDonors?.length) {
      // Count donations per donor
      const donorCounts = new Map();
      for (const d of unmatchedDonors) {
        if (!d.donor_name) continue;
        donorCounts.set(d.donor_name, (donorCounts.get(d.donor_name) || 0) + 1);
      }

      // Sort by frequency, take top 100
      const topUnmatched = [...donorCounts.entries()]
        .sort((a, b) => b[1] - a[1])
        .slice(0, 100);

      const csvLines = ['donor_name,donation_count,candidate_1_name,candidate_1_abn,candidate_1_similarity,candidate_2_name,candidate_2_abn,candidate_2_similarity,candidate_3_name,candidate_3_abn,candidate_3_similarity,correct_abn,label'];

      for (const [donorName, count] of topUnmatched) {
        // Find top 3 candidates by trigram similarity
        const candidates = entitiesWithAbn
          .map(e => ({ ...e, sim: trigramSimilarity(donorName, e.canonical_name) }))
          .filter(e => e.sim > 0.2)
          .sort((a, b) => b.sim - a.sim)
          .slice(0, 3);

        const row = [
          `"${donorName.replace(/"/g, '""')}"`,
          count,
        ];

        for (let i = 0; i < 3; i++) {
          if (candidates[i]) {
            row.push(
              `"${candidates[i].canonical_name.replace(/"/g, '""')}"`,
              candidates[i].abn || '',
              candidates[i].sim.toFixed(3)
            );
          } else {
            row.push('', '', '');
          }
        }
        row.push('', ''); // correct_abn, label (for human to fill)
        csvLines.push(row.join(','));
      }

      writeFileSync(HARD_CASES_CSV, csvLines.join('\n') + '\n');
      log(`  Exported ${topUnmatched.length} hard cases to: ${HARD_CASES_CSV}`);
    }
  }
}

main().catch(err => {
  console.error('[ground-truth] Fatal:', err);
  process.exit(1);
});
