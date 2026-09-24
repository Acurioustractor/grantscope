#!/usr/bin/env node
/**
 * Money-lane reconciliation — does the money on the GRAPH match the money in the SOURCE?
 *
 * Fourth gate, after completeness (right number of edges), referential integrity (edges point at
 * rows that exist) and attribution (edges point at the right entity). It exists because on
 * 2026-09-24 the justice_funding edges summed to $76.3B while the filtered grant lane in the source
 * is $34.0B, and nothing had noticed:
 *
 *   real grants                               114,806 edges   $31.6B
 *   whole-of-state budget aggregates              276 edges   $25.5B   <- recipe has no lane filter
 *   edges whose source row was deleted            120 edges   $11.1B   <- builder only ever adds
 *   contract values / budget announcements     29,468 edges    $8.2B   <- recipe has no lane filter
 *
 * Every view that sums edges (entity stats, total funding, search money) inherited that.
 *
 * For each money dataset it measures, against the source table the edge was built from:
 *   ORPHANS   edges whose source_record_id no longer resolves to a source row
 *   LEAKAGE   edges built from rows OUTSIDE the lane (justice: not the grant lane; donations: a
 *             'donation' edge whose row is not 'donation received')
 *   DOUBLES   source rows that produced more than one edge
 * and prints edge dollars beside the filtered source dollars, so a gap is visible even when no
 * single rule catches it.
 *
 * Read-only against the data; writes one agent_runs row. Exits 1 when any ORPHANS or LEAKAGE
 * exist, so a scheduler surfaces it. Reports, never fixes: the fix is a recipe change plus a
 * reviewed migration.
 *
 * Usage:
 *   node --env-file=.env scripts/check-lane-reconciliation.mjs
 *   node --env-file=.env scripts/check-lane-reconciliation.mjs --json
 */
import { createClient } from '@supabase/supabase-js';
import { spawnSync } from 'node:child_process';
import { resolveBin } from './lib/agent-resilience.mjs';
import { logStart, logComplete } from './lib/log-agent-run.mjs';
import 'dotenv/config';

const AGENT_ID = 'check-lane-reconciliation';
const AGENT_NAME = 'Check Money Lane Reconciliation';
const jsonOut = process.argv.includes('--json');
const log = (m) => { if (!jsonOut) console.log(`[lane-recon] ${m}`); };

function psql(sql) {
  const res = spawnSync(resolveBin('psql'), [
    '-h', 'aws-0-ap-southeast-2.pooler.supabase.com', '-p', '5432',
    '-U', `postgres.${process.env.SUPABASE_PROJECT_REF || 'tednluwflfhxyucgwigh'}`,
    '-d', 'postgres', '-q', '-t', '-A', '-F', '|', '-c', `SET statement_timeout='300s'; ${sql}`,
  ], { encoding: 'utf8', env: { ...process.env, PGPASSWORD: process.env.DATABASE_PASSWORD } });
  if (res.status !== 0) throw new Error(res.stderr?.trim() || `psql exited ${res.status}`);
  return res.stdout.trim().split('\n').filter(Boolean).map((l) => l.split('|'));
}

const NON_RECIPIENT = `ARRAY['total','totals','grand total','subtotal','sub-total','various','n/a','na','unknown','tbc','other']`;

/**
 * One entry per money dataset. `src` builds the source key set once: `s_key` is the expression the
 * recipe writes into source_record_id (scripts/lib/graph-edge-datasets.mjs), plus whatever columns
 * the lane rule needs. `inLane` is judged after a single hash join (a per-edge lookup would scan the
 * source once per edge: 800K times for AusTender, whose key expression has no index).
 * `sourceTotal` is the filtered source figure the edges should reconcile to.
 */
const LANES = [
  {
    dataset: 'justice_funding',
    src: `SELECT s.id::text AS s_key,
                 (s.measure_kind = 'grant' AND s.is_aggregate IS NOT TRUE
                  AND lower(btrim(s.recipient_name)) <> ALL (${NON_RECIPIENT})) AS lane_ok
            FROM justice_funding s`,
    inLane: 'src.lane_ok',
    sourceTotal: `SELECT count(*), coalesce(sum(amount_dollars), 0) FROM justice_funding s
                   WHERE s.measure_kind = 'grant' AND s.is_aggregate IS NOT TRUE
                     AND lower(btrim(s.recipient_name)) <> ALL (${NON_RECIPIENT})`,
  },
  {
    dataset: 'aec_donations',
    src: `SELECT s.id::text AS s_key, (s.receipt_type = 'donation received') AS lane_ok FROM political_donations s`,
    // Only 'donation' edges are compared: party_receipt edges carry the rest of party income by
    // design. A 'donation' edge built from a row that is not 'donation received' is leakage.
    inLane: 'src.lane_ok',
    edgeFilter: `r.relationship_type = 'donation'`,
    sourceTotal: `SELECT count(*), coalesce(sum(amount), 0) FROM political_donations s
                   WHERE s.receipt_type = 'donation received'`,
  },
  {
    dataset: 'austender',
    src: `SELECT coalesce(NULLIF(s.ocid, ''), s.id::text) AS s_key, (s.contract_value > 0) AS lane_ok
            FROM austender_contracts s`,
    inLane: 'src.lane_ok',
    sourceTotal: `SELECT count(*), coalesce(sum(contract_value), 0) FROM austender_contracts s
                   WHERE s.contract_value > 0 AND regexp_replace(s.supplier_abn, '\\s', '', 'g') ~ '^[0-9]{11}$'`,
  },
  {
    dataset: 'grantconnect_awards',
    src: `SELECT s.ga_id AS s_key, true AS lane_ok FROM grantconnect_awards s`,
    inLane: 'src.lane_ok',
    sourceTotal: `SELECT count(*), coalesce(sum(value_aud), 0) FROM grantconnect_awards s WHERE s.gs_entity_id IS NOT NULL`,
  },
];

const n = (v) => Number(v ?? 0);
const bn = (v) => `$${(n(v) / 1e9).toFixed(2)}B`;

async function main() {
  const supabase = process.env.SUPABASE_SERVICE_ROLE_KEY
    ? createClient(process.env.SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY)
    : null;
  const runId = supabase ? await logStart(supabase, AGENT_ID, AGENT_NAME).then((r) => r?.id).catch(() => null) : null;

  const results = [];
  for (const lane of LANES) {
    const edgeWhere = `r.dataset = '${lane.dataset}'${lane.edgeFilter ? ` AND ${lane.edgeFilter}` : ''}`;
    // One pass over the dataset's edges, hash-joined to the source rows they claim to come from.
    const [row] = psql(`
      WITH src AS (${lane.src})
      SELECT count(*),
             coalesce(sum(r.amount), 0),
             count(*) FILTER (WHERE src.s_key IS NULL),
             coalesce(sum(r.amount) FILTER (WHERE src.s_key IS NULL), 0),
             count(*) FILTER (WHERE src.s_key IS NOT NULL AND NOT coalesce(${lane.inLane}, false)),
             coalesce(sum(r.amount) FILTER (WHERE src.s_key IS NOT NULL AND NOT coalesce(${lane.inLane}, false)), 0)
        FROM gs_relationships r
        LEFT JOIN src ON src.s_key = r.source_record_id
       WHERE ${edgeWhere};`);
    const [doubles] = psql(`
      SELECT count(*), coalesce(sum(extra), 0) FROM (
        SELECT count(*) - 1 AS extra FROM gs_relationships r
         WHERE ${edgeWhere}
         GROUP BY r.source_record_id HAVING count(*) > 1) z;`);
    const [src] = psql(lane.sourceTotal);
    results.push({
      dataset: lane.dataset,
      edges: n(row[0]), edgeDollars: n(row[1]),
      orphans: n(row[2]), orphanDollars: n(row[3]),
      leakage: n(row[4]), leakageDollars: n(row[5]),
      doubledSourceRows: n(doubles[0]), extraEdges: n(doubles[1]),
      sourceRows: n(src[0]), sourceDollars: n(src[1]),
    });
  }

  const failing = results.filter((r) => r.orphans > 0 || r.leakage > 0);

  if (supabase && runId) {
    await logComplete(supabase, runId, {
      items_found: results.length,
      items_new: failing.length,
      status: failing.length ? 'partial' : 'success',
      errors: failing.map((r) =>
        `${r.dataset}: ${r.orphans} orphan edges (${bn(r.orphanDollars)}), ${r.leakage} out-of-lane edges (${bn(r.leakageDollars)})`),
    }).catch(() => {});
  }

  if (jsonOut) {
    process.stdout.write(JSON.stringify({ results }, null, 2) + '\n');
    process.exit(failing.length ? 1 : 0);
  }

  log('dataset               edges   on edges    source (filtered)   orphans            out of lane         source rows with 2+ edges');
  for (const r of results) {
    log(`${r.dataset.padEnd(20)} ${String(r.edges).padStart(8)}  ${bn(r.edgeDollars).padStart(9)}   ${bn(r.sourceDollars).padStart(9)}` +
        `          ${String(r.orphans).padStart(6)} ${bn(r.orphanDollars).padStart(9)}   ${String(r.leakage).padStart(6)} ${bn(r.leakageDollars).padStart(9)}   ${r.doubledSourceRows} (+${r.extraEdges} edges)`);
  }
  log('');
  if (failing.length) {
    log(`✗ ${failing.length} dataset(s) carry orphan or out-of-lane edges: every view that sums edges overstates them.`);
    process.exit(1);
  }
  log('✓ every money lane reconciles');
}

main().catch((e) => { console.error(`[lane-recon] ${e.message}`); process.exit(2); });
