#!/usr/bin/env node
/**
 * ingest-act-contracts.mjs
 *
 * Ingests ACT government contracts data from data.act.gov.au Socrata API
 * into the austender_contracts table.
 *
 * Source: ACT Contracts Register (SODA API)
 *   https://www.data.act.gov.au/resource/pfs5-8d64.json
 *   Contracts >= $25K, updated monthly
 *
 * Usage:
 *   node --env-file=.env scripts/ingest-act-contracts.mjs          # dry run (default)
 *   node --env-file=.env scripts/ingest-act-contracts.mjs --live   # insert into DB
 */

import { createClient } from '@supabase/supabase-js';
import { logStart, logComplete, logFailed } from './lib/log-agent-run.mjs';

const AGENT_ID = 'ingest-act-contracts';
const AGENT_NAME = 'ACT Contracts Ingest';

const SODA_URL = 'https://www.data.act.gov.au/resource/pfs5-8d64.json';
const PAGE_SIZE = 1000;
const BATCH_SIZE = 500;

const db = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);
const LIVE = process.argv.includes('--live');

function log(msg) {
  console.log(`[${new Date().toISOString().slice(11, 19)}] ${msg}`);
}

// ── Helpers ──────────────────────────────────────────

function normaliseAbn(abn) {
  if (!abn) return null;
  const cleaned = abn.replace(/\s/g, '');
  if (/^\d{11}$/.test(cleaned)) return cleaned;
  return null;
}

function parseDate(str) {
  if (!str) return null;
  // Socrata ISO format: 2016-06-20T00:00:00.000
  if (str.includes('T')) {
    const d = new Date(str);
    return isNaN(d.getTime()) ? null : str.slice(0, 10);
  }
  // DD/MM/YYYY fallback
  const parts = str.split('/');
  if (parts.length === 3) {
    const [d, m, y] = parts;
    const result = `${y}-${m.padStart(2, '0')}-${d.padStart(2, '0')}`;
    return isNaN(new Date(result).getTime()) ? null : result;
  }
  return null;
}

function parseMoney(str) {
  if (!str) return null;
  const cleaned = str.toString().replace(/[$,\s]/g, '');
  const num = parseFloat(cleaned);
  return isNaN(num) ? null : num;
}

// ── Phase 1: Discover schema ─────────────────────────

async function discoverSchema() {
  log('Phase 1: Discovering Socrata schema...');
  const url = `${SODA_URL}?$limit=1`;
  const res = await fetch(url);
  if (!res.ok) throw new Error(`Socrata API error: ${res.status} ${res.statusText}`);
  const rows = await res.json();
  if (rows.length === 0) throw new Error('No data returned from Socrata API');

  const fields = Object.keys(rows[0]);
  log(`  Found ${fields.length} fields: ${fields.join(', ')}`);
  return { sampleRow: rows[0], fields };
}

// ── Phase 2: Paginated download ──────────────────────

async function downloadAll() {
  log('Phase 2: Downloading ACT contracts via SODA API...');
  const allRows = [];
  let offset = 0;

  while (true) {
    const url = `${SODA_URL}?$limit=${PAGE_SIZE}&$offset=${offset}&$order=:id`;
    const res = await fetch(url);
    if (!res.ok) throw new Error(`Socrata API error at offset ${offset}: ${res.status}`);
    const rows = await res.json();

    if (rows.length === 0) break;
    allRows.push(...rows);

    if (allRows.length % 500 < PAGE_SIZE) {
      log(`  Downloaded ${allRows.length} records...`);
    }

    if (rows.length < PAGE_SIZE) break;
    offset += PAGE_SIZE;
  }

  log(`  Total downloaded: ${allRows.length} contracts`);
  return allRows;
}

// ── Phase 3: Transform and map fields ────────────────

function transformRow(row) {
  const contractNumber = row.contract_number?.trim();
  const abn = normaliseAbn(row.abn);
  const value = parseMoney(row.contract_amount || row.original_amount);
  const startDate = parseDate(row.execution_date);
  const endDate = parseDate(row.expiry_date);

  return {
    ocid: `act-${contractNumber || `unknown-${Math.random().toString(36).slice(2, 10)}`}`,
    release_id: 'act-contracts-register',
    title: row.contract_title?.trim() || 'ACT Government Contract',
    description: row.brief_description_of_contract?.trim() || null,
    contract_value: value,
    currency: 'AUD',
    procurement_method: row.procurement_methodology?.trim() || null,
    category: row.procurement_type?.trim() || null,
    contract_start: startDate,
    contract_end: endDate,
    date_published: startDate ? new Date(startDate + 'T00:00:00Z').toISOString() : null,
    buyer_name: row.directorate?.trim() ? `ACT ${row.directorate.trim()}` : 'ACT Government',
    buyer_id: 'act-gov',
    supplier_name: row.contractor_name?.trim() || null,
    supplier_abn: abn,
    supplier_id: abn ? `AU-ABN-${abn}` : null,
    source_url: 'https://www.data.act.gov.au/Government-and-Transparency/Contracts-Register/pfs5-8d64',
  };
}

function transformAll(rows) {
  log('Phase 3: Transforming and mapping fields...');
  const contracts = rows.map(transformRow);
  log(`  Transformed ${contracts.length} contracts`);
  return contracts;
}

// ── Phase 4: Batch upsert ────────────────────────────

async function upsertContracts(contracts) {
  log(`Phase 4: Upserting ${contracts.length} contracts (batch size ${BATCH_SIZE})...`);
  let inserted = 0;
  let errors = 0;

  for (let i = 0; i < contracts.length; i += BATCH_SIZE) {
    const batch = contracts.slice(i, i + BATCH_SIZE);

    const { error } = await db
      .from('austender_contracts')
      .upsert(batch, { onConflict: 'ocid', ignoreDuplicates: false });

    if (error) {
      // Fall back to individual inserts
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

    if ((i + BATCH_SIZE) % 500 === 0 || i + BATCH_SIZE >= contracts.length) {
      log(`  Progress: ${Math.min(i + BATCH_SIZE, contracts.length)}/${contracts.length} (${inserted} upserted, ${errors} errors)`);
    }
  }

  log(`  Done: ${inserted} upserted, ${errors} errors`);
  return { inserted, errors };
}

// ── Phase 5: Entity matching ─────────────────────────

async function matchEntities(contracts) {
  log('Phase 5: Matching suppliers to gs_entities...');

  const abns = [...new Set(contracts.map(c => c.supplier_abn).filter(Boolean))];
  log(`  Unique ABNs to match: ${abns.length}`);

  if (abns.length === 0) {
    log('  No ABNs to match');
    return 0;
  }

  // Check which ABNs already have entity matches
  const { data: existing } = await db.rpc('exec_sql', {
    query: `SELECT DISTINCT supplier_abn FROM austender_contracts WHERE ocid LIKE 'act-%' AND supplier_abn IS NOT NULL AND supplier_entity_type IS NOT NULL`
  });
  const alreadyMatched = new Set((existing || []).map(r => r.supplier_abn));

  const unmatchedAbns = abns.filter(a => !alreadyMatched.has(a));
  log(`  Already matched: ${alreadyMatched.size}, unmatched: ${unmatchedAbns.length}`);

  if (unmatchedAbns.length === 0) {
    log('  All ABNs already matched');
    return 0;
  }

  // Look up entities by ABN in batches
  let matched = 0;
  const ABN_BATCH = 50;

  for (let i = 0; i < unmatchedAbns.length; i += ABN_BATCH) {
    const batch = unmatchedAbns.slice(i, i + ABN_BATCH);
    const abnList = batch.map(a => `'${a}'`).join(',');

    const { data: entities } = await db.rpc('exec_sql', {
      query: `SELECT abn, entity_type FROM gs_entities WHERE abn IN (${abnList})`
    });

    if (entities && entities.length > 0) {
      for (const ent of entities) {
        const { error } = await db
          .from('austender_contracts')
          .update({ supplier_entity_type: ent.entity_type })
          .eq('supplier_abn', ent.abn)
          .like('ocid', 'act-%');

        if (!error) matched++;
      }
    }
  }

  log(`  Matched ${matched} ABNs to gs_entities`);
  return matched;
}

// ── Phase 6: Summary stats ───────────────────────────

function printSummary(contracts) {
  log('\nPhase 6: Summary');
  log('─'.repeat(50));

  const withAbn = contracts.filter(c => c.supplier_abn).length;
  const withValue = contracts.filter(c => c.contract_value).length;
  const totalValue = contracts.reduce((sum, c) => sum + (c.contract_value || 0), 0);

  log(`  Total contracts: ${contracts.length}`);
  log(`  With ABN: ${withAbn} (${(withAbn / contracts.length * 100).toFixed(1)}%)`);
  log(`  With value: ${withValue} (${(withValue / contracts.length * 100).toFixed(1)}%)`);
  log(`  Total value: $${(totalValue / 1e6).toFixed(2)}M`);

  // Buyer (directorate) distribution
  const buyerCounts = {};
  for (const c of contracts) {
    const buyer = c.buyer_name || 'Unknown';
    buyerCounts[buyer] = (buyerCounts[buyer] || 0) + 1;
  }
  const topBuyers = Object.entries(buyerCounts).sort((a, b) => b[1] - a[1]).slice(0, 10);
  log('\n  Top directorates:');
  for (const [name, count] of topBuyers) {
    log(`    ${count.toString().padStart(5)} ${name}`);
  }

  // Procurement method distribution
  const methodCounts = {};
  for (const c of contracts) {
    const method = c.procurement_method || 'Unknown';
    methodCounts[method] = (methodCounts[method] || 0) + 1;
  }
  log('\n  Procurement methods:');
  for (const [method, count] of Object.entries(methodCounts).sort((a, b) => b[1] - a[1])) {
    log(`    ${count.toString().padStart(5)} ${method}`);
  }

  // Sample records
  log('\n  Sample records:');
  for (const c of contracts.slice(0, 5)) {
    log(`    ${c.ocid} | ${c.buyer_name} -> ${c.supplier_name} | $${c.contract_value?.toLocaleString() || '?'} | ABN: ${c.supplier_abn || 'none'}`);
  }
}

// ── Field mapping display ────────────────────────────

function printFieldMapping(sampleRow) {
  log('\n  Field mapping (Socrata -> austender_contracts):');
  log('    contract_number        -> ocid (prefixed act-)');
  log('    contract_title         -> title');
  log('    brief_description_of_contract -> description');
  log('    contract_amount        -> contract_value');
  log('    procurement_methodology -> procurement_method');
  log('    procurement_type       -> category');
  log('    execution_date         -> contract_start');
  log('    expiry_date            -> contract_end');
  log('    directorate            -> buyer_name (prefixed ACT)');
  log('    contractor_name        -> supplier_name');
  log('    abn                    -> supplier_abn');
  log(`    source marker          -> release_id = 'act-contracts-register'`);

  log('\n  Socrata fields NOT mapped:');
  const mapped = ['contract_number', 'contract_title', 'brief_description_of_contract',
    'contract_amount', 'original_amount', 'procurement_methodology', 'procurement_type',
    'execution_date', 'expiry_date', 'directorate', 'contractor_name', 'abn',
    'contract_type', 'gst'];
  const unmapped = Object.keys(sampleRow).filter(k => !mapped.includes(k));
  for (const field of unmapped) {
    log(`    ${field}: ${JSON.stringify(sampleRow[field]).slice(0, 60)}`);
  }
}

// ── Main ─────────────────────────────────────────────

async function main() {
  log('==================================================');
  log('  ACT Contracts Register Ingest');
  log(`  Mode: ${LIVE ? 'LIVE' : 'DRY RUN'}`);
  log('==================================================');

  const run = await logStart(db, AGENT_ID, AGENT_NAME);
  const runId = run?.id;

  try {
    // Phase 1: Discover schema
    const { sampleRow } = await discoverSchema();

    // Phase 2: Download all records
    const rawRows = await downloadAll();

    // Phase 3: Transform
    const contracts = transformAll(rawRows);

    // Phase 6 (early): Summary stats
    printSummary(contracts);
    printFieldMapping(sampleRow);

    if (!LIVE) {
      log('\n  DRY RUN -- no data inserted. Pass --live to insert.');
      await logComplete(db, runId, {
        items_found: contracts.length,
        items_new: 0,
        status: 'dry_run',
      });
      return;
    }

    // Phase 4: Batch upsert
    const { inserted, errors } = await upsertContracts(contracts);

    // Phase 5: Entity matching
    const matched = await matchEntities(contracts);

    log('\n  Final: ' +
      `${inserted} upserted, ${errors} errors, ${matched} entity matches`);

    await logComplete(db, runId, {
      items_found: contracts.length,
      items_new: inserted,
      items_updated: matched,
    });

  } catch (err) {
    console.error('Fatal error:', err);
    await logFailed(db, runId, err.message || String(err));
    process.exit(1);
  }
}

main();
