#!/usr/bin/env node
/**
 * evaluate.mjs — Fixed Evaluation Harness
 *
 * THIS FILE SHOULD NEVER BE MODIFIED BY THE AUTORESEARCH LOOP.
 * It is the "prepare.py" equivalent — defines the task, loads data, scores results.
 *
 * Usage:
 *   node scripts/benchmark/evaluate.mjs                              # run evaluation
 *   node scripts/benchmark/evaluate.mjs --task entity-resolution     # explicit task
 *   node scripts/benchmark/evaluate.mjs --verbose                    # show individual failures
 *   node scripts/benchmark/evaluate.mjs --save                       # save results to data/results/
 */

import 'dotenv/config';
import { createClient } from '@supabase/supabase-js';
import { readFileSync, writeFileSync, mkdirSync, existsSync } from 'fs';
import { dirname, join } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const DATA_DIR = join(__dirname, 'data');
const RESULTS_DIR = join(DATA_DIR, 'results');

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

const args = process.argv.slice(2);
const task = args.find(a => a.startsWith('--task='))?.split('=')[1] || 'entity-resolution';
const verbose = args.includes('--verbose');
const save = args.includes('--save');

function log(msg) {
  console.log(msg);
}

// ─── Fixed Normalization (used for index building — never changes) ───

function indexNormalize(name) {
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

// ─── Load Entity Index ───

async function loadEntityIndex() {
  log('[eval] Loading entity index from Supabase...');
  const byExact = new Map();
  const byNormalized = new Map();
  const byAlias = new Map();

  // Load entities
  let offset = 0;
  while (true) {
    const { data, error } = await supabase
      .from('gs_entities')
      .select('canonical_name, abn, entity_type, state')
      .range(offset, offset + 999);
    if (error || !data?.length) break;
    for (const e of data) {
      const upper = e.canonical_name.toUpperCase().trim();
      byExact.set(upper, e);
      const normalized = indexNormalize(e.canonical_name);
      if (normalized.length >= 3) {
        byNormalized.set(normalized, e);
      }
    }
    offset += data.length;
    if (data.length < 1000) break;
  }
  log(`[eval]   ${byExact.size} exact entries, ${byNormalized.size} normalized entries`);

  // Load aliases
  offset = 0;
  while (true) {
    const { data, error } = await supabase
      .from('gs_entity_aliases')
      .select('alias_value, entity_id')
      .range(offset, offset + 999);
    if (error || !data?.length) break;

    // We need to map entity_id back to entity data
    const entityIds = [...new Set(data.map(a => a.entity_id))];
    const { data: entities } = await supabase
      .from('gs_entities')
      .select('id, canonical_name, abn, entity_type, state')
      .in('id', entityIds);

    const entityById = new Map();
    if (entities) for (const e of entities) entityById.set(e.id, e);

    for (const alias of data) {
      const entity = entityById.get(alias.entity_id);
      if (entity && alias.alias_value) {
        byAlias.set(alias.alias_value.toUpperCase().trim(), entity);
      }
    }
    offset += data.length;
    if (data.length < 1000) break;
  }
  log(`[eval]   ${byAlias.size} alias entries`);

  return { byExact, byNormalized, byAlias };
}

// ─── Load Ground Truth ───

function loadGroundTruth() {
  const gtFile = join(DATA_DIR, `${task}-ground-truth.jsonl`);
  if (!existsSync(gtFile)) {
    console.error(`[eval] Ground truth file not found: ${gtFile}`);
    console.error(`[eval] Run: node scripts/benchmark/create-ground-truth.mjs`);
    process.exit(1);
  }

  const lines = readFileSync(gtFile, 'utf-8').trim().split('\n');
  return lines.map(line => JSON.parse(line));
}

// ─── Evaluate ───

async function main() {
  log(`\n╔══════════════════════════════════════════════════╗`);
  log(`║  GrantScope Benchmark — ${task.padEnd(24)}║`);
  log(`╚══════════════════════════════════════════════════╝\n`);

  // Load everything
  const groundTruth = loadGroundTruth();
  log(`[eval] Ground truth: ${groundTruth.length} pairs (${groundTruth.filter(g => g.label === 1).length} positive, ${groundTruth.filter(g => g.label === 0).length} negative)\n`);

  const entityIndex = await loadEntityIndex();

  // Dynamic import of the resolver (the mutable part)
  const resolverPath = `./tasks/${task}/resolve.mjs`;
  const { resolve } = await import(resolverPath);

  log(`[eval] Running resolver...\n`);

  let truePositives = 0;   // resolver matched correctly
  let falsePositives = 0;  // resolver matched incorrectly (wrong ABN or matched a negative)
  let falseNegatives = 0;  // resolver failed to match a positive
  let trueNegatives = 0;   // resolver correctly returned null for a negative
  let totalMatched = 0;

  const failures = { falsePositiveExamples: [], falseNegativeExamples: [] };

  // Confidence calibration buckets
  const calibration = {};

  for (const gt of groundTruth) {
    const result = resolve(gt.donor_name, entityIndex);
    const resolverMatched = result !== null;
    const isPositive = gt.label === 1;

    if (resolverMatched) {
      totalMatched++;

      // Bucket confidence for calibration
      const bucket = Math.round((result.confidence || 0) * 10) / 10;
      if (!calibration[bucket]) calibration[bucket] = { correct: 0, total: 0 };
      calibration[bucket].total++;

      if (isPositive) {
        // Check if the match is correct
        // Primary: ABN match. Fallback (when ground truth has no ABN): name match
        const gtHasAbn = gt.candidate_abn && gt.candidate_abn !== '0' && gt.candidate_abn !== '';
        const abnMatch = gtHasAbn && result.matched_abn === gt.candidate_abn;
        const nameMatch = !gtHasAbn && result.matched_name &&
          result.matched_name.toUpperCase().trim() === gt.candidate_name?.toUpperCase().trim();
        if (abnMatch || nameMatch) {
          truePositives++;
          calibration[bucket].correct++;
        } else {
          falsePositives++;
          failures.falsePositiveExamples.push({
            donor_name: gt.donor_name,
            expected_abn: gt.candidate_abn,
            expected_name: gt.candidate_name,
            got_abn: result.matched_abn,
            got_name: result.matched_name,
            confidence: result.confidence,
            method: result.method,
            difficulty: gt.difficulty,
          });
        }
      } else {
        // Matched a negative — false positive
        falsePositives++;
        calibration[bucket].total--; // undo the count for negatives
        failures.falsePositiveExamples.push({
          donor_name: gt.donor_name,
          expected: 'no match',
          got_abn: result.matched_abn,
          got_name: result.matched_name,
          confidence: result.confidence,
          method: result.method,
          difficulty: gt.difficulty,
        });
      }
    } else {
      // Resolver returned null
      if (isPositive) {
        falseNegatives++;
        failures.falseNegativeExamples.push({
          donor_name: gt.donor_name,
          expected_abn: gt.candidate_abn,
          expected_name: gt.candidate_name,
          difficulty: gt.difficulty,
        });
      } else {
        trueNegatives++;
      }
    }
  }

  // ─── Calculate Metrics ───
  const precision = (truePositives + falsePositives) === 0 ? 0 : truePositives / (truePositives + falsePositives);
  const positiveCount = groundTruth.filter(g => g.label === 1).length;
  const recall = positiveCount === 0 ? 0 : truePositives / positiveCount;
  const f1 = (precision + recall) === 0 ? 0 : 2 * (precision * recall) / (precision + recall);
  const matchRate = groundTruth.length === 0 ? 0 : totalMatched / groundTruth.length;
  const accuracy = groundTruth.length === 0 ? 0 : (truePositives + trueNegatives) / groundTruth.length;

  // ─── Print Results ───
  log(`┌──────────────────────────────────────┐`);
  log(`│           EVALUATION RESULTS         │`);
  log(`├──────────────────────────────────────┤`);
  log(`│  Precision:    ${(precision * 100).toFixed(1).padStart(6)}%              │`);
  log(`│  Recall:       ${(recall * 100).toFixed(1).padStart(6)}%              │`);
  log(`│  F1 Score:     ${(f1 * 100).toFixed(1).padStart(6)}%              │`);
  log(`│  Accuracy:     ${(accuracy * 100).toFixed(1).padStart(6)}%              │`);
  log(`│  Match Rate:   ${(matchRate * 100).toFixed(1).padStart(6)}%              │`);
  log(`├──────────────────────────────────────┤`);
  log(`│  True Positives:  ${String(truePositives).padStart(5)}             │`);
  log(`│  False Positives: ${String(falsePositives).padStart(5)}             │`);
  log(`│  True Negatives:  ${String(trueNegatives).padStart(5)}             │`);
  log(`│  False Negatives: ${String(falseNegatives).padStart(5)}             │`);
  log(`└──────────────────────────────────────┘`);

  // ─── Confidence Calibration ───
  log(`\nConfidence Calibration:`);
  const buckets = Object.keys(calibration).sort((a, b) => Number(b) - Number(a));
  for (const bucket of buckets) {
    const { correct, total } = calibration[bucket];
    const actual = total === 0 ? 0 : correct / total;
    const bar = '█'.repeat(Math.round(actual * 20));
    log(`  ${Number(bucket).toFixed(1)}: ${bar} ${(actual * 100).toFixed(0)}% correct (${correct}/${total})`);
  }

  // ─── Difficulty Breakdown ───
  log(`\nBy Difficulty:`);
  for (const diff of ['easy', 'medium', 'hard']) {
    const subset = groundTruth.filter(g => g.difficulty === diff);
    if (subset.length === 0) continue;

    let tp = 0, fn = 0, fp = 0;
    for (const gt of subset) {
      const result = resolve(gt.donor_name, entityIndex);
      if (gt.label === 1) {
        if (result && result.matched_abn === gt.candidate_abn) tp++;
        else if (result) fp++;
        else fn++;
      } else if (result) fp++;
    }
    const p = (tp + fp) === 0 ? 0 : tp / (tp + fp);
    const positives = subset.filter(g => g.label === 1).length;
    const r = positives === 0 ? 0 : tp / positives;
    const f = (p + r) === 0 ? 0 : 2 * (p * r) / (p + r);
    log(`  ${diff.padEnd(8)}: F1=${(f * 100).toFixed(1)}% P=${(p * 100).toFixed(1)}% R=${(r * 100).toFixed(1)}% (${subset.length} pairs)`);
  }

  // ─── Verbose: Show Failures ───
  if (verbose) {
    if (failures.falsePositiveExamples.length > 0) {
      log(`\nTop False Positives (wrong matches):`);
      for (const f of failures.falsePositiveExamples.slice(0, 20)) {
        log(`  "${f.donor_name}" → got "${f.got_name}" (${f.got_abn}) expected "${f.expected_name || f.expected}" [${f.difficulty}]`);
      }
    }
    if (failures.falseNegativeExamples.length > 0) {
      log(`\nTop False Negatives (missed matches):`);
      for (const f of failures.falseNegativeExamples.slice(0, 20)) {
        log(`  "${f.donor_name}" → expected "${f.expected_name}" (${f.expected_abn}) [${f.difficulty}]`);
      }
    }
  }

  // ─── Save Results ───
  const results = {
    task,
    timestamp: new Date().toISOString(),
    metrics: { precision, recall, f1, accuracy, matchRate },
    counts: { truePositives, falsePositives, trueNegatives, falseNegatives, totalPairs: groundTruth.length },
    calibration,
    topFalsePositives: failures.falsePositiveExamples.slice(0, 50),
    topFalseNegatives: failures.falseNegativeExamples.slice(0, 50),
  };

  if (save) {
    mkdirSync(RESULTS_DIR, { recursive: true });
    const filename = `run-${Date.now()}.json`;
    writeFileSync(join(RESULTS_DIR, filename), JSON.stringify(results, null, 2));
    log(`\nResults saved to: data/results/${filename}`);
  }

  // Always write latest.json for the dashboard/autoresearch to read
  mkdirSync(RESULTS_DIR, { recursive: true });
  writeFileSync(join(RESULTS_DIR, 'latest.json'), JSON.stringify(results, null, 2));

  // Return metrics for programmatic use
  return results;
}

// Support both CLI and import usage
const isMain = process.argv[1] && fileURLToPath(import.meta.url).endsWith(process.argv[1].replace(/.*\//, ''));
if (isMain || process.argv[1]?.endsWith('evaluate.mjs')) {
  main().catch(err => {
    console.error('[eval] Fatal:', err);
    process.exit(1);
  });
}

export { main as evaluate };
