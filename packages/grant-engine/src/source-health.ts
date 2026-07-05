/**
 * Source Health — classify per-source ingest runs so a silently-zeroed
 * scraper raises an alarm instead of quietly returning nothing.
 *
 * Pure and dependency-free: the caller supplies recent runs (from `agent_runs`),
 * this decides each source's health. The alarm case is `zeroed` — a source that
 * used to yield grants but whose latest run found none (a broken selector /
 * changed portal), which a plain success/failure check never catches because
 * the run itself "succeeded" with zero rows.
 */

export type SourceHealthStatus = 'healthy' | 'zeroed' | 'stale' | 'failing' | 'unknown';

export interface SourceRun {
  source: string;
  /** ISO timestamp. */
  startedAt: string;
  itemsFound: number;
  status?: string; // 'success' | 'partial' | 'failed' | ...
}

export interface SourceHealth {
  source: string;
  status: SourceHealthStatus;
  latestYield: number;
  lastRunAt: string | null;
  note: string;
}

export interface ClassifyOptions {
  /** A source with no run within this window is `stale`. Default 3 days. */
  staleDays?: number;
  /** Injectable clock for deterministic tests. Default Date.now(). */
  now?: number;
}

/**
 * Classify each source's health from its recent runs. One entry per distinct
 * source, ordered most-concerning first (failing → zeroed → stale → healthy).
 */
export function classifySourceHealth(runs: SourceRun[], options: ClassifyOptions = {}): SourceHealth[] {
  const staleMs = (options.staleDays ?? 3) * 86_400_000;
  const now = options.now ?? Date.now();

  const bySource = new Map<string, SourceRun[]>();
  for (const run of runs) {
    const list = bySource.get(run.source) ?? [];
    list.push(run);
    bySource.set(run.source, list);
  }

  const results: SourceHealth[] = [];

  for (const [source, sourceRuns] of bySource) {
    const sorted = [...sourceRuns].sort((a, b) => new Date(b.startedAt).getTime() - new Date(a.startedAt).getTime());
    const latest = sorted[0];

    if (!latest) {
      results.push({ source, status: 'unknown', latestYield: 0, lastRunAt: null, note: 'no runs recorded' });
      continue;
    }

    const lastRunAt = latest.startedAt;
    const latestYield = latest.itemsFound ?? 0;
    const ageMs = now - new Date(lastRunAt).getTime();
    const everYielded = sorted.some((r) => (r.itemsFound ?? 0) > 0);

    let status: SourceHealthStatus;
    let note: string;

    if (latest.status === 'failed') {
      status = 'failing';
      note = 'latest run failed';
    } else if (ageMs > staleMs) {
      status = 'stale';
      note = `no successful run in ${Math.floor(ageMs / 86_400_000)}d`;
    } else if (latestYield === 0 && everYielded) {
      status = 'zeroed';
      note = 'latest run found 0 grants but this source has yielded before — likely broken';
    } else if (latestYield === 0) {
      status = 'unknown';
      note = 'no grants yet, no prior yield to compare';
    } else {
      status = 'healthy';
      note = `${latestYield} grants in latest run`;
    }

    results.push({ source, status, latestYield, lastRunAt, note });
  }

  const order: Record<SourceHealthStatus, number> = { failing: 0, zeroed: 1, stale: 2, unknown: 3, healthy: 4 };
  results.sort((a, b) => order[a.status] - order[b.status] || a.source.localeCompare(b.source));
  return results;
}

/** Sources that need attention (anything not healthy/unknown). */
export function unhealthySources(health: SourceHealth[]): SourceHealth[] {
  return health.filter((h) => h.status === 'failing' || h.status === 'zeroed' || h.status === 'stale');
}
