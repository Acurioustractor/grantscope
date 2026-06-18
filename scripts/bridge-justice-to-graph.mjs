#!/usr/bin/env node

/**
 * Bridge justice_funding → gs_relationships (grant edges: program → recipient).
 *
 * Set-based via direct psql, in two additive + idempotent steps:
 *   1. Ensure a `program` entity exists for every (program_name, state) — JUSTICE_PROGRAM_ENSURE_SQL.
 *   2. Insert program→recipient `grant` edges, guarded so only payments with NO existing justice
 *      edge are written (JUSTICE_BUILD_GUARD) → re-runs add zero duplicates.
 *
 * The edge SELECT, prog_map prelude and the two write helpers live in
 * scripts/lib/graph-edge-datasets.mjs — the single source of truth shared with build-entity-graph
 * (which inserts) and check-graph-completeness (which counts). This agent is therefore equivalent to
 * `build-entity-graph.mjs --phase=justice`, kept standalone so the data-pipeline can run it alone.
 *
 * History: the old REST `.upsert({onConflict:'…,source_record_id'})` path could not match the only
 * dedup index (idx_gs_rel_dedup, on the COALESCE(source_record_id,'') EXPRESSION), so it errored on
 * every batch (0 written). Set-based psql with `ON CONFLICT (<the expression>) DO NOTHING` is the fix.
 *
 * Usage:
 *   node --env-file=.env scripts/bridge-justice-to-graph.mjs [--dry-run]
 */

import { spawnSync } from 'node:child_process';
import { resolveBin, withRetry } from './lib/agent-resilience.mjs';
import { edgeDataset, JUSTICE_PROGRAM_ENSURE_SQL, JUSTICE_BUILD_GUARD } from './lib/graph-edge-datasets.mjs';
import 'dotenv/config';

const DRY_RUN = process.argv.includes('--dry-run');

const PG_PASSWORD = process.env.DATABASE_PASSWORD;
const PSQL_BIN = resolveBin('psql');
const PSQL_CONN = [
  '-h', process.env.PGHOST || 'aws-0-ap-southeast-2.pooler.supabase.com',
  '-p', process.env.PGPORT || '5432',
  '-U', process.env.PGUSER || 'postgres.tednluwflfhxyucgwigh',
  '-d', process.env.PGDATABASE || 'postgres',
  '-X', '-A', '-t', '-v', 'ON_ERROR_STOP=1',
];

// Mirrors build-entity-graph's DEDUP_TARGET (the idx_gs_rel_dedup expression).
const DEDUP_TARGET =
  "(source_entity_id, target_entity_id, relationship_type, dataset, COALESCE(source_record_id, ''::text))";

function log(msg) {
  console.log(`[${new Date().toISOString()}] ${msg}`);
}

/** Run one DML/SELECT via psql, retrying transient pooler failures. Returns stdout. */
async function runDml(label, sql) {
  if (!PG_PASSWORD) throw new Error('DATABASE_PASSWORD not set — the justice bridge requires direct psql');
  const stdout = await withRetry(() => {
    const res = spawnSync(PSQL_BIN, [...PSQL_CONN, '-c', `SET statement_timeout=0;\n${sql}`], {
      env: { ...process.env, PGPASSWORD: PG_PASSWORD },
      encoding: 'utf8',
      maxBuffer: 64 * 1024 * 1024,
    });
    if (res.error) throw res.error;
    if (res.status !== 0) throw new Error((res.stderr || res.stdout || `psql exit ${res.status}`).trim());
    return res.stdout || '';
  }, label);
  return String(stdout);
}

/** Parse the inserted-row count from psql's "INSERT 0 N" command tag. */
function insertedCount(out) {
  const m = String(out).match(/INSERT\s+\d+\s+(\d+)/);
  return m ? m[1] : '0';
}

async function main() {
  const d = edgeDataset('justice_funding');
  log(`=== Justice Funding → Graph Bridge (${DRY_RUN ? 'DRY RUN' : 'LIVE'}) ===`);

  if (DRY_RUN) {
    // Count what the guarded write would insert against CURRENT program entities. (Program
    // creation is skipped in dry-run, so brand-new programs' rows are not yet counted.)
    const out = await runDml('justice dry-run',
      `${d.prelude}\nSELECT count(*) FROM (${d.selectSql}${JUSTICE_BUILD_GUARD}) _q;`);
    const n = out.trim().split('\n').pop() || '?';
    log(`Would insert ~${n} grant edges (excludes payments whose program entity is not yet created)`);
    log('=== DRY RUN COMPLETE ===');
    return;
  }

  log('Step 1/2: ensuring program entities (additive)...');
  const pe = await runDml('justice program entities', JUSTICE_PROGRAM_ENSURE_SQL);
  log(`  Program entities created: ${insertedCount(pe)} (existing reused)`);

  log('Step 2/2: inserting program→recipient grant edges (additive, guarded)...');
  const ins = await runDml('justice edges',
    `${d.prelude}\nINSERT INTO gs_relationships ${d.cols}\n${d.selectSql}${JUSTICE_BUILD_GUARD}\nON CONFLICT ${DEDUP_TARGET} DO NOTHING;`);
  log(`  Grant edges inserted: ${insertedCount(ins)} (existing skipped via ON CONFLICT)`);

  log('=== COMPLETE ===');
}

main().catch((err) => {
  console.error('Fatal:', err);
  process.exit(1);
});
