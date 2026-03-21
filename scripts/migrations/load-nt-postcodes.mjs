#!/usr/bin/env node
/**
 * Load NT postcodes into postcode_geo from the Proctor CSV.
 * Fills the NT gap that makes Northern Territory invisible on the map.
 *
 * Uses: node --env-file=.env scripts/migrations/load-nt-postcodes.mjs
 */
import { readFileSync, writeFileSync } from 'fs';
import { parse } from 'csv-parse/sync';
import { execSync } from 'child_process';

const CSV_PATH = 'data/lga/australian_postcodes.csv';
const SQL_OUT = '/tmp/nt-postcodes-insert.sql';

function esc(val) {
  if (!val || val === '') return 'NULL';
  return `'${val.replace(/'/g, "''")}'`;
}

const csv = readFileSync(CSV_PATH, 'utf-8');
const records = parse(csv, { columns: true, skip_empty_lines: true });

const ntRows = records.filter(r => r.state === 'NT');
console.log(`Found ${ntRows.length} NT rows in CSV`);

const lines = ['BEGIN;', ''];

let count = 0;
for (const r of ntRows) {
  const lat = r.Lat_precise || r.lat;
  const lng = r.Long_precise || r.long;

  if (!lat || !lng || lat === '0' || lng === '0') continue;

  lines.push(
    `INSERT INTO postcode_geo (postcode, locality, state, latitude, longitude, sa2_code, sa2_name, sa3_code, sa3_name, sa4_code, sa4_name, remoteness_2021, lga_name, lga_code)` +
    ` VALUES (${esc(r.postcode)}, ${esc(r.locality)}, 'NT', ${lat}, ${lng}, ${esc(r.SA2_CODE_2021)}, ${esc(r.SA2_NAME_2021)}, ${esc(r.SA3_CODE_2021)}, ${esc(r.SA3_NAME_2021)}, ${esc(r.SA4_CODE_2021)}, ${esc(r.SA4_NAME_2021)}, ${esc(r.RA_2021_NAME)}, ${esc(r.lgaregion)}, ${esc(r.lgacode)})` +
    ` ON CONFLICT DO NOTHING;`
  );
  count++;
}

lines.push('', 'COMMIT;');
lines.push('', `-- Verify:`);
lines.push(`SELECT state, COUNT(*) FROM postcode_geo WHERE state = 'NT' GROUP BY state;`);
lines.push(`SELECT lga_name, COUNT(*) as cnt FROM postcode_geo WHERE state = 'NT' AND lga_name IS NOT NULL GROUP BY lga_name ORDER BY cnt DESC LIMIT 10;`);

writeFileSync(SQL_OUT, lines.join('\n'));
console.log(`Generated ${count} INSERT statements → ${SQL_OUT}`);

// Execute via psql
const host = 'aws-0-ap-southeast-2.pooler.supabase.com';
const user = 'postgres.tednluwflfhxyucgwigh';
const pw = process.env.DATABASE_PASSWORD;

if (!pw) {
  console.error('DATABASE_PASSWORD not set');
  process.exit(1);
}

console.log('Running via psql...');
const result = execSync(
  `PGPASSWORD="${pw}" psql -h ${host} -p 5432 -U "${user}" -d postgres -f ${SQL_OUT}`,
  { encoding: 'utf-8', timeout: 60000 }
);
console.log(result);
