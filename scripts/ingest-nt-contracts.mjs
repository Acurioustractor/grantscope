#!/usr/bin/env node
/**
 * ingest-nt-contracts.mjs
 *
 * Downloads and ingests NT Government awarded contracts data into austender_contracts.
 * Source: NT Open Data — XLSX spreadsheet of contracts >= $15K (from Feb 2013 onwards).
 *
 * Usage:
 *   node --env-file=.env scripts/ingest-nt-contracts.mjs          # dry run (default)
 *   node --env-file=.env scripts/ingest-nt-contracts.mjs --live   # insert into DB
 *   node --env-file=.env scripts/ingest-nt-contracts.mjs --download --live  # re-download + insert
 */

import { createClient } from '@supabase/supabase-js';
import { readFile, writeFile, mkdir } from 'fs/promises';
import { existsSync } from 'fs';
import XLSX from 'xlsx';
import { logStart, logComplete, logFailed } from './lib/log-agent-run.mjs';

const AGENT_ID = 'ingest-nt-contracts';
const AGENT_NAME = 'NT Contracts Ingest';

const db = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);
const LIVE = process.argv.includes('--live');
const DOWNLOAD = process.argv.includes('--download');
const DRY_RUN = !LIVE;

const DATA_DIR = 'data/state-procurement';
const XLSX_PATH = `${DATA_DIR}/nt-contracts.xlsx`;
const SOURCE_URL = 'https://nt.gov.au/__data/assets/excel_doc/0010/405487/government-awarded-contracts.xlsx';

function log(msg) { console.log(`[${new Date().toISOString().slice(11, 19)}] ${msg}`); }

// ── Helpers ──────────────────────────────────────────

function normaliseAbn(abn) {
  if (!abn) return null;
  const cleaned = String(abn).replace(/\s/g, '');
  if (/^\d{11}$/.test(cleaned)) return cleaned;
  return null;
}

function parseDate(str) {
  if (!str) return null;

  // Excel serial date number
  if (typeof str === 'number') {
    // Excel epoch: 1 Jan 1900, but with the Lotus 1-2-3 bug (day 60 = 29 Feb 1900)
    const epoch = new Date(1899, 11, 30);
    const d = new Date(epoch.getTime() + str * 86400000);
    if (isNaN(d.getTime())) return null;
    return d.toISOString().slice(0, 10);
  }

  str = String(str).trim();
  if (!str) return null;

  // ISO format
  if (str.includes('T') || /^\d{4}-\d{2}-\d{2}/.test(str)) {
    const d = new Date(str);
    return isNaN(d.getTime()) ? null : d.toISOString().slice(0, 10);
  }

  // DD/MM/YYYY
  const parts = str.split('/');
  if (parts.length === 3) {
    const [day, month, year] = parts;
    const result = `${year}-${month.padStart(2, '0')}-${day.padStart(2, '0')}`;
    const d = new Date(result);
    return isNaN(d.getTime()) ? null : result;
  }

  return null;
}

function parseMoney(val) {
  if (val == null) return null;
  if (typeof val === 'number') return isNaN(val) ? null : val;
  const cleaned = String(val).replace(/[$,\s]/g, '');
  const num = parseFloat(cleaned);
  return isNaN(num) ? null : num;
}

// ── Download ─────────────────────────────────────────

async function downloadXlsx() {
  log(`Downloading NT contracts XLSX from ${SOURCE_URL}...`);
  const res = await fetch(SOURCE_URL);
  if (!res.ok) throw new Error(`Download failed: HTTP ${res.status} ${res.statusText}`);
  const buf = Buffer.from(await res.arrayBuffer());
  await mkdir(DATA_DIR, { recursive: true });
  await writeFile(XLSX_PATH, buf);
  log(`  Saved ${XLSX_PATH} (${(buf.length / 1024).toFixed(0)} KB)`);
}

// ── Parse XLSX ───────────────────────────────────────

function discoverColumnMapping(headers) {
  // NT spreadsheet column names may vary — map them flexibly
  const mapping = {};
  const lower = headers.map(h => (h || '').toString().toLowerCase().trim());

  for (let i = 0; i < lower.length; i++) {
    const h = lower[i];
    if (!h) continue;

    if (h === 'reference' || h.includes('tender') && h.includes('number') || h.includes('contract') && h.includes('number'))
      mapping.reference = i;
    else if (h.includes('description') || h.includes('title') || h === 'contract description')
      mapping.title = i;
    else if (h === 'agency' || h.includes('department') || h.includes('buyer') || h.includes('agency/entity') || h.includes('agency name'))
      mapping.buyer = i;
    else if (h.includes('division') || h.includes('business unit') || h.includes('unit'))
      mapping.division = i;
    else if ((h.includes('contractor') || h.includes('supplier')) && !h.includes('abn'))
      mapping.supplier = i;
    else if (h.includes('abn'))
      mapping.abn = i;
    else if (h.includes('value') || h.includes('amount') || h.includes('price'))
      mapping.value = i;
    else if (h.includes('commence') || h.includes('start') || h === 'awarded')
      mapping.startDate = i;
    else if (h.includes('expiry') || h.includes('end') || h.includes('finish') || h.includes('completion'))
      mapping.endDate = i;
    else if (h === 'category')
      mapping.category = i;
    else if (h === 'type')
      mapping.type = i;
    else if (h === 'process' || h.includes('method') || h.includes('procurement'))
      mapping.method = i;
    else if (h === 'state')
      mapping.supplierState = i;
    else if (h.includes('city') || h.includes('suburb'))
      mapping.supplierCity = i;
    else if (h.includes('territory enterprise'))
      mapping.territoryEnterprise = i;
  }

  return mapping;
}

async function parseNTContracts() {
  if (!existsSync(XLSX_PATH)) {
    throw new Error(`XLSX file not found at ${XLSX_PATH}. Run with --download flag.`);
  }

  log(`Parsing ${XLSX_PATH}...`);
  const buf = await readFile(XLSX_PATH);
  const workbook = XLSX.read(buf, { type: 'buffer', cellDates: true });

  log(`  Worksheets: ${workbook.SheetNames.join(', ')}`);

  const contracts = [];

  for (const sheetName of workbook.SheetNames) {
    const sheet = workbook.Sheets[sheetName];
    const rows = XLSX.utils.sheet_to_json(sheet, { header: 1, defval: null, raw: true });

    if (rows.length < 2) {
      log(`  Skipping empty sheet: "${sheetName}"`);
      continue;
    }

    // Find header row — look for a row with recognizable column names
    let headerIdx = -1;
    for (let i = 0; i < Math.min(rows.length, 10); i++) {
      const row = rows[i];
      if (!row) continue;
      const joined = row.map(c => String(c || '').toLowerCase()).join(' ');
      if (joined.includes('contractor') || joined.includes('supplier') ||
          joined.includes('tender') || joined.includes('contract') && joined.includes('value')) {
        headerIdx = i;
        break;
      }
    }

    if (headerIdx < 0) {
      log(`  Skipping sheet "${sheetName}" — no recognizable header row`);
      continue;
    }

    const headers = rows[headerIdx];
    const mapping = discoverColumnMapping(headers);

    log(`  Sheet "${sheetName}": ${rows.length - headerIdx - 1} data rows`);
    log(`    Column mapping: ${JSON.stringify(Object.fromEntries(
      Object.entries(mapping).map(([k, v]) => [k, headers[v]])
    ))}`);

    const dataRows = rows.slice(headerIdx + 1);
    let sheetCount = 0;

    for (const row of dataRows) {
      if (!row || row.every(c => c == null || String(c).trim() === '')) continue;

      const ref = mapping.reference != null ? String(row[mapping.reference] || '').trim() : null;
      const title = mapping.title != null ? String(row[mapping.title] || '').trim() : null;
      const buyerRaw = mapping.buyer != null ? String(row[mapping.buyer] || '').trim() : null;
      const divisionRaw = mapping.division != null ? String(row[mapping.division] || '').trim() : null;
      const supplier = mapping.supplier != null ? String(row[mapping.supplier] || '').trim() : null;
      const abnRaw = mapping.abn != null ? row[mapping.abn] : null;
      const valueRaw = mapping.value != null ? row[mapping.value] : null;
      const startRaw = mapping.startDate != null ? row[mapping.startDate] : null;
      const endRaw = mapping.endDate != null ? row[mapping.endDate] : null;
      const category = mapping.category != null ? String(row[mapping.category] || '').trim() : null;
      const typeField = mapping.type != null ? String(row[mapping.type] || '').trim() : null;
      const method = mapping.method != null ? String(row[mapping.method] || '').trim() : null;

      // Skip rows without meaningful data
      if (!title && !supplier && !ref) continue;

      // Build buyer name with division if present
      const buyerParts = ['NT'];
      if (buyerRaw) buyerParts.push(buyerRaw);
      if (divisionRaw) buyerParts.push(`- ${divisionRaw}`);
      const buyerName = buyerParts.length > 1 ? buyerParts.join(' ') : null;

      const abn = normaliseAbn(abnRaw);
      const contractValue = parseMoney(valueRaw);
      const contractStart = parseDate(startRaw);
      const contractEnd = parseDate(endRaw);

      // Generate a stable ocid
      const ocid = ref ? `nt-${ref}` : `nt-${sheetName.replace(/\s/g, '')}-${sheetCount}`;

      contracts.push({
        ocid,
        release_id: `nt-contracts-${sheetName.replace(/\s/g, '-').toLowerCase()}`,
        title: title || 'NT Government Contract',
        description: null,
        contract_value: contractValue,
        currency: 'AUD',
        procurement_method: method || null,
        category: [category, typeField].filter(Boolean).join(' / ') || null,
        contract_start: contractStart,
        contract_end: contractEnd,
        date_published: contractStart ? (() => {
          try {
            const d = new Date(contractStart + 'T00:00:00Z');
            return isNaN(d.getTime()) ? null : d.toISOString();
          } catch { return null; }
        })() : null,
        buyer_name: buyerName,
        buyer_id: null,
        supplier_name: supplier || null,
        supplier_abn: abn,
        supplier_id: abn ? `AU-ABN-${abn}` : null,
        source_url: 'https://data.nt.gov.au',
      });

      sheetCount++;
    }

    log(`    Parsed ${sheetCount} contracts from "${sheetName}"`);
  }

  return contracts;
}

// ── Upsert to DB ─────────────────────────────────────

async function upsertContracts(contracts) {
  if (contracts.length === 0) return { inserted: 0, errors: 0 };
  log(`Upserting ${contracts.length} contracts...`);

  let inserted = 0;
  let errors = 0;
  const BATCH = 500;

  for (let i = 0; i < contracts.length; i += BATCH) {
    const batch = contracts.slice(i, i + BATCH);

    const { error } = await db
      .from('austender_contracts')
      .upsert(batch, {
        onConflict: 'ocid',
        ignoreDuplicates: false,
      });

    if (error) {
      // Fallback to individual inserts
      for (const row of batch) {
        const { error: singleErr } = await db
          .from('austender_contracts')
          .upsert(row, { onConflict: 'ocid', ignoreDuplicates: false });
        if (singleErr) {
          errors++;
          if (errors <= 5) log(`  Error: ${singleErr.message.slice(0, 120)}`);
        } else {
          inserted++;
        }
      }
    } else {
      inserted += batch.length;
    }

    if (i > 0 && i % 2000 === 0) {
      log(`  Progress: ${i}/${contracts.length} (${inserted} upserted, ${errors} errors)`);
    }
  }

  log(`  Done: ${inserted} upserted, ${errors} errors`);
  return { inserted, errors };
}

// ── Entity Matching ──────────────────────────────────

async function matchEntities(contracts) {
  const uniqueAbns = [...new Set(contracts.map(c => c.supplier_abn).filter(Boolean))];
  if (uniqueAbns.length === 0) {
    log('  No ABNs to match against gs_entities');
    return;
  }

  log(`Matching ${uniqueAbns.length} unique supplier ABNs to gs_entities...`);

  // Check how many already have matches
  const { data: matched } = await db.rpc('exec_sql', {
    query: `SELECT COUNT(DISTINCT supplier_abn) as cnt FROM austender_contracts WHERE ocid LIKE 'nt-%' AND supplier_abn IS NOT NULL AND supplier_abn IN (SELECT abn FROM gs_entities WHERE abn IS NOT NULL)`
  });

  const matchedCount = matched?.[0]?.cnt || 0;
  log(`  ${matchedCount}/${uniqueAbns.length} ABNs already matched in gs_entities`);
}

// ── Main ─────────────────────────────────────────────

async function main() {
  log('='.repeat(60));
  log(`  NT Contracts Ingest`);
  log(`  Mode: ${DRY_RUN ? 'DRY RUN (pass --live to insert)' : 'LIVE'}`);
  log(`  Download: ${DOWNLOAD}`);
  log('='.repeat(60));

  await mkdir(DATA_DIR, { recursive: true });

  const run = await logStart(db, AGENT_ID, AGENT_NAME);
  const runId = run?.id;

  try {
    // Phase 1: Download
    if (DOWNLOAD || !existsSync(XLSX_PATH)) {
      await downloadXlsx();
    } else {
      log(`Using cached XLSX at ${XLSX_PATH}`);
    }

    // Phase 2-3: Parse and transform
    const contracts = await parseNTContracts();
    log(`\nTotal contracts parsed: ${contracts.length}`);

    if (contracts.length === 0) {
      log('No contracts found — check XLSX structure');
      await logComplete(db, runId, { items_found: 0, items_new: 0 });
      return;
    }

    // Phase 6: Summary stats
    const withAbn = contracts.filter(c => c.supplier_abn).length;
    const withValue = contracts.filter(c => c.contract_value).length;
    const totalValue = contracts.reduce((sum, c) => sum + (c.contract_value || 0), 0);

    log(`\n--- Summary ---`);
    log(`  Total contracts: ${contracts.length}`);
    log(`  With ABN:        ${withAbn} (${(withAbn / contracts.length * 100).toFixed(1)}%)`);
    log(`  With value:      ${withValue} (${(withValue / contracts.length * 100).toFixed(1)}%)`);
    log(`  Total value:     $${(totalValue / 1e6).toFixed(1)}M`);

    // Date range
    const dates = contracts.map(c => c.contract_start).filter(Boolean).sort();
    if (dates.length > 0) {
      log(`  Date range:      ${dates[0]} to ${dates[dates.length - 1]}`);
    }

    // Buyer distribution
    const buyerCounts = {};
    for (const c of contracts) {
      const buyer = c.buyer_name || 'Unknown';
      buyerCounts[buyer] = (buyerCounts[buyer] || 0) + 1;
    }
    const topBuyers = Object.entries(buyerCounts).sort((a, b) => b[1] - a[1]).slice(0, 10);
    log('\nTop 10 buyers:');
    for (const [name, count] of topBuyers) {
      log(`  ${String(count).padStart(5)} ${name}`);
    }

    // Sample records
    log('\nSample records:');
    for (const c of contracts.slice(0, 5)) {
      log(`  [${c.ocid}] ${c.buyer_name} -> ${c.supplier_name} | $${c.contract_value?.toLocaleString() || '?'} | ABN: ${c.supplier_abn || 'none'} | ${c.contract_start || '?'}`);
    }

    if (DRY_RUN) {
      log('\n** DRY RUN — no data inserted. Pass --live to upsert. **');
      await logComplete(db, runId, {
        items_found: contracts.length,
        items_new: 0,
        status: 'dry_run',
      });
    } else {
      // Phase 4: Batch upsert
      const { inserted, errors } = await upsertContracts(contracts);

      // Phase 5: Entity matching summary
      await matchEntities(contracts);

      await logComplete(db, runId, {
        items_found: contracts.length,
        items_new: inserted,
      });
    }

  } catch (err) {
    console.error('Fatal error:', err);
    await logFailed(db, runId, err.message || String(err));
    process.exit(1);
  }
}

main();
