/**
 * Agent Run Logger — writes to agent_runs table so ops dashboard can track script executions.
 *
 * Usage:
 *   import { logStart, logComplete, logFailed } from './lib/log-agent-run.mjs';
 *
 *   const run = await logStart(supabase, 'enrich-grants-free', 'Enrich Grants (Free)');
 *   // ... do work ...
 *   await logComplete(supabase, run.id, { items_found: 50, items_new: 12, items_updated: 38 });
 *   // or on error:
 *   await logFailed(supabase, run.id, error);
 *
 * All three functions are best-effort observability — they retry transient pooler
 * failures (via withRetry) and NEVER throw into the calling agent. A run-logging
 * failure must not crash real work or leave a run falsely stuck as `running`.
 */

import { withRetry } from './agent-resilience.mjs';

/**
 * Start a new agent run. Returns the row with its UUID.
 * @param {import('@supabase/supabase-js').SupabaseClient} supabase
 * @param {string} agentId - Machine ID e.g. 'enrich-grants-free'
 * @param {string} agentName - Display name e.g. 'Enrich Grants (Free)'
 */
export async function logStart(supabase, agentId, agentName) {
  const now = new Date().toISOString();
  try {
    const { data, error } = await withRetry(
      () => supabase
        .from('agent_runs')
        .insert({
          agent_id: agentId,
          agent_name: agentName,
          started_at: now,
          status: 'running',
        })
        .select('id')
        .single(),
      `logStart(${agentId})`,
    );

    if (error) {
      console.error('[log-agent-run] Failed to log start:', error.message);
      return { id: null };
    }
    return data;
  } catch (err) {
    console.error('[log-agent-run] Failed to log start (after retries):', err instanceof Error ? err.message : String(err));
    return { id: null };
  }
}

/**
 * Mark a run as completed with stats.
 * @param {import('@supabase/supabase-js').SupabaseClient} supabase
 * @param {string|null} runId
 * @param {{
 *   items_found?: number,
 *   items_new?: number,
 *   items_updated?: number,
 *   status?: 'success' | 'partial',
 *   errors?: unknown[]
 * }} stats
 */
export async function logComplete(supabase, runId, stats = {}) {
  if (!runId) return;
  const now = new Date().toISOString();

  try {
    // Fetch started_at to compute duration
    const { data: run } = await withRetry(
      () => supabase
        .from('agent_runs')
        .select('started_at')
        .eq('id', runId)
        .single(),
      `logComplete.fetch(${runId})`,
    );

    const durationMs = run
      ? Date.now() - new Date(run.started_at).getTime()
      : 0;

    const { error } = await withRetry(
      () => supabase
        .from('agent_runs')
        .update({
          status: stats.status || 'success',
          completed_at: now,
          duration_ms: durationMs,
          items_found: stats.items_found ?? 0,
          items_new: stats.items_new ?? 0,
          items_updated: stats.items_updated ?? 0,
          errors: Array.isArray(stats.errors) && stats.errors.length > 0
            ? stats.errors.map(err => ({ message: errorToString(err), time: now }))
            : null,
        })
        .eq('id', runId),
      `logComplete.update(${runId})`,
    );

    if (error) {
      console.error('[log-agent-run] Failed to log complete:', error.message);
    }
  } catch (err) {
    console.error('[log-agent-run] Failed to log complete (after retries):', err instanceof Error ? err.message : String(err));
  }
}

/**
 * Serialize an error value to a human-readable string.
 * Handles Error objects, plain objects, and primitives.
 */
function errorToString(err) {
  if (typeof err === 'string') return err;
  if (err instanceof Error) return err.message;
  if (err && typeof err === 'object') {
    // Supabase/API error objects often have .message or .error
    if (err.message) return String(err.message);
    if (err.error) return String(err.error);
    try { return JSON.stringify(err); } catch { return '[unserializable object]'; }
  }
  return String(err);
}

/**
 * Mark a run as failed.
 * @param {import('@supabase/supabase-js').SupabaseClient} supabase
 * @param {string|null} runId
 * @param {Error|string|object} err
 */
export async function logFailed(supabase, runId, err) {
  if (!runId) return;
  const now = new Date().toISOString();

  try {
    const { data: run } = await withRetry(
      () => supabase
        .from('agent_runs')
        .select('started_at')
        .eq('id', runId)
        .single(),
      `logFailed.fetch(${runId})`,
    );

    const durationMs = run
      ? Date.now() - new Date(run.started_at).getTime()
      : 0;

    const { error } = await withRetry(
      () => supabase
        .from('agent_runs')
        .update({
          status: 'failed',
          completed_at: now,
          duration_ms: durationMs,
          errors: [{ message: errorToString(err), time: now }],
        })
        .eq('id', runId),
      `logFailed.update(${runId})`,
    );

    if (error) {
      console.error('[log-agent-run] Failed to log failure:', error.message);
    }
  } catch (retryErr) {
    console.error('[log-agent-run] Failed to log failure (after retries):', retryErr instanceof Error ? retryErr.message : String(retryErr));
  }
}
