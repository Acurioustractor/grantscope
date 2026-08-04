#!/usr/bin/env node
/**
 * db-saturation-snapshot — catch shared-box (tednluwflfhxyucgwigh) saturation blips red-handed.
 *
 * WHY: the reachability monitor reports gsql UNREACHABLE during pool-saturation blips but can't
 * say WHAT is bursting — the box recovers before a query can land. gsql's SELECTs go over the
 * PostgREST pool (user 'authenticator', REST/443); psql goes over the SEPARATE Supavisor pooler
 * (5432). When PostgREST saturates, its 'authenticator' backends are busy running the bursting
 * queries — and a psql snapshot (different pool) can still see them.
 *
 * WHAT: polls the PostgREST path every POLL_MS. On the reachable->unreachable transition (and on
 * each subsequent poll while down, capped) it snapshots pg_stat_activity via psql and appends to
 * scripts/logs/db-saturation-snapshots.log. Emits one stdout line per capture (→ pm2 logs).
 * If psql ALSO fails, it logs "BOTH POOLS DOWN" — itself a useful signal (pooler-wide saturation).
 *
 * Run: pm2 start scripts/db-saturation-snapshot.mjs --name db-saturation-snapshot --cwd <repo>
 * Read captures: tail -n 60 scripts/logs/db-saturation-snapshots.log
 */
import 'dotenv/config';
import { createClient } from '@supabase/supabase-js';
import { execSync } from 'child_process';
import { appendFileSync, mkdirSync } from 'fs';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const __dirname = dirname(fileURLToPath(import.meta.url));
const REPO = join(__dirname, '..');
const LOG_DIR = join(REPO, 'scripts', 'logs');
const LOG = join(LOG_DIR, 'db-saturation-snapshots.log');
const SQL = join(REPO, 'scripts', 'sql', 'db-saturation-snapshot.sql');
mkdirSync(LOG_DIR, { recursive: true });

const POLL_MS = 10_000;
const PROBE_TIMEOUT_MS = 8_000;
const MAX_CAPTURES_PER_BLIP = 6; // capture the blip's evolution without runaway logging

const supabase = createClient(
  process.env.SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY,
);

const PSQL = `psql -h aws-0-ap-southeast-2.pooler.supabase.com -p 5432 -U "postgres.tednluwflfhxyucgwigh" -d postgres -X -q -f "${SQL}"`;

const ts = () => new Date().toISOString();
const log = (line) => appendFileSync(LOG, line + '\n');

/** Probe the PostgREST pool exactly the way gsql does (exec_sql RPC). Reachable = answered in time. */
async function probePostgrest() {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), PROBE_TIMEOUT_MS);
  try {
    const { error } = await supabase
      .rpc('exec_sql', { query: 'SELECT 1 AS ok' })
      .abortSignal(controller.signal);
    return !error;
  } catch {
    return false; // timeout / abort / network = unreachable
  } finally {
    clearTimeout(timer);
  }
}

/** Snapshot pg_stat_activity via the separate Supavisor pool. Returns true if captured. */
function snapshotViaPsql(label, blipNum, captureNum) {
  const header = `\n===== SNAPSHOT ${ts()} | blip #${blipNum} | ${label} (capture ${captureNum}) =====`;
  try {
    const out = execSync(PSQL, {
      env: { ...process.env, PGPASSWORD: process.env.DATABASE_PASSWORD, PGCONNECT_TIMEOUT: '6' },
      encoding: 'utf8',
      timeout: 12_000,
    });
    log(header + '\n' + out.trim());
    console.log(`[${ts()}] BLIP capture #${captureNum} (blip #${blipNum}, ${label}) — psql snapshot OK → appended to log`);
    return true;
  } catch (e) {
    const msg = String(e.stderr || e.message || '').trim().split('\n').slice(-2).join(' | ');
    log(header + `\n!! psql snapshot FAILED — Supavisor pooler also unreachable (BOTH POOLS DOWN): ${msg}`);
    console.log(`[${ts()}] BLIP capture #${captureNum} (blip #${blipNum}) — BOTH POOLS DOWN (psql also failed: ${msg})`);
    return false;
  }
}

let wasReachable = true;
let blipNum = 0;
let capturesThisBlip = 0;
let blipStart = null;

async function tick() {
  const reachable = await probePostgrest();
  if (!reachable) {
    const onset = wasReachable;
    if (onset) {
      blipNum++;
      capturesThisBlip = 0;
      blipStart = Date.now();
      log(`\n----- BLIP #${blipNum} ONSET ${ts()} (PostgREST/gsql unreachable) -----`);
      console.log(`[${ts()}] ⚠ BLIP #${blipNum} ONSET — PostgREST unreachable, capturing via psql...`);
    }
    if (capturesThisBlip < MAX_CAPTURES_PER_BLIP) {
      capturesThisBlip++;
      snapshotViaPsql(onset ? 'ONSET' : 'while-down', blipNum, capturesThisBlip);
    }
    wasReachable = false;
  } else {
    if (!wasReachable) {
      const durS = blipStart ? Math.round((Date.now() - blipStart) / 1000) : 0;
      log(`----- BLIP #${blipNum} RECOVERED ${ts()} (after ~${durS}s, ${capturesThisBlip} capture(s)) -----`);
      console.log(`[${ts()}] ✓ BLIP #${blipNum} RECOVERED after ~${durS}s (${capturesThisBlip} capture(s))`);
    }
    wasReachable = true;
  }
}

console.log(`[${ts()}] db-saturation-snapshot started — probing PostgREST every ${POLL_MS / 1000}s; snapshots → ${LOG}`);
log(`\n##### watcher started ${ts()} (poll ${POLL_MS / 1000}s, probe-timeout ${PROBE_TIMEOUT_MS / 1000}s) #####`);

// eslint-disable-next-line no-constant-condition
while (true) {
  try {
    await tick();
  } catch (e) {
    console.error(`[${ts()}] tick error (continuing): ${e.message}`);
  }
  await new Promise((r) => setTimeout(r, POLL_MS));
}
