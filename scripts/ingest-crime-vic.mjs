#!/usr/bin/env node
/**
 * Ingest Victoria LGA-level crime data into crime_stats_lga.
 *
 * Source: Crime Statistics Agency (CSA) Victoria
 *   - XLSX with LGA-level criminal incidents by offence
 *   - https://www.crimestatistics.vic.gov.au/
 *
 * Usage:
 *   node --env-file=.env scripts/ingest-crime-vic.mjs [path-to-xlsx]
 */

import { createRequire } from 'module';
import { createClient } from '@supabase/supabase-js';

// xlsx is installed in /tmp for this pipeline
const require = createRequire(import.meta.url);
let XLSX;
try {
  XLSX = require('xlsx');
} catch {
  XLSX = require('/tmp/node_modules/xlsx');
}

const XLSX_PATH = process.argv[2] || '/tmp/vic-crime-lga.xlsx';

// ---------------------------------------------------------------------------
// Map VIC offence divisions/subdivisions to normalised groups/types
// ---------------------------------------------------------------------------
const OFFENCE_MAP = {
  'A10 Homicide and related offences':     { group: 'Homicide', type: 'Homicide & related' },
  'A20 Assault and related offences':      { group: 'Assault', type: 'Assault & related' },
  'A30 Sexual offences':                   { group: 'Sexual Offences', type: 'Sexual offences' },
  'A40 Abduction and related offences':    { group: 'Other person offences', type: 'Abduction & related' },
  'A50 Robbery':                           { group: 'Robbery', type: 'Robbery' },
  'A60 Blackmail and extortion':           { group: 'Other person offences', type: 'Blackmail & extortion' },
  'A70 Stalking, harassment and threatening behaviour': { group: 'Other person offences', type: 'Stalking & harassment' },
  'A80 Dangerous and negligent acts endangering people': { group: 'Other person offences', type: 'Dangerous acts' },
  'B10 Arson':                             { group: 'Property damage', type: 'Arson' },
  'B20 Property damage':                   { group: 'Property damage', type: 'Property damage' },
  'B30 Burglary/Break and enter':          { group: 'Break and enter', type: 'Burglary/Break & enter' },
  'B40 Theft':                             { group: 'Theft', type: 'Theft' },
  'B50 Deception':                         { group: 'Fraud', type: 'Deception' },
  'B60 Bribery':                           { group: 'Fraud', type: 'Bribery' },
  'C10 Drug dealing and trafficking':      { group: 'Drug offences', type: 'Drug dealing & trafficking' },
  'C20 Cultivate or manufacture drugs':    { group: 'Drug offences', type: 'Cultivate/manufacture drugs' },
  'C30 Drug use and possession':           { group: 'Drug offences', type: 'Drug use & possession' },
  'C90 Other drug offences':               { group: 'Drug offences', type: 'Other drug offences' },
  'D10 Weapons and explosives offences':   { group: 'Weapons offences', type: 'Weapons & explosives' },
  'D20 Disorderly and offensive conduct':  { group: 'Disorderly conduct', type: 'Disorderly conduct' },
  'D30 Public nuisance offences':          { group: 'Disorderly conduct', type: 'Public nuisance' },
  'D40 Public security offences':          { group: 'Disorderly conduct', type: 'Public security' },
  'E10 Justice procedures':               { group: 'Against justice procedures', type: 'Justice procedures' },
  'E20 Breaches of orders':               { group: 'Against justice procedures', type: 'Breaches of orders' },
  'F10 Regulatory driving offences':       { group: 'Traffic offences', type: 'Regulatory driving' },
  'F20 Transport regulation offences':     { group: 'Traffic offences', type: 'Transport regulation' },
  'F30 Other government regulatory offences': { group: 'Other offences', type: 'Government regulatory' },
  'F90 Miscellaneous offences':            { group: 'Other offences', type: 'Miscellaneous' },
};

// LGAs to exclude (not real LGAs)
const EXCLUDE_LGAS = new Set([
  'Total',
  'Justice Institutions and Immigration Facilities',
  'Unincorporated Vic',
]);

// ---------------------------------------------------------------------------
// Read XLSX
// ---------------------------------------------------------------------------
console.log(`Reading ${XLSX_PATH}...`);
const wb = XLSX.readFile(XLSX_PATH);

// ---------------------------------------------------------------------------
// Table 01: Total incidents per LGA (for overall rate)
// Headers: Year, Year ending, Police Region, Local Government Area, Incidents Recorded, Rate per 100,000 population
// ---------------------------------------------------------------------------
const t01 = XLSX.utils.sheet_to_json(wb.Sheets['Table 01'], { header: 1 });

// Find the most recent year
const years = [...new Set(t01.slice(1).map(r => r[0]).filter(Boolean))].sort();
const latestYear = years[years.length - 1];
const yearEnding = t01.find(r => r[0] === latestYear)?.[1] || 'September';
const yearPeriodLabel = `October ${latestYear - 1} - ${yearEnding} ${latestYear}`;
console.log(`Latest period: ${yearPeriodLabel} (Year=${latestYear})`);

// ---------------------------------------------------------------------------
// Table 02: Offence-level data per LGA
// Headers: Year, Year ending, Police Service Area, Local Government Area,
//          Offence Division, Offence Subdivision, Offence Subgroup,
//          Incidents Recorded, PSA Rate per 100,000, LGA Rate per 100,000
// ---------------------------------------------------------------------------
const t02 = XLSX.utils.sheet_to_json(wb.Sheets['Table 02'], { header: 1 });
console.log(`Table 02: ${t02.length - 1} data rows`);

// Aggregate by LGA + Offence Subdivision for the latest year
// Some LGAs span multiple PSAs so we need to sum incidents
const lgaOffenceMap = new Map(); // key: "LGA|subdivision" -> { incidents, rate }

for (let i = 1; i < t02.length; i++) {
  const row = t02[i];
  if (!row || row[0] !== latestYear) continue;

  const lga = (row[3] || '').trim();
  if (!lga || EXCLUDE_LGAS.has(lga)) continue;

  const subdivision = row[5];
  if (!OFFENCE_MAP[subdivision]) continue;

  const key = `${lga}|${subdivision}`;
  const existing = lgaOffenceMap.get(key) || { incidents: 0, rate: null };

  const incidents = parseInt(row[7]) || 0;
  const lgaRate = parseFloat(row[9]);

  existing.incidents += incidents;
  // LGA rate should be same across PSAs for same LGA, take the first non-empty
  if (existing.rate === null && !isNaN(lgaRate)) {
    existing.rate = lgaRate;
  }

  lgaOffenceMap.set(key, existing);
}

// Build insert rows
const insertRows = [];
const lgaNames = new Set();

for (const [key, data] of lgaOffenceMap) {
  const [lga, subdivision] = key.split('|');
  const mapping = OFFENCE_MAP[subdivision];
  if (!mapping) continue;

  // Skip zero rows
  if (data.incidents === 0 && (!data.rate || data.rate === 0)) continue;

  lgaNames.add(lga);
  insertRows.push({
    lga_name: lga,
    state: 'VIC',
    offence_group: mapping.group,
    offence_type: mapping.type,
    year_period: yearPeriodLabel,
    incidents: data.incidents,
    rate_per_100k: data.rate !== null ? Math.round(data.rate * 10) / 10 : null,
    source: 'CSA_VIC',
  });
}

// Also add total row per LGA from Table 01
for (let i = 1; i < t01.length; i++) {
  const row = t01[i];
  if (!row || row[0] !== latestYear) continue;

  const lga = (row[3] || '').trim();
  if (!lga || EXCLUDE_LGAS.has(lga)) continue;

  const incidents = parseInt(row[4]) || 0;
  const rate = parseFloat(row[5]);

  if (incidents === 0) continue;

  lgaNames.add(lga);
  insertRows.push({
    lga_name: lga,
    state: 'VIC',
    offence_group: 'Total',
    offence_type: 'All offences',
    year_period: yearPeriodLabel,
    incidents,
    rate_per_100k: !isNaN(rate) ? Math.round(rate * 10) / 10 : null,
    source: 'CSA_VIC',
  });
}

console.log(`\nLGAs found: ${lgaNames.size}`);
console.log(`Total rows to insert: ${insertRows.length}`);

// ---------------------------------------------------------------------------
// Connect to Supabase and insert
// ---------------------------------------------------------------------------
const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
if (!supabaseUrl || !supabaseKey) {
  console.error('Missing NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY');
  process.exit(1);
}
const supabase = createClient(supabaseUrl, supabaseKey);

// Delete existing VIC data for this period (idempotent re-runs)
console.log(`\nDeleting existing VIC/CSA_VIC data for period "${yearPeriodLabel}"...`);
const { error: delErr } = await supabase
  .from('crime_stats_lga')
  .delete()
  .eq('state', 'VIC')
  .eq('source', 'CSA_VIC')
  .eq('year_period', yearPeriodLabel);

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
console.log(`Source: Crime Statistics Agency Victoria`);
console.log(`Period: ${yearPeriodLabel}`);
console.log(`LGAs: ${lgaNames.size}`);
console.log(`Rows inserted: ${inserted}`);
console.log(`Batch errors: ${errors}`);

// Sample data
console.log('\n=== SAMPLE DATA (first 10 rows) ===');
for (const row of insertRows.slice(0, 10)) {
  console.log(`  ${row.lga_name} | ${row.offence_group} | ${row.offence_type} | incidents=${row.incidents} | rate=${row.rate_per_100k}`);
}

// Top LGAs by total incidents (from Table 01 totals)
const totals = insertRows.filter(r => r.offence_group === 'Total');
totals.sort((a, b) => b.incidents - a.incidents);
console.log('\n=== TOP 15 LGAs BY TOTAL INCIDENTS ===');
for (const row of totals.slice(0, 15)) {
  console.log(`  ${row.lga_name}: ${row.incidents.toLocaleString()} (rate: ${row.rate_per_100k})`);
}

// Bottom 5 LGAs
totals.sort((a, b) => a.incidents - b.incidents);
console.log('\n=== BOTTOM 5 LGAs BY TOTAL INCIDENTS ===');
for (const row of totals.slice(0, 5)) {
  console.log(`  ${row.lga_name}: ${row.incidents.toLocaleString()} (rate: ${row.rate_per_100k})`);
}
