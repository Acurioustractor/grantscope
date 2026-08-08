#!/usr/bin/env node
/**
 * Ingest South Australia crime data into crime_stats_lga, keyed on suburb.
 *
 * Source: SA Police reported crime statistics, published per suburb.
 *   https://data.sa.gov.au/data/dataset/crime-statistics
 *
 * WHY THIS WAS REWRITTEN
 *
 * The previous version aggregated to LGA through postcode_geo, which stored one
 * council per postcode and took whichever it saw first. Postcode 5690 spans
 * four councils, so every offence reported anywhere in it was filed against
 * Maralinga Tjarutja: 905 offences and 336 assaults attributed to a community of
 * a few hundred people. Oak Valley, the community actually in Maralinga
 * Tjarutja, reported 8 offences in 2024-25. Ceduna township reported 649.
 *
 * SAPOL publishes the suburb. It always did. The old script parsed it and then
 * threw it away in favour of the postcode. This one uses it, resolving suburb to
 * council through abs_locality_lga (ABS ASGS Ed3 SAL_2021 + LGA_2025).
 *
 * WHAT IT REFUSES TO DO
 *
 * Where ABS puts a locality in more than one council, the offences are not
 * assigned. They are counted, reported at the end, and left out. A number
 * attributed to the wrong community is worse than a number we admit we cannot
 * place, and this whole rewrite exists because of what the guess cost.
 *
 * Usage:
 *   node --env-file=.env scripts/ingest-crime-sa.mjs <path-to-csv>            # dry run
 *   node --env-file=.env scripts/ingest-crime-sa.mjs <path-to-csv> --apply
 */

import { readFileSync } from 'fs';
import { createClient } from '@supabase/supabase-js';

const args = process.argv.slice(2);
const APPLY = args.includes('--apply');
const CSV_PATH = args.find((a) => !a.startsWith('--')) || '/tmp/sa-crime-2024-25.csv';
const PERIOD = args.find((a) => a.startsWith('--period='))?.split('=')[1] || 'July 2024 - June 2025';

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

const db = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SECRET_KEY || process.env.SUPABASE_SERVICE_ROLE_KEY,
);

// Suburb -> council, SA only, and only where ABS gives exactly one answer.
// Paged: PostgREST caps a response at 1,000 rows whatever .limit() says.
const absRows = [];
for (let from = 0; ; from += 1000) {
  const { data: page, error } = await db
    .from('abs_locality_lga')
    .select('locality, lga_name, lga_count')
    .eq('state_name', 'South Australia')
    .range(from, from + 999);
  if (error) { console.error('ABS lookup failed:', error.message); process.exit(1); }
  if (!page?.length) break;
  absRows.push(...page);
  if (page.length < 1000) break;
}

const suburbToLga = new Map();
const ambiguous = new Set();
for (const row of absRows) {
  const key = row.locality.replace(/\s*\([A-Z]{2,3}\)\s*$/, '').trim().toUpperCase();
  if (row.lga_count === 1) suburbToLga.set(key, row.lga_name);
  else ambiguous.add(key);
}
console.log(`ABS: ${suburbToLga.size} SA suburbs resolve to one council, ${ambiguous.size} straddle several`);

// ---------------------------------------------------------------------------
const raw = readFileSync(CSV_PATH, 'utf-8').trim().split('\n');
const headers = raw[0].split(',').map((h) => h.trim());
const col = {
  suburb: headers.indexOf('Suburb - Incident'),
  level2: headers.indexOf('Offence Level 2 Description'),
  count: headers.indexOf('Offence count'),
};
if (Object.values(col).some((i) => i < 0)) {
  console.error(`Unexpected columns: ${headers.join(' | ')}`);
  process.exit(1);
}
console.log(`Reading ${CSV_PATH}: ${raw.length - 1} rows\n`);

const tally = new Map();          // "LGA|group|type" -> incidents
const lgaTotals = new Map();
let placed = 0, unplacedAmbiguous = 0, unplacedUnknown = 0, unmappedOffence = 0;
const unknownSuburbs = new Map();

for (let i = 1; i < raw.length; i++) {
  const parts = raw[i].split(',');
  const suburb = (parts[col.suburb] || '').trim().toUpperCase();
  const level2 = (parts[col.level2] || '').trim().toUpperCase();
  const count = parseInt(parts[col.count] || '0', 10) || 0;
  if (!suburb || !count) continue;

  const mapping = OFFENCE_MAP[level2];
  if (!mapping) { unmappedOffence += count; continue; }

  const lga = suburbToLga.get(suburb);
  if (!lga) {
    if (ambiguous.has(suburb)) unplacedAmbiguous += count;
    else { unplacedUnknown += count; unknownSuburbs.set(suburb, (unknownSuburbs.get(suburb) || 0) + count); }
    continue;
  }

  placed += count;
  const key = `${lga}|${mapping.group}|${mapping.type}`;
  tally.set(key, (tally.get(key) || 0) + count);
  lgaTotals.set(lga, (lgaTotals.get(lga) || 0) + count);
}

const rows = [];
for (const [key, incidents] of tally) {
  const [lga_name, offence_group, offence_type] = key.split('|');
  rows.push({ lga_name, state: 'SA', offence_group, offence_type, year_period: PERIOD, incidents, source: 'SAPOL' });
}
for (const [lga_name, incidents] of lgaTotals) {
  rows.push({ lga_name, state: 'SA', offence_group: 'Total', offence_type: 'All offences', year_period: PERIOD, incidents, source: 'SAPOL' });
}

const total = placed + unplacedAmbiguous + unplacedUnknown + unmappedOffence;
console.log(`Placed:              ${placed} offences across ${lgaTotals.size} councils`);
console.log(`Unplaced, ambiguous: ${unplacedAmbiguous}  (suburb straddles councils in ABS)`);
console.log(`Unplaced, unknown:   ${unplacedUnknown}  (suburb not in ABS)`);
console.log(`Offence not mapped:  ${unmappedOffence}`);
console.log(`Total in file:       ${total}  (${((100 * placed) / total).toFixed(1)}% placed)\n`);

if (unknownSuburbs.size) {
  const worst = [...unknownSuburbs.entries()].sort((a, b) => b[1] - a[1]).slice(0, 10);
  console.log('Largest unrecognised suburbs:');
  for (const [name, n] of worst) console.log(`  ${String(n).padStart(6)}  ${name}`);
  console.log();
}

console.log('Far West check:');
for (const name of ['Ceduna', 'Maralinga Tjarutja', 'Streaky Bay']) {
  console.log(`  ${name.padEnd(20)} ${lgaTotals.get(name) ?? 0}`);
}
console.log();

if (!APPLY) {
  console.log(`Dry run: ${rows.length} rows ready. Re-run with --apply to replace SA rows for "${PERIOD}".`);
  process.exit(0);
}

const { error: delError } = await db
  .from('crime_stats_lga')
  .delete()
  .eq('state', 'SA')
  .eq('year_period', PERIOD);
if (delError) { console.error('Delete failed:', delError.message); process.exit(1); }

for (let i = 0; i < rows.length; i += 500) {
  const { error: insError } = await db.from('crime_stats_lga').insert(rows.slice(i, i + 500));
  if (insError) { console.error('Insert failed:', insError.message); process.exit(1); }
}
console.log(`Wrote ${rows.length} rows for ${PERIOD}.`);
