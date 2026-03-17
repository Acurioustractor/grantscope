#!/usr/bin/env node
/**
 * Ingest Queensland LGA-level crime data into crime_stats_lga.
 *
 * Source: QPS Open Data
 *   - Counts: LGA_Reported_Offences_Number.csv
 *   - Rates:  LGA_Reported_Offences_Rates.csv
 *
 * Usage:
 *   node --env-file=.env scripts/ingest-crime-qld.mjs
 */

import { readFileSync } from 'fs';
import { createClient } from '@supabase/supabase-js';

const COUNTS_CSV = process.argv[2] || '/tmp/qld-crime-lga-counts.csv';
const RATES_CSV = process.argv[3] || '/tmp/qld-crime-lga-rates.csv';

// ---------------------------------------------------------------------------
// Offence group mapping: CSV column name -> { group, type }
// We map QLD columns to broad offence groups matching the schema pattern.
// Aggregate columns (like "Offences Against the Person") are used as the group
// total; sub-columns are individual offence types.
// ---------------------------------------------------------------------------

// These are the aggregate/summary columns in the CSV — we skip them because
// we ingest individual offence types instead.
const AGGREGATE_COLUMNS = new Set([
  'Offences Against the Person',
  'Offences Against Property',
  'Other Offences',
]);

// Map each CSV column to an offence group. Columns not listed here are skipped.
const OFFENCE_MAP = {
  // --- Offences Against the Person ---
  'Homicide (Murder)':                           { group: 'Homicide', type: 'Murder' },
  'Other Homicide':                              { group: 'Homicide', type: 'Other Homicide' },
  'Attempted Murder':                            { group: 'Homicide', type: 'Attempted Murder' },
  'Conspiracy to Murder':                        { group: 'Homicide', type: 'Conspiracy to Murder' },
  'Manslaughter (excl. by driving)':             { group: 'Homicide', type: 'Manslaughter' },
  'Manslaughter Unlawful Striking Causing Death':{ group: 'Homicide', type: 'Manslaughter Unlawful Striking' },
  'Driving Causing Death':                       { group: 'Homicide', type: 'Driving Causing Death' },
  'Assault':                                     { group: 'Assault', type: 'Assault (Total)' },
  'Grievous Assault':                            { group: 'Assault', type: 'Grievous Assault' },
  'Serious Assault':                             { group: 'Assault', type: 'Serious Assault' },
  'Serious Assault (Other)':                     { group: 'Assault', type: 'Serious Assault (Other)' },
  "Common Assault'":                             { group: 'Assault', type: 'Common Assault' },
  'Sexual Offences':                             { group: 'Sexual Offences', type: 'Sexual Offences (Total)' },
  'Rape and Attempted Rape':                     { group: 'Sexual Offences', type: 'Rape and Attempted Rape' },
  'Other Sexual Offences':                       { group: 'Sexual Offences', type: 'Other Sexual Offences' },
  'Robbery':                                     { group: 'Robbery', type: 'Robbery (Total)' },
  'Armed Robbery':                               { group: 'Robbery', type: 'Armed Robbery' },
  'Unarmed Robbery':                             { group: 'Robbery', type: 'Unarmed Robbery' },
  'Kidnapping & Abduction etc.':                 { group: 'Other person offences', type: 'Kidnapping & Abduction' },
  'Coercive Control':                            { group: 'Other person offences', type: 'Coercive Control' },
  'Extortion':                                   { group: 'Other person offences', type: 'Extortion' },
  'Stalking':                                    { group: 'Other person offences', type: 'Stalking' },
  'Life Endangering Acts':                       { group: 'Other person offences', type: 'Life Endangering Acts' },
  'Other Offences Against the Person':           { group: 'Other person offences', type: 'Other Offences Against the Person' },

  // --- Offences Against Property ---
  'Unlawful Entry':                                     { group: 'Break and enter', type: 'Unlawful Entry (Total)' },
  'Unlawful Entry With Intent - Dwelling':              { group: 'Break and enter', type: 'Unlawful Entry - Dwelling (Intent)' },
  'Unlawful Entry Without Violence - Dwelling':         { group: 'Break and enter', type: 'Unlawful Entry - Dwelling (No Violence)' },
  'Unlawful Entry With Violence - Dwelling':            { group: 'Break and enter', type: 'Unlawful Entry - Dwelling (Violence)' },
  'Unlawful Entry With Intent - Shop':                  { group: 'Break and enter', type: 'Unlawful Entry - Shop' },
  'Unlawful Entry With Intent - Other':                 { group: 'Break and enter', type: 'Unlawful Entry - Other' },
  'Arson':                                              { group: 'Property damage', type: 'Arson' },
  'Other Property Damage':                              { group: 'Property damage', type: 'Other Property Damage' },
  'Unlawful Use of Motor Vehicle':                      { group: 'Theft', type: 'Unlawful Use of Motor Vehicle' },
  'Other Theft (excl. Unlawful Entry)':                 { group: 'Theft', type: 'Other Theft' },
  'Stealing from Dwellings':                            { group: 'Theft', type: 'Stealing from Dwellings' },
  'Shop Stealing':                                      { group: 'Theft', type: 'Shop Stealing' },
  'Vehicles (steal from/enter with intent)':            { group: 'Theft', type: 'Steal from Vehicle' },
  'Other Stealing':                                     { group: 'Theft', type: 'Other Stealing' },
  'Fraud':                                              { group: 'Fraud', type: 'Fraud (Total)' },
  'Fraud by Computer':                                  { group: 'Fraud', type: 'Fraud by Computer' },
  'Fraud by Cheque':                                    { group: 'Fraud', type: 'Fraud by Cheque' },
  'Fraud by Credit Card':                               { group: 'Fraud', type: 'Fraud by Credit Card' },
  'Identity Fraud':                                     { group: 'Fraud', type: 'Identity Fraud' },
  'Other Fraud':                                        { group: 'Fraud', type: 'Other Fraud' },
  'Handling Stolen Goods':                              { group: 'Handling stolen goods', type: 'Handling Stolen Goods (Total)' },
  'Possess Property Suspected Stolen':                  { group: 'Handling stolen goods', type: 'Possess Property Suspected Stolen' },
  'Receiving Stolen Property':                          { group: 'Handling stolen goods', type: 'Receiving Stolen Property' },
  'Possess etc. Tainted Property':                      { group: 'Handling stolen goods', type: 'Possess Tainted Property' },
  'Other Handling Stolen Goods':                        { group: 'Handling stolen goods', type: 'Other Handling Stolen Goods' },

  // --- Drug Offences ---
  'Drug Offences':                                      { group: 'Drug offences', type: 'Drug Offences (Total)' },
  'Trafficking Drugs':                                  { group: 'Drug offences', type: 'Trafficking Drugs' },
  'Possess Drugs':                                      { group: 'Drug offences', type: 'Possess Drugs' },
  'Produce Drugs':                                      { group: 'Drug offences', type: 'Produce Drugs' },
  'Sell Supply Drugs':                                  { group: 'Drug offences', type: 'Sell Supply Drugs' },
  'Other Drug Offences':                                { group: 'Drug offences', type: 'Other Drug Offences' },

  // --- Other offences ---
  'Liquor (excl. Drunkenness)':                         { group: 'Liquor offences', type: 'Liquor (excl. Drunkenness)' },
  'Gaming Racing & Betting Offences':                   { group: 'Other offences', type: 'Gaming Racing & Betting' },
  'Breach Domestic Violence Protection Order':          { group: 'Against justice procedures', type: 'Breach DVO' },
  'Trespassing and Vagrancy':                           { group: 'Disorderly conduct', type: 'Trespassing and Vagrancy' },
  'Weapons Act Offences':                               { group: 'Weapons offences', type: 'Weapons Act Offences (Total)' },
  'Unlawful Possess Concealable Firearm':               { group: 'Weapons offences', type: 'Possess Concealable Firearm' },
  'Unlawful Possess Firearm - Other':                   { group: 'Weapons offences', type: 'Possess Firearm - Other' },
  'Bomb Possess and/or use of':                         { group: 'Weapons offences', type: 'Bomb Possess/Use' },
  'Possess and/or use other weapons; restricted items': { group: 'Weapons offences', type: 'Possess Other Weapons' },
  'Weapons Act Offences - Other':                       { group: 'Weapons offences', type: 'Weapons Act Offences - Other' },
  'Good Order Offences':                                { group: 'Disorderly conduct', type: 'Good Order Offences (Total)' },
  'Disobey Move-on Direction':                          { group: 'Disorderly conduct', type: 'Disobey Move-on Direction' },
  'Resist Incite Hinder Obstruct Police':               { group: 'Against justice procedures', type: 'Resist/Hinder Police' },
  'Fare Evasion':                                       { group: 'Other offences', type: 'Fare Evasion' },
  'Public Nuisance':                                    { group: 'Disorderly conduct', type: 'Public Nuisance' },
  'Stock Related Offences':                             { group: 'Other offences', type: 'Stock Related Offences' },
  'Traffic and Related Offences':                       { group: 'Traffic offences', type: 'Traffic Offences (Total)' },
  'Dangerous Operation of a Vehicle':                   { group: 'Traffic offences', type: 'Dangerous Operation of Vehicle' },
  'Drink Driving':                                      { group: 'Traffic offences', type: 'Drink Driving' },
  'Disqualified Driving':                               { group: 'Traffic offences', type: 'Disqualified Driving' },
  'Interfere with Mechanism of Motor Vehicle':          { group: 'Traffic offences', type: 'Interfere with Motor Vehicle' },
  'Miscellaneous Offences':                             { group: 'Other offences', type: 'Miscellaneous Offences' },
};

// Columns to skip entirely (not offence data)
const SKIP_COLUMNS = new Set([
  'LGA Name',
  'Month Year',
  'Voluntary Assisted Dying',
  'Other Miscellaneous',
  'Prostitution Offences',
  'Found in Places Used for Purpose of Prostitution Offences',
  'Have Interest in Premises Used for Prostitution Offences',
  'Knowingly Participate in Provision Prostitution Offences',
  'Public Soliciting',
  'Procuring Prostitution',
  'Permit Minor to be at a Place Used for Prostitution Offences',
  'Advertising Prostitution',
  'Other Prostitution Offences',
]);

// ---------------------------------------------------------------------------
// Parse CSV (handles quoted fields with commas)
// ---------------------------------------------------------------------------
function parseCSV(path) {
  const raw = readFileSync(path, 'utf-8');
  const lines = raw.trim().split('\n');

  // Simple CSV parse that handles quoted fields
  function parseLine(line) {
    const fields = [];
    let current = '';
    let inQuotes = false;
    for (let i = 0; i < line.length; i++) {
      const ch = line[i];
      if (ch === '"') {
        inQuotes = !inQuotes;
      } else if (ch === ',' && !inQuotes) {
        fields.push(current);
        current = '';
      } else {
        current += ch;
      }
    }
    fields.push(current);
    return fields;
  }

  const header = parseLine(lines[0]);
  const rows = [];
  for (let i = 1; i < lines.length; i++) {
    if (!lines[i].trim()) continue;
    const fields = parseLine(lines[i]);
    const row = {};
    for (let j = 0; j < header.length; j++) {
      row[header[j]] = fields[j];
    }
    rows.push(row);
  }
  return { header, rows };
}

// ---------------------------------------------------------------------------
// Determine the latest 12-month window and aggregate
// ---------------------------------------------------------------------------
function parsePeriod(s) {
  // Format: MMMYY e.g. "JAN01", "DEC25"
  const months = { JAN: 0, FEB: 1, MAR: 2, APR: 3, MAY: 4, JUN: 5, JUL: 6, AUG: 7, SEP: 8, OCT: 9, NOV: 10, DEC: 11 };
  const mon = s.slice(0, 3);
  const yr = parseInt(s.slice(3));
  const year = yr < 50 ? 2000 + yr : 1900 + yr;
  return { month: months[mon], year, label: s };
}

function periodToSortKey(s) {
  const { month, year } = parsePeriod(s);
  return year * 100 + month;
}

// ---------------------------------------------------------------------------
// Clean LGA name: strip "Shire Council", "Regional Council", etc.
// ---------------------------------------------------------------------------
function cleanLgaName(raw) {
  return raw
    .replace(/\s+(Shire|Regional|City|Town|Aboriginal Shire)\s+Council$/i, '')
    .replace(/\s+Council$/i, '')
    .trim();
}

// ---------------------------------------------------------------------------
// Main
// ---------------------------------------------------------------------------
console.log('Loading CSVs...');
const countData = parseCSV(COUNTS_CSV);
const rateData = parseCSV(RATES_CSV);
console.log(`  Counts: ${countData.rows.length} rows, ${countData.header.length} columns`);
console.log(`  Rates:  ${rateData.rows.length} rows, ${rateData.header.length} columns`);

// Find all periods and pick the latest 12 months
const allPeriods = [...new Set(countData.rows.map(r => r['Month Year']))];
allPeriods.sort((a, b) => periodToSortKey(a) - periodToSortKey(b));
const latest12 = allPeriods.slice(-12);
const latestPeriodStart = latest12[0];
const latestPeriodEnd = latest12[latest12.length - 1];
const { month: startMonth, year: startYear } = parsePeriod(latestPeriodStart);
const { month: endMonth, year: endYear } = parsePeriod(latestPeriodEnd);

const monthNames = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];
const yearPeriodLabel = `${monthNames[startMonth]} ${startYear} - ${monthNames[endMonth]} ${endYear}`;
console.log(`\nLatest 12-month window: ${yearPeriodLabel}`);

// Filter to latest 12 months
const latestPeriodSet = new Set(latest12);
const countRows = countData.rows.filter(r => latestPeriodSet.has(r['Month Year']));
const rateRows = rateData.rows.filter(r => latestPeriodSet.has(r['Month Year']));
console.log(`  Filtered count rows: ${countRows.length}`);
console.log(`  Filtered rate rows:  ${rateRows.length}`);

// Identify which columns are offence types
const offenceColumns = countData.header.filter(h =>
  !SKIP_COLUMNS.has(h) &&
  !AGGREGATE_COLUMNS.has(h) &&
  OFFENCE_MAP[h]
);
console.log(`  Mapped offence columns: ${offenceColumns.length}`);

// Check for unmapped columns
const unmapped = countData.header.filter(h =>
  !SKIP_COLUMNS.has(h) &&
  !AGGREGATE_COLUMNS.has(h) &&
  !OFFENCE_MAP[h] &&
  h !== 'LGA Name' &&
  h !== 'Month Year'
);
if (unmapped.length > 0) {
  console.log(`  WARNING: Unmapped columns: ${unmapped.join(', ')}`);
}

// Aggregate counts and rates by LGA + offence type over the 12-month window
// Key: "LGA|offenceCol"
const countAgg = new Map();
const rateAgg = new Map();
const lgaNames = new Set();

for (const row of countRows) {
  const lga = row['LGA Name'];
  lgaNames.add(lga);
  for (const col of offenceColumns) {
    const key = `${lga}|${col}`;
    const val = parseFloat(row[col]) || 0;
    countAgg.set(key, (countAgg.get(key) || 0) + val);
  }
}

for (const row of rateRows) {
  const lga = row['LGA Name'];
  for (const col of offenceColumns) {
    const key = `${lga}|${col}`;
    const val = parseFloat(row[col]) || 0;
    // Average rate over the 12-month window
    rateAgg.set(key, (rateAgg.get(key) || 0) + val);
  }
}

// Convert rate sums to averages (divide by 12)
for (const [key, val] of rateAgg) {
  rateAgg.set(key, Math.round((val / 12) * 10) / 10);
}

console.log(`\nUnique LGAs: ${lgaNames.size}`);

// Build insert rows
const insertRows = [];
for (const lgaRaw of lgaNames) {
  const lgaClean = cleanLgaName(lgaRaw);
  for (const col of offenceColumns) {
    const mapping = OFFENCE_MAP[col];
    const key = `${lgaRaw}|${col}`;
    const incidents = Math.round(countAgg.get(key) || 0);
    const rate = rateAgg.get(key) || 0;

    // Skip zero-count rows to keep the table manageable
    if (incidents === 0 && rate === 0) continue;

    insertRows.push({
      lga_name: lgaClean,
      state: 'QLD',
      offence_group: mapping.group,
      offence_type: mapping.type,
      year_period: yearPeriodLabel,
      incidents,
      rate_per_100k: rate,
      source: 'QPS',
    });
  }
}

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

// Delete existing QLD data for this period to allow re-runs (idempotent)
console.log(`\nDeleting existing QLD data for period "${yearPeriodLabel}"...`);
const { error: delErr, count: delCount } = await supabase
  .from('crime_stats_lga')
  .delete()
  .eq('state', 'QLD')
  .eq('year_period', yearPeriodLabel);

if (delErr) {
  console.error('Delete error:', delErr.message);
} else {
  console.log(`  Deleted existing rows (if any)`);
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
console.log(`Source: QPS Open Crime Data`);
console.log(`Period: ${yearPeriodLabel}`);
console.log(`LGAs: ${lgaNames.size}`);
console.log(`Rows inserted: ${inserted}`);
console.log(`Batch errors: ${errors}`);

// Show sample data
console.log('\n=== SAMPLE DATA (first 10 rows) ===');
for (const row of insertRows.slice(0, 10)) {
  console.log(`  ${row.lga_name} | ${row.offence_group} | ${row.offence_type} | incidents=${row.incidents} | rate=${row.rate_per_100k}`);
}

// Show top LGAs by total incidents
const lgaTotals = new Map();
for (const row of insertRows) {
  lgaTotals.set(row.lga_name, (lgaTotals.get(row.lga_name) || 0) + row.incidents);
}
const topLgas = [...lgaTotals.entries()].sort((a, b) => b[1] - a[1]).slice(0, 15);
console.log('\n=== TOP 15 LGAs BY TOTAL INCIDENTS ===');
for (const [name, total] of topLgas) {
  console.log(`  ${name}: ${total.toLocaleString()}`);
}
