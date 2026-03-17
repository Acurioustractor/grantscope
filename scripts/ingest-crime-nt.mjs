#!/usr/bin/env node
/**
 * Ingest NT Police crime statistics by town into crime_stats_lga.
 *
 * Source: NT Police, Fire & Emergency Services (NTPFES)
 *   https://pfes.nt.gov.au/police/community-safety/nt-crime-statistics/{town}
 *
 * Scrapes HTML tables from individual town pages and inserts into crime_stats_lga.
 *
 * Usage:
 *   node --env-file=.env scripts/ingest-crime-nt.mjs
 */

import { createClient } from '@supabase/supabase-js';

// ---------------------------------------------------------------------------
// Town -> URL slug + LGA name mapping
// ---------------------------------------------------------------------------
const TOWNS = [
  { slug: 'darwin',        lgaName: 'Darwin' },
  { slug: 'palmerston',    lgaName: 'Palmerston' },
  { slug: 'alice-springs', lgaName: 'Alice Springs' },
  { slug: 'katherine',     lgaName: 'Katherine' },
  { slug: 'tennant-creek', lgaName: 'Tennant Creek' },
  { slug: 'nt-balance',    lgaName: 'Unincorporated NT' },
];

const BASE_URL = 'https://pfes.nt.gov.au/police/community-safety/nt-crime-statistics';

// ---------------------------------------------------------------------------
// Offence mapping: raw crime name from HTML -> { group, type }
// ---------------------------------------------------------------------------
const OFFENCE_MAP = {
  // Selected offences
  'Assault':                              { group: 'Assault', type: 'Assault (Total)' },
  'Domestic violence related assault':    { group: 'Assault', type: 'DV Related Assault' },
  'Alcohol related assault':              { group: 'Assault', type: 'Alcohol Related Assault' },
  'Sexual assault':                       { group: 'Sexual Offences', type: 'Sexual Assault' },
  'House break-ins':                      { group: 'Break and enter', type: 'House Break-ins' },
  'Commercial break-ins':                 { group: 'Break and enter', type: 'Commercial Break-ins' },
  'Motor vehicle theft':                  { group: 'Theft', type: 'Motor Vehicle Theft' },
  'Property damage':                      { group: 'Property damage', type: 'Property Damage' },

  // Summary offences
  'Crime against the person':             { group: 'Summary', type: 'Crime Against the Person' },
  'Crime against property':               { group: 'Summary', type: 'Crime Against Property' },
};

// ---------------------------------------------------------------------------
// Fetch and parse a single town page
// ---------------------------------------------------------------------------
async function fetchTownData(slug) {
  const url = `${BASE_URL}/${slug}`;
  console.log(`  Fetching ${url} ...`);
  const resp = await fetch(url);
  if (!resp.ok) {
    console.error(`    HTTP ${resp.status} for ${slug}`);
    return null;
  }
  const html = await resp.text();
  return parseHtmlTables(html);
}

/**
 * Parse crime data from NT Police HTML pages.
 *
 * The pages contain tables with class "table-crime-statistics" structured as:
 *   <tr><th class="crime-type">CRIME</th><th class="crime-figure">Dec-25**</th></tr>
 *   <tr><td>Assault</td><td>168</td></tr>
 *
 * Returns { period, offences: [{name, count}] }
 */
function parseHtmlTables(html) {
  const offences = [];
  let period = null;

  // Extract the period from the header row (e.g. "Dec-25**")
  const periodMatch = html.match(/class="crime-figure">([^<]+)</);
  if (periodMatch) {
    period = periodMatch[1].replace(/\*+/g, '').trim();
  }

  // Extract all table rows with crime data
  // Pattern: <tr><td>CrimeName</td><td>Count</td></tr>
  const rowRegex = /<tr>\s*<td>([^<]+)<\/td>\s*<td>([^<]+)<\/td>\s*<\/tr>/g;
  let match;
  while ((match = rowRegex.exec(html)) !== null) {
    const name = match[1].trim();
    const countStr = match[2].trim().replace(/,/g, '');
    const count = parseInt(countStr, 10);
    if (!isNaN(count)) {
      offences.push({ name, count });
    }
  }

  return { period, offences };
}

/**
 * Convert period like "Dec-25" to a year_period label like "December 2025"
 */
function formatPeriod(raw) {
  if (!raw) return 'Unknown period';
  const monthMap = {
    'Jan': 'January', 'Feb': 'February', 'Mar': 'March',
    'Apr': 'April', 'May': 'May', 'Jun': 'June',
    'Jul': 'July', 'Aug': 'August', 'Sep': 'September',
    'Oct': 'October', 'Nov': 'November', 'Dec': 'December',
  };
  // "Dec-25" -> month=Dec, year=25
  const parts = raw.split('-');
  if (parts.length !== 2) return raw;
  const monthAbbr = parts[0];
  const yearShort = parseInt(parts[1], 10);
  const year = yearShort < 50 ? 2000 + yearShort : 1900 + yearShort;
  const monthFull = monthMap[monthAbbr] || monthAbbr;
  return `${monthFull} ${year}`;
}

// ---------------------------------------------------------------------------
// Main
// ---------------------------------------------------------------------------
console.log('NT Crime Statistics Scraper');
console.log('==========================\n');

const allRows = [];
let periodsFound = new Set();

for (const town of TOWNS) {
  console.log(`\n[${town.lgaName}]`);
  const data = await fetchTownData(town.slug);

  if (!data || data.offences.length === 0) {
    console.log('  No data found');
    continue;
  }

  const period = formatPeriod(data.period);
  periodsFound.add(period);
  console.log(`  Period: ${data.period} -> ${period}`);
  console.log(`  Offences found: ${data.offences.length}`);

  for (const offence of data.offences) {
    const mapping = OFFENCE_MAP[offence.name];
    if (!mapping) {
      console.log(`  WARNING: Unmapped offence "${offence.name}" (count: ${offence.count})`);
      continue;
    }

    allRows.push({
      lga_name: town.lgaName,
      state: 'NT',
      offence_group: mapping.group,
      offence_type: mapping.type,
      year_period: period,
      incidents: offence.count,
      rate_per_100k: null,  // NT Police pages don't provide rates
      source: 'NTPFES',
    });

    console.log(`    ${offence.name}: ${offence.count}`);
  }
}

console.log(`\n\nTotal rows to insert: ${allRows.length}`);
console.log(`Periods: ${[...periodsFound].join(', ')}`);

if (allRows.length === 0) {
  console.log('No data to insert. Exiting.');
  process.exit(1);
}

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

// Delete existing NT data to allow re-runs (idempotent)
console.log('\nDeleting existing NT crime data...');
const { error: delErr } = await supabase
  .from('crime_stats_lga')
  .delete()
  .eq('state', 'NT')
  .eq('source', 'NTPFES');

if (delErr) {
  console.error('Delete error:', delErr.message);
} else {
  console.log('  Deleted existing NT rows (if any)');
}

// Insert in batches
const BATCH_SIZE = 500;
let inserted = 0;
let errors = 0;

for (let i = 0; i < allRows.length; i += BATCH_SIZE) {
  const batch = allRows.slice(i, i + BATCH_SIZE);
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
console.log(`Source: NTPFES Crime Statistics`);
console.log(`Towns scraped: ${TOWNS.length}`);
console.log(`Periods: ${[...periodsFound].join(', ')}`);
console.log(`Rows inserted: ${inserted}`);
console.log(`Batch errors: ${errors}`);

// Show summary by LGA
console.log('\n=== BY LGA ===');
const lgaTotals = new Map();
for (const row of allRows) {
  lgaTotals.set(row.lga_name, (lgaTotals.get(row.lga_name) || 0) + row.incidents);
}
for (const [name, total] of [...lgaTotals.entries()].sort((a, b) => b[1] - a[1])) {
  console.log(`  ${name}: ${total.toLocaleString()} incidents`);
}
