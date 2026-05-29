#!/usr/bin/env node

/**
 * Reconcile gs_entities.source_datasets / source_count by ABN.
 *
 * WHY: the ingest/build scripts (engine-entity-resolution.mjs, build-entity-graph.mjs,
 * backfill-austender-entities.mjs, overnight-linkage-sweep.mjs) upsert with
 * `ignoreDuplicates: true` and write a single-element source_datasets array. When an
 * ABN appears in more than one source table, only the FIRST writer's label sticks and
 * later sources are silently dropped. That left the donor-contractor overlap unlinked
 * (2,078 ABNs are in both political_donations and austender_contracts, but only ~5 were
 * tagged with both). See thoughts: civicgraph-entity-resolution-fix-2026-05-29.md.
 *
 * WHAT: for every ABN, union the datasets it actually appears in across the source
 * tables below and merge them onto gs_entities.source_datasets (+ recompute source_count).
 * Idempotent: gated by `@>`, so a row is selected only when it is actually missing a
 * label. Re-running heals any drift re-introduced by future ingest runs, which is why
 * this is wired as a scheduled agent rather than a one-shot migration.
 *
 * NOTE: the target arrays are computed in SQL (read via exec_sql, which wraps the query
 * in `SELECT row_to_json(t) FROM (...) t` and therefore cannot run DML), then written
 * with the JS client's .update(). Batched so no single statement times out; in steady
 * state it selects ~0 rows and exits.
 *
 * Usage: node --env-file=.env scripts/reconcile-entity-source-datasets.mjs [--batch=2000] [--dry-run]
 */

import 'dotenv/config';
import { createClient } from '@supabase/supabase-js';

const SUPABASE_URL = process.env.SUPABASE_URL;
const SUPABASE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;
if (!SUPABASE_URL || !SUPABASE_KEY) {
  console.error('Missing SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY');
  process.exit(1);
}
const supabase = createClient(SUPABASE_URL, SUPABASE_KEY, { auth: { persistSession: false } });

const arg = (p, d) => { const a = process.argv.find((x) => x.startsWith(`${p}=`)); return a ? a.slice(p.length + 1) : d; };
const BATCH = parseInt(arg('--batch', '2000'), 10);
const WRITE_CONCURRENCY = 25;
const DRY_RUN = process.argv.includes('--dry-run');

// exec_sql returns SETOF json (one row_to_json per row). NO trailing ';' and SELECT-only.
const sql = async (query) => {
  const { data, error } = await supabase.rpc('exec_sql', { query });
  if (error) throw new Error(error.message);
  return data || [];
};

// ABN-keyed source tables -> canonical source_datasets label. Extend as needed
// (acnc_charities/abn -> acnc, justice_funding/recipient_abn -> justice_funding, etc.).
const SOURCES = [
  { table: 'austender_contracts', abn: 'supplier_abn', label: 'austender' },
  { table: 'political_donations', abn: 'donor_abn', label: 'aec_donations' },
];

const ABN_SRC = SOURCES.map((s) =>
  `SELECT DISTINCT ${s.abn} AS abn, '${s.label}'::text AS ds FROM ${s.table} WHERE ${s.abn} IS NOT NULL AND length(trim(${s.abn})) >= 9`,
).join('\n      UNION\n      ');

const MERGED_CTE = `WITH abn_src AS (
      ${ABN_SRC}
    ), merged AS (
      SELECT abn, array_agg(DISTINCT ds ORDER BY ds) AS datasets FROM abn_src GROUP BY abn
    )`;

// One batch of entities still missing a label, with the target array pre-computed in SQL.
const fetchBatch = () => sql(`${MERGED_CTE}
    SELECT e.id AS id,
      (SELECT array_agg(DISTINCT d ORDER BY d) FROM unnest(coalesce(e.source_datasets, '{}') || m.datasets) d) AS new_source_datasets,
      (SELECT count(DISTINCT d)::int FROM unnest(coalesce(e.source_datasets, '{}') || m.datasets) d) AS new_source_count
    FROM gs_entities e JOIN merged m ON e.abn = m.abn
    WHERE NOT (coalesce(e.source_datasets, '{}') @> m.datasets)
    LIMIT ${BATCH}`);

async function main() {
  console.log(`[reconcile] sources: ${SOURCES.map((s) => s.label).join(', ')} | batch=${BATCH} | dry-run=${DRY_RUN}`);

  if (DRY_RUN) {
    const rows = await sql(`${MERGED_CTE}
      SELECT count(*)::int AS n
      FROM gs_entities e JOIN merged m ON e.abn = m.abn
      WHERE NOT (coalesce(e.source_datasets, '{}') @> m.datasets)`);
    console.log(`[reconcile] ${Number(rows?.[0]?.n || 0)} entities need a dataset label merged (dry run, no writes)`);
    return;
  }

  let total = 0;
  let batch;
  do {
    batch = await fetchBatch();
    for (let i = 0; i < batch.length; i += WRITE_CONCURRENCY) {
      const chunk = batch.slice(i, i + WRITE_CONCURRENCY);
      await Promise.all(chunk.map((r) =>
        supabase
          .from('gs_entities')
          .update({ source_datasets: r.new_source_datasets, source_count: r.new_source_count })
          .eq('id', r.id)
          .then(({ error }) => { if (error) throw new Error(`update ${r.id}: ${error.message}`); }),
      ));
    }
    total += batch.length;
    if (batch.length) console.log(`[reconcile] merged ${batch.length} (running total ${total})`);
  } while (batch.length > 0);

  console.log(`[reconcile] done. ${total} entities reconciled.`);
}

main().catch((err) => { console.error('[reconcile] fatal:', err.message); process.exit(1); });
