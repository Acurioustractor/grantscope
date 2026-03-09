#!/usr/bin/env node
/**
 * enrich-lga.mjs — Enrich postcode_geo and gs_entities with LGA data
 *
 * Data source: Matthew Proctor Australian Postcodes Database
 * https://www.matthewproctor.com/australian_postcodes
 *
 * Usage:
 *   node --env-file=.env scripts/enrich-lga.mjs              # dry run
 *   node --env-file=.env scripts/enrich-lga.mjs --apply       # apply changes
 */
import { createClient } from '@supabase/supabase-js';
import { readFileSync } from 'fs';
import { parse } from 'csv-parse/sync';
import { execSync } from 'child_process';

const DRY_RUN = !process.argv.includes('--apply');
const CSV_PATH = 'data/lga/australian_postcodes.csv';

const supabase = createClient(
  process.env.SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

async function sql(query) {
  const { data, error } = await supabase.rpc('exec_sql', { query });
  if (error) throw new Error(`SQL: ${error.message}`);
  return data;
}

function psql(query) {
  const dbPassword = process.env.DATABASE_PASSWORD;
  return execSync(
    `psql -h aws-0-ap-southeast-2.pooler.supabase.com -p 5432 -U "postgres.tednluwflfhxyucgwigh" -d postgres -c "${query.replace(/"/g, '\\"')}"`,
    { env: { ...process.env, PGPASSWORD: dbPassword }, encoding: 'utf8', timeout: 120000, stdio: ['pipe', 'pipe', 'pipe'] }
  ).trim();
}

// Load CSV and build postcode → LGA lookup
console.log('\n  LGA Enrichment\n');

const raw = readFileSync(CSV_PATH, 'utf8');
const records = parse(raw, { columns: true, skip_empty_lines: true });

// Build postcode → {lga_name, lga_code} map
// One postcode can have multiple localities — pick the most common LGA
const postcodeEntries = {};
for (const row of records) {
  const pc = row.postcode?.trim();
  const lgaName = row.lgaregion?.trim();
  const lgaCode = row.lgacode?.trim();
  if (!pc || !lgaName || lgaName === '') continue;

  if (!postcodeEntries[pc]) postcodeEntries[pc] = {};
  const key = `${lgaName}|${lgaCode}`;
  postcodeEntries[pc][key] = (postcodeEntries[pc][key] || 0) + 1;
}

// Resolve to most common LGA per postcode
const lgaMap = {};
for (const [pc, counts] of Object.entries(postcodeEntries)) {
  const best = Object.entries(counts).sort((a, b) => b[1] - a[1])[0][0];
  const [name, code] = best.split('|');
  lgaMap[pc] = { name, code };
}

console.log(`  Loaded ${Object.keys(lgaMap).length} postcodes with LGA data`);

// Check current state
const pgRows = await sql("SELECT COUNT(*) as cnt FROM postcode_geo WHERE lga_name IS NOT NULL");
const entityRows = await sql("SELECT COUNT(*) as cnt FROM gs_entities WHERE lga_name IS NOT NULL");
console.log(`  Current: ${pgRows[0].cnt} postcode_geo with LGA, ${entityRows[0].cnt} entities with LGA`);

if (DRY_RUN) {
  // Count how many we'd fill
  const pgMissing = await sql("SELECT COUNT(*) as cnt FROM postcode_geo WHERE lga_name IS NULL");
  const entMissing = await sql("SELECT COUNT(*) as cnt FROM gs_entities WHERE lga_name IS NULL AND postcode IS NOT NULL");
  console.log(`  Would fill: ~${pgMissing[0].cnt} postcode_geo, ~${entMissing[0].cnt} entities`);
  console.log('\n  DRY RUN — pass --apply to execute\n');
  process.exit(0);
}

// Step 1: Update postcode_geo
console.log('  Updating postcode_geo...');
let pgUpdated = 0;
const BATCH_SIZE = 200;
const postcodes = Object.keys(lgaMap);

for (let i = 0; i < postcodes.length; i += BATCH_SIZE) {
  const batch = postcodes.slice(i, i + BATCH_SIZE);
  const cases_name = batch.map(pc => `WHEN '${pc}' THEN '${lgaMap[pc].name.replace(/'/g, "''")}'`).join(' ');
  const cases_code = batch.map(pc => `WHEN '${pc}' THEN '${lgaMap[pc].code}'`).join(' ');
  const inList = batch.map(pc => `'${pc}'`).join(',');

  const result = psql(
    `UPDATE postcode_geo SET lga_name = CASE postcode ${cases_name} END, lga_code = CASE postcode ${cases_code} END WHERE postcode IN (${inList}) AND lga_name IS NULL`
  );
  const match = result.match(/UPDATE (\d+)/);
  if (match) pgUpdated += parseInt(match[1]);

  if ((i / BATCH_SIZE) % 5 === 0) process.stdout.write(`\r  postcode_geo: ${pgUpdated} updated (${i + batch.length}/${postcodes.length} checked)`);
}
console.log(`\r  postcode_geo: ${pgUpdated} updated                                    `);

// Step 2: Backfill gs_entities from postcode_geo
console.log('  Backfilling gs_entities from postcode_geo...');
const entityResult = psql(
  `UPDATE gs_entities e SET lga_name = pg.lga_name, lga_code = pg.lga_code FROM postcode_geo pg WHERE e.postcode = pg.postcode AND pg.lga_name IS NOT NULL AND e.lga_name IS NULL`
);
const entityMatch = entityResult.match(/UPDATE (\d+)/);
const entUpdated = entityMatch ? parseInt(entityMatch[1]) : 0;
console.log(`  gs_entities: ${entUpdated} updated`);

// Step 3: Refresh materialized view
console.log('  Refreshing mv_funding_by_lga...');
try {
  psql('REFRESH MATERIALIZED VIEW mv_funding_by_lga');
  const mvCount = await sql("SELECT COUNT(*) as cnt FROM mv_funding_by_lga");
  console.log(`  mv_funding_by_lga: ${mvCount[0].cnt} LGAs`);
} catch (e) {
  console.log(`  mv_funding_by_lga refresh failed: ${e.message.split('\n')[0]}`);
}

// Final counts
const pgFinal = await sql("SELECT COUNT(*) as cnt FROM postcode_geo WHERE lga_name IS NOT NULL");
const entFinal = await sql("SELECT COUNT(*) as cnt FROM gs_entities WHERE lga_name IS NOT NULL");
console.log(`\n  Final: ${pgFinal[0].cnt} postcode_geo with LGA, ${entFinal[0].cnt} entities with LGA\n`);
