#!/usr/bin/env node
/**
 * refresh-views-v2.mjs — Better MV refresh with auto-fallback, real errors,
 *                       and observability logging.
 *
 * Improvements over refresh-views.mjs:
 *   1. Sequential by default (no pooler contention from parallel REFRESH)
 *   2. Auto-fallback CONCURRENTLY → non-concurrent on unique-index error
 *   3. Real psql stderr captured and surfaced (no more "psql error" black-box)
 *   4. Logs every refresh to mv_refresh_log table for trend analysis
 *   5. Per-MV stats: status, duration, error message
 *   6. Summary at end with success/failure count
 *
 * Usage:
 *   node --env-file=.env scripts/refresh-views-v2.mjs
 *   node --env-file=.env scripts/refresh-views-v2.mjs --view mv_name
 *   node --env-file=.env scripts/refresh-views-v2.mjs --skip-heavy
 *   node --env-file=.env scripts/refresh-views-v2.mjs --dry-run
 */
import { spawn } from 'child_process';

const HOST = 'aws-0-ap-southeast-2.pooler.supabase.com';
const PORT = 5432;
const USER = 'postgres.tednluwflfhxyucgwigh';
const DB = 'postgres';

const args = process.argv.slice(2);
const SINGLE_VIEW = args.includes('--view') ? args[args.indexOf('--view') + 1] : null;
const SKIP_HEAVY = args.includes('--skip-heavy');
const DRY_RUN = args.includes('--dry-run');
const NO_LOG = args.includes('--no-log');

// View ordering by dependency. CONCURRENTLY-friendly views first, ones we know
// need non-concurrent listed in NEEDS_NON_CONCURRENT below.
const VIEW_LIST = [
  // Tier 1: foundational, no dependencies
  'mv_acnc_latest',
  'mv_acnc_ais_yearly',
  'v_grant_stats',
  'v_grant_focus_areas',
  'v_grant_provider_summary',
  'mv_abr_name_lookup',
  // Tier 2: cross-system aggregates
  'mv_gs_entity_stats',
  'mv_gs_donor_contractors',
  'mv_donor_contract_crossref',
  'mv_org_justice_signals',
  'mv_funding_by_postcode',
  'mv_funding_by_lga',
  'mv_funding_by_disadvantage',
  'mv_indigenous_funding_by_disadvantage',
  'v_austender_stats',
  'v_austender_entity_summary',
  'v_austender_top_oric',
  // Tier 3: depend on Tier 2
  'mv_entity_power_index',
  'mv_funding_deserts',
  'mv_revolving_door',
  'mv_board_interlocks',
  'mv_person_influence',
  'mv_person_cross_system',
  'mv_person_network',
  'mv_foundation_grantees',
  'mv_donation_contract_timing',
  'mv_charity_network',
  // Tier 4: heavy or rarely-needed
  'mv_disability_landscape',
  'mv_charity_rankings',
  'mv_foundation_scores',
  'mv_foundation_trends',
  'mv_indigenous_procurement_score',
  'mv_grant_contract_overlap',
  'mv_lga_indigenous_proxy_score',
];

// MVs known to lack unique indexes — pre-emptively use non-concurrent.
// 2026-04-27: mv_donor_contract_crossref + mv_revolving_door now have unique
// indexes (see scripts/sql/add-mv-unique-indexes.sql) — they can use CONCURRENTLY.
// mv_funding_by_lga + mv_funding_deserts have duplicate-key data quality issues
// in the MV definition; until those are deduped, they stay non-concurrent.
const NEEDS_NON_CONCURRENT = new Set([
  'mv_funding_by_lga',
  'mv_funding_deserts',
  'mv_foundation_grantees',
  'mv_donation_contract_timing',
]);

// MVs that need extra timeout (heavy joins, 1M+ row aggregations)
const HEAVY = new Set([
  'mv_gs_donor_contractors',
  'mv_donor_contract_crossref',
  'mv_entity_power_index',
  'mv_person_influence',
  'mv_person_cross_system',
  'mv_person_network',
  'mv_charity_network',
  'mv_abr_name_lookup',
  'mv_board_interlocks',
]);

function log(msg) { console.log(`[${new Date().toISOString().split('T')[1].slice(0, 8)}] ${msg}`); }

async function ensureLogTable() {
  if (NO_LOG) return;
  const sql = `CREATE TABLE IF NOT EXISTS mv_refresh_log (
    id BIGSERIAL PRIMARY KEY,
    mv_name TEXT NOT NULL,
    started_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    finished_at TIMESTAMPTZ,
    duration_ms INTEGER,
    status TEXT NOT NULL,
    used_concurrent BOOLEAN,
    error_message TEXT,
    triggered_by TEXT DEFAULT 'refresh-views-v2'
  );
  CREATE INDEX IF NOT EXISTS mv_refresh_log_started ON mv_refresh_log (mv_name, started_at DESC);`;
  await runPsql(sql, { timeout: 30 });
}

async function logRefresh({ name, started, finished, status, concurrent, error }) {
  if (NO_LOG) return;
  const escaped = (s) => (s || '').replace(/'/g, "''").slice(0, 1000);
  const duration = finished - started;
  const sql = `INSERT INTO mv_refresh_log (mv_name, started_at, finished_at, duration_ms, status, used_concurrent, error_message)
    VALUES ('${name}', to_timestamp(${Math.floor(started / 1000)}), to_timestamp(${Math.floor(finished / 1000)}),
            ${duration}, '${status}', ${concurrent}, ${error ? `'${escaped(error)}'` : 'NULL'})`;
  try {
    await runPsql(sql, { timeout: 10 });
  } catch (e) {
    log(`  log-write failed (non-fatal): ${e.message}`);
  }
}

function runPsql(sql, { timeout = 600 } = {}) {
  return new Promise((resolve, reject) => {
    const fullSql = `SET statement_timeout = '${timeout}s'; ${sql}`;
    const env = { ...process.env, PGPASSWORD: process.env.DATABASE_PASSWORD };
    const proc = spawn('psql', [
      '-h', HOST, '-p', String(PORT), '-U', USER, '-d', DB,
      '-v', 'ON_ERROR_STOP=1',
      '-c', fullSql,
    ], { env, timeout: (timeout + 30) * 1000 });

    let stdout = '';
    let stderr = '';
    proc.stdout.on('data', (d) => { stdout += d.toString(); });
    proc.stderr.on('data', (d) => { stderr += d.toString(); });

    proc.on('close', (code) => {
      if (code === 0) {
        resolve({ stdout: stdout.trim(), stderr: stderr.trim() });
      } else {
        const err = new Error(extractPsqlError(stderr) || `psql exit ${code}`);
        err.stdout = stdout;
        err.stderr = stderr;
        err.code = code;
        reject(err);
      }
    });

    proc.on('error', (e) => reject(e));
  });
}

function extractPsqlError(stderr) {
  if (!stderr) return null;
  const errLine = stderr.split('\n').find(l => l.startsWith('ERROR:') || l.startsWith('FATAL:'));
  if (errLine) return errLine.replace(/^(ERROR|FATAL):\s*/, '').slice(0, 200);
  return stderr.split('\n').filter(l => l.trim()).slice(-1)[0]?.slice(0, 200) || null;
}

async function refreshOne(name) {
  if (DRY_RUN) {
    log(`[DRY] would refresh ${name}`);
    return { name, status: 'dry-run' };
  }
  if (SKIP_HEAVY && HEAVY.has(name)) {
    log(`[SKIP] ${name} (heavy + --skip-heavy)`);
    return { name, status: 'skipped' };
  }

  const timeout = HEAVY.has(name) ? 1200 : 300; // 20 min for heavy, 5 min for light
  const started = Date.now();
  const wantsConcurrent = !NEEDS_NON_CONCURRENT.has(name);

  // First attempt
  if (wantsConcurrent) {
    try {
      log(`▶ ${name} (CONCURRENTLY, ${timeout}s timeout)`);
      const { stderr } = await runPsql(`REFRESH MATERIALIZED VIEW CONCURRENTLY ${name}`, { timeout });
      const finished = Date.now();
      const dur = ((finished - started) / 1000).toFixed(1);
      log(`  ✓ ${name} CONCURRENTLY (${dur}s)`);
      await logRefresh({ name, started, finished, status: 'success', concurrent: true });
      if (stderr) log(`  stderr: ${stderr.slice(0, 200)}`);
      return { name, status: 'success', concurrent: true, duration_s: parseFloat(dur) };
    } catch (e) {
      const isUniqueIndexError = (e.stderr || '').includes('cannot refresh') || e.message.includes('cannot refresh');
      if (!isUniqueIndexError) {
        const finished = Date.now();
        const dur = ((finished - started) / 1000).toFixed(1);
        log(`  ✗ ${name} CONCURRENTLY failed (${dur}s): ${e.message}`);
        await logRefresh({ name, started, finished, status: 'failed', concurrent: true, error: e.message });
        return { name, status: 'failed', concurrent: true, error: e.message };
      }
      log(`  ! ${name} no unique index — falling back to non-concurrent`);
    }
  }

  // Non-concurrent path
  const ncStart = Date.now();
  try {
    log(`▶ ${name} (non-concurrent, ${timeout}s timeout)`);
    const { stderr } = await runPsql(`REFRESH MATERIALIZED VIEW ${name}`, { timeout });
    const finished = Date.now();
    const dur = ((finished - ncStart) / 1000).toFixed(1);
    log(`  ✓ ${name} non-concurrent (${dur}s)`);
    await logRefresh({ name, started: ncStart, finished, status: 'success', concurrent: false });
    if (stderr) log(`  stderr: ${stderr.slice(0, 200)}`);
    return { name, status: 'success', concurrent: false, duration_s: parseFloat(dur) };
  } catch (e) {
    const finished = Date.now();
    const dur = ((finished - ncStart) / 1000).toFixed(1);
    log(`  ✗ ${name} non-concurrent failed (${dur}s): ${e.message}`);
    await logRefresh({ name, started: ncStart, finished, status: 'failed', concurrent: false, error: e.message });
    return { name, status: 'failed', concurrent: false, error: e.message };
  }
}

async function main() {
  if (!process.env.DATABASE_PASSWORD) {
    console.error('Missing DATABASE_PASSWORD in .env');
    process.exit(1);
  }

  const targetList = SINGLE_VIEW ? [SINGLE_VIEW] : VIEW_LIST;
  log(`refresh-views-v2: ${targetList.length} views, sequential mode`);

  await ensureLogTable();

  const results = [];
  const t0 = Date.now();
  for (const name of targetList) {
    const r = await refreshOne(name);
    results.push(r);
  }
  const totalMin = ((Date.now() - t0) / 60000).toFixed(1);

  // Summary
  const ok = results.filter(r => r.status === 'success');
  const failed = results.filter(r => r.status === 'failed');
  const skipped = results.filter(r => r.status === 'skipped' || r.status === 'dry-run');

  log('');
  log(`SUMMARY: ${ok.length}/${targetList.length} succeeded · ${failed.length} failed · ${skipped.length} skipped · ${totalMin} min`);

  if (failed.length) {
    log('');
    log('Failed views:');
    for (const r of failed) log(`  ${r.name} — ${r.error?.slice(0, 100)}`);
  }
}

main().catch((e) => { console.error(e); process.exit(1); });
