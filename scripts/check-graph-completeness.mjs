#!/usr/bin/env node
/**
 * Graph completeness gate — data-health roadmap Phase 2 (the centerpiece).
 *
 * For each relationship dataset, compute the EXPECTED edge count set-based (the same
 * INSERT…SELECT shape the build uses, minus the insert — distinct edge-keys) and compare
 * it to the ACTUAL count in gs_relationships. The edge SQL is imported from the single
 * source of truth (scripts/lib/graph-edge-datasets.mjs), so "expected" can never drift
 * from what build-entity-graph actually inserts.
 *
 *   expected > actual  → ALERT: edges silently went missing (the #82/#83 bug class).
 *   actual   > expected → STALE: gs_relationships carries rows the current build no longer
 *                         produces (legacy/dead-code dupes, deleted source rows). Informational.
 *
 * Writes one row per dataset to gs_graph_completeness_log (the roadmap's "coverage trend")
 * and an agent_runs row. Exits non-zero ONLY on ALERT (under-built) — the actionable bug
 * direction — so a scheduler / CI surfaces it. STALE and OK exit 0.
 *
 * Usage:
 *   node --env-file=.env scripts/check-graph-completeness.mjs
 *   node --env-file=.env scripts/check-graph-completeness.mjs --threshold=0.03
 *   node --env-file=.env scripts/check-graph-completeness.mjs --json   # machine-readable (for /health)
 */

import { createClient } from '@supabase/supabase-js';
import { spawnSync } from 'node:child_process';
import { resolveBin, withRetry } from './lib/agent-resilience.mjs';
import { GRAPH_EDGE_DATASETS, EDGE_KEY_COLS } from './lib/graph-edge-datasets.mjs';
import { logStart, logComplete, logFailed } from './lib/log-agent-run.mjs';
import 'dotenv/config';

const AGENT_ID = 'check-graph-completeness';
const AGENT_NAME = 'Check Graph Completeness';

const args = process.argv.slice(2);
const jsonOut = args.includes('--json');
const thresholdArg = args.find((a) => a.startsWith('--threshold='))?.split('=')[1];
// Drift tolerance: a dataset is ALERT only if it's under-built by MORE than this fraction.
// Default 5% — comfortably catches the 35% #82 drop while tolerating source rows that have
// arrived since the last build-entity-graph run (new data not yet built into edges).
const THRESHOLD = Number(thresholdArg ?? process.env.GRAPH_COMPLETENESS_THRESHOLD ?? 0.05);

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL;
const SUPABASE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;
const PG_PASSWORD = process.env.DATABASE_PASSWORD;
const PSQL_BIN = resolveBin('psql');
const PSQL_CONN = [
  '-h', process.env.PGHOST || 'aws-0-ap-southeast-2.pooler.supabase.com',
  '-p', process.env.PGPORT || '5432',
  '-U', process.env.PGUSER || 'postgres.tednluwflfhxyucgwigh',
  '-d', process.env.PGDATABASE || 'postgres',
  '-X', '-A', '-t', '-v', 'ON_ERROR_STOP=1',
];

// Only the gate's own output (the table + alerts) should reach stdout in --json mode; route
// progress chatter to stderr so `--json` produces a clean parseable document.
const log = (msg) => process.stderr.write(`[graph-completeness] ${msg}\n`);

/** Run a SELECT via psql and return the first cell of the last row as a string. */
function psqlScalar(label, sql) {
  if (!PG_PASSWORD) throw new Error('DATABASE_PASSWORD not set — graph-completeness check requires direct psql');
  return withRetry(() => {
    const res = spawnSync(PSQL_BIN, [...PSQL_CONN, '-c', `SET statement_timeout=0;\n${sql}`], {
      env: { ...process.env, PGPASSWORD: PG_PASSWORD },
      encoding: 'utf8',
      maxBuffer: 64 * 1024 * 1024,
    });
    if (res.error) throw res.error;
    if (res.status !== 0) throw new Error((res.stderr || res.stdout || `psql exit ${res.status}`).trim());
    // -A -t output: psql echoes the "SET" command tag first, then the rows. Take the last
    // non-empty line and its first |-field.
    const lines = String(res.stdout || '').split('\n').map((s) => s.trim()).filter(Boolean);
    const last = lines[lines.length - 1] || '';
    return last.split('|')[0];
  }, label);
}

async function checkDataset(def) {
  const t0 = Date.now();
  // EXPECTED: distinct edge-keys the current build SELECT would produce. Prelude (if any) runs
  // in the SAME psql session so the SELECT can see its temp tables.
  const pre = def.prelude ? `${def.prelude.trim()}\n` : '';
  const expected = Number(await psqlScalar(`expected:${def.dataset}`,
    `${pre}SELECT count(*) FROM (SELECT DISTINCT ${EDGE_KEY_COLS} FROM (${def.selectSql}) _q) _d;`));

  // ACTUAL: edges currently in gs_relationships for this dataset + type.
  const actual = Number(await psqlScalar(`actual:${def.dataset}`,
    `SELECT count(*) FROM gs_relationships WHERE dataset = '${def.dataset}' AND relationship_type = '${def.relationshipType}';`));

  // SOURCE rows: coverage denominator (the trend line).
  const sourceRows = Number(await psqlScalar(`source:${def.dataset}`,
    `SELECT count(*) FROM ${def.sourceTable};`));

  const driftPct = expected > 0 ? (expected - actual) / expected : null;       // >0 = under-built
  const coveragePct = sourceRows > 0 ? (actual / sourceRows) * 100 : null;
  let status;
  if (expected === 0) status = 'EMPTY';
  else if (driftPct > THRESHOLD) status = 'ALERT';                             // under-built (the bug)
  else if (-driftPct > THRESHOLD) status = 'STALE';                            // over-built (legacy/stale)
  else status = 'OK';

  return {
    dataset: def.dataset,
    relationship_type: def.relationshipType,
    expected_edges: expected,
    actual_edges: actual,
    source_rows: sourceRows,
    drift_pct: driftPct === null ? null : Number(driftPct.toFixed(5)),
    coverage_pct: coveragePct === null ? null : Number(coveragePct.toFixed(2)),
    status,
    threshold: THRESHOLD,
    duration_ms: Date.now() - t0,
  };
}

function printTable(results) {
  const pct = (n) => (n === null || n === undefined ? '   —  ' : `${(n * 100).toFixed(2)}%`.padStart(7));
  const num = (n) => Number(n).toLocaleString('en-US').padStart(11);
  log('');
  log(`Graph completeness  (threshold ±${(THRESHOLD * 100).toFixed(1)}%)`);
  log('─'.repeat(86));
  log(`${'dataset'.padEnd(20)}${'expected'.padStart(11)}${'actual'.padStart(11)}  ${'drift'.padStart(8)}  ${'coverage'.padStart(8)}  status`);
  log('─'.repeat(86));
  for (const r of results) {
    log(`${r.dataset.padEnd(20)}${num(r.expected_edges)}${num(r.actual_edges)}  ${pct(r.drift_pct)}  ${r.coverage_pct === null ? '   —  ' : (r.coverage_pct.toFixed(1) + '%').padStart(7)}  ${r.status}`);
  }
  log('─'.repeat(86));
}

async function main() {
  const supabase = SUPABASE_URL && SUPABASE_KEY
    ? createClient(SUPABASE_URL, SUPABASE_KEY, { auth: { persistSession: false } })
    : null;
  const run = supabase ? await logStart(supabase, AGENT_ID, AGENT_NAME) : { id: null };
  const runId = run?.id ?? null;

  const results = [];
  try {
    for (const def of GRAPH_EDGE_DATASETS) {
      const r = await checkDataset(def);
      results.push(r);
      log(`  ${def.dataset}: expected ${r.expected_edges.toLocaleString()} · actual ${r.actual_edges.toLocaleString()} · ${r.status}`);
    }
  } catch (err) {
    if (supabase && runId) await logFailed(supabase, runId, err);
    console.error('[graph-completeness] Fatal error:', err instanceof Error ? err.message : String(err));
    process.exit(2);
  }

  printTable(results);

  // Persist the trend rows (best-effort — never let a logging hiccup mask the gate verdict).
  if (supabase) {
    const { error } = await supabase.from('gs_graph_completeness_log').insert(
      results.map((r) => ({ ...r, run_id: runId })),
    );
    if (error) log(`WARN: could not write gs_graph_completeness_log: ${error.message}`);
  }

  const alerts = results.filter((r) => r.status === 'ALERT');
  const stale = results.filter((r) => r.status === 'STALE');

  if (supabase && runId) {
    await logComplete(supabase, runId, {
      items_found: results.reduce((s, r) => s + r.expected_edges, 0),
      items_new: results.reduce((s, r) => s + r.actual_edges, 0),
      status: alerts.length ? 'partial' : 'success',
      errors: alerts.map((r) => `${r.dataset} under-built: expected ${r.expected_edges}, actual ${r.actual_edges} (drift ${(r.drift_pct * 100).toFixed(1)}%)`),
    });
  }

  if (jsonOut) process.stdout.write(JSON.stringify({ threshold: THRESHOLD, results }, null, 2) + '\n');

  if (alerts.length) {
    log('');
    for (const r of alerts) {
      log(`✗ ALERT ${r.dataset}: ${(r.drift_pct * 100).toFixed(1)}% of expected edges are MISSING (expected ${r.expected_edges.toLocaleString()}, actual ${r.actual_edges.toLocaleString()}). Re-run build-entity-graph --phase=<…> and investigate.`);
    }
    process.exit(1);  // actionable: edges silently went missing
  }
  if (stale.length) {
    log('');
    for (const r of stale) {
      log(`• STALE ${r.dataset}: ${(-r.drift_pct * 100).toFixed(1)}% more edges than the current build produces (${(r.actual_edges - r.expected_edges).toLocaleString()} legacy/stale rows). A clean rebuild of this dataset would reconcile it.`);
    }
  }
  log('✓ No under-built datasets.');
  process.exit(0);
}

main().catch((err) => {
  console.error('[graph-completeness] Fatal error:', err);
  process.exit(2);
});
