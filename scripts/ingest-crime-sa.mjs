#!/usr/bin/env node
/**
 * Ingest South Australia crime data into crime_stats_lga.
 *
 * Source: SA Police (SAPOL) reported crime statistics
 *   - CSV with suburb/postcode-level offence counts (daily granularity)
 *   - Aggregated to LGA level via postcode_geo lookup
 *
 * Usage:
 *   node --env-file=.env scripts/ingest-crime-sa.mjs [path-to-csv]
 */

import { readFileSync } from 'fs';
import { createClient } from '@supabase/supabase-js';

const CSV_PATH = process.argv[2] || '/tmp/sa-crime-2024-25.csv';

// ---------------------------------------------------------------------------
// Map SA offence Level 2 descriptions to normalised groups/types
// ---------------------------------------------------------------------------
const OFFENCE_MAP = {
  'HOMICIDE AND RELATED OFFENCES':          { group: 'Homicide', type: 'Homicide & related' },
  'ACTS INTENDED TO CAUSE INJURY':          { group: 'Assault', type: 'Assault & related' },
  'SEXUAL ASSAULT AND RELATED OFFENCES':    { group: 'Sexual Offences', type: 'Sexual offences' },
  'ROBBERY AND RELATED OFFENCES':           { group: 'Robbery', type: 'Robbery' },
  'OTHER OFFENCES AGAINST THE PERSON':      { group: 'Other person offences', type: 'Other offences against person' },
  'OTHER OFFENCES AGAINST THE PERSON NEC':  { group: 'Other person offences', type: 'Other offences against person NEC' },
  'SERIOUS CRIMINAL TRESPASS':              { group: 'Break and enter', type: 'Serious criminal trespass' },
  'THEFT AND RELATED OFFENCES':             { group: 'Theft', type: 'Theft & related' },
  'FRAUD DECEPTION AND RELATED OFFENCES':   { group: 'Fraud', type: 'Fraud & deception' },
  'PROPERTY DAMAGE AND ENVIRONMENTAL':      { group: 'Property damage', type: 'Property damage & environmental' },
  'OTHER OFFENCES AGAINST PROPERTY':        { group: 'Other offences', type: 'Other property offences' },
};

// ---------------------------------------------------------------------------
// Parse CSV (simple — no quoted commas in this dataset)
// ---------------------------------------------------------------------------
console.log(`Reading ${CSV_PATH}...`);
const raw = readFileSync(CSV_PATH, 'utf-8');
const lines = raw.trim().split('\n');
const headers = lines[0].split(',');
console.log(`Headers: ${headers.join(' | ')}`);
console.log(`Data rows: ${lines.length - 1}`);

// Parse rows: Reported Date, Suburb, Postcode, Level1, Level2, Level3, Count
const records = [];
for (let i = 1; i < lines.length; i++) {
  const parts = lines[i].split(',');
  if (parts.length < 7) continue;
  records.push({
    date: parts[0],
    suburb: parts[1],
    postcode: parts[2],
    level1: parts[3],
    level2: parts[4],
    level3: parts[5],
    count: parseInt(parts[6]) || 0,
  });
}
console.log(`Parsed ${records.length} records`);

// Determine year period from date range
const dates = records.map(r => {
  const [d, m, y] = r.date.split('/');
  return new Date(`${y}-${m}-${d}`);
}).sort((a, b) => a - b);
const startDate = dates[0];
const endDate = dates[dates.length - 1];
const yearPeriod = `July ${startDate.getFullYear()} - June ${endDate.getFullYear()}`;
console.log(`Period: ${yearPeriod}`);

// ---------------------------------------------------------------------------
// Load postcode→LGA mapping from Supabase
// ---------------------------------------------------------------------------
const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
if (!supabaseUrl || !supabaseKey) {
  console.error('Missing NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY');
  process.exit(1);
}
const supabase = createClient(supabaseUrl, supabaseKey);

console.log('\nLoading SA postcode→LGA mapping...');
const { data: postcodeRows, error: pgErr } = await supabase
  .from('postcode_geo')
  .select('postcode, lga_name')
  .eq('state', 'SA')
  .not('lga_name', 'is', null);

if (pgErr) {
  console.error('Error loading postcode_geo:', pgErr.message);
  process.exit(1);
}

// Build postcode→LGA map (some postcodes span multiple LGAs — take first)
const postcodeLga = new Map();
for (const row of postcodeRows) {
  if (!postcodeLga.has(row.postcode)) {
    postcodeLga.set(row.postcode, row.lga_name);
  }
}
console.log(`Postcode→LGA mappings: ${postcodeLga.size}`);

// ---------------------------------------------------------------------------
// Aggregate: postcode → LGA, Level 2 → normalised offence group/type
// ---------------------------------------------------------------------------
const lgaOffenceMap = new Map(); // key: "LGA|group|type" -> incidents
let unmappedPostcodes = 0;
let unmappedOffences = 0;
const unmappedPostcodeSet = new Set();

for (const rec of records) {
  const lga = postcodeLga.get(rec.postcode);
  if (!lga) {
    unmappedPostcodes++;
    unmappedPostcodeSet.add(rec.postcode);
    continue;
  }

  const mapping = OFFENCE_MAP[rec.level2];
  if (!mapping) {
    unmappedOffences++;
    continue;
  }

  const key = `${lga}|${mapping.group}|${mapping.type}`;
  lgaOffenceMap.set(key, (lgaOffenceMap.get(key) || 0) + rec.count);
}

console.log(`\nUnmapped postcodes: ${unmappedPostcodes} records (${unmappedPostcodeSet.size} unique postcodes)`);
if (unmappedPostcodeSet.size > 0 && unmappedPostcodeSet.size <= 20) {
  console.log(`  Postcodes: ${[...unmappedPostcodeSet].sort().join(', ')}`);
}
console.log(`Unmapped offence types: ${unmappedOffences} records`);

// Build insert rows
const insertRows = [];
const lgaNames = new Set();
const lgaTotals = new Map(); // LGA → total incidents

for (const [key, incidents] of lgaOffenceMap) {
  const [lga, group, type] = key.split('|');
  if (incidents === 0) continue;

  lgaNames.add(lga);
  lgaTotals.set(lga, (lgaTotals.get(lga) || 0) + incidents);

  insertRows.push({
    lga_name: lga,
    state: 'SA',
    offence_group: group,
    offence_type: type,
    year_period: yearPeriod,
    incidents,
    rate_per_100k: null, // SAPOL CSV doesn't include population rates
    source: 'SAPOL',
  });
}

// Add total row per LGA
for (const [lga, total] of lgaTotals) {
  insertRows.push({
    lga_name: lga,
    state: 'SA',
    offence_group: 'Total',
    offence_type: 'All offences',
    year_period: yearPeriod,
    incidents: total,
    rate_per_100k: null,
    source: 'SAPOL',
  });
}

console.log(`\nLGAs found: ${lgaNames.size}`);
console.log(`Total rows to insert: ${insertRows.length}`);

// ---------------------------------------------------------------------------
// Delete existing SA data for this period (idempotent re-runs)
// ---------------------------------------------------------------------------
console.log(`\nDeleting existing SA/SAPOL data for period "${yearPeriod}"...`);
const { error: delErr } = await supabase
  .from('crime_stats_lga')
  .delete()
  .eq('state', 'SA')
  .eq('source', 'SAPOL')
  .eq('year_period', yearPeriod);

if (delErr) {
  console.error('Delete error:', delErr.message);
} else {
  console.log('  Deleted existing rows (if any)');
}

// Insert in batches of 500
const BATCH_SIZE = 500;
let inserted = 0;
let errors = 0;

for (let i = 0; i < insertRows.length; i += BATCH_SIZE) {
  const batch = insertRows.slice(i, i + BATCH_SIZE);
  const { error: insertErr } = await supabase
    .from('crime_stats_lga')
    .insert(batch);

  if (insertErr) {
    console.error(`  Batch ${Math.floor(i / BATCH_SIZE) + 1} error:`, insertErr.message);
    errors++;
  } else {
    inserted += batch.length;
  }
}

// ---------------------------------------------------------------------------
// Report
// ---------------------------------------------------------------------------
console.log('\n=== INGEST REPORT ===');
console.log(`Source: SA Police (SAPOL)`);
console.log(`Period: ${yearPeriod}`);
console.log(`LGAs: ${lgaNames.size}`);
console.log(`Rows inserted: ${inserted}`);
console.log(`Batch errors: ${errors}`);

// Sample data
console.log('\n=== SAMPLE DATA (first 10 rows) ===');
for (const row of insertRows.slice(0, 10)) {
  console.log(`  ${row.lga_name} | ${row.offence_group} | ${row.offence_type} | incidents=${row.incidents}`);
}

// Top LGAs by total incidents
const totals = insertRows.filter(r => r.offence_group === 'Total');
totals.sort((a, b) => b.incidents - a.incidents);
console.log('\n=== TOP 15 LGAs BY TOTAL INCIDENTS ===');
for (const row of totals.slice(0, 15)) {
  console.log(`  ${row.lga_name}: ${row.incidents.toLocaleString()}`);
}

// Bottom 5 LGAs
totals.sort((a, b) => a.incidents - b.incidents);
console.log('\n=== BOTTOM 5 LGAs BY TOTAL INCIDENTS ===');
for (const row of totals.slice(0, 5)) {
  console.log(`  ${row.lga_name}: ${row.incidents.toLocaleString()}`);
}
