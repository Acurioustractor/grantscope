#!/usr/bin/env node
/**
 * ingest-state-procurement.mjs
 *
 * Ingests state-level procurement data (NSW, QLD) into austender_contracts table.
 * Sources:
 *   - NSW: OCDS bulk CSV from data.open-contracting.org
 *   - QLD: Contract Disclosure Reports from data.qld.gov.au
 *
 * Usage:
 *   node --env-file=.env scripts/ingest-state-procurement.mjs [--state=nsw|qld|all] [--dry-run] [--download]
 *
 * The --download flag fetches fresh data from public APIs.
 * Without --download, it processes data already in data/state-procurement/.
 */

import { createClient } from '@supabase/supabase-js';
import { readFile, writeFile, mkdir } from 'fs/promises';
import { existsSync } from 'fs';
import { parse } from 'csv-parse/sync';
import { logStart, logComplete, logFailed } from './lib/log-agent-run.mjs';

const AGENT_ID = 'ingest-state-procurement';
const AGENT_NAME = 'State Procurement Ingest';

const db = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);
const DRY_RUN = process.argv.includes('--dry-run');
const DOWNLOAD = process.argv.includes('--download');
const STATE = (process.argv.find(a => a.startsWith('--state='))?.split('=')[1] || 'all').toLowerCase();
const DATA_DIR = 'data/state-procurement';

function log(msg) { console.log(`[${new Date().toISOString().slice(11, 19)}] ${msg}`); }

// ── Download helpers ──────────────────────────────────

const QLD_URLS = [
  { fy: '2019-20', url: 'https://www.data.qld.gov.au/dataset/2b977e4d-c765-4ce5-8088-65210a744add/resource/cf40a8f0-1df9-475a-9c89-e03b6108423e/download/sp_contract-disclosure-report-2019-20.csv' },
  { fy: '2021-22', url: 'https://www.data.qld.gov.au/dataset/2b977e4d-c765-4ce5-8088-65210a744add/resource/df742b02-99b3-48c3-a0d7-4f8453cf88f5/download/sp_contract-disclosure-report-2021-22.csv' },
  { fy: '2022-23', url: 'https://www.data.qld.gov.au/dataset/2b977e4d-c765-4ce5-8088-65210a744add/resource/30026b85-0102-4a55-8c4b-a53de647f1d0/download/sp_contract-disclosure-report-2022-23.csv' },
  { fy: '2023-24', url: 'https://www.data.qld.gov.au/dataset/2b977e4d-c765-4ce5-8088-65210a744add/resource/3e40ac78-6381-4de1-b353-c1c89e90a7e2/download/sp_contract-disclosure-report-2023-24.csv' },
  { fy: '2024-25', url: 'https://www.data.qld.gov.au/dataset/2b977e4d-c765-4ce5-8088-65210a744add/resource/15c1bcea-7924-432c-9ece-f70fae1a5a0d/download/sp_contract-disclosure-report-2024-25.csv' },
  { fy: '2025-26', url: 'https://www.data.qld.gov.au/dataset/2b977e4d-c765-4ce5-8088-65210a744add/resource/09335d0c-cfba-43e0-b036-4461c8345a73/download/sp_contract-disclosure-report-2025-26.csv' },
];

async function downloadFile(url, dest) {
  const res = await fetch(url);
  if (!res.ok) throw new Error(`Failed to download ${url}: ${res.status}`);
  const buf = Buffer.from(await res.arrayBuffer());
  await writeFile(dest, buf);
  log(`  Downloaded ${dest} (${(buf.length / 1024).toFixed(0)} KB)`);
}

async function downloadQLD() {
  log('Downloading QLD procurement data...');
  for (const { fy, url } of QLD_URLS) {
    const dest = `${DATA_DIR}/qld-${fy}.csv`;
    try {
      await downloadFile(url, dest);
    } catch (e) {
      log(`  ⚠ Failed ${fy}: ${e.message}`);
    }
  }
}

// ── NSW OCDS parser ───────────────────────────────────

function normaliseAbn(abn) {
  if (!abn) return null;
  const cleaned = abn.replace(/\s/g, '');
  if (/^\d{11}$/.test(cleaned)) return cleaned;
  return null;
}

function parseDate(str) {
  if (!str) return null;
  // Handle ISO dates and DD/MM/YYYY
  if (str.includes('T')) {
    const d = new Date(str);
    return isNaN(d.getTime()) ? null : str.slice(0, 10);
  }
  const parts = str.split('/');
  if (parts.length === 3) {
    const [d, m, y] = parts;
    if (isNaN(parseInt(d)) || isNaN(parseInt(m)) || isNaN(parseInt(y))) return null;
    const result = `${y}-${m.padStart(2, '0')}-${d.padStart(2, '0')}`;
    return isNaN(new Date(result).getTime()) ? null : result;
  }
  // Check if it looks like a date at all
  if (!/\d{4}/.test(str)) return null;
  const d = new Date(str);
  return isNaN(d.getTime()) ? null : str.slice(0, 10);
}

function parseMoney(str) {
  if (!str) return null;
  const cleaned = str.toString().replace(/[$,\s]/g, '');
  const num = parseFloat(cleaned);
  return isNaN(num) ? null : num;
}

async function parseNSW() {
  log('Parsing NSW OCDS awards...');
  const awardsPath = `${DATA_DIR}/full/awards.csv`;
  const suppliersPath = `${DATA_DIR}/full/awards_suppliers.csv`;

  if (!existsSync(awardsPath)) {
    log('  ⚠ NSW awards.csv not found. Run with --download first.');
    return [];
  }

  const awardsRaw = await readFile(awardsPath, 'utf-8');
  const suppliersRaw = await readFile(suppliersPath, 'utf-8');

  const awards = parse(awardsRaw, { columns: true, skip_empty_lines: true, relax_column_count: true });
  const suppliers = parse(suppliersRaw, { columns: true, skip_empty_lines: true, relax_column_count: true });

  // Build supplier lookup: _link_awards -> supplier info
  const supplierMap = new Map();
  for (const s of suppliers) {
    const key = s._link_awards || s._link;
    if (!supplierMap.has(key)) supplierMap.set(key, []);
    supplierMap.get(key).push(s);
  }

  const contracts = [];
  for (const a of awards) {
    const awardSuppliers = supplierMap.get(a._link) || [];
    const value = parseMoney(a.value_amount);

    for (const s of awardSuppliers) {
      const abn = normaliseAbn(s.identifier_id);
      contracts.push({
        ocid: `nsw-${a.id || a.CNUUID}`,
        release_id: a._link_main,
        title: a.title || 'NSW State Contract',
        description: null,
        contract_value: value,
        currency: a.value_currency || 'AUD',
        procurement_method: a.procurementMethod || a.eTenderProcurementMethod || null,
        category: a.contractGroup_totalContractGroupValue ? 'grouped' : null,
        contract_start: parseDate(a.contractPeriod_startDate || a.date),
        contract_end: parseDate(a.contractPeriod_endDate),
        date_published: a.publishedDate ? new Date(a.publishedDate).toISOString() : null,
        buyer_name: a.buyer_name || null,
        buyer_id: null,
        supplier_name: s.name || s.identifier_legalName || null,
        supplier_abn: abn,
        supplier_id: abn ? `AU-ABN-${abn}` : null,
        source_url: 'https://data.open-contracting.org/en/publication/11',
      });
    }

    // Awards without suppliers — still record the contract
    if (awardSuppliers.length === 0 && value) {
      contracts.push({
        ocid: `nsw-${a.id || a.CNUUID}`,
        release_id: a._link_main,
        title: a.title || 'NSW State Contract',
        description: null,
        contract_value: value,
        currency: 'AUD',
        procurement_method: a.procurementMethod || null,
        category: null,
        contract_start: parseDate(a.contractPeriod_startDate || a.date),
        contract_end: parseDate(a.contractPeriod_endDate),
        date_published: a.publishedDate ? new Date(a.publishedDate).toISOString() : null,
        buyer_name: a.buyer_name || null,
        buyer_id: null,
        supplier_name: null,
        supplier_abn: null,
        supplier_id: null,
        source_url: 'https://data.open-contracting.org/en/publication/11',
      });
    }
  }

  log(`  Parsed ${contracts.length} NSW contracts from ${awards.length} awards`);
  return contracts;
}

// ── QLD parser ────────────────────────────────────────

async function parseQLD() {
  log('Parsing QLD procurement data...');
  const contracts = [];
  const files = QLD_URLS.map(q => ({ fy: q.fy, path: `${DATA_DIR}/qld-${q.fy}.csv` }));
  // Also check the sample file
  if (existsSync(`${DATA_DIR}/qld-sample-2023-24.csv`) && !existsSync(`${DATA_DIR}/qld-2023-24.csv`)) {
    // Rename sample if dedicated file doesn't exist
  }

  for (const { fy, path } of files) {
    if (!existsSync(path)) {
      log(`  ⚠ ${path} not found, skipping ${fy}`);
      continue;
    }

    const raw = await readFile(path, 'utf-8');
    const rows = parse(raw, { columns: true, skip_empty_lines: true, relax_column_count: true, trim: true });

    for (const r of rows) {
      const supplierName = r['Supplier name']?.trim();
      const agencyName = r['Agency (Dept or Stat Body)']?.trim();
      const title = r['Contract description/name']?.trim();
      const value = parseMoney(r['  Contract value  '] || r['Contract value']);
      const rawAbn = r['Supplier ABN']?.trim();

      // QLD sometimes has multiple ABNs separated by commas — take first
      const firstAbn = rawAbn?.split(',')[0]?.trim();
      const abn = normaliseAbn(firstAbn);

      const contractRef = r['Contract reference number']?.trim();
      const startDate = parseDate(r['Commence date'] || r['Award contract date']);
      const endDate = parseDate(r['Finish date']);
      const awardDate = parseDate(r['Award contract date']);
      const method = r['Procurement method']?.trim();
      const category = r['Contract category group']?.trim();

      contracts.push({
        ocid: `qld-${contractRef || `${fy}-${contracts.length}`}`,
        release_id: `qld-sp-${fy}`,
        title: title || 'QLD State Contract',
        description: null,
        contract_value: value,
        currency: 'AUD',
        procurement_method: method || null,
        category: category || null,
        contract_start: startDate || awardDate,
        contract_end: endDate,
        date_published: (() => { try { if (!awardDate || !/^\d{4}-/.test(awardDate)) return null; const d = new Date(awardDate + 'T00:00:00Z'); return isNaN(d.getTime()) ? null : d.toISOString(); } catch { return null; } })(),
        buyer_name: agencyName ? `QLD ${agencyName}` : null,
        buyer_id: null,
        supplier_name: supplierName || null,
        supplier_abn: abn,
        supplier_id: abn ? `AU-ABN-${abn}` : null,
        source_url: `https://www.data.qld.gov.au/dataset/system_procurement_contract-disclosure-report`,
      });
    }

    log(`  ${fy}: ${rows.length} contracts`);
  }

  log(`  Total QLD: ${contracts.length} contracts`);
  return contracts;
}

// ── Upsert to DB ──────────────────────────────────────

async function upsertContracts(contracts) {
  if (contracts.length === 0) return 0;
  log(`Upserting ${contracts.length} contracts...`);

  let inserted = 0;
  let skipped = 0;
  let errors = 0;
  const BATCH = 100;

  for (let i = 0; i < contracts.length; i += BATCH) {
    const batch = contracts.slice(i, i + BATCH);

    const { error } = await db
      .from('austender_contracts')
      .upsert(batch, {
        onConflict: 'ocid',
        ignoreDuplicates: true,
      });

    if (error) {
      // Try individual inserts
      for (const row of batch) {
        const { error: singleErr } = await db
          .from('austender_contracts')
          .upsert(row, { onConflict: 'ocid', ignoreDuplicates: true });
        if (singleErr) {
          errors++;
          if (errors <= 5) log(`  ⚠ Insert error: ${singleErr.message.slice(0, 100)}`);
        } else {
          inserted++;
        }
      }
    } else {
      inserted += batch.length;
    }

    if (i > 0 && i % 1000 === 0) {
      log(`  Progress: ${i}/${contracts.length} (${inserted} inserted, ${errors} errors)`);
    }
  }

  log(`  Done: ${inserted} inserted, ${skipped} skipped, ${errors} errors`);
  return inserted;
}

// ── Main ──────────────────────────────────────────────

async function main() {
  log('╔══════════════════════════════════════════════════╗');
  log('║  State Procurement Ingest                        ║');
  log(`║  State: ${STATE.padEnd(4)} | Dry Run: ${DRY_RUN} | Download: ${DOWNLOAD}  ║`);
  log('╚══════════════════════════════════════════════════╝');

  await mkdir(DATA_DIR, { recursive: true });

  const run = await logStart(db, AGENT_ID, AGENT_NAME);
  const runId = run?.id;

  try {
    // Download fresh data if requested
    if (DOWNLOAD) {
      if (STATE === 'all' || STATE === 'qld') await downloadQLD();
      // NSW OCDS needs manual download (tar.gz extraction)
      if (STATE === 'nsw') {
        log('NSW data must be downloaded manually:');
        log('  curl -L "https://data.open-contracting.org/en/publication/11/download?name=full.csv.tar.gz" -o data/state-procurement/nsw-ocds.csv.tar.gz');
        log('  cd data/state-procurement && tar -xzf nsw-ocds.csv.tar.gz');
      }
    }

    let allContracts = [];

    // Parse available data
    if (STATE === 'all' || STATE === 'nsw') {
      const nsw = await parseNSW();
      allContracts.push(...nsw);
    }

    if (STATE === 'all' || STATE === 'qld') {
      const qld = await parseQLD();
      allContracts.push(...qld);
    }

    log(`\nTotal contracts to ingest: ${allContracts.length}`);

    // Stats
    const withAbn = allContracts.filter(c => c.supplier_abn).length;
    const withValue = allContracts.filter(c => c.contract_value).length;
    const totalValue = allContracts.reduce((sum, c) => sum + (c.contract_value || 0), 0);
    log(`  With ABN: ${withAbn} (${(withAbn / allContracts.length * 100).toFixed(1)}%)`);
    log(`  With value: ${withValue}`);
    log(`  Total value: $${(totalValue / 1e9).toFixed(2)}B`);

    // Buyer distribution
    const buyerCounts = {};
    for (const c of allContracts) {
      const buyer = c.buyer_name || 'Unknown';
      buyerCounts[buyer] = (buyerCounts[buyer] || 0) + 1;
    }
    const topBuyers = Object.entries(buyerCounts).sort((a, b) => b[1] - a[1]).slice(0, 10);
    log('\nTop buyers:');
    for (const [name, count] of topBuyers) {
      log(`  ${count.toString().padStart(5)} ${name}`);
    }

    if (DRY_RUN) {
      log('\n⚠ DRY RUN — no data inserted. Remove --dry-run to apply.');
      // Show sample records
      log('\nSample records:');
      for (const c of allContracts.slice(0, 5)) {
        log(`  ${c.buyer_name} → ${c.supplier_name} | $${c.contract_value?.toLocaleString() || '?'} | ${c.supplier_abn || 'no ABN'}`);
      }
    } else {
      const inserted = await upsertContracts(allContracts);
      await logComplete(db, runId, {
        items_found: allContracts.length,
        items_new: inserted,
      });
    }

    if (DRY_RUN) {
      await logComplete(db, runId, {
        items_found: allContracts.length,
        items_new: 0,
        status: 'dry_run',
      });
    }

  } catch (err) {
    console.error('Fatal error:', err);
    await logFailed(db, runId, err.message || String(err));
    process.exit(1);
  }
}

main();
