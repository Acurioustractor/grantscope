#!/usr/bin/env node
// Backfill remoteness for gs_entities using postcode_geo lookup
// Uses session pooler (port 6543) which allows SET statement_timeout

import 'dotenv/config';
import { execSync } from 'child_process';

const DRY_RUN = !process.argv.includes('--apply');

// Use session pooler (port 6543) on the correct region — allows SET statement_timeout
const pw = process.env.DATABASE_PASSWORD;
if (!pw) { console.error('Missing DATABASE_PASSWORD'); process.exit(1); }
const CONN = `postgresql://postgres.tednluwflfhxyucgwigh:${pw}@aws-0-ap-southeast-2.pooler.supabase.com:6543/postgres`;

function psql(sql, timeout = 600000) {
  const oneLine = sql.replace(/\s+/g, ' ').trim();
  // Combine SET + query in single command to avoid session reset between -c calls
  const combined = `SET statement_timeout = '600s'; ${oneLine}`;
  const cmd = `psql "${CONN}" -t -A -c ${JSON.stringify(combined)}`;
  return execSync(cmd, { encoding: 'utf8', timeout }).trim();
}

console.log(DRY_RUN ? '🔍 DRY RUN (use --apply to write)' : '✏️  APPLYING CHANGES');

// 1. Build postcode → remoteness lookup
console.log('\nLoading postcode_geo remoteness...');
const raw = psql(`SELECT postcode || '|' || remoteness_2021 FROM (SELECT DISTINCT ON (postcode) postcode, remoteness_2021 FROM postcode_geo WHERE remoteness_2021 IS NOT NULL ORDER BY postcode, remoteness_2021) t`);
const lookup = new Map();
for (const line of raw.split('\n')) {
  const [pc, rem] = line.split('|');
  if (pc && rem) lookup.set(pc, rem);
}
console.log(`  ${lookup.size} postcodes with remoteness`);

// 2. Get distinct postcodes of entities needing fill
console.log('Finding entity postcodes missing remoteness...');
const pcRaw = psql(`SELECT postcode || '|' || count(*) FROM gs_entities WHERE remoteness IS NULL AND postcode IS NOT NULL GROUP BY postcode ORDER BY count(*) DESC`, 300000);
const entityPostcodes = [];
for (const line of pcRaw.split('\n')) {
  const [postcode, cnt] = line.split('|');
  if (postcode && cnt) entityPostcodes.push({ postcode, cnt: parseInt(cnt) });
}

let fillable = 0, unfillable = 0;
const unmatchedTop = [];
for (const { postcode, cnt } of entityPostcodes) {
  if (lookup.has(postcode)) {
    fillable += cnt;
  } else {
    unfillable += cnt;
    if (unmatchedTop.length < 10) unmatchedTop.push({ postcode, cnt });
  }
}

console.log(`\n  ✅ ${fillable} entities can be filled`);
console.log(`  ❌ ${unfillable} entities have postcodes not in lookup`);

if (unmatchedTop.length > 0) {
  console.log('\n  Top unmatched postcodes:');
  unmatchedTop.forEach(({ postcode, cnt }) => console.log(`    ${postcode}: ${cnt} entities`));
}

if (DRY_RUN) {
  console.log('\nRun with --apply to update.');
  process.exit(0);
}

// 3. Update — one SQL per remoteness category (few distinct values)
const byRemoteness = {};
for (const { postcode } of entityPostcodes) {
  const rem = lookup.get(postcode);
  if (rem) (byRemoteness[rem] ??= []).push(postcode);
}

let updated = 0;
for (const [remoteness, postcodes] of Object.entries(byRemoteness)) {
  const pcList = postcodes.map(p => `'${p}'`).join(',');
  const result = psql(`UPDATE gs_entities SET remoteness = '${remoteness}' WHERE postcode IN (${pcList}) AND remoteness IS NULL`, 300000);
  const match = result.match(/UPDATE (\d+)/);
  const n = match ? parseInt(match[1]) : 0;
  updated += n;
  console.log(`  ${remoteness}: ${n} entities updated (${postcodes.length} postcodes)`);
}

console.log(`\n✅ Done. Updated ${updated} entities with remoteness.`);
