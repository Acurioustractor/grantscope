#!/usr/bin/env node
/**
 * Ingest BOCSAR NSW LGA crime trends into lga_cross_system_stats.
 *
 * Source: https://bocsar.nsw.gov.au/content/dam/dcj/bocsar/documents/open-datasets/LGA_trends.xlsx
 * Updates crime_rate_per_100k for NSW LGAs using the LGA rankings file which has rates.
 *
 * Also ingests from LGA rankings (27 offences) which has rate per 100K.
 * Source: https://bocsar.nsw.gov.au/content/dam/dcj/bocsar/documents/open-datasets/LgaRankings_27_Offences.xlsx
 *
 * Usage:
 *   node --env-file=.env scripts/ingest-bocsar-nsw.mjs
 */

import { readFileSync } from 'fs';
import { execSync } from 'child_process';
import { createClient } from '@supabase/supabase-js';

// Download files
console.log('Downloading BOCSAR LGA rankings...');
execSync('curl -sL -o /tmp/bocsar-lga-rankings.xlsx "https://bocsar.nsw.gov.au/content/dam/dcj/bocsar/documents/open-datasets/LgaRankings_27_Offences.xlsx"');

// Parse Excel
import pkg from 'xlsx';
const XLSX = pkg;

const wb = XLSX.readFile('/tmp/bocsar-lga-rankings.xlsx');

// We want the latest year's total crime rate per 100K across key offences
// Each sheet is one offence type. We'll sum incidents across offence types for each LGA.
// Use the latest year column (rightmost pair of Number/Rate columns)

const offenceSheets = wb.SheetNames;
console.log(`Found ${offenceSheets.length} offence sheets`);

// Build per-LGA totals from latest year
const lgaTotals = new Map(); // lga_name -> { incidents: number, rate: number, offenceCount: number }

for (const sheetName of offenceSheets) {
  const ws = wb.Sheets[sheetName];
  const data = XLSX.utils.sheet_to_json(ws, { header: 1, defval: null });

  // Find the header row (row with "Local Government Area")
  let headerIdx = -1;
  for (let i = 0; i < Math.min(data.length, 10); i++) {
    if (data[i] && data[i][0] === 'Local Government Area') {
      headerIdx = i;
      break;
    }
  }
  if (headerIdx === -1) continue;

  // Find the latest year columns (last Number/Rate pair)
  const headers = data[headerIdx];
  let lastNumberCol = -1;
  let lastRateCol = -1;
  for (let c = headers.length - 1; c >= 0; c--) {
    const h = String(headers[c] || '');
    if (h.startsWith('Rate per 100,000') && lastRateCol === -1) lastRateCol = c;
    if (h === 'Number' && lastNumberCol === -1) lastNumberCol = c;
  }
  if (lastNumberCol === -1 || lastRateCol === -1) continue;

  // Extract data rows
  for (let i = headerIdx + 1; i < data.length; i++) {
    const row = data[i];
    if (!row || !row[0]) continue;
    const lgaName = String(row[0]).trim();
    if (lgaName === 'NSW' || lgaName.startsWith('Note') || lgaName.startsWith('*')) continue;

    const incidents = typeof row[lastNumberCol] === 'number' ? row[lastNumberCol] : 0;
    const rate = typeof row[lastRateCol] === 'number' ? row[lastRateCol] : 0;

    if (!lgaTotals.has(lgaName)) {
      lgaTotals.set(lgaName, { incidents: 0, rate: 0, offenceCount: 0 });
    }
    const entry = lgaTotals.get(lgaName);
    entry.incidents += incidents;
    entry.rate += rate; // Sum of rates across offence types
    entry.offenceCount++;
  }
}

console.log(`Parsed ${lgaTotals.size} LGAs from BOCSAR rankings`);

// Connect to Supabase
const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
if (!supabaseUrl || !supabaseKey) {
  console.error('Missing NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY');
  process.exit(1);
}
const supabase = createClient(supabaseUrl, supabaseKey);

// Fetch existing NSW LGAs
const { data: existingLgas, error: fetchErr } = await supabase
  .from('lga_cross_system_stats')
  .select('id, lga_name, state, crime_rate_per_100k')
  .eq('state', 'NSW');

if (fetchErr) {
  console.error('Failed to fetch LGAs:', fetchErr);
  process.exit(1);
}

console.log(`NSW LGAs in database: ${existingLgas.length}`);

// Build lookup
const dbLookup = new Map();
for (const lga of existingLgas) {
  dbLookup.set(lga.lga_name, lga);
}

// BOCSAR name -> DB name mappings
const nameVariations = {
  'Central Coast': 'Central Coast (NSW)',
  'Bayside': 'Bayside (NSW)',
  'Campbelltown': 'Campbelltown (NSW)',
  'Sutherland Shire': 'Sutherland',
  'Tamworth Regional': 'Tamworth',
  'Dubbo Regional': 'Dubbo',
  'The Hills Shire': 'The Hills',
  'Bathurst Regional': 'Bathurst',
  'Queanbeyan-Palerang Regional': 'Queanbeyan-Palerang',
  'Armidale Regional': 'Armidale',
  'Goulburn Mulwaree': 'Goulburn-Mulwaree',
  'Snowy Monaro Regional': 'Snowy Monaro',
  'Upper Hunter Shire': 'Upper Hunter',
  'Upper Lachlan Shire': 'Upper Lachlan',
  'Snowy Valleys': 'Snowy Valleys',
  'Hilltops': 'Hilltops',
  'Edward River': 'Edward River',
  'Murray River': 'Murray River',
  'Cootamundra-Gundagai Regional': 'Cootamundra-Gundagai',
};

let matched = 0;
let updated = 0;
let alreadyHadData = 0;
const unmatched = [];

for (const [lgaName, totals] of lgaTotals) {
  // Average rate across offence types (rough approximation of total crime rate)
  const avgRate = Math.round(totals.rate);

  // Try exact match first, then variations
  let dbLga = dbLookup.get(lgaName) || dbLookup.get(nameVariations[lgaName]);

  if (!dbLga) {
    unmatched.push({ lgaName, incidents: totals.incidents, rate: avgRate });
    continue;
  }

  matched++;

  // Only update if no crime data exists yet
  if (dbLga.crime_rate_per_100k && dbLga.crime_rate_per_100k > 0) {
    alreadyHadData++;
    continue;
  }

  const { error: updateErr } = await supabase
    .from('lga_cross_system_stats')
    .update({
      crime_rate_per_100k: avgRate,
      updated_at: new Date().toISOString(),
    })
    .eq('id', dbLga.id);

  if (updateErr) {
    console.error(`  Error updating ${dbLga.lga_name}:`, updateErr.message);
  } else {
    updated++;
  }
}

console.log('\n=== BOCSAR NSW INGEST REPORT ===');
console.log(`BOCSAR LGAs parsed: ${lgaTotals.size}`);
console.log(`Matched to DB: ${matched}`);
console.log(`Already had crime data: ${alreadyHadData}`);
console.log(`Newly updated: ${updated}`);
console.log(`Unmatched: ${unmatched.length}`);

if (unmatched.length > 0) {
  console.log('\nUnmatched (top 20 by incidents):');
  unmatched.sort((a, b) => b.incidents - a.incidents);
  for (const u of unmatched.slice(0, 20)) {
    console.log(`  ${u.lgaName}: ${u.incidents} incidents, rate ${u.rate}`);
  }
}
