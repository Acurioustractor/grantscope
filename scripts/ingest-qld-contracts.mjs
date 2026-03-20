#!/usr/bin/env node
/**
 * ingest-qld-contracts.mjs
 *
 * Downloads QLD government awarded contracts from data.qld.gov.au (CKAN API)
 * and ingests into austender_contracts, matching suppliers to gs_entities by name.
 *
 * Data source: Queensland Government Contracts Directory (Awarded Contracts)
 * https://www.data.qld.gov.au/dataset/queensland-government-contracts-directory-awarded-contracts
 *
 * Note: QLD data does NOT include supplier ABNs — entity matching is name-based only.
 *
 * Usage:
 *   node --env-file=.env scripts/ingest-qld-contracts.mjs            # dry run (default)
 *   node --env-file=.env scripts/ingest-qld-contracts.mjs --live      # insert into DB
 *   node --env-file=.env scripts/ingest-qld-contracts.mjs --limit=100 # cap records fetched
 */

import { createClient } from '@supabase/supabase-js';
import { logStart, logComplete, logFailed } from './lib/log-agent-run.mjs';

// ─── Config ─────────────────────────────────────────────────────────
const LIVE = process.argv.includes('--live');
const limitArg = process.argv.find(a => a.startsWith('--limit='));
const RECORD_LIMIT = limitArg ? parseInt(limitArg.split('=')[1], 10) : Infinity;
const BATCH_SIZE = 500;
const CKAN_BASE = 'https://www.data.qld.gov.au/api/3/action';
const PACKAGE_ID = 'queensland-government-contracts-directory-awarded-contracts';
const AGENT_ID = 'ingest-qld-contracts';
const AGENT_NAME = 'Ingest QLD Contracts';

// ─── Supabase ───────────────────────────────────────────────────────
const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL || process.env.SUPABASE_URL;
const SUPABASE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!SUPABASE_URL || !SUPABASE_KEY) {
  console.error('Missing SUPABASE_URL / NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY');
  process.exit(1);
}

const db = createClient(SUPABASE_URL, SUPABASE_KEY);

// ─── Logging ────────────────────────────────────────────────────────
function ts() {
  return new Date().toLocaleTimeString('en-AU', { hour12: false });
}
function log(msg) {
  console.log(`[${ts()}] ${msg}`);
}

// ─── Stats ──────────────────────────────────────────────────────────
const stats = {
  fetched: 0,
  inserted: 0,
  skipped: 0,
  errors: 0,
  duplicates: 0,
  entityMatches: 0,
};

// ─── Phase 1: Discover resource ID ─────────────────────────────────
async function discoverResourceId() {
  log('Phase 1: Discovering resource ID via CKAN API...');
  const url = `${CKAN_BASE}/package_show?id=${PACKAGE_ID}`;
  const resp = await fetch(url);
  if (!resp.ok) throw new Error(`CKAN package_show failed: ${resp.status}`);
  const body = await resp.json();
  const resources = body.result.resources;
  const csv = resources.find(r => r.format?.toUpperCase() === 'CSV');
  if (!csv) throw new Error('No CSV resource found in package');
  log(`  Resource ID: ${csv.id}`);
  log(`  Last modified: ${csv.last_modified || csv.metadata_modified || 'unknown'}`);
  return csv.id;
}

// ─── Phase 2: Fetch records via CKAN datastore API ──────────────────
async function fetchRecords(resourceId) {
  log('Phase 2: Fetching records via CKAN datastore API...');
  const PAGE = 1000;
  const records = [];
  let offset = 0;

  while (records.length < RECORD_LIMIT) {
    const limit = Math.min(PAGE, RECORD_LIMIT - records.length);
    const url = `${CKAN_BASE}/datastore_search?resource_id=${resourceId}&limit=${limit}&offset=${offset}`;
    const resp = await fetch(url);
    if (!resp.ok) throw new Error(`datastore_search failed: ${resp.status} at offset ${offset}`);
    const body = await resp.json();
    const batch = body.result.records;
    if (!batch?.length) break;
    records.push(...batch);
    offset += batch.length;
    if (records.length % 5000 === 0 || batch.length < limit) {
      log(`  Fetched ${records.length} / ${body.result.total} records`);
    }
    if (batch.length < limit) break;
  }

  stats.fetched = records.length;
  log(`  Total fetched: ${records.length}`);
  return records;
}

// ─── Phase 3: Transform records ─────────────────────────────────────
function parseDate(dateStr) {
  if (!dateStr) return null;
  // CKAN returns ISO timestamps like "2018-12-17T00:00:00"
  const d = new Date(dateStr);
  if (isNaN(d.getTime())) return null;
  return d.toISOString().split('T')[0]; // YYYY-MM-DD
}

function parseValue(val) {
  if (!val) return null;
  const cleaned = String(val).replace(/[,$\s]/g, '');
  const num = parseFloat(cleaned);
  return isNaN(num) ? null : num;
}

function transformRecord(raw) {
  const agencyName = (raw['Agency Name'] || '').trim();
  const supplierName = (raw['Supplier Name'] || '').trim();
  const description = (raw['Description'] || '').trim();
  const value = parseValue(raw['Value']);
  const date = parseDate(raw['Date']);

  if (!supplierName && !agencyName) return null;

  // Generate a deterministic OCID for deduplication
  const ocid = `qld-${raw._id}`;

  return {
    ocid,
    title: description || null,
    description: description || null,
    contract_value: value,
    currency: 'AUD',
    buyer_name: agencyName || null,
    supplier_name: supplierName || null,
    supplier_abn: null, // QLD data does not include ABNs
    contract_start: date,
    source_url: `https://www.data.qld.gov.au/dataset/${PACKAGE_ID}`,
  };
}

function transformAll(rawRecords) {
  log('Phase 3: Transforming records...');
  const transformed = [];
  for (const raw of rawRecords) {
    const row = transformRecord(raw);
    if (row) {
      transformed.push(row);
    } else {
      stats.skipped++;
    }
  }
  log(`  Transformed: ${transformed.length}, Skipped (empty): ${stats.skipped}`);
  return transformed;
}

// ─── Phase 4: Upsert into austender_contracts ───────────────────────
async function upsertBatch(rows) {
  // Use upsert with onConflict on ocid to avoid duplicates
  const { data, error } = await db
    .from('austender_contracts')
    .upsert(rows, { onConflict: 'ocid', ignoreDuplicates: false })
    .select('id');

  if (error) {
    // If batch fails, try individual inserts to isolate bad rows
    log(`  Batch upsert error: ${error.message} — falling back to row-by-row`);
    let batchInserted = 0;
    for (const row of rows) {
      const { error: rowErr } = await db
        .from('austender_contracts')
        .upsert(row, { onConflict: 'ocid', ignoreDuplicates: false });
      if (rowErr) {
        stats.errors++;
      } else {
        batchInserted++;
      }
    }
    return batchInserted;
  }

  return data?.length || rows.length;
}

async function upsertAll(records) {
  log(`Phase 4: ${LIVE ? 'LIVE' : 'DRY RUN'} — upserting ${records.length} records (batch size ${BATCH_SIZE})...`);

  if (!LIVE) {
    log('  [DRY RUN] Showing 3 sample records:');
    for (const rec of records.slice(0, 3)) {
      console.log(JSON.stringify(rec, null, 2));
    }
    log(`  [DRY RUN] Would upsert ${records.length} records into austender_contracts`);
    log('  [DRY RUN] Re-run with --live to insert.');
    return;
  }

  for (let i = 0; i < records.length; i += BATCH_SIZE) {
    const batch = records.slice(i, i + BATCH_SIZE);
    const count = await upsertBatch(batch);
    stats.inserted += count;
    if ((i + BATCH_SIZE) % 2000 === 0 || i + BATCH_SIZE >= records.length) {
      log(`  Progress: ${Math.min(i + BATCH_SIZE, records.length)} / ${records.length} (inserted: ${stats.inserted}, errors: ${stats.errors})`);
    }
  }

  log(`  Upsert complete: ${stats.inserted} inserted/updated, ${stats.errors} errors`);
}

// ─── Phase 5: Entity matching summary ───────────────────────────────
function normalize(name) {
  return name.toLowerCase().trim()
    .replace(/\s+/g, ' ')
    .replace(/^the\s+/, '')
    .replace(/\s+(inc\.?|ltd\.?|limited|incorporated|pty|pty ltd|co\.?|corporation|association|foundation|trust)$/i, '')
    .replace(/[.,]/g, '');
}

async function loadEntityCache() {
  log('Phase 5: Loading entity cache for name matching...');
  const cache = new Map(); // normalized name -> { id, gs_id, canonical_name, abn }
  const abnIndex = new Map(); // abn -> entity
  const PAGE = 1000;
  let from = 0;
  let total = 0;

  while (true) {
    const { data } = await db.from('gs_entities')
      .select('id, gs_id, canonical_name, abn')
      .range(from, from + PAGE - 1);
    if (!data?.length) break;
    for (const e of data) {
      const norm = normalize(e.canonical_name);
      cache.set(norm, e);
      // Also index shorter form without suffixes
      const short = norm.replace(/\s+(inc|ltd|limited|incorporated|pty|association|foundation|trust)$/i, '');
      if (short !== norm) cache.set(short, e);
      if (e.abn) abnIndex.set(e.abn, e);
    }
    total += data.length;
    from += PAGE;
    if (data.length < PAGE) break;
  }

  log(`  Entity cache: ${cache.size} name entries from ${total} entities, ${abnIndex.size} ABN entries`);
  return { cache, abnIndex };
}

async function entityMatchingSummary(records) {
  if (!LIVE) {
    log('Phase 5: [DRY RUN] Skipping entity matching (run with --live).');

    // Still show a quick match preview
    const { cache } = await loadEntityCache();
    const uniqueSuppliers = new Map();
    for (const r of records) {
      if (r.supplier_name && !uniqueSuppliers.has(r.supplier_name)) {
        uniqueSuppliers.set(r.supplier_name, r);
      }
    }

    let matched = 0;
    let unmatched = 0;
    const unmatchedSample = [];
    for (const [name] of uniqueSuppliers) {
      const norm = normalize(name);
      if (cache.has(norm)) {
        matched++;
      } else {
        unmatched++;
        if (unmatchedSample.length < 5) unmatchedSample.push(name);
      }
    }

    log(`  [DRY RUN] Name match preview: ${matched} / ${matched + unmatched} unique suppliers matched (${((matched / (matched + unmatched)) * 100).toFixed(1)}%)`);
    if (unmatchedSample.length) {
      log(`  [DRY RUN] Sample unmatched: ${unmatchedSample.join(', ')}`);
    }
    return;
  }

  const { cache } = await loadEntityCache();

  // Collect unique suppliers from the records we just inserted
  const uniqueSuppliers = new Map();
  for (const r of records) {
    if (r.supplier_name && !uniqueSuppliers.has(r.supplier_name)) {
      uniqueSuppliers.set(r.supplier_name, r);
    }
  }

  log(`  Unique suppliers: ${uniqueSuppliers.size}`);

  let matched = 0;
  let unmatched = 0;
  const topUnmatched = [];
  const matchedNames = [];

  for (const [name] of uniqueSuppliers) {
    const norm = normalize(name);
    const entity = cache.get(norm);
    if (entity) {
      matched++;
      matchedNames.push(`${name} -> ${entity.canonical_name} (${entity.gs_id})`);
    } else {
      unmatched++;
      if (topUnmatched.length < 10) topUnmatched.push(name);
    }
  }

  stats.entityMatches = matched;
  log(`  Entity match rate: ${matched} / ${matched + unmatched} unique suppliers (${((matched / (matched + unmatched)) * 100).toFixed(1)}%)`);
  if (matchedNames.length <= 10) {
    for (const m of matchedNames) log(`    MATCHED: ${m}`);
  } else {
    for (const m of matchedNames.slice(0, 5)) log(`    MATCHED: ${m}`);
    log(`    ... and ${matchedNames.length - 5} more`);
  }
  if (topUnmatched.length) {
    log('  Sample unmatched suppliers:');
    for (const u of topUnmatched) log(`    UNMATCHED: ${u}`);
  }
}

// ─── Main ───────────────────────────────────────────────────────────
async function main() {
  log(`=== QLD Contracts Ingestion ${LIVE ? '(LIVE)' : '(DRY RUN)'} ===`);
  if (RECORD_LIMIT < Infinity) log(`  Record limit: ${RECORD_LIMIT}`);

  let runId = null;
  if (LIVE) {
    const run = await logStart(db, AGENT_ID, AGENT_NAME);
    runId = run.id;
  }

  try {
    const resourceId = await discoverResourceId();
    const rawRecords = await fetchRecords(resourceId);
    const records = transformAll(rawRecords);
    await upsertAll(records);
    await entityMatchingSummary(records);

    // Summary
    log('');
    log('=== Summary ===');
    log(`  Mode:      ${LIVE ? 'LIVE' : 'DRY RUN'}`);
    log(`  Fetched:   ${stats.fetched}`);
    log(`  Inserted:  ${stats.inserted}`);
    log(`  Skipped:   ${stats.skipped}`);
    log(`  Errors:    ${stats.errors}`);
    log(`  Matches:   ${stats.entityMatches} unique suppliers matched to gs_entities`);
    log('');

    if (runId) {
      await logComplete(db, runId, {
        items_found: stats.fetched,
        items_new: stats.inserted,
      });
    }
  } catch (err) {
    log(`FATAL: ${err.message}`);
    console.error(err);
    if (runId) await logFailed(db, runId, err);
    process.exit(1);
  }
}

main();
