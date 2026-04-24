#!/usr/bin/env node
// Backfill remoteness for gs_entities using the official ABS
// "Postcode 2022 to Remoteness Area 2021" correspondence file.
//
// This replaces the old loop-based approach that was causing CPU thrashing.
// Strategy: 5 simple UPDATE WHERE postcode IN (...) statements, one per
// remoteness category. Each touches ~5-10K rows max. No loops, no batching.
//
// Usage:
//   node scripts/backfill-remoteness-from-abs.mjs           # dry run
//   node scripts/backfill-remoteness-from-abs.mjs --apply   # write to DB

import 'dotenv/config';
import { readFileSync } from 'fs';
import { execSync } from 'child_process';
import { parse } from 'csv-parse/sync';

const DRY_RUN = !process.argv.includes('--apply');
const CSV_PATH = process.argv.find(a => a.endsWith('.csv'))
  || 'data/abs/CG_POSTCODE_2022_RA_2021.csv';

// --- 1. Load ABS postcode → remoteness mapping ---
console.log(`Loading ABS data from ${CSV_PATH}...`);
const raw = readFileSync(CSV_PATH, 'utf8');
const records = parse(raw, { columns: true, skip_empty_lines: true });

const SKIP = ['Migratory', 'No usual', 'Outside'];
const best = new Map(); // postcode → { ratio, remoteness }

for (const row of records) {
  const ra = row.RA_NAME_2021;
  if (!ra || SKIP.some(s => ra.includes(s))) continue;
  const pc = row.POSTCODE.padStart(4, '0');
  const ratio = parseFloat(row.RATIO_FROM_TO);
  const prev = best.get(pc);
  if (!prev || ratio > prev.ratio) {
    best.set(pc, { ratio, remoteness: ra });
  }
}
console.log(`  ${best.size} postcodes with remoteness`);

// --- 2. Group by remoteness category ---
const byCategory = {};
for (const [pc, { remoteness }] of best) {
  (byCategory[remoteness] ??= []).push(pc);
}

// --- 3. Check what needs filling ---
const pw = process.env.DATABASE_PASSWORD;
if (!pw) { console.error('Missing DATABASE_PASSWORD'); process.exit(1); }
const CONN = `postgresql://postgres.tednluwflfhxyucgwigh:${pw}@aws-0-ap-southeast-2.pooler.supabase.com:5432/postgres`;

function psql(sql, timeout = 120000) {
  const cmd = `psql "${CONN}" -t -A -c ${JSON.stringify(sql)}`;
  return execSync(cmd, { encoding: 'utf8', timeout, maxBuffer: 200 * 1024 * 1024 }).trim();
}

console.log('\nChecking current gaps...');
const gapCount = psql("SELECT count(*) FROM gs_entities WHERE remoteness IS NULL AND postcode IS NOT NULL");
console.log(`  ${gapCount} entities missing remoteness (with postcode)`);

if (DRY_RUN) {
  console.log('\n🔍 DRY RUN — showing what would be updated:\n');
  for (const [remoteness, postcodes] of Object.entries(byCategory).sort()) {
    const pcList = postcodes.map(p => `'${p}'`).join(',');
    const count = psql(`SELECT count(*) FROM gs_entities WHERE remoteness IS NULL AND postcode IN (${pcList})`);
    console.log(`  ${remoteness}: ${count} entities (${postcodes.length} postcodes)`);
  }
  console.log('\nRun with --apply to update.');
  process.exit(0);
}

// --- 4. Apply updates — one per category ---
console.log('\n✏️  Applying updates...\n');
let totalUpdated = 0;

for (const [remoteness, postcodes] of Object.entries(byCategory).sort()) {
  const pcList = postcodes.map(p => `'${p}'`).join(',');
  const sql = `UPDATE gs_entities SET remoteness = '${remoteness}' WHERE remoteness IS NULL AND postcode IN (${pcList})`;
  const result = psql(sql, 300000);
  const match = result.match(/UPDATE (\d+)/);
  const n = match ? parseInt(match[1]) : 0;
  totalUpdated += n;
  console.log(`  ${remoteness}: ${n} entities updated`);
}

console.log(`\n✅ Done. Updated ${totalUpdated} entities.`);

// Final gap check
const remaining = psql("SELECT count(*) FROM gs_entities WHERE remoteness IS NULL AND postcode IS NOT NULL");
console.log(`  Remaining gap: ${remaining} entities without remoteness (postcode exists but no ABS match)`);
