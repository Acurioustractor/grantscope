export type PipelinePhaseStatus = 'healthy' | 'running' | 'backlogged' | 'failing' | 'idle' | 'disabled';

export interface PipelineSchedule { agentId: string; enabled: boolean; intervalHours: number; lastScheduledAt: string | null }
export interface PipelineTask { agentId: string; status: string; createdAt: string; startedAt?: string | null; error?: string | null }
export interface PipelineRun { agentId: string; status: string; startedAt: string; completedAt?: string | null }
export interface PipelinePhaseHealth {
  agentId: string; status: PipelinePhaseStatus; pending: number; running: number;
  oldestPendingAt: string | null; latestRunAt: string | null; latestRunStatus: string | null; note: string;
}
export interface PipelineHealth { status: PipelinePhaseStatus; pending: number; running: number; phases: PipelinePhaseHealth[]; note: string }
export interface PipelineHealthOptions { now?: number; backlogMinutes?: number }

const STATUS_ORDER: Record<PipelinePhaseStatus, number> = { failing: 0, backlogged: 1, running: 2, idle: 3, disabled: 4, healthy: 5 };

export function classifyPipelineHealth(
  schedules: PipelineSchedule[], tasks: PipelineTask[], runs: PipelineRun[], options: PipelineHealthOptions = {},
): PipelineHealth {
  const now = options.now ?? Date.now();
  const backlogMs = (options.backlogMinutes ?? 30) * 60_000;
  const phases = schedules.map((schedule): PipelinePhaseHealth => {
    const phaseTasks = tasks.filter((task) => task.agentId === schedule.agentId);
    const pendingTasks = phaseTasks.filter((task) => task.status === 'pending')
      .sort((a, b) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime());
    const runningTasks = phaseTasks.filter((task) => task.status === 'running');
    const latestRun = runs.filter((run) => run.agentId === schedule.agentId)
      .sort((a, b) => new Date(b.startedAt).getTime() - new Date(a.startedAt).getTime())[0];
    const oldestPendingAt = pendingTasks[0]?.createdAt ?? null;
    const oldestPendingAge = oldestPendingAt ? now - new Date(oldestPendingAt).getTime() : 0;
    let status: PipelinePhaseStatus;
    let note: string;
    if (!schedule.enabled) { status = 'disabled'; note = 'schedule disabled'; }
    else if (runningTasks.length > 0) { status = 'running'; note = `${runningTasks.length} task${runningTasks.length === 1 ? '' : 's'} running`; }
    else if (pendingTasks.length > 0 && oldestPendingAge > backlogMs) { status = 'backlogged'; note = `oldest queued task has waited ${Math.floor(oldestPendingAge / 60_000)}m`; }
    else if (latestRun?.status === 'failed' || latestRun?.status === 'timed_out') { status = 'failing'; note = `latest run ${latestRun.status}`; }
    else if (pendingTasks.length > 0) { status = 'idle'; note = `${pendingTasks.length} task${pendingTasks.length === 1 ? '' : 's'} queued`; }
    else { status = 'healthy'; note = latestRun ? `latest run ${latestRun.status}` : 'ready; no run recorded'; }
    return { agentId: schedule.agentId, status, pending: pendingTasks.length, running: runningTasks.length, oldestPendingAt,
      latestRunAt: latestRun?.startedAt ?? null, latestRunStatus: latestRun?.status ?? null, note };
  });
  const status = phases.reduce<PipelinePhaseStatus>((worst, phase) => STATUS_ORDER[phase.status] < STATUS_ORDER[worst] ? phase.status : worst, 'healthy');
  const pending = phases.reduce((sum, phase) => sum + phase.pending, 0);
  const running = phases.reduce((sum, phase) => sum + phase.running, 0);
  const note = status === 'backlogged' ? 'Scheduled work is not being consumed; restart or inspect the orchestrator.'
    : status === 'failing' ? 'A pipeline phase needs attention.' : status === 'running' ? 'The funding pipeline is running.' : 'The funding pipeline is ready.';
  return { status, pending, running, phases, note };
}
