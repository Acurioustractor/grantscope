#!/usr/bin/env node
/**
 * build-entity-graph.mjs
 *
 * Populates gs_entities + gs_relationships from all source tables.
 * Uses bulk SQL operations for performance (minutes not hours).
 *
 * Usage:
 *   node scripts/build-entity-graph.mjs                    # full build
 *   node scripts/build-entity-graph.mjs --phase=entities   # entities only
 *   node scripts/build-entity-graph.mjs --phase=donations  # donations only
 *   node scripts/build-entity-graph.mjs --phase=contracts  # contracts only
 *   node scripts/build-entity-graph.mjs --phase=links      # cross-registry links
 *   node scripts/build-entity-graph.mjs --phase=justice    # justice funding grant edges
 *   node scripts/build-entity-graph.mjs --phase=grantconnect # GrantConnect award edges
 *   node scripts/build-entity-graph.mjs --phase=refresh    # refresh materialized views
 *   node scripts/build-entity-graph.mjs --dry-run          # count only, no writes
 */

import { createClient } from '@supabase/supabase-js';
import { spawnSync } from 'node:child_process';
import { resolveBin, withRetry } from './lib/agent-resilience.mjs';
import { edgeDataset, JUSTICE_PROGRAM_ENSURE_SQL, JUSTICE_BUILD_GUARD } from './lib/graph-edge-datasets.mjs';
import { makeGsId } from './lib/gs-id.mjs';
import 'dotenv/config';

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL;
const SUPABASE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;

const supabase = createClient(SUPABASE_URL, SUPABASE_KEY);

const args = process.argv.slice(2);
const phase = args.find(a => a.startsWith('--phase='))?.split('=')[1] || 'all';
const dryRun = args.includes('--dry-run');

function log(msg) {
  console.log(`[entity-graph] ${msg}`);
}

// Rows that permanently failed to write after adaptive retry (genuine errors,
// not timeouts or tolerated duplicates). Surfaced loudly at the end of main().
let writeFailures = 0;
let writeSplits = 0;
let duplicatesSkipped = 0;

/**
 * Write `rows` via `run`, splitting the batch on failure so one bad row never
 * sinks the whole batch:
 *   - statement timeout: a 1000-row UPDATE-on-conflict against 159K-row
 *     gs_entities (or a 200-row insert into 1.08M gs_relationships) can exceed
 *     statement_timeout even on an idle DB — halve until each statement fits.
 *   - duplicate key: an insert-or-skip row may collide on a non-conflict-target
 *     unique index (e.g. idx_gs_entities_abn_unique when the entity already
 *     exists under a different gs_id) — halve until the offender is isolated so
 *     the rest still land, then skip just that row.
 * Any other error is counted so a partial build fails loudly (exit 1) instead
 * of leaving silent gaps — the bug that hid both of the above for months.
 */
async function safeWrite(table, rows, run) {
  if (dryRun || !rows?.length) return;
  const { error } = await withRetry(() => run(rows), `${table} ${rows.length}-row write`);
  if (!error) return;
  const msg = error.message || JSON.stringify(error);
  const isDuplicate = /duplicate key|already exists/i.test(msg);
  const isSplittable = /statement timeout|canceling statement|deadlock/i.test(msg);
  const isConnectivityFailure = /fetch failed|server closed|too many (clients|connections)|ECONN|EPIPE|socket|could not translate host/i.test(msg);
  if (isConnectivityFailure) {
    throw new Error(`${table} connectivity failure after retries: ${msg}`);
  }
  if (rows.length > 1 && (isSplittable || isDuplicate)) {
    writeSplits++;
    const mid = rows.length >> 1;
    await safeWrite(table, rows.slice(0, mid), run);
    await safeWrite(table, rows.slice(mid), run);
    return;
  }
  if (isDuplicate) { duplicatesSkipped += rows.length; return; }
  writeFailures += rows.length;
  log(`  ${table} write failed (${rows.length} row(s)): ${msg}`);
}

const upsertEntities = (rows, opts) =>
  safeWrite('gs_entities', rows, (chunk) => supabase.from('gs_entities').upsert(chunk, opts));

/** Execute raw SQL via Supabase REST API */
async function execSql(sql) {
  const res = await fetch(`${SUPABASE_URL}/rest/v1/rpc/exec_sql`, {
    method: 'POST',
    headers: {
      'apikey': SUPABASE_KEY,
      'Authorization': `Bearer ${SUPABASE_KEY}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ query: sql }),
  });

  // If exec_sql RPC doesn't exist, fall back to pg_net or just report
  if (!res.ok) {
    const text = await res.text();
    // Try the /sql endpoint (Supabase management API)
    throw new Error(`SQL exec failed: ${text}`);
  }
  return res.json();
}

/** Execute raw SQL via Supabase SQL endpoint (management API) */
async function execSqlDirect(sql) {
  // Use the PostgREST /rpc endpoint or fall back
  try {
    return await execSql(sql);
  } catch {
    // Fall back: execute via pg functions
    log('  (exec_sql RPC not available — using client workaround)');
    return null;
  }
}

// ─── Set-based relationship builder (direct psql) ────────────────────────────
// The relationship phases run as ONE server-side INSERT...SELECT each, instead of
// pulling every source row into Node and writing 200-row REST chunks. This is ~250x
// faster (minutes → seconds) AND immune to the in-memory entity-index pagination bug
// that silently dropped ~⅓ of links: the join resolves against the COMPLETE gs_entities
// table, never a partial in-memory copy. Writes are additive (ON CONFLICT DO NOTHING on
// the dedup index) — identical insert-or-skip semantics to the old REST path.
const PSQL_BIN = resolveBin('psql');
const PG_PASSWORD = process.env.DATABASE_PASSWORD;
const PSQL_CONN = [
  '-h', process.env.PGHOST || 'aws-0-ap-southeast-2.pooler.supabase.com',
  '-p', process.env.PGPORT || '5432',
  '-U', process.env.PGUSER || 'postgres.tednluwflfhxyucgwigh',
  '-d', process.env.PGDATABASE || 'postgres',
  '-X',                        // skip ~/.psqlrc
  '-A', '-t',                  // unaligned, tuples-only → clean machine-readable output
  '-v', 'ON_ERROR_STOP=1',
];

const DEDUP_TARGET =
  "(source_entity_id, target_entity_id, relationship_type, dataset, COALESCE(source_record_id, ''::text))";

/** Run one DML/SELECT statement via psql, retrying transient pooler failures. Returns stdout. */
async function runDml(label, sql) {
  if (!PG_PASSWORD) throw new Error('DATABASE_PASSWORD not set — set-based relationship phases require direct psql');
  const stdout = await withRetry(() => {
    const res = spawnSync(PSQL_BIN, [...PSQL_CONN, '-c', `SET statement_timeout=0;\n${sql}`], {
      env: { ...process.env, PGPASSWORD: PG_PASSWORD },
      encoding: 'utf8',
      maxBuffer: 64 * 1024 * 1024,
    });
    if (res.error) throw res.error;                                   // ENOENT / spawn failure
    if (res.status !== 0) throw new Error((res.stderr || res.stdout || `psql exit ${res.status}`).trim());
    return res.stdout || '';
  }, label);
  return String(stdout);
}

/** Run a SELECT via psql and parse each `-A -t` line as a JSON row (delimiter-safe vs `-A`'s `|`). */
async function selectJsonRows(label, selectSql) {
  const out = await runDml(label, `SELECT row_to_json(_t) FROM (${selectSql}) _t;`);
  // runDml prefixes stdout with psql command tags (e.g. the "SET" from statement_timeout=0).
  // row_to_json emits exactly one JSON object per line, so keep only `{`-prefixed lines.
  return out.split('\n').map((s) => s.trim())
    .filter((line) => line.startsWith('{'))
    .map((line) => JSON.parse(line));
}

/**
 * Build one relationship dataset set-based. `cols` is the parenthesised insert column list;
 * `selectSql` is the matching SELECT. `prelude` runs first in the SAME psql session — use it to
 * pre-materialise + index any lookup table the SELECT joins, so the planner gets real stats and
 * an index scan instead of a nested-loop-over-a-Materialize (the latter turned the donations
 * join into a ~4-billion-op runaway). Dry-run counts candidate rows instead of writing.
 */
async function buildRelationshipsSetBased(label, cols, selectSql, prelude = '') {
  const pre = prelude ? `${prelude.trim()}\n` : '';
  if (dryRun) {
    const out = await runDml(label, `${pre}SELECT count(*) FROM (${selectSql}) _q;`);
    log(`  [dry-run] ${label}: ${(out.trim().split('\n').pop() || '?')} candidate rows`);
    return;
  }
  const out = await runDml(
    label,
    `${pre}INSERT INTO gs_relationships ${cols}\n${selectSql}\nON CONFLICT ${DEDUP_TARGET} DO NOTHING;`,
  );
  const m = out.match(/INSERT\s+\d+\s+(\d+)/);
  log(`  ${label}: ${m ? m[1] : '0'} inserted (existing rows skipped via ON CONFLICT)`);
}

// makeGsId now lives in ./lib/gs-id.mjs — see #324 for why it had to be validated and shared.


// ─── Phase 1: Build entity registry ──────────────────────────────────────────

async function buildEntities() {
  log('Phase 1: Building entity registry...');
  const stats = { charities: 0, foundations: 0, oric: 0, govt: 0, suppliers: 0, donors: 0, parties: 0, ato: 0, asx: 0, social: 0, skipped: 0 };
  const batchSize = 1000;

  // 1a. ACNC Charities (64K) — the backbone
  log('  Loading ACNC charities...');
  let offset = 0;
  while (true) {
    const { data: charities, error } = await supabase
      .from('acnc_charities')
      .select('abn, name, is_foundation, state, postcode')
      .range(offset, offset + batchSize - 1);
    if (error) { log(`  ERROR: ${error.message}`); break; }
    if (!charities?.length) break;

    const entities = charities
      .filter(c => c.abn)
      .map(c => ({
        entity_type: c.is_foundation ? 'foundation' : 'charity',
        canonical_name: c.name,
        abn: c.abn,
        gs_id: makeGsId({ abn: c.abn }),
        state: c.state,
        postcode: c.postcode,
        source_datasets: ['acnc'],
        source_count: 1,
        confidence: 'registry',
      }));

    await upsertEntities(entities, { onConflict: 'gs_id', ignoreDuplicates: false });
    stats.charities += entities.length;
    offset += batchSize;
    if (offset % 10000 === 0) log(`  ACNC progress: ${offset} processed`);
  }
  log(`  ACNC charities: ${stats.charities} entities`);

  // 1b. Foundations — BULK UPDATE via batched upsert (not per-row!)
  log('  Enriching foundations (bulk)...');
  offset = 0;
  while (true) {
    const { data: foundations, error } = await supabase
      .from('foundations')
      .select('acnc_abn, name, website, description, thematic_focus, geographic_focus')
      .range(offset, offset + batchSize - 1);
    if (error) { log(`  ERROR: ${error.message}`); break; }
    if (!foundations?.length) break;

    if (!dryRun) {
      // Batch: build upsert array with foundation-enriched data
      const updates = foundations
        .filter(f => f.acnc_abn)
        .map(f => ({
          gs_id: makeGsId({ abn: f.acnc_abn }),
          canonical_name: f.name,
          abn: f.acnc_abn,
          entity_type: 'foundation',
          description: f.description || undefined,
          website: f.website || undefined,
          sector: f.thematic_focus?.[0] || null,
          source_datasets: ['acnc', 'foundations'],
          source_count: 2,
          confidence: 'registry',
        }));

      // Upsert merges with existing ACNC records via gs_id conflict
      for (let i = 0; i < updates.length; i += 500) {
        await upsertEntities(updates.slice(i, i + 500), { onConflict: 'gs_id', ignoreDuplicates: false });
      }
    }
    stats.foundations += foundations.length;
    offset += batchSize;
    if (offset % 5000 === 0) log(`  Foundation progress: ${offset} processed`);
  }
  log(`  Foundations enriched: ${stats.foundations}`);

  // 1c. ORIC Corporations — batch upsert
  log('  Loading ORIC corporations...');
  // Merged AU-ORIC twins live on as their AU-ABN survivor rows (dedup migration
  // 20260809200000) — re-minting them here silently undoes the dedup, so every
  // applied dedup tranche appends its manifest table to this list.
  const DEDUP_MANIFEST_TABLES = ['dedup_tranche1_20260809'];
  const suppressedGsIds = new Set();
  for (const manifestTable of DEDUP_MANIFEST_TABLES) {
    let mOffset = 0;
    while (true) {
      const { data: rows, error: mErr } = await supabase
        .from(manifestTable)
        .select('oric_gs_id')
        .range(mOffset, mOffset + batchSize - 1);
      if (mErr) { log(`  WARN: dedup manifest ${manifestTable} unreadable (${mErr.message}) — no suppression this run`); break; }
      if (!rows?.length) break;
      for (const r of rows) if (r.oric_gs_id) suppressedGsIds.add(r.oric_gs_id);
      mOffset += batchSize;
    }
  }
  if (suppressedGsIds.size) log(`  ORIC dedup suppression: ${suppressedGsIds.size} merged gs_ids will be skipped`);
  offset = 0;
  while (true) {
    const { data: corps, error } = await supabase
      .from('oric_corporations')
      .select('icn, abn, name, state, postcode, enriched_description, status')
      .range(offset, offset + batchSize - 1);
    if (error) { log(`  ERROR: ${error.message}`); break; }
    if (!corps?.length) break;

    if (!dryRun) {
      // Deduplicate within batch — multiple ORIC corps can share ABN
      const deduped = new Map();
      for (const c of corps) {
        if (!c.abn && !c.icn) continue;
        const gsId = makeGsId({ abn: c.abn, icn: c.icn });
        if (suppressedGsIds.has(gsId)) { stats.skipped++; continue; }
        if (!deduped.has(gsId)) {
          deduped.set(gsId, {
            entity_type: 'indigenous_corp',
            canonical_name: c.name,
            abn: c.abn || null,
            gs_id: gsId,
            state: c.state,
            postcode: c.postcode,
            description: c.enriched_description || null,
            source_datasets: c.abn ? ['acnc', 'oric'] : ['oric'],
            source_count: c.abn ? 2 : 1,
            confidence: 'registry',
          });
        }
      }
      const entities = Array.from(deduped.values());

      for (let i = 0; i < entities.length; i += 500) {
        await upsertEntities(entities.slice(i, i + 500), { onConflict: 'gs_id', ignoreDuplicates: false });
      }
    }
    stats.oric += corps.length;
    offset += batchSize;
  }
  log(`  ORIC corporations: ${stats.oric}`);

  // 1d. Government bodies (from AusTender buyers) — set-based distinct read.
  // The old unpaginated REST select silently hit PostgREST's 1000-row cap (#85 bug class), so it
  // only saw buyers present in the first 1000 of ~770K contract rows. Push the DISTINCT to the DB
  // (instant) so every buyer becomes a government_body entity.
  log('  Loading government bodies...');
  const buyerRows = await selectJsonRows('government buyers',
    `SELECT DISTINCT ON (buyer_id) buyer_id, buyer_name
       FROM austender_contracts
      WHERE buyer_name IS NOT NULL AND buyer_id IS NOT NULL`);

  const uniqueBuyers = new Map();
  for (const b of buyerRows) {
    if (!uniqueBuyers.has(b.buyer_id)) uniqueBuyers.set(b.buyer_id, b.buyer_name);
  }

  if (!dryRun) {
    const govEntities = Array.from(uniqueBuyers.entries()).map(([buyerId, name]) => ({
      entity_type: 'government_body',
      canonical_name: name,
      gs_id: makeGsId({ buyer_id: buyerId }),
      source_datasets: ['austender'],
      source_count: 1,
      confidence: 'registry',
    }));

    for (let i = 0; i < govEntities.length; i += 500) {
      const chunk = govEntities.slice(i, i + 500);
      await upsertEntities(chunk, { onConflict: 'gs_id', ignoreDuplicates: true });
    }
  }
  stats.govt = uniqueBuyers.size;
  log(`  Government bodies: ${stats.govt}`);

  // 1e. AusTender suppliers (by ABN) — set-based distinct read.
  // Same #85 cap bug: ~60K distinct supplier ABNs were truncated to whatever appeared in the first
  // 1000 contract rows. That truncation is the upstream cause of contracts with no supplier entity
  // (the preserved legacy-only contract edges). Push DISTINCT to the DB so every supplier exists.
  // Filter to valid 11-digit ABNs: ~12 distinct values are Excel/exempt garbage ('#N/A',
  // 'Exempt-NonAustralianEntity', ...) that would otherwise collapse hundreds of unrelated suppliers
  // into one fake hub node. The contract-relationship join applies the same filter (kept in sync).
  log('  Loading AusTender suppliers...');
  const supplierRows = await selectJsonRows('austender suppliers',
    `SELECT DISTINCT ON (supplier_abn) supplier_abn, supplier_name, supplier_entity_type
       FROM austender_contracts
      WHERE supplier_abn IS NOT NULL
        AND regexp_replace(supplier_abn, '\\s', '', 'g') ~ '^[0-9]{11}$'
        AND NULLIF(btrim(supplier_name), '') IS NOT NULL
      ORDER BY supplier_abn, contract_start DESC NULLS LAST, id DESC`);

  const uniqueSuppliers = new Map();
  for (const s of supplierRows) {
    if (!uniqueSuppliers.has(s.supplier_abn)) {
      uniqueSuppliers.set(s.supplier_abn, { name: s.supplier_name, type: s.supplier_entity_type });
    }
  }

  if (!dryRun) {
    const out = await runDml('austender supplier entities', `
      INSERT INTO gs_entities (entity_type, canonical_name, abn, gs_id, source_datasets, source_count, confidence)
      SELECT CASE
               WHEN supplier_entity_type = 'Charity' THEN 'charity'
               WHEN supplier_entity_type = 'Indigenous Corp' THEN 'indigenous_corp'
               ELSE 'company'
             END,
             supplier_name,
             supplier_abn,
             'AU-ABN-' || regexp_replace(supplier_abn, '\\s', '', 'g'),
             ARRAY['austender']::text[],
             1,
             'registry'
        FROM (
          SELECT DISTINCT ON (supplier_abn) supplier_abn, supplier_name, supplier_entity_type
            FROM austender_contracts
           WHERE supplier_abn IS NOT NULL
             AND regexp_replace(supplier_abn, '\\s', '', 'g') ~ '^[0-9]{11}$'
             AND NULLIF(btrim(supplier_name), '') IS NOT NULL
           ORDER BY supplier_abn, contract_start DESC NULLS LAST, id DESC
        ) suppliers
      ON CONFLICT DO NOTHING;`);
    const inserted = out.match(/INSERT\s+\d+\s+(\d+)/)?.[1] || '0';
    log(`  AusTender supplier entities inserted: ${inserted}`);
  }
  stats.suppliers = uniqueSuppliers.size;
  log(`  AusTender suppliers (unique ABNs): ${stats.suppliers}`);

  // 1f. Political parties — one entity per distinct donation_to recipient.
  // The old unpaginated REST select silently hit PostgREST's 1000-row cap, so only
  // ~66 of 2,437 distinct recipients ever became party entities. Fetch the distinct
  // set set-based (instant), and keep makeGsId so gs_ids stay consistent across runs
  // (the donations phase joins parties by name, but a stable gs_id prevents dupes).
  log('  Loading political parties...');
  const partyRows = await selectJsonRows('political party recipients',
    `SELECT DISTINCT donation_to FROM political_donations WHERE donation_to IS NOT NULL`);
  const uniqueParties = partyRows.map((r) => r.donation_to).filter(Boolean);

  if (!dryRun) {
    const partyEntities = uniqueParties.map((name) => ({
      entity_type: 'political_party',
      canonical_name: name,
      gs_id: makeGsId({ name }),
      source_datasets: ['aec_donations'],
      source_count: 1,
      confidence: 'registry',
    }));

    for (let i = 0; i < partyEntities.length; i += 500) {
      const chunk = partyEntities.slice(i, i + 500);
      await upsertEntities(chunk, { onConflict: 'gs_id', ignoreDuplicates: true });
    }
  }
  stats.parties = uniqueParties.length;
  log(`  Political parties: ${stats.parties}`);

  // 1g. Donors (from donor_entity_matches) — batch upsert
  log('  Loading matched donors...');
  offset = 0;
  while (true) {
    const { data: donors, error } = await supabase
      .from('donor_entity_matches')
      .select('donor_name, matched_abn, matched_entity_type, match_confidence')
      .not('matched_abn', 'is', null)
      .range(offset, offset + batchSize - 1);
    if (error) { log(`  ERROR: ${error.message}`); break; }
    if (!donors?.length) break;

    if (!dryRun) {
      const donorEntities = donors.map(d => ({
        entity_type: d.matched_entity_type === 'acnc' ? 'charity' : 'company',
        canonical_name: d.donor_name,
        abn: d.matched_abn,
        gs_id: makeGsId({ abn: d.matched_abn }),
        source_datasets: ['aec_donations'],
        source_count: 1,
        confidence: d.match_confidence >= 0.9 ? 'verified' : 'reported',
      }));

      for (let i = 0; i < donorEntities.length; i += 500) {
        const chunk = donorEntities.slice(i, i + 500);
        await upsertEntities(chunk, { onConflict: 'gs_id', ignoreDuplicates: true });
      }
    }
    stats.donors += donors.length;
    offset += batchSize;
  }
  log(`  Matched donors: ${stats.donors}`);

  // 1h. ATO Tax Transparency — batch upsert with financial data
  log('  Linking ATO tax data...');
  offset = 0;
  while (true) {
    const { data: taxRecords, error } = await supabase
      .from('ato_tax_transparency')
      .select('abn, entity_name, industry, total_income, taxable_income, tax_payable, report_year')
      .not('abn', 'is', null)
      .order('report_year', { ascending: false })
      .range(offset, offset + batchSize - 1);
    if (error) { log(`  ERROR: ${error.message}`); break; }
    if (!taxRecords?.length) break;

    // Deduplicate by ABN (keep latest year)
    const byAbn = new Map();
    for (const t of taxRecords) {
      if (!byAbn.has(t.abn)) byAbn.set(t.abn, t);
    }

    if (!dryRun) {
      const atoEntities = Array.from(byAbn.values()).map(t => ({
        entity_type: 'company',
        canonical_name: t.entity_name,
        abn: t.abn,
        gs_id: makeGsId({ abn: t.abn }),
        sector: t.industry || null,
        latest_revenue: t.total_income,
        latest_tax_payable: t.tax_payable,
        financial_year: t.report_year?.toString(),
        source_datasets: ['ato_tax'],
        source_count: 1,
        confidence: 'registry',
      }));

      for (let i = 0; i < atoEntities.length; i += 500) {
        const chunk = atoEntities.slice(i, i + 500);
        // ignoreDuplicates: true — don't overwrite entities already created from ACNC/foundations
        // We'll do a separate bulk update for financial data on existing entities
        await upsertEntities(chunk, { onConflict: 'gs_id', ignoreDuplicates: true });
      }

      // Bulk update financial data for ALL ATO records (even pre-existing entities)
      // Build a VALUES list for a single UPDATE ... FROM
      const atoUpdates = Array.from(byAbn.values()).map(t => ({
        gs_id: makeGsId({ abn: t.abn }),
        latest_revenue: t.total_income,
        latest_tax_payable: t.tax_payable,
        financial_year: t.report_year?.toString(),
        sector: t.industry || null,
      }));

      // Batch update: for each ATO entity, update financial fields
      for (let i = 0; i < atoUpdates.length; i += 100) {
        const chunk = atoUpdates.slice(i, i + 100);
        const promises = chunk.map(u =>
          supabase.from('gs_entities').update({
            latest_revenue: u.latest_revenue,
            latest_tax_payable: u.latest_tax_payable,
            financial_year: u.financial_year,
          }).eq('gs_id', u.gs_id)
        );
        await Promise.all(promises);
      }
    }
    stats.ato += byAbn.size;
    offset += batchSize;
    if (offset % 5000 === 0) log(`  ATO progress: ${offset} processed`);
  }
  log(`  ATO tax records linked: ${stats.ato}`);

  // 1i. ASX Companies — set-based read (was unpaginated; asx_companies has ~2,013 rows so the
  // 1000-cap truncated it too). NOTE: every asx_companies.abn is currently NULL, so the abn filter
  // below yields 0 entities regardless — an upstream data-population gap, tracked separately.
  // Reading the full set is correctness hygiene; it won't add entities until ABNs exist.
  log('  Loading ASX companies...');
  const asxCompanies = await selectJsonRows('asx companies',
    `SELECT asx_code, company_name, abn, gics_industry_group FROM asx_companies`);
  const asxWithAbn = asxCompanies.filter(c => c.abn);

  if (!dryRun && asxWithAbn.length) {
    const asxEntities = asxWithAbn
      .map(c => ({
        entity_type: 'company',
        canonical_name: c.company_name,
        abn: c.abn,
        gs_id: makeGsId({ abn: c.abn }),
        sector: c.gics_industry_group || null,
        source_datasets: ['asx'],
        source_count: 1,
        confidence: 'registry',
      }));

    for (let i = 0; i < asxEntities.length; i += 500) {
      const chunk = asxEntities.slice(i, i + 500);
      await upsertEntities(chunk, { onConflict: 'gs_id', ignoreDuplicates: true });
    }
    stats.asx = asxEntities.length;
  }
  log(asxWithAbn.length
    ? `  ASX companies: ${stats.asx}`
    : `  ASX companies: 0 (all ${asxCompanies.length} rows have NULL abn — upstream data gap)`);

  // 1j. Social Enterprises — batch upsert
  log('  Loading social enterprises...');
  offset = 0;
  while (true) {
    const { data: ses, error } = await supabase
      .from('social_enterprises')
      .select('abn, name, state, sector, website, description')
      .not('abn', 'is', null)
      .range(offset, offset + batchSize - 1);
    if (error) { log(`  ERROR: ${error.message}`); break; }
    if (!ses?.length) break;

    if (!dryRun) {
      const seEntities = ses.map(s => ({
        entity_type: 'social_enterprise',
        canonical_name: s.name,
        abn: s.abn,
        gs_id: makeGsId({ abn: s.abn }),
        state: s.state,
        website: s.website,
        description: s.description,
        source_datasets: ['social_enterprises'],
        source_count: 1,
        confidence: 'registry',
      }));

      for (let i = 0; i < seEntities.length; i += 500) {
        const chunk = seEntities.slice(i, i + 500);
        await upsertEntities(chunk, { onConflict: 'gs_id', ignoreDuplicates: true });
      }
    }
    stats.social += ses.length;
    offset += batchSize;
  }
  log(`  Social enterprises: ${stats.social}`);

  // 1k. JusticeHub Organizations — batch upsert (cross-system bridge)
  log('  Loading JusticeHub organizations...');
  let jhCount = 0;
  offset = 0;
  while (true) {
    const { data: jhOrgs, error } = await supabase
      .from('organizations')
      .select('id, name, abn, type, state, postcode, gs_entity_id')
      .not('abn', 'is', null)
      .range(offset, offset + batchSize - 1);
    if (error) { log(`  ERROR: ${error.message}`); break; }
    if (!jhOrgs?.length) break;

    // Only process orgs that still need linking (~3K of ~104K), not all of them
    // every run. Re-processing all 104K with a per-row SELECT + UPDATE was the
    // N+1 loop (~208K sequential round-trips) that ran this stage past the
    // orchestrator's wall-clock timeout.
    const unlinked = jhOrgs.filter(o => !o.gs_entity_id);
    if (!dryRun && unlinked.length) {
      const jhEntities = unlinked.map(o => ({
        entity_type: o.type === 'government' ? 'government_body' : (o.type === 'indigenous' ? 'indigenous_corp' : 'charity'),
        canonical_name: o.name,
        abn: o.abn,
        gs_id: makeGsId({ abn: o.abn }),
        state: o.state,
        postcode: o.postcode,
        source_datasets: ['justicehub'],
        source_count: 1,
        confidence: 'registry',
      }));

      for (let i = 0; i < jhEntities.length; i += 500) {
        await upsertEntities(jhEntities.slice(i, i + 500), { onConflict: 'gs_id', ignoreDuplicates: true });
      }

      // Auto-link: one bulk SELECT for this batch's entity ids, then update only
      // the unlinked orgs (was a per-row SELECT + UPDATE on every org).
      const gsIds = [...new Set(unlinked.map(o => makeGsId({ abn: o.abn })))];
      const idByGsId = new Map();
      for (let i = 0; i < gsIds.length; i += 1000) {
        const { data: ents } = await supabase
          .from('gs_entities')
          .select('id, gs_id')
          .in('gs_id', gsIds.slice(i, i + 1000));
        for (const e of (ents || [])) idByGsId.set(e.gs_id, e.id);
      }
      for (const o of unlinked) {
        const eid = idByGsId.get(makeGsId({ abn: o.abn }));
        if (eid) await supabase.from('organizations').update({ gs_entity_id: eid }).eq('id', o.id);
      }
    }
    jhCount += jhOrgs.length;
    offset += batchSize;
  }
  log(`  JusticeHub organizations: ${jhCount}`);

  log(`\nEntity registry complete:`);
  log(`  ACNC charities: ${stats.charities}`);
  log(`  Foundations enriched: ${stats.foundations}`);
  log(`  ORIC corporations: ${stats.oric}`);
  log(`  Government bodies: ${stats.govt}`);
  log(`  AusTender suppliers: ${stats.suppliers}`);
  log(`  Political parties: ${stats.parties}`);
  log(`  Matched donors: ${stats.donors}`);
  log(`  ATO tax records: ${stats.ato}`);
  log(`  ASX companies: ${stats.asx}`);
  log(`  Social enterprises: ${stats.social}`);
  log(`  JusticeHub orgs: ${jhCount}`);
  log(`  Skipped: ${stats.skipped}`);
  return stats;
}

// ─── Phase 2a: Political donations → relationships ──────────────────────────

// NB: the SQL for these 4 phases lives in scripts/lib/graph-edge-datasets.mjs — the
// single source of truth shared with check-graph-completeness.mjs, so the gate's
// "expected" count can never drift from what we actually insert. Edit the SQL there.

async function buildDonationRelationships() {
  log('\nPhase 2a: Political donation relationships...');
  const d = edgeDataset('aec_donations');
  await buildRelationshipsSetBased(d.label, d.cols, d.selectSql, d.prelude);
}

// ─── Phase 2b: AusTender contracts → relationships ──────────────────────────

async function buildContractRelationships() {
  log('\nPhase 2b: Contract relationships...');
  const d = edgeDataset('austender');
  await buildRelationshipsSetBased(d.label, d.cols, d.selectSql, d.prelude);
}

// ─── Phase 2b2: Grant opportunities → relationships ─────────────────────────

async function buildGrantRelationships() {
  log('\nPhase 2b2: Grant relationships...');
  const d = edgeDataset('grant_opportunities');
  await buildRelationshipsSetBased(d.label, d.cols, d.selectSql, d.prelude);
}

// ─── Phase 2c: Cross-registry links ──────────────────────────────────────────

async function buildCrossRegistryLinks() {
  log('\nPhase 2c: Cross-registry links...');
  log('  Building foundation → parent company links...');
  const d = edgeDataset('foundations');
  await buildRelationshipsSetBased(d.label, d.cols, d.selectSql, d.prelude);
}

// ─── Phase 2d: Justice funding → relationships ──────────────────────────────

async function buildJusticeRelationships() {
  log('\nPhase 2d: Justice funding relationships...');
  const d = edgeDataset('justice_funding');
  // Program entities (entity_type='program') are derived from justice_funding itself, so create
  // them here (additive, idempotent) before building the program→recipient grant edges.
  if (!dryRun) {
    const out = await runDml('justice program entities', JUSTICE_PROGRAM_ENSURE_SQL);
    const m = out.match(/INSERT\s+\d+\s+(\d+)/);
    log(`  Program entities: ${m ? m[1] : '0'} created (existing reused)`);
  }
  // WRITE appends the additive guard (only un-edged payments); the completeness gate uses the bare
  // selectSql (full derivation), so expected can't drift from the canonical join.
  await buildRelationshipsSetBased(d.label, d.cols, d.selectSql + JUSTICE_BUILD_GUARD, d.prelude);
}

// ─── Phase 2e: GrantConnect awards → relationships ───────────────────────────

async function buildGrantConnectRelationships() {
  log('\nPhase 2e: GrantConnect award relationships...');
  // ADDED 2026-08-14. grantconnect_awards held 291,264 rows and ZERO edges — the largest
  // awarded-grants source in the database was absent from the relationship layer. Not stale:
  // never built, because no phase existed to build it.
  //
  // Expected ~189,590 edges (65.1% of awards satisfy both join sides). The derivation and its
  // agency-dedup prelude live in graph-edge-datasets.mjs and are validated read-only by
  // check-graph-completeness --dataset=grantconnect_awards.
  const d = edgeDataset('grantconnect_awards');
  await buildRelationshipsSetBased(d.label, d.cols, d.selectSql, d.prelude);
}

// ─── Phase 3: Refresh materialised views ─────────────────────────────────────

async function refreshViews() {
  log('\nPhase 3: Refreshing materialised views...');

  const views = ['mv_gs_donor_contractors', 'mv_gs_entity_stats'];

  for (const view of views) {
    log(`  Refreshing ${view}...`);
    try {
      await runDml(`refresh ${view}`, `REFRESH MATERIALIZED VIEW CONCURRENTLY ${view};`);
      log(`  ${view} refreshed`);
    } catch (concurrentError) {
      try {
        await runDml(`refresh ${view} non-concurrent`, `REFRESH MATERIALIZED VIEW ${view};`);
        log(`  ${view} refreshed (non-concurrent)`);
      } catch (e) {
        log(`  Warning: ${view} refresh failed — concurrent: ${concurrentError.message}; fallback: ${e.message}`);
      }
    }
  }
}

// ─── Main ────────────────────────────────────────────────────────────────────

async function main() {
  log(`Starting entity graph build (phase=${phase}, dry-run=${dryRun})`);
  const startTime = Date.now();

  if (phase === 'all' || phase === 'entities') {
    await buildEntities();
  }

  if (phase === 'all' || phase === 'donations') {
    await buildDonationRelationships();
  }

  if (phase === 'all' || phase === 'contracts') {
    await buildContractRelationships();
  }

  if (phase === 'all' || phase === 'grants') {
    await buildGrantRelationships();
  }

  if (phase === 'all' || phase === 'links') {
    await buildCrossRegistryLinks();
  }

  if (phase === 'all' || phase === 'justice') {
    await buildJusticeRelationships();
  }

  if (phase === 'all' || phase === 'grantconnect') {
    await buildGrantConnectRelationships();
  }

  if (phase === 'all' || phase === 'refresh') {
    await refreshViews();
  }

  // Final stats
  const { count: entityCount } = await supabase.from('gs_entities').select('*', { count: 'exact', head: true });
  const { count: relCount } = await supabase.from('gs_relationships').select('*', { count: 'exact', head: true });

  const elapsed = ((Date.now() - startTime) / 1000).toFixed(1);
  log(`\n════════════════════════════════════════`);
  log(`Entity graph build complete in ${elapsed}s`);
  log(`  Entities: ${entityCount ?? '?'}`);
  log(`  Relationships: ${relCount ?? '?'}`);
  log(`  Batch-splits: ${writeSplits} · duplicates skipped: ${duplicatesSkipped} · permanent write failures: ${writeFailures}`);
  log(`════════════════════════════════════════`);

  if (writeFailures > 0) {
    log(`⚠ ${writeFailures} row(s) failed to write after adaptive retry — graph is INCOMPLETE`);
    process.exit(1);
  }
}

main().catch(err => {
  console.error('[entity-graph] Fatal error:', err);
  process.exit(1);
});
