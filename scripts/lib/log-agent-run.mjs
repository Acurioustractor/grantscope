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
 */

/**
 * Start a new agent run. Returns the row with its UUID.
 * @param {import('@supabase/supabase-js').SupabaseClient} supabase
 * @param {string} agentId - Machine ID e.g. 'enrich-grants-free'
 * @param {string} agentName - Display name e.g. 'Enrich Grants (Free)'
 */
export async function logStart(supabase, agentId, agentName) {
  const now = new Date().toISOString();
  const { data, error } = await supabase
    .from('agent_runs')
    .insert({
      agent_id: agentId,
      agent_name: agentName,
      started_at: now,
      status: 'running',
    })
    .select('id')
    .single();

  if (error) {
    console.error('[log-agent-run] Failed to log start:', error.message);
    return { id: null };
  }
  return data;
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

  // Fetch started_at to compute duration
  const { data: run } = await supabase
    .from('agent_runs')
    .select('started_at')
    .eq('id', runId)
    .single();

  const durationMs = run
    ? Date.now() - new Date(run.started_at).getTime()
    : 0;

  const { error } = await supabase
    .from('agent_runs')
    .update({
      status: stats.status || 'success',
      completed_at: now,
      duration_ms: durationMs,
      items_found: stats.items_found ?? 0,
      items_new: stats.items_new ?? 0,
      items_updated: stats.items_updated ?? 0,
      errors: Array.isArray(stats.errors) && stats.errors.length > 0
        ? stats.errors.map(err => ({ message: String(err), time: now }))
        : null,
    })
    .eq('id', runId);

  if (error) {
    console.error('[log-agent-run] Failed to log complete:', error.message);
  }
}

/**
 * Mark a run as failed.
 * @param {import('@supabase/supabase-js').SupabaseClient} supabase
 * @param {string|null} runId
 * @param {Error|string} err
 */
export async function logFailed(supabase, runId, err) {
  if (!runId) return;
  const now = new Date().toISOString();

  const { data: run } = await supabase
    .from('agent_runs')
    .select('started_at')
    .eq('id', runId)
    .single();

  const durationMs = run
    ? Date.now() - new Date(run.started_at).getTime()
    : 0;

  const { error } = await supabase
    .from('agent_runs')
    .update({
      status: 'failed',
      completed_at: now,
      duration_ms: durationMs,
      errors: [{ message: String(err), time: now }],
    })
    .eq('id', runId);

  if (error) {
    console.error('[log-agent-run] Failed to log failure:', error.message);
  }
}
