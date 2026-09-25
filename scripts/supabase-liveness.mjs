#!/usr/bin/env node
/**
 * Is each object in the shared Supabase project alive? Rules only, read-only, no model.
 *
 * The /ops/schema register (schema_ownership) says whose each object is and who should read it.
 * This says whether anything actually does. Evidence, strongest first:
 *   1. Postgres' own counters (pg_stat_user_tables): every scan and write by ANY app or repo since
 *      the server last started (the window is printed; counters were never reset).
 *   2. Other database objects that need it: views and matviews built on it (pg_depend), functions
 *      whose body names it, pg_cron jobs that name it, the matview refresh registry.
 *   3. Code that names it: grantscope's table-readers.generated.json plus a .from('x') sweep of the
 *      sibling repos under ~/Code.
 *
 * "Really read" is not "scanned". Nightly backups, the /ops/schema page and census jobs scan every
 * table in full: measured 2026-09-26, never-written tables cluster at 80-150 sequential scans with no
 * index scan over 44 days. So a table counts as read only if something used an index on it (backups
 * never do) or it had more sequential scans than that background (BACKGROUND_SEQ_SCANS). An upsert
 * or a foreign-key check also does an index lookup, so "read" can mean "a live table points at it".
 *
 *   node --env-file=.env scripts/supabase-liveness.mjs [--out thoughts/shared/data-map/liveness-YYYY-MM-DD.json]
 */
import { createClient } from '@supabase/supabase-js';
import { readFileSync, writeFileSync, mkdirSync, existsSync } from 'node:fs';
import { execSync } from 'node:child_process';
import { dirname } from 'node:path';

let client = null;
const db = () => (client ??= createClient(process.env.NEXT_PUBLIC_SUPABASE_URL || process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY));

async function sql(query) {
  const { data, error } = await db().rpc('exec_sql', { query });
  if (error) throw new Error(`${error.message}\n${query.slice(0, 200)}`);
  return data ?? [];
}

/** exec_sql returns at most 1,000 rows; page with a stable ORDER BY in the query. */
async function sqlAll(query) {
  const out = [];
  for (let off = 0; ; off += 1000) {
    const page = await sql(`${query} LIMIT 1000 OFFSET ${off}`);
    out.push(...page);
    if (page.length < 1000) return out;
  }
}

// Names that usually mean "a copy someone meant to delete". A flag for review, never a verdict.
// Above the backup/census background measured on 2026-09-26 (80-150 full scans in 44 days).
export const BACKGROUND_SEQ_SCANS = 200;

export function reallyRead(seqScans, idxScans) {
  return idxScans > 0 || seqScans > BACKGROUND_SEQ_SCANS;
}

export const SUSPECT_COPY = /(_old|_bak|_backup|_copy|_tmp|_temp|_legacy|_archive|_archived|_test|_dedupe|_staging|_v\d+|_\d{6,8})$/i;

/**
 * One verdict per object. Order matters: the first rule that fits wins.
 * facts: { kind, rows, reads, writes, dependents, functions, crons, codeRefs, refreshed, registered }
 */
export function verdict(f) {
  const used = f.dependents + f.functions + f.crons + f.codeRefs + (f.refreshed ? 1 : 0);
  if (f.kind === 'view') {
    return used > 0 ? 'live (referenced)' : 'unreferenced view';
  }
  if (f.rows === 0) return f.read || used > 0 ? 'empty but wired' : 'empty and unused';
  if (!f.read && f.writes === 0) return used > 0 ? 'dormant but referenced' : 'dormant';
  if (!f.read) return 'written, never read';
  if (f.writes === 0) return 'read-only (reference or frozen)';
  return 'live';
}

function codeRefsOutsideGrantscope() {
  // One ripgrep pass over sibling repos: every .from('name') / .from("name").
  const roots = ['JusticeHub', 'empathy-ledger-v2', 'act-global-infrastructure', 'Goods Asset Register/v2', 'el-dam']
    .map((r) => `/Users/benknight/Code/${r}`).filter(existsSync);
  const counts = new Map();
  for (const root of roots) {
    let out = '';
    try {
      out = execSync(`rg -o --no-filename -g '!node_modules' -g '!.next' -g '!_archive' "\\.from\\(['\\"][a-z_0-9]+['\\"]\\)" "${root}"`,
        { encoding: 'utf8', maxBuffer: 256 * 1024 * 1024, stdio: ['ignore', 'pipe', 'ignore'] });
    } catch (e) { out = e.stdout ?? ''; }
    for (const m of out.matchAll(/from\(['"]([a-z_0-9]+)['"]\)/g)) counts.set(m[1], (counts.get(m[1]) ?? 0) + 1);
  }
  return { counts, roots };
}

async function main() {
  const outArg = process.argv.find((a) => a.startsWith('--out='));
  const [{ since }] = await sql(`SELECT pg_postmaster_start_time()::text AS since`);

  // n_live_tup is unreliable on this project and reltuples is -1 until a table is analysed, so rows
  // come from reltuples where it is known and from an exact count(*) otherwise (small, unanalysed tables).
  const objects = await sqlAll(`
    SELECT c.relname AS name, CASE c.relkind WHEN 'v' THEN 'view' WHEN 'm' THEN 'matview' ELSE 'table' END AS kind,
           greatest(c.reltuples, 0)::bigint AS est_rows, pg_total_relation_size(c.oid) AS bytes,
           coalesce(s.seq_scan, 0) AS seq_scans, coalesce(s.idx_scan, 0) AS idx_scans,
           coalesce(s.n_tup_ins, 0) + coalesce(s.n_tup_upd, 0) + coalesce(s.n_tup_del, 0) AS writes,
           s.n_live_tup AS live_tup,
           o.owner, (o.object IS NOT NULL) AS registered
    FROM pg_class c JOIN pg_namespace n ON n.oid = c.relnamespace AND n.nspname = 'public'
    LEFT JOIN pg_stat_user_tables s ON s.relid = c.oid
    LEFT JOIN schema_ownership o ON o.object = c.relname
    WHERE c.relkind IN ('r','p','v','m') ORDER BY c.relname`);
  const unknown = objects.filter((o) => o.kind !== 'view' && Number(o.est_rows) <= 0 && Number(o.bytes) < 200 * 1024 * 1024).map((o) => o.name);
  const exact = new Map();
  for (let i = 0; i < unknown.length; i += 40) {
    const q = unknown.slice(i, i + 40).map((n) => `SELECT '${n}' AS name, (SELECT count(*) FROM public."${n}") AS n`).join(' UNION ALL ');
    for (const r of await sql(q)) exact.set(r.name, Number(r.n));
  }

  const deps = await sqlAll(`
    SELECT DISTINCT src.relname AS source, dep.relname AS dependent
    FROM pg_depend d JOIN pg_rewrite rw ON rw.oid = d.objid
    JOIN pg_class dep ON dep.oid = rw.ev_class JOIN pg_class src ON src.oid = d.refobjid
    JOIN pg_namespace ns ON ns.oid = src.relnamespace AND ns.nspname = 'public'
    WHERE src.oid <> dep.oid ORDER BY 1, 2`);
  const fns = await sqlAll(`SELECT p.proname, lower(p.prosrc) AS src FROM pg_proc p JOIN pg_namespace n ON n.oid = p.pronamespace AND n.nspname = 'public' ORDER BY p.oid`);
  let crons = [];
  try { crons = await sql(`SELECT jobname, lower(command) AS command FROM cron.job`); } catch { /* no cron access */ }
  const refreshed = new Set((await sql(`SELECT mv_name FROM mv_refresh_registry WHERE enabled`)).map((r) => r.mv_name));

  const readers = JSON.parse(readFileSync(new URL('../apps/web/src/lib/table-readers.generated.json', import.meta.url), 'utf8'));
  const gsReaders = (name) => (Array.isArray(readers[name]) ? readers[name].length : readers[name] ? 1 : 0);
  const { counts: siblingRefs, roots } = codeRefsOutsideGrantscope();

  const depCount = new Map();
  for (const d of deps) depCount.set(d.source, (depCount.get(d.source) ?? 0) + 1);
  const word = (name) => new RegExp(`\\b${name}\\b`);

  const rows = objects.map((o) => {
    const re = word(o.name);
    const rowsN = o.kind === 'view' ? null : exact.has(o.name) ? exact.get(o.name) : Number(o.est_rows);
    const f = {
      kind: o.kind, rows: rowsN, seqScans: Number(o.seq_scans), idxScans: Number(o.idx_scans),
      read: reallyRead(Number(o.seq_scans), Number(o.idx_scans)), writes: Number(o.writes),
      dependents: depCount.get(o.name) ?? 0,
      functions: fns.filter((p) => re.test(p.src)).length,
      crons: crons.filter((j) => re.test(j.command)).length,
      codeRefs: gsReaders(o.name) + (siblingRefs.get(o.name) ?? 0),
      refreshed: refreshed.has(o.name),
      registered: Boolean(o.registered),
    };
    return { name: o.name, owner: o.owner ?? null, bytes: Number(o.bytes), ...f, suspectCopy: SUSPECT_COPY.test(o.name), verdict: verdict(f) };
  });

  const tally = {};
  for (const r of rows) tally[r.verdict] = (tally[r.verdict] ?? 0) + 1;
  const out = {
    ran_at: new Date().toISOString(), counters_since: since, code_roots: roots, total: rows.length,
    unregistered: rows.filter((r) => !r.registered).length, suspect_copies: rows.filter((r) => r.suspectCopy).length,
    tally, objects: rows.sort((a, b) => a.verdict.localeCompare(b.verdict) || b.bytes - a.bytes),
  };
  const dest = outArg ? outArg.split('=')[1] : `thoughts/shared/data-map/liveness-${out.ran_at.slice(0, 10)}.json`;
  mkdirSync(dirname(dest), { recursive: true });
  writeFileSync(dest, JSON.stringify(out, null, 2));
  console.log(`counters since ${since}; ${rows.length} objects, ${out.unregistered} not in schema_ownership, ${out.suspect_copies} suspect-copy names`);
  for (const [k, v] of Object.entries(tally).sort((a, b) => b[1] - a[1])) console.log(`  ${String(v).padStart(4)}  ${k}`);
  console.log(`written to ${dest}`);
}

if (import.meta.url === `file://${process.argv[1]}`) main().catch((e) => { console.error(e.message); process.exit(1); });
