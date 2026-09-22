/**
 * Which agent_tasks rows marked 'running' are zombies.
 *
 * Why (2026-09-22): two tasks died on 2026-09-18 during a DB outage, but the write marking
 * them done failed, so both rows stayed 'running'. claim_next_task counts 'running' rows
 * against the concurrency limit (2), so the queue stopped for four days and the nightly
 * graph build never ran. The scheduler's 4-hour janitor only sweeps agent_runs, and the
 * orchestrator only recovered agent_tasks at startup and shutdown.
 *
 * A row is stale when this orchestrator is not running it AND it has outlived its agent's
 * timeout plus a grace period. execFile kills the child at timeoutMs, so a row older than
 * that with no live child cannot still be working.
 */

export const STALE_GRACE_MS = 30 * 60_000;
export const DEFAULT_TIMEOUT_MS = 600_000;

export function findStaleTasks(runningTasks, { agents, activeIds, now = Date.now(), graceMs = STALE_GRACE_MS }) {
  return runningTasks.filter(task => {
    if (activeIds.has(task.id)) return false;
    if (!task.started_at) return true;
    const timeout = agents[task.agent_id]?.timeoutMs || DEFAULT_TIMEOUT_MS;
    return now - new Date(task.started_at).getTime() > timeout + graceMs;
  });
}
