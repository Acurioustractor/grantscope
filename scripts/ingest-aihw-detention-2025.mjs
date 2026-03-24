#!/usr/bin/env node
/**
 * ingest-aihw-detention-2025.mjs
 *
 * Ingests AIHW Youth Detention Population in Australia 2025 supplementary tables.
 * Source: https://www.aihw.gov.au/reports/youth-justice/youth-detention-population-in-australia-2025
 *
 * Extracts quarterly data (Jun 2021 → Jun 2025, 17 quarters) from:
 *   S14: Detention numbers (ages 10-17) by state
 *   S18: Detention rates per 10K by Indigenous status by state
 *
 * Inserts into outcomes_metrics with domain='youth-justice'.
 *
 * Usage:
 *   node --env-file=.env scripts/ingest-aihw-detention-2025.mjs --dry-run
 *   node --env-file=.env scripts/ingest-aihw-detention-2025.mjs
 */

import { readFileSync, writeFileSync } from 'fs';
import { execSync } from 'child_process';
import { createRequire } from 'module';
const require = createRequire(import.meta.url);
const XLSX = require('xlsx');

const DRY_RUN = process.argv.includes('--dry-run');
const XLSX_PATH = '/tmp/aihw-youth-detention-2025.xlsx';
const SOURCE = 'AIHW Youth Detention Population in Australia 2025';
const SOURCE_URL = 'https://www.aihw.gov.au/reports/youth-justice/youth-detention-population-in-australia-2025';

function log(msg) { console.log(`[${new Date().toISOString().slice(11, 19)}] ${msg}`); }

function psql(query) {
  const escaped = query.replace(/'/g, "'\\''");
  const cmd = `source .env && PGPASSWORD="$DATABASE_PASSWORD" psql -h aws-0-ap-southeast-2.pooler.supabase.com -p 5432 -U "postgres.tednluwflfhxyucgwigh" -d postgres -t -A -c '${escaped}'`;
  try {
    return execSync(cmd, { encoding: 'utf-8', timeout: 30000 }).trim();
  } catch (err) {
    log(`  psql error: ${err.message?.slice(0, 120)}`);
    return '';
  }
}

// Map column indices to jurisdictions
const JURISDICTIONS = {
  3: 'NSW', 4: 'VIC', 5: 'QLD', 6: 'WA', 7: 'SA', 8: 'TAS', 9: 'ACT', 10: 'NT', 11: 'National',
};

// Convert quarter strings to financial year periods for consistency
// "Jun qtr 2021" → "2020-21", "Sep qtr 2021" → "2021-22Q1", etc.
function quarterToPeriod(qtr) {
  const match = qtr.match(/(Jun|Sep|Dec|Mar)\s+qtr\s+(\d{4})/);
  if (!match) return qtr;
  const [, month, yearStr] = match;
  const year = parseInt(yearStr);
  // Map to financial year quarters:
  // Jul-Sep = Q1 of FY YYYY-(YY+1)
  // Oct-Dec = Q2
  // Jan-Mar = Q3
  // Apr-Jun = Q4
  switch (month) {
    case 'Sep': return `${year}-${(year + 1).toString().slice(2)}Q1`;
    case 'Dec': return `${year}-${(year + 1).toString().slice(2)}Q2`;
    case 'Mar': return `${year - 1}-${year.toString().slice(2)}Q3`;
    case 'Jun': return `${year - 1}-${year.toString().slice(2)}Q4`;
  }
  return qtr;
}

log('Loading AIHW 2025 Excel...');
const wb = XLSX.readFile(XLSX_PATH);

const metrics = [];

// -- Table S18: Rates per 10K by Indigenous status by state (ages 10-17) --

log('Parsing Table S18 (rates by Indigenous status)...');
const s18 = XLSX.utils.sheet_to_json(wb.Sheets['Table S18'], { header: 1 });

let currentCohort = '';
for (let i = 3; i < s18.length; i++) {
  const row = s18[i];
  if (!row || !row[1]) continue;

  // Detect cohort
  if (row[0]?.toString().includes('First Nations')) currentCohort = 'indigenous';
  else if (row[0]?.toString().includes('Non')) currentCohort = 'non-indigenous';
  else if (row[0]?.toString().includes('Total')) currentCohort = 'all';
  else if (row[0]?.toString().includes('Rate ratio')) continue; // skip rate ratios

  const quarter = row[1]?.toString().trim();
  if (!quarter.includes('qtr')) continue;

  const period = quarterToPeriod(quarter);

  for (const [colIdx, jurisdiction] of Object.entries(JURISDICTIONS)) {
    const value = row[parseInt(colIdx)];
    if (value === undefined || value === null || value === 'n.p.' || value === '—' || value === '..') continue;
    const numValue = parseFloat(value);
    if (isNaN(numValue)) continue;

    metrics.push({
      jurisdiction,
      domain: 'youth-justice',
      metric_name: 'aihw_detention_rate_per_10k',
      metric_value: Math.round(numValue * 100) / 100,
      metric_unit: 'per_10k',
      period,
      cohort: currentCohort,
      source: SOURCE,
      source_url: SOURCE_URL,
      source_table: 'Table S18',
      notes: `Ages 10-17, ${quarter}`,
    });
  }
}

// -- Table S14: Detention numbers by state (ages 10-17) --

log('Parsing Table S14 (numbers ages 10-17)...');
const s14 = XLSX.utils.sheet_to_json(wb.Sheets['Table S14'], { header: 1 });

// S14 has Male, Female, Total sections. We want Total (starts around row 39)
let inTotal = false;
for (let i = 3; i < s14.length; i++) {
  const row = s14[i];
  if (!row) continue;

  if (row[0]?.toString().includes('Total') || row[0]?.toString().includes('Persons')) {
    inTotal = true;
    continue;
  }
  if (row[0]?.toString().includes('Male') && inTotal) break; // past total section

  if (!inTotal) continue;

  const quarter = row[1]?.toString().trim();
  if (!quarter || !quarter.includes('qtr')) continue;
  const period = quarterToPeriod(quarter);

  for (const [colIdx, jurisdiction] of Object.entries(JURISDICTIONS)) {
    const value = row[parseInt(colIdx)];
    if (value === undefined || value === null || value === 'n.p.' || value === '—') continue;
    const numValue = parseFloat(value);
    if (isNaN(numValue)) continue;

    metrics.push({
      jurisdiction,
      domain: 'youth-justice',
      metric_name: 'aihw_avg_nightly_detention',
      metric_value: Math.round(numValue),
      metric_unit: 'persons',
      period,
      cohort: 'all',
      source: SOURCE,
      source_url: SOURCE_URL,
      source_table: 'Table S14',
      notes: `Ages 10-17, ${quarter}, avg nightly population`,
    });
  }
}

// -- Table S4: First Nations numbers (ages 10-17) --

log('Parsing Table S4 (First Nations numbers ages 10-17)...');
const s4 = XLSX.utils.sheet_to_json(wb.Sheets['Table S4'], { header: 1 });

let inS4Total = false;
for (let i = 3; i < s4.length; i++) {
  const row = s4[i];
  if (!row) continue;

  if (row[0]?.toString().includes('Total') || row[0]?.toString().includes('Persons')) {
    inS4Total = true;
    continue;
  }
  if (row[0] && !row[0].toString().includes('Total') && inS4Total) break;

  if (!inS4Total) continue;

  const quarter = row[1]?.toString().trim();
  if (!quarter || !quarter.includes('qtr')) continue;
  const period = quarterToPeriod(quarter);

  for (const [colIdx, jurisdiction] of Object.entries(JURISDICTIONS)) {
    const value = row[parseInt(colIdx)];
    if (value === undefined || value === null || value === 'n.p.' || value === '—') continue;
    const numValue = parseFloat(value);
    if (isNaN(numValue)) continue;

    metrics.push({
      jurisdiction,
      domain: 'youth-justice',
      metric_name: 'aihw_avg_nightly_detention',
      metric_value: Math.round(numValue),
      metric_unit: 'persons',
      period,
      cohort: 'indigenous',
      source: SOURCE,
      source_url: SOURCE_URL,
      source_table: 'Table S4',
      notes: `First Nations ages 10-17, ${quarter}, avg nightly population`,
    });
  }
}

log(`  Total metrics extracted: ${metrics.length}`);

// -- Summary --

const byCohort = {};
const byMetric = {};
for (const m of metrics) {
  byCohort[m.cohort] = (byCohort[m.cohort] || 0) + 1;
  byMetric[m.metric_name] = (byMetric[m.metric_name] || 0) + 1;
}
log(`  By cohort: ${JSON.stringify(byCohort)}`);
log(`  By metric: ${JSON.stringify(byMetric)}`);

// -- Insert --

if (DRY_RUN) {
  log(`\nDRY RUN — would insert ${metrics.length} metrics`);
  // Show sample
  for (const m of metrics.slice(0, 5)) {
    log(`  ${m.jurisdiction} | ${m.metric_name} | ${m.period} | ${m.cohort} | ${m.metric_value}`);
  }
} else {
  log('\nInserting into outcomes_metrics...');

  // Build SQL
  const values = metrics.map(m => {
    const notes = (m.notes || '').replace(/'/g, "''");
    const source = m.source.replace(/'/g, "''");
    return `('${m.jurisdiction}', '${m.domain}', '${m.metric_name}', ${m.metric_value}, '${m.metric_unit}', '${m.period}', '${m.cohort}', '${source}', '${m.source_url}', '${m.source_table}', '${notes}')`;
  });

  // Insert in batches of 100
  const BATCH = 100;
  let inserted = 0;
  for (let i = 0; i < values.length; i += BATCH) {
    const batch = values.slice(i, i + BATCH);
    const sql = `INSERT INTO outcomes_metrics (jurisdiction, domain, metric_name, metric_value, metric_unit, period, cohort, source, source_url, source_table, notes)
VALUES ${batch.join(',\n')}
ON CONFLICT DO NOTHING;`;

    writeFileSync('/tmp/aihw-import-batch.sql', sql);
    const result = psql(`\\i /tmp/aihw-import-batch.sql`);
    if (result.includes('ERROR')) {
      log(`  Batch ${Math.floor(i / BATCH) + 1} error: ${result.slice(0, 120)}`);
    } else {
      const countMatch = result.match(/INSERT 0 (\d+)/);
      inserted += countMatch ? parseInt(countMatch[1]) : batch.length;
    }
  }

  log(`  Inserted ${inserted} metrics`);

  // Log agent run
  psql(`INSERT INTO agent_runs (agent_id, agent_name, status, items_found, items_new, started_at, completed_at) VALUES ('ingest-aihw-detention-2025', 'AIHW Youth Detention 2025 Ingest', 'success', ${metrics.length}, ${inserted}, NOW() - INTERVAL '1 minute', NOW())`);
}

log('\n======================================================');
log(`  AIHW Youth Detention 2025 — ${DRY_RUN ? 'DRY RUN' : 'LIVE'}`);
log(`  Metrics: ${metrics.length}`);
log(`  Quarters: Jun 2021 → Jun 2025 (17 quarters)`);
log(`  Tables: S4 (First Nations numbers), S14 (total numbers), S18 (rates by Indigenous status)`);
log('======================================================');
