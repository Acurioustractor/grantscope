#!/usr/bin/env node
/**
 * refresh-views-v2.mjs — MV refresh driven by the database registry.
 *
 * SOURCE OF TRUTH: mv_refresh_registry + mv_refresh_plan() in the database.
 * This script holds NO list of view names, NO concurrency list and NO heavy
 * list. It used to hold all three, which is how it drifted 16 views apart from
 * the pg_cron function that was supposed to run the same schedule.
 *
 *   - which views, and in what order  → mv_refresh_plan(tier)   (from pg_depend)
 *   - CONCURRENTLY or not             → mv_refresh_plan(tier)   (from pg_index)
 *   - per-view timeout                → measured p90 in mv_refresh_log
 *
 * To add a view to the schedule, INSERT it into mv_refresh_registry. Do not
 * edit this file. See migrations/2026-08-14-mv-refresh-registry.sql.
 *
 * Behaviour kept from the previous version:
 *   1. Sequential (no pooler contention from parallel REFRESH)
 *   2. Auto-fallback CONCURRENTLY → non-concurrent on unique-index error
 *   3. Real psql stderr captured and surfaced
 *   4. Logs every refresh to mv_refresh_log
 *   5. Per-MV status/duration/error, summary at end
 *
 * Usage:
 *   node --env-file=.env scripts/refresh-views-v2.mjs
 *   node --env-file=.env scripts/refresh-views-v2.mjs --tier weekly
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
const TIER = args.includes('--tier') ? args[args.indexOf('--tier') + 1] : 'nightly';
const SKIP_HEAVY = args.includes('--skip-heavy');
const DRY_RUN = args.includes('--dry-run');
const NO_LOG = args.includes('--no-log');

// A view is "heavy" if its measured p90 exceeds this. Derived, not hardcoded.
const HEAVY_THRESHOLD_S = 60;

function log(msg) { console.log(`[${new Date().toISOString().split('T')[1].slice(0, 8)}] ${msg}`); }

/**
 * The refresh plan, straight from the database. Order comes from pg_depend,
 * CONCURRENTLY eligibility from pg_index — neither is maintained here.
 * Returns [{ name, concurrent, depth }].
 */
async function loadPlan(tier) {
  try {
    const { stdout } = await runPsql(
      `SELECT seq, mv_name, depth, use_concurrent FROM mv_refresh_plan('${tier.replace(/'/g, "''")}') ORDER BY seq`,
      { timeout: 60, tuplesOnly: true },
    );
    // filter on '|': runPsql prefixes the statement with SET, whose "SET" acknowledgement lands
    // in stdout and would otherwise parse as a row named undefined at depth NaN.
    return stdout.split('\n').filter((l) => l.includes('|')).map((line) => {
      const [, name, depth, conc] = line.split('|').map((s) => s.trim());
      return { name, depth: Number(depth), concurrent: conc === 't' };
    });
  } catch (err) {
    // FALLBACK. mv_refresh_plan() ships in migrations/2026-08-14-mv-refresh-registry.sql, which is
    // an UNAPPLIED deliverable. Until it lands this script must still work — rewriting it to read a
    // registry that does not exist yet would have taken a working nightly tool offline in exchange
    // for a migration nobody had run.
    if (!/mv_refresh_plan.*does not exist/i.test(err.stderr || err.message || '')) throw err;
    log('mv_refresh_plan() not found — the registry migration is unapplied.');
    log('Falling back to catalogue order: every populated matview, dependency-ordered by pg_depend.');
    const { stdout } = await runPsql(
      `WITH RECURSIVE mvs AS (
         SELECT c.oid, c.relname::text AS mv_name,
                EXISTS (SELECT 1 FROM pg_index i
                         WHERE i.indrelid = c.oid AND i.indisunique
                           AND i.indpred IS NULL AND i.indexprs IS NULL) AS use_concurrent
           FROM pg_class c JOIN pg_namespace n ON n.oid = c.relnamespace
          WHERE n.nspname = 'public' AND c.relkind = 'm'),
       edges AS (
         SELECT DISTINCT d.refobjid AS parent, r.ev_class AS child
           FROM pg_depend d JOIN pg_rewrite r ON r.oid = d.objid
          WHERE d.classid = 'pg_rewrite'::regclass AND d.refclassid = 'pg_class'::regclass
            AND d.refobjid <> r.ev_class),
       depth AS (
         SELECT m.oid, 0 AS d FROM mvs m
          WHERE NOT EXISTS (SELECT 1 FROM edges e JOIN mvs p ON p.oid = e.parent WHERE e.child = m.oid)
         UNION ALL
         SELECT m.oid, depth.d + 1 FROM depth
           JOIN edges e ON e.parent = depth.oid JOIN mvs m ON m.oid = e.child
          WHERE depth.d < 10)
       SELECT row_number() OVER (ORDER BY max_d, mv_name) AS seq, mv_name, max_d, use_concurrent
         FROM (SELECT m.mv_name, m.use_concurrent, coalesce(max(depth.d), 0) AS max_d
                 FROM mvs m LEFT JOIN depth ON depth.oid = m.oid
                GROUP BY 1, 2) z
        ORDER BY max_d, mv_name`,
      { timeout: 120, tuplesOnly: true },
    );
    // filter on '|': runPsql prefixes the statement with SET, whose "SET" acknowledgement lands
    // in stdout and would otherwise parse as a row named undefined at depth NaN.
    return stdout.split('\n').filter((l) => l.includes('|')).map((line) => {
      const [, name, depth, conc] = line.split('|').map((s) => s.trim());
      return { name, depth: Number(depth), concurrent: conc === 't' };
    });
  }
}

/**
 * Per-view timeout from measured history rather than a hardcoded HEAVY list.
 * 4x the p90 (floor 300s, ceiling 1800s) — generous enough to absorb a slow
 * night, tight enough that a genuinely stuck refresh is cut loose.
 * Rows with duration_ms = 0 are excluded: every pg_cron row written before
 * 2026-08-14 has a bogus zero duration (now() is frozen inside a transaction).
 */
async function loadTimeouts() {
  const { stdout } = await runPsql(
    `SELECT mv_name, ceil(percentile_cont(0.9) WITHIN GROUP (ORDER BY duration_ms)/1000.0)::int
       FROM mv_refresh_log
      WHERE status LIKE 'success%' AND duration_ms > 0
        AND started_at > now() - interval '120 days'
      GROUP BY mv_name`,
    { timeout: 60, tuplesOnly: true },
  );
  const map = new Map();
  for (const line of stdout.split('\n').filter(Boolean)) {
    const [name, p90] = line.split('|').map((s) => s.trim());
    map.set(name, Number(p90));
  }
  return map;
}

/** Warn loudly about matviews nobody registered — the drift this design exists to prevent. */
async function warnDrift() {
  try {
    const { stdout } = await runPsql(
      `SELECT mv_name, drift FROM v_mv_refresh_drift WHERE drift <> 'ok'`,
      { timeout: 30, tuplesOnly: true },
    );
    // filter on '|' for the same reason loadPlan does: runPsql prefixes the statement with SET,
    // and psql's "SET" acknowledgement lands in stdout, where it read as a drift row.
    const rows = stdout.split('\n').filter((l) => l.includes('|'));
    if (rows.length) {
      log(`⚠ ${rows.length} registry drift row(s) — matviews with no schedule, or registry rows for dropped matviews:`);
      for (const r of rows.slice(0, 20)) log(`    ${r.replace(/\|/g, '  ')}`);
      log('  Fix by INSERTing into mv_refresh_registry (see migrations/2026-08-14-mv-refresh-registry.sql).');
    }
  } catch (e) {
    log(`  drift check skipped: ${e.message}`);
  }
}

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

function runPsql(sql, { timeout = 600, tuplesOnly = false } = {}) {
  return new Promise((resolve, reject) => {
    const fullSql = `SET statement_timeout = '${timeout}s'; ${sql}`;
    const env = { ...process.env, PGPASSWORD: process.env.DATABASE_PASSWORD };
    const proc = spawn('psql', [
      '-h', HOST, '-p', String(PORT), '-U', USER, '-d', DB,
      '-v', 'ON_ERROR_STOP=1',
      ...(tuplesOnly ? ['-At', '-F', '|'] : []),
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

async function refreshOne(item, timeouts) {
  const { name, concurrent } = item;
  const p90 = timeouts.get(name);
  const isHeavy = (p90 ?? 0) >= HEAVY_THRESHOLD_S;
  // 4x p90, clamped. Unmeasured views get the 300s floor.
  const timeout = Math.min(1800, Math.max(300, Math.ceil((p90 ?? 0) * 4)));

  if (DRY_RUN) {
    log(`[DRY] would refresh ${name} (depth ${item.depth}, ${concurrent ? 'CONCURRENTLY' : 'non-concurrent'}, ${timeout}s${p90 ? `, p90 ${p90}s` : ', never measured'})`);
    return { name, status: 'dry-run' };
  }
  if (SKIP_HEAVY && isHeavy) {
    log(`[SKIP] ${name} (p90 ${p90}s >= ${HEAVY_THRESHOLD_S}s + --skip-heavy)`);
    return { name, status: 'skipped' };
  }

  const started = Date.now();
  const wantsConcurrent = concurrent;

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

  await ensureLogTable();

  let targetList;
  if (SINGLE_VIEW) {
    // Single-view mode still asks the DB whether CONCURRENTLY is legal.
    const plan = await loadPlan(TIER);
    targetList = plan.filter((p) => p.name === SINGLE_VIEW);
    if (!targetList.length) {
      const { stdout } = await runPsql(
        `SELECT EXISTS (SELECT 1 FROM pg_index i JOIN pg_class c ON c.oid = i.indrelid
                        WHERE c.relname = '${SINGLE_VIEW.replace(/'/g, "''")}' AND i.indisunique)`,
        { timeout: 30, tuplesOnly: true },
      );
      targetList = [{ name: SINGLE_VIEW, depth: 0, concurrent: stdout.trim() === 't' }];
      log(`note: ${SINGLE_VIEW} is not in the '${TIER}' plan — refreshing it anyway`);
    }
  } else {
    targetList = await loadPlan(TIER);
    if (!targetList.length) {
      console.error(`No views in tier '${TIER}'. Check mv_refresh_registry.`);
      process.exit(1);
    }
  }

  const timeouts = await loadTimeouts();
  const maxDepth = Math.max(...targetList.map((t) => t.depth));
  log(`refresh-views-v2: tier=${TIER}, ${targetList.length} views, dependency depth 0..${maxDepth}, sequential`);
  if (!SINGLE_VIEW) await warnDrift();

  const results = [];
  const t0 = Date.now();
  for (const item of targetList) {
    const r = await refreshOne(item, timeouts);
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
