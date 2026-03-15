#!/usr/bin/env node

/**
 * Relationship Extraction Engine (v4 — SQL batch via psql)
 *
 * Creates gs_relationships using direct SQL batches for speed.
 * Entity resolution via in-memory cache, inserts via psql.
 *
 * DEPENDS ON: Entity Resolution Engine running first
 *
 * Usage:
 *   node --env-file=.env scripts/engine-relationship-extraction.mjs [--source=austender|justice|donations] [--limit=N]
 */

import { createClient } from '@supabase/supabase-js';
import { execSync } from 'child_process';
import { writeFileSync, unlinkSync } from 'fs';

const db = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);

const SOURCE = process.argv.find(a => a.startsWith('--source='))?.split('=')[1] || 'all';
const LIMIT = parseInt(process.argv.find(a => a.startsWith('--limit='))?.split('=')[1] || '0');

function log(msg) { console.log(`[${new Date().toISOString()}] ${msg}`); }

// Entity lookup caches
const abnCache = new Map();
const nameCache = new Map();

function resolveEntity(abn, name) {
  if (abn && abnCache.has(abn)) return abnCache.get(abn);
  if (name) {
    const key = name.trim().toLowerCase();
    if (nameCache.has(key)) return nameCache.get(key);
  }
  return null;
}

function esc(s) {
  if (s === null || s === undefined) return 'NULL';
  return `'${String(s).replace(/'/g, "''")}'`;
}

function execSql(sql) {
  const tmpFile = '/tmp/gs_rel_batch.sql';
  writeFileSync(tmpFile, sql);
  try {
    const host = 'aws-0-ap-southeast-2.pooler.supabase.com';
    const user = 'postgres.tednluwflfhxyucgwigh';
    const result = execSync(
      `PGPASSWORD="${process.env.DATABASE_PASSWORD}" psql -h ${host} -p 5432 -U "${user}" -d postgres -f ${tmpFile} 2>&1`,
      { timeout: 120000, encoding: 'utf-8' }
    );
    // Count INSERT lines
    const match = result.match(/INSERT 0 (\d+)/);
    return match ? parseInt(match[1]) : 0;
  } catch (e) {
    log(`  !! SQL ERROR: ${e.message.substring(0, 200)}`);
    return 0;
  } finally {
    try { unlinkSync(tmpFile); } catch {}
  }
}

// ─── Contract Relationships ───────────────────────────────────────────

async function extractContracts() {
  log('--- Extracting Contract Relationships ---');
  let created = 0;
  let noSource = 0;
  let noTarget = 0;
  let total = 0;
  const BATCH_SIZE = 500;
  let valueBatch = [];
  let lastId = '00000000-0000-0000-0000-000000000000';

  function flushBatch() {
    if (valueBatch.length === 0) return;
    const sql = `INSERT INTO gs_relationships (source_entity_id, target_entity_id, relationship_type, amount, year, dataset, source_record_id, properties)
VALUES ${valueBatch.join(',\n')}
ON CONFLICT DO NOTHING;`;
    const inserted = execSql(sql);
    created += inserted;
    valueBatch = [];
  }

  while (true) {
    const { data: contracts, error } = await db.from('austender_contracts')
      .select('id, buyer_name, supplier_name, supplier_abn, contract_value, contract_start, contract_end, title, category')
      .gt('id', lastId)
      .order('id')
      .limit(1000);

    if (error) { log(`  Error: ${error.message}`); break; }
    if (!contracts || contracts.length === 0) break;
    lastId = contracts[contracts.length - 1].id;

    for (const c of contracts) {
      total++;

      const sourceId = resolveEntity(null, c.buyer_name);
      if (!sourceId) { noSource++; continue; }

      const targetId = resolveEntity(c.supplier_abn, c.supplier_name);
      if (!targetId) { noTarget++; continue; }

      const year = c.contract_start ? new Date(c.contract_start).getFullYear() : 'NULL';
      const props = JSON.stringify({
        title: c.title,
        category: c.category,
        contract_start: c.contract_start,
        contract_end: c.contract_end,
      });

      valueBatch.push(`('${sourceId}', '${targetId}', 'contract', ${c.contract_value || 'NULL'}, ${year}, 'austender', ${esc(c.id?.toString() || '')}, ${esc(props)}::jsonb)`);

      if (valueBatch.length >= BATCH_SIZE) flushBatch();
    }

    if (total % 50000 === 0) {
      flushBatch();
      log(`  [${total.toLocaleString()}] created=${created.toLocaleString()} noSource=${noSource.toLocaleString()} noTarget=${noTarget.toLocaleString()}`);
    }
    if (LIMIT && created >= LIMIT) break;
  }

  flushBatch();
  log(`  Contracts: ${created.toLocaleString()} new, ${noSource.toLocaleString()} no buyer, ${noTarget.toLocaleString()} no supplier (${total.toLocaleString()} total)`);
  return created;
}

// ─── Justice Funding Relationships ────────────────────────────────────

async function extractJusticeFunding() {
  log('--- Extracting Justice Funding Relationships ---');
  let created = 0;
  let noSource = 0;
  let noTarget = 0;
  let total = 0;
  const BATCH_SIZE = 500;
  let valueBatch = [];
  let lastId = '00000000-0000-0000-0000-000000000000';

  function flushBatch() {
    if (valueBatch.length === 0) return;
    const sql = `INSERT INTO gs_relationships (source_entity_id, target_entity_id, relationship_type, amount, year, dataset, source_record_id, properties)
VALUES ${valueBatch.join(',\n')}
ON CONFLICT DO NOTHING;`;
    const inserted = execSql(sql);
    created += inserted;
    valueBatch = [];
  }

  while (true) {
    const { data: records, error } = await db.from('justice_funding')
      .select('id, program_name, recipient_name, recipient_abn, amount_dollars, financial_year, state, sector')
      .gt('id', lastId)
      .order('id')
      .limit(1000);

    if (error) { log(`  Error: ${error.message}`); break; }
    if (!records || records.length === 0) break;
    lastId = records[records.length - 1].id;

    for (const r of records) {
      total++;

      const sourceId = resolveEntity(null, r.program_name);
      if (!sourceId) { noSource++; continue; }

      const targetId = resolveEntity(r.recipient_abn, r.recipient_name);
      if (!targetId) { noTarget++; continue; }

      const year = r.financial_year ? parseInt(r.financial_year) : 'NULL';
      const props = JSON.stringify({
        program: r.program_name,
        sector: r.sector,
        state: r.state,
      });

      valueBatch.push(`('${sourceId}', '${targetId}', 'grant', ${r.amount_dollars || 'NULL'}, ${year}, 'justice_funding', ${esc(r.id?.toString() || '')}, ${esc(props)}::jsonb)`);

      if (valueBatch.length >= BATCH_SIZE) flushBatch();
    }

    if (total % 20000 === 0) {
      flushBatch();
      log(`  [${total.toLocaleString()}] created=${created.toLocaleString()} noSource=${noSource} noTarget=${noTarget}`);
    }
    if (LIMIT && created >= LIMIT) break;
  }

  flushBatch();
  log(`  Justice: ${created.toLocaleString()} new, ${noSource} no funder, ${noTarget} no recipient (${total.toLocaleString()} total)`);
  return created;
}

// ─── Political Donation Relationships ─────────────────────────────────

async function extractDonations() {
  log('--- Extracting Political Donation Relationships ---');
  let created = 0;
  let noSource = 0;
  let noTarget = 0;
  let total = 0;
  const BATCH_SIZE = 500;
  let valueBatch = [];
  let lastId = '00000000-0000-0000-0000-000000000000';

  function flushBatch() {
    if (valueBatch.length === 0) return;
    const sql = `INSERT INTO gs_relationships (source_entity_id, target_entity_id, relationship_type, amount, year, dataset, source_record_id)
VALUES ${valueBatch.join(',\n')}
ON CONFLICT DO NOTHING;`;
    const inserted = execSql(sql);
    created += inserted;
    valueBatch = [];
  }

  while (true) {
    const { data: records, error } = await db.from('political_donations')
      .select('id, donor_name, donor_abn, donation_to, amount, financial_year')
      .gt('id', lastId)
      .order('id')
      .limit(1000);

    if (error) { log(`  Error: ${error.message}`); break; }
    if (!records || records.length === 0) break;
    lastId = records[records.length - 1].id;

    for (const r of records) {
      total++;

      const sourceId = resolveEntity(r.donor_abn, r.donor_name);
      if (!sourceId) { noSource++; continue; }

      const targetId = resolveEntity(null, r.donation_to);
      if (!targetId) { noTarget++; continue; }

      const year = r.financial_year ? parseInt(r.financial_year) : 'NULL';

      valueBatch.push(`('${sourceId}', '${targetId}', 'donation', ${r.amount || 'NULL'}, ${year}, 'aec_donations', ${esc(r.id?.toString() || '')})`);

      if (valueBatch.length >= BATCH_SIZE) flushBatch();
    }

    if (total % 50000 === 0) {
      flushBatch();
      log(`  [${total.toLocaleString()}] created=${created.toLocaleString()} noSource=${noSource.toLocaleString()} noTarget=${noTarget.toLocaleString()}`);
    }
    if (LIMIT && created >= LIMIT) break;
  }

  flushBatch();
  log(`  Donations: ${created.toLocaleString()} new, ${noSource.toLocaleString()} no donor, ${noTarget.toLocaleString()} no target (${total.toLocaleString()} total)`);
  return created;
}

// ─── Main ─────────────────────────────────────────────────────────────

async function main() {
  log('=== Relationship Extraction Engine v4 ===');
  const t0 = Date.now();

  // Pre-warm entity cache (cursor pagination for reliability)
  log('Pre-warming entity cache...');
  let entityCount = 0;
  let lastEntityId = '00000000-0000-0000-0000-000000000000';
  while (true) {
    const { data, error } = await db.from('gs_entities')
      .select('id, abn, canonical_name')
      .gt('id', lastEntityId)
      .order('id')
      .limit(1000);
    if (error) { log(`  Cache error: ${error.message}`); break; }
    if (!data || data.length === 0) break;
    lastEntityId = data[data.length - 1].id;
    for (const e of data) {
      entityCount++;
      if (e.abn) abnCache.set(e.abn, e.id);
      if (e.canonical_name) {
        nameCache.set(e.canonical_name.trim().toLowerCase(), e.id);
      }
    }
    if (entityCount % 50000 === 0) log(`  ... ${entityCount.toLocaleString()} entities loaded`);
  }
  log(`  Cache: ${entityCount.toLocaleString()} entities → ${abnCache.size.toLocaleString()} ABNs + ${nameCache.size.toLocaleString()} names`);

  let totalCreated = 0;

  if (SOURCE === 'all' || SOURCE === 'austender') {
    totalCreated += await extractContracts();
  }
  if (SOURCE === 'all' || SOURCE === 'justice') {
    totalCreated += await extractJusticeFunding();
  }
  if (SOURCE === 'all' || SOURCE === 'donations') {
    totalCreated += await extractDonations();
  }

  const elapsed = ((Date.now() - t0) / 1000 / 60).toFixed(1);
  log(`=== RELATIONSHIP EXTRACTION COMPLETE ===`);
  log(`  ${totalCreated.toLocaleString()} new relationships created in ${elapsed} min`);

  // Final counts
  const { data: finalCounts } = await db.from('gs_relationships').select('dataset', { count: 'exact' });
  log(`  Run: node --env-file=.env scripts/gsql.mjs "SELECT dataset, COUNT(*) FROM gs_relationships GROUP BY dataset ORDER BY count DESC"`);
}

main().catch(e => { console.error(e); process.exit(1); });
