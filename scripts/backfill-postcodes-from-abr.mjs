#!/usr/bin/env node
/**
 * backfill-postcodes-from-abr.mjs
 *
 * Parses the ABR Bulk Extract XML files (from data.gov.au) and backfills
 * postcode + state on gs_entities that have an ABN but no postcode.
 *
 * Data source: https://data.gov.au/data/dataset/abn-bulk-extract
 * No API key or GUID required — this is open data (CC BY 3.0 AU).
 *
 * Prerequisites:
 *   1. Download ABR bulk extract ZIP files into data/abr/
 *      curl -L -o data/abr/public_split_1_10.zip "https://data.gov.au/data/dataset/5bd7fcab-e315-42cb-8daf-50b7efc2027e/resource/0ae4d427-6fa8-4d40-8e76-c6909b5a071b/download/public_split_1_10.zip"
 *      curl -L -o data/abr/public_split_11_20.zip "https://data.gov.au/data/dataset/5bd7fcab-e315-42cb-8daf-50b7efc2027e/resource/635fcb95-7864-4509-9fa7-a62a6e32b62d/download/public_split_11_20.zip"
 *
 * Usage:
 *   node --env-file=.env scripts/backfill-postcodes-from-abr.mjs              # dry run
 *   node --env-file=.env scripts/backfill-postcodes-from-abr.mjs --apply      # update DB
 */

import { execSync } from 'child_process';
import { readdirSync, existsSync, writeFileSync, unlinkSync } from 'fs';
import { join } from 'path';

const DRY_RUN = !process.argv.includes('--apply');
const DATA_DIR = join(import.meta.dirname, '..', 'data', 'abr');

const pw = process.env.DATABASE_PASSWORD;
if (!pw) { console.error('Missing DATABASE_PASSWORD in .env'); process.exit(1); }
const CONN = `postgresql://postgres.tednluwflfhxyucgwigh:${pw}@aws-0-ap-southeast-2.pooler.supabase.com:5432/postgres`;

function psql(sql, timeout = 120000) {
  const cmd = `psql "${CONN}" -t -A -c ${JSON.stringify(sql)}`;
  return execSync(cmd, { encoding: 'utf8', timeout }).trim();
}

function log(msg) {
  console.log(`[abr-backfill] ${msg}`);
}

// --- 1. Load ABNs needing postcodes ---
log('Loading entities with ABN but no postcode...');
const raw = psql(`SELECT abn FROM gs_entities WHERE abn IS NOT NULL AND postcode IS NULL`);
const needsPostcode = new Set(raw.split('\n').filter(Boolean));
log(`  ${needsPostcode.size} entities need postcode`);

if (needsPostcode.size === 0) {
  log('Nothing to do — all entities with ABN already have postcodes.');
  process.exit(0);
}

// Write ABN list to temp file for grep matching
const abnListFile = join(DATA_DIR, '_abn_lookup.txt');
writeFileSync(abnListFile, Array.from(needsPostcode).join('\n'));

// --- 2. Find ZIP/XML files ---
if (!existsSync(DATA_DIR)) {
  console.error(`Data directory not found: ${DATA_DIR}`);
  process.exit(1);
}

const zipFiles = readdirSync(DATA_DIR).filter(f => f.endsWith('.zip')).sort();
const xmlFiles = readdirSync(DATA_DIR).filter(f => f.endsWith('.xml')).sort();

if (zipFiles.length === 0 && xmlFiles.length === 0) {
  console.error('No ZIP or XML files found in data/abr/');
  process.exit(1);
}

log(`Found ${zipFiles.length} ZIP files, ${xmlFiles.length} XML files`);

// --- 3. Extract ABN → postcode+state using streaming grep ---
// Each <ABR> record is on one line. We extract ABN, State, Postcode with grep+sed.
// This handles 6GB+ files efficiently via piped streaming.

const matches = new Map(); // ABN → { state, postcode }

function processXmlStream(source, label) {
  log(`  Processing ${label}...`);

  // Use grep to find lines containing active ABNs, then extract fields
  // Pattern: <ABN status="ACT" ...>XXXXXXXXXXX</ABN>...<State>XX</State><Postcode>XXXX</Postcode>
  try {
    const result = execSync(
      `${source} | grep -o '<ABN status="ACT"[^>]*>[0-9]\\{11\\}</ABN>.*<Postcode>[0-9]\\{4\\}</Postcode>' | sed 's/.*<ABN[^>]*>\\([0-9]\\{11\\}\\)<\\/ABN>.*<State>\\([A-Z]*\\)<\\/State><Postcode>\\([0-9]\\{4\\}\\)<\\/Postcode>.*/\\1|\\2|\\3/'`,
      { encoding: 'utf8', maxBuffer: 200 * 1024 * 1024, timeout: 600000 }
    );

    let fileMatches = 0;
    for (const line of result.split('\n')) {
      if (!line) continue;
      const [abn, state, postcode] = line.split('|');
      if (abn && postcode && needsPostcode.has(abn)) {
        matches.set(abn, { state: state || null, postcode });
        fileMatches++;
      }
    }
    log(`    ${fileMatches} matches found`);
  } catch (err) {
    // grep returns exit code 1 if no matches — that's ok
    if (err.status !== 1) {
      log(`    Error: ${err.message?.slice(0, 200)}`);
    } else {
      log(`    0 matches`);
    }
  }
}

// Process ZIP files (stream via unzip -p without extracting to disk)
for (const zf of zipFiles) {
  const zipPath = join(DATA_DIR, zf);
  // List XML files inside the zip
  const listing = execSync(`unzip -l "${zipPath}" | grep '\\.xml$' | awk '{print $4}'`, { encoding: 'utf8' });
  const xmlInZip = listing.trim().split('\n').filter(Boolean);

  for (const xmlName of xmlInZip) {
    processXmlStream(`unzip -p "${zipPath}" "${xmlName}"`, `${zf}/${xmlName}`);
  }
}

// Process any already-extracted XML files
for (const xf of xmlFiles) {
  processXmlStream(`cat "${join(DATA_DIR, xf)}"`, xf);
}

// Clean up temp file
try { unlinkSync(abnListFile); } catch {}

log(`\nScan complete: ${matches.size} matches for ${needsPostcode.size} entities`);

if (matches.size === 0) {
  log('No matches found.');
  process.exit(0);
}

// --- 4. Apply updates ---
if (DRY_RUN) {
  log(`\nDRY RUN — would update ${matches.size} entities with postcodes`);
  let i = 0;
  for (const [abn, { state, postcode }] of matches) {
    if (i++ >= 15) break;
    log(`  ABN ${abn} → ${postcode}, ${state}`);
  }
  if (matches.size > 15) log(`  ... and ${matches.size - 15} more`);
  log('\nRun with --apply to update the database.');
  process.exit(0);
}

log(`\nApplying ${matches.size} postcode updates...`);
const BATCH_SIZE = 500;
const entries = Array.from(matches.entries());
let updated = 0;

for (let i = 0; i < entries.length; i += BATCH_SIZE) {
  const batch = entries.slice(i, i + BATCH_SIZE);
  const values = batch
    .map(([abn, { state, postcode }]) =>
      `('${abn}', '${postcode}', ${state ? `'${state}'` : 'NULL'})`
    )
    .join(',\n');

  const sql = `
    UPDATE gs_entities e
    SET postcode = v.postcode,
        state = COALESCE(e.state, v.state)
    FROM (VALUES ${values}) AS v(abn, postcode, state)
    WHERE e.abn = v.abn AND e.postcode IS NULL
  `;

  // Write to temp file to avoid shell quoting issues
  const tmpFile = join(DATA_DIR, '_batch_update.sql');
  writeFileSync(tmpFile, sql);
  try {
    const result = execSync(`psql "${CONN}" -f "${tmpFile}"`, { encoding: 'utf8', timeout: 60000 });
    const count = parseInt(result.match(/UPDATE (\d+)/)?.[1] || '0');
    updated += count;
  } catch (err) {
    log(`  Batch error at offset ${i}: ${err.message?.slice(0, 200)}`);
  }
  try { unlinkSync(tmpFile); } catch {}

  if ((i + BATCH_SIZE) % 2000 === 0) {
    log(`  Progress: ${Math.min(i + BATCH_SIZE, entries.length)}/${entries.length}, ${updated} updated`);
  }
}

log(`  Postcodes updated: ${updated}`);

// --- 5. Cascade: backfill remoteness, SEIFA, LGA from postcode ---
log('\nCascading geographic enrichment from new postcodes...');

const remSql = `UPDATE gs_entities e SET remoteness = pg.remoteness_2021 FROM postcode_geo pg WHERE e.postcode = pg.postcode AND e.remoteness IS NULL AND pg.remoteness_2021 IS NOT NULL`;
const seifaSql = `UPDATE gs_entities e SET seifa_irsd_decile = s.decile_national FROM seifa_2021 s WHERE e.postcode = s.postcode AND s.index_type = 'IRSD' AND e.seifa_irsd_decile IS NULL`;
const lgaSql = `UPDATE gs_entities e SET lga_name = pg.lga_name FROM postcode_geo pg WHERE e.postcode = pg.postcode AND e.lga_name IS NULL AND pg.lga_name IS NOT NULL`;

for (const [label, sql] of [['Remoteness', remSql], ['SEIFA', seifaSql], ['LGA', lgaSql]]) {
  const tmpFile = join(DATA_DIR, '_cascade.sql');
  writeFileSync(tmpFile, sql);
  try {
    const result = execSync(`psql "${CONN}" -f "${tmpFile}"`, { encoding: 'utf8', timeout: 120000 });
    log(`  ${label}: ${result.trim()}`);
  } catch (err) {
    log(`  ${label} error: ${err.message?.slice(0, 200)}`);
  }
  try { unlinkSync(tmpFile); } catch {}
}

// Final coverage stats
log('\nFinal coverage:');
const stats = psql(`SELECT COUNT(*) as total, COUNT(postcode) as with_postcode, COUNT(remoteness) as with_remoteness, COUNT(lga_name) as with_lga, COUNT(seifa_irsd_decile) as with_seifa FROM gs_entities`);
const [total, withPostcode, withRemoteness, withLga, withSeifa] = stats.split('|');
log(`  Entities:    ${Number(total).toLocaleString()}`);
log(`  Postcode:    ${Number(withPostcode).toLocaleString()} (${Math.round(withPostcode/total*100)}%)`);
log(`  Remoteness:  ${Number(withRemoteness).toLocaleString()} (${Math.round(withRemoteness/total*100)}%)`);
log(`  LGA:         ${Number(withLga).toLocaleString()} (${Math.round(withLga/total*100)}%)`);
log(`  SEIFA:       ${Number(withSeifa).toLocaleString()} (${Math.round(withSeifa/total*100)}%)`);
