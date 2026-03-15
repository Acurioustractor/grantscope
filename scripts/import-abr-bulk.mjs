#!/usr/bin/env node

/**
 * ABR Bulk XML Import Agent
 *
 * Streams ABR bulk extract XML files from ZIPs directly into abr_registry table.
 * Each XML file is ~600MB with ~1M records per file, 20 files total = ~2.8M ABNs.
 *
 * The XML format has each <ABR> record on a single line with nested elements.
 * We use line-by-line regex parsing — no XML library needed.
 *
 * Usage:
 *   node --env-file=.env scripts/import-abr-bulk.mjs [--limit=N] [--file=N]
 *
 * Options:
 *   --limit=N       Stop after N total records
 *   --file=N        Only process file number N (1-20)
 *   --start-file=N  Start from file N (skip earlier files)
 */

import { createClient } from '@supabase/supabase-js';
import { execSync } from 'child_process';
import { createReadStream, existsSync, writeFileSync } from 'fs';
import { createInterface } from 'readline';
import { spawn } from 'child_process';

const SUPABASE_URL = process.env.SUPABASE_URL;
const SUPABASE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;
if (!SUPABASE_URL || !SUPABASE_KEY) { console.error('Missing env vars'); process.exit(1); }

const db = createClient(SUPABASE_URL, SUPABASE_KEY);
const DATA_DIR = '/tmp/abr-bulk';
const LIMIT = parseInt(process.argv.find(a => a.startsWith('--limit='))?.split('=')[1] || '0');
const FILE_NUM = parseInt(process.argv.find(a => a.startsWith('--file='))?.split('=')[1] || '0');
const START_FILE = parseInt(process.argv.find(a => a.startsWith('--start-file='))?.split('=')[1] || '0');

function log(msg) { console.log(`[${new Date().toISOString()}] ${msg}`); }

// ─── Parse a single ABR line into a record ────────────────────────────

function parseAbrLine(line) {
  if (!line.includes('<ABR ') && !line.includes('<ABR>')) return null;

  const r = {};

  // ABN: <ABN status="ACT" ABNStatusFromDate="19991101">11000000948</ABN>
  const abnMatch = line.match(/<ABN\s+status="(\w+)"\s+ABNStatusFromDate="(\d+)">(\d+)<\/ABN>/);
  if (!abnMatch) return null;
  r.status = abnMatch[1] === 'ACT' ? 'Active' : 'Cancelled';
  r.status_from_date = parseAbrDate(abnMatch[2]);
  r.abn = abnMatch[3];

  // Record last updated: <ABR recordLastUpdatedDate="20180216"
  const updMatch = line.match(/recordLastUpdatedDate="(\d+)"/);
  if (updMatch) r.record_updated_date = parseAbrDate(updMatch[1]);

  // Entity type: <EntityTypeInd>PUB</EntityTypeInd><EntityTypeText>Australian Public Company</EntityTypeText>
  const typeIndMatch = line.match(/<EntityTypeInd>([^<]+)<\/EntityTypeInd>/);
  if (typeIndMatch) r.entity_type_code = typeIndMatch[1];
  const typeTextMatch = line.match(/<EntityTypeText>([^<]+)<\/EntityTypeText>/);
  if (typeTextMatch) r.entity_type = typeTextMatch[1];

  // Main name: <NonIndividualName type="MN"><NonIndividualNameText>NAME</NonIndividualNameText>
  const mainNameMatch = line.match(/<NonIndividualName\s+type="MN"><NonIndividualNameText>([^<]+)<\/NonIndividualNameText>/);
  if (mainNameMatch) {
    r.entity_name = mainNameMatch[1];
  } else {
    // Individual name: <IndividualName><GivenName>X</GivenName><FamilyName>Y</FamilyName>
    const familyMatch = line.match(/<FamilyName>([^<]+)<\/FamilyName>/);
    const givenMatch = line.match(/<GivenName>([^<]+)<\/GivenName>/);
    if (familyMatch) {
      r.entity_name = givenMatch ? `${givenMatch[1]} ${familyMatch[1]}` : familyMatch[1];
    }
  }

  if (!r.entity_name) return null;

  // Address: <State>NSW</State><Postcode>2000</Postcode>
  const stateMatch = line.match(/<State>([^<]+)<\/State>/);
  if (stateMatch) r.state = stateMatch[1];
  const pcMatch = line.match(/<Postcode>([^<]+)<\/Postcode>/);
  if (pcMatch && pcMatch[1] !== '0000') r.postcode = pcMatch[1];

  // ASIC number: <ASICNumber ASICNumberType="undetermined">000000948</ASICNumber>
  const acnMatch = line.match(/<ASICNumber[^>]*>(\d+)<\/ASICNumber>/);
  if (acnMatch) r.acn = acnMatch[1];

  // GST: <GST status="ACT" GSTStatusFromDate="20000701" />
  const gstMatch = line.match(/<GST\s+status="(\w+)"\s+GSTStatusFromDate="(\d+)"/);
  if (gstMatch) {
    r.gst_status = gstMatch[1] === 'ACT' ? 'Active' : 'Cancelled';
    r.gst_from_date = parseAbrDate(gstMatch[2]);
  }

  // ACNC: <CharityType> or <CharityConcession>
  if (line.includes('<CharityType>') || line.includes('<CharityConcession>')) {
    r.acnc_registered = true;
    const charityTypeMatch = line.match(/<CharityTypeDescription>([^<]+)<\/CharityTypeDescription>/);
    if (charityTypeMatch) r.charity_type = charityTypeMatch[1];
  }

  // Trading names: <NonIndividualName type="TRD"><NonIndividualNameText>NAME</NonIndividualNameText>
  const tradingNames = [];
  const trdRegex = /<NonIndividualName\s+type="(?:TRD|BN)"><NonIndividualNameText>([^<]+)<\/NonIndividualNameText>/g;
  let trdMatch;
  while ((trdMatch = trdRegex.exec(line)) !== null) {
    tradingNames.push(trdMatch[1]);
  }
  // Also check <BusinessName>
  const bnRegex = /<BusinessName[^>]*><OrganisationName>([^<]+)<\/OrganisationName>/g;
  let bnMatch;
  while ((bnMatch = bnRegex.exec(line)) !== null) {
    tradingNames.push(bnMatch[1]);
  }
  if (tradingNames.length > 0) r.trading_names = tradingNames;

  return r;
}

function parseAbrDate(d) {
  if (!d || d.length !== 8) return null;
  return `${d.slice(0, 4)}-${d.slice(4, 6)}-${d.slice(6, 8)}`;
}

// ─── Stream XML from ZIP without extracting ───────────────────────────

async function* streamXmlFromZip(zipPath, xmlName) {
  const unzip = spawn('unzip', ['-p', zipPath, xmlName], {
    stdio: ['ignore', 'pipe', 'pipe']
  });

  let stderrData = '';
  unzip.stderr.on('data', (d) => { stderrData += d.toString(); });

  const rl = createInterface({ input: unzip.stdout, crlfDelay: Infinity });

  for await (const line of rl) {
    yield line;
  }

  // Wait for unzip to fully close
  const exitCode = await new Promise((resolve) => {
    if (unzip.exitCode !== null) resolve(unzip.exitCode);
    else unzip.on('close', resolve);
  });

  if (exitCode !== 0 && stderrData) {
    log(`  unzip stderr (exit ${exitCode}): ${stderrData.trim().slice(0, 200)}`);
  }
}

// ─── Upsert batch via Supabase ────────────────────────────────────────

async function upsertBatch(records) {
  const rows = records.map(r => ({
    abn: r.abn,
    entity_name: r.entity_name,
    entity_type: r.entity_type || null,
    entity_type_code: r.entity_type_code || null,
    status: r.status || 'Active',
    status_from_date: r.status_from_date || null,
    postcode: r.postcode || null,
    state: r.state || null,
    acn: r.acn || null,
    gst_status: r.gst_status || null,
    gst_from_date: r.gst_from_date || null,
    acnc_registered: r.acnc_registered || false,
    charity_type: r.charity_type || null,
    trading_names: r.trading_names || [],
    record_updated_date: r.record_updated_date || null,
  }));

  const { error } = await db
    .from('abr_registry')
    .upsert(rows, { onConflict: 'abn', ignoreDuplicates: false });

  if (error) throw new Error(`Upsert error: ${error.message}`);
  return rows.length;
}

// ─── Main ─────────────────────────────────────────────────────────────

async function main() {
  log('=== ABR Bulk XML Import ===');
  const t0 = Date.now();

  // List ZIP files and their XML contents
  const zips = ['public_split_1_10.zip', 'public_split_11_20.zip']
    .map(z => `${DATA_DIR}/${z}`)
    .filter(z => existsSync(z));

  if (zips.length === 0) {
    log('No ZIP files found in ' + DATA_DIR);
    process.exit(1);
  }

  // Get all XML filenames from ZIPs
  const xmlFiles = [];
  for (const zip of zips) {
    const listing = execSync(`unzip -l "${zip}" | grep '\\.xml$' | awk '{print $NF}'`).toString().trim();
    for (const name of listing.split('\n').filter(Boolean)) {
      xmlFiles.push({ zip, name });
    }
  }

  log(`Found ${xmlFiles.length} XML files across ${zips.length} ZIPs`);

  // Filter to specific file if requested
  const filesToProcess = FILE_NUM > 0
    ? xmlFiles.filter((_, i) => i + 1 === FILE_NUM)
    : START_FILE > 0
      ? xmlFiles.filter((_, i) => i + 1 >= START_FILE)
      : xmlFiles;

  let totalImported = 0;
  let totalParsed = 0;
  let totalSkipped = 0;

  const BATCH_SIZE = 500;

  for (const { zip, name } of filesToProcess) {
    const fileStart = Date.now();
    log(`--- Processing ${name} from ${zip.split('/').pop()} ---`);

    let batch = [];
    let fileImported = 0;
    let fileParsed = 0;
    let fileSkipped = 0;
    let retries = 0;

    try {
    for await (const line of streamXmlFromZip(zip, name)) {
      const record = parseAbrLine(line);
      if (!record) {
        if (line.includes('<ABR ')) fileSkipped++;
        continue;
      }

      fileParsed++;
      batch.push(record);

      if (batch.length >= BATCH_SIZE) {
        // Retry logic for transient errors
        for (let attempt = 0; attempt < 3; attempt++) {
          try {
            await upsertBatch(batch);
            fileImported += batch.length;
            break;
          } catch (e) {
            retries++;
            if (attempt === 2) {
              log(`  FAILED batch at ${fileParsed}: ${e.message}`);
            } else {
              await new Promise(r => setTimeout(r, 1000 * (attempt + 1)));
            }
          }
        }
        batch = [];

        if (fileParsed % 50000 === 0) {
          const rate = (fileParsed / ((Date.now() - fileStart) / 1000)).toFixed(0);
          log(`  [${fileParsed.toLocaleString()}] imported=${fileImported.toLocaleString()} (${rate}/s)`);
        }
      }

      if (LIMIT && totalImported + fileImported >= LIMIT) break;
    }

    // Flush remaining
    if (batch.length > 0) {
      try {
        await upsertBatch(batch);
        fileImported += batch.length;
      } catch (e) {
        log(`  Final batch error: ${e.message}`);
      }
    }

    totalImported += fileImported;
    totalParsed += fileParsed;
    totalSkipped += fileSkipped;

    const fileElapsed = ((Date.now() - fileStart) / 1000).toFixed(1);
    log(`  Done: ${fileImported.toLocaleString()} imported, ${fileSkipped} skipped, ${retries} retries in ${fileElapsed}s`);

    if (LIMIT && totalImported >= LIMIT) {
      log(`Limit reached: ${totalImported.toLocaleString()}`);
      break;
    }
    } catch (fileErr) {
      log(`  ERROR processing ${name}: ${fileErr.message}`);
      log(`  Continuing to next file...`);
      totalImported += fileImported;
      totalParsed += fileParsed;
      totalSkipped += fileSkipped;
    }
  }

  const elapsed = ((Date.now() - t0) / 1000 / 60).toFixed(1);
  log(`=== COMPLETE === ${totalImported.toLocaleString()} records imported in ${elapsed} min (${totalSkipped} skipped)`);

  // Quick stats
  const { count } = await db.from('abr_registry').select('*', { count: 'exact', head: true });
  log(`abr_registry total rows: ${count?.toLocaleString()}`);

  const { count: activeCount } = await db.from('abr_registry').select('*', { count: 'exact', head: true }).eq('status', 'Active');
  log(`  Active: ${activeCount?.toLocaleString()}`);
}

main().catch(e => { console.error(e); process.exit(1); });
