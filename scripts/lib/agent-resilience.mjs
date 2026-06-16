/**
 * agent-resilience.mjs — shared resilience helpers for pipeline agents.
 *
 * Two failure classes were being fixed agent-by-agent; this consolidates them:
 *
 *  1. resolveBin()       — scheduler/cron/pm2 contexts run with a minimal PATH, so both
 *                          `which <bin>` AND a bare spawnSync('<bin>') fail with ENOENT.
 *                          Probe an env override and known install locations, not just `which`.
 *
 *  2. withRetry()        — the shared Supabase pooler saturates during the nightly batch,
 *     isTransientDbError()  so DB calls sporadically throw `fetch failed` / schema-cache
 *                          errors. Retry the transient ones (network throws AND transient
 *                          error values) with linear backoff; let real errors pass through.
 */
import { execSync } from 'node:child_process';
import { existsSync } from 'node:fs';

// Known absolute install locations, used as the minimal-PATH fallback for resolveBin.
export const KNOWN_BIN_CANDIDATES = {
  psql: [
    '/opt/homebrew/bin/psql',
    '/opt/homebrew/opt/postgresql@16/bin/psql',
    '/usr/local/bin/psql',
    '/Applications/Postgres.app/Contents/Versions/latest/bin/psql',
  ],
};

/**
 * Resolve an absolute binary path that works under a minimal PATH.
 * Order: {NAME}_BIN env override -> validated `which` hit -> known candidates -> bare name.
 */
export function resolveBin(name, candidates = KNOWN_BIN_CANDIDATES[name] || []) {
  const envOverride = process.env[`${name.toUpperCase()}_BIN`];
  if (envOverride && existsSync(envOverride)) return envOverride;
  try {
    const found = execSync(`which ${name}`, { encoding: 'utf8' }).trim();
    if (found && existsSync(found)) return found;
  } catch {
    // `which` unavailable or PATH too minimal — fall through to candidates.
  }
  for (const candidate of candidates) {
    if (existsSync(candidate)) return candidate;
  }
  return name;
}

/** True for transient pooler/connection failures that are worth retrying. */
export function isTransientDbError(message) {
  return /fetch failed|ECONNRESET|ETIMEDOUT|timeout|schema cache|EPIPE|socket hang up|503|terminating connection|too many (clients|connections)|Connection terminated|deadlock|ECONNREFUSED/i.test(String(message || ''));
}

/**
 * Run a Supabase call with retry on transient connection failures. Handles both shapes
 * the client produces: a thrown network error, or a returned `{ data, error }` whose
 * error is transient. Non-transient errors pass straight through (returned or rethrown)
 * so real bugs surface immediately and are NOT retried.
 */
export async function withRetry(fn, label, tries = 4, baseDelayMs = 1500) {
  let lastResult;
  for (let attempt = 1; attempt <= tries; attempt++) {
    try {
      lastResult = await fn();
      if (!(lastResult && lastResult.error && isTransientDbError(lastResult.error.message))) {
        return lastResult;
      }
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      if (!isTransientDbError(message) || attempt === tries) throw err;
      lastResult = { data: null, error: { message } };
    }
    if (attempt === tries) return lastResult;
    const delay = baseDelayMs * attempt;
    console.error(`[retry] ${label}: transient DB failure (attempt ${attempt}/${tries}): ${lastResult?.error?.message} — retrying in ${delay}ms`);
    await new Promise((r) => setTimeout(r, delay));
  }
  return lastResult;
}
