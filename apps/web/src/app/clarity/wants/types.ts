export interface BlockerObject {
  object_key: string;
  object_name: string;
  rows: number | null;
  state: string | null;
}

export interface WantRow {
  slug: string;
  stub: string;
  question: string;
  subject: string;
  state: 'unanswerable' | 'refused' | 'contested';
  blocked_by: string[];
  blocked_by_metric: string | null;
  unlock_effort: 'S' | 'M' | 'L' | null;
  unlock_note: string | null;
  unlock_dollars: number | null;
  licence_note: string | null;
  blocker_objects: BlockerObject[];
  also_blocks: number;
  unlocks_named: number | null;
  metric_now: number | null;
  metric_target: number | null;
  metric_unit: string | null;
  metric_direction: string | null;
  metric_numerator: number | null;
  metric_denominator: number | null;
  metric_measured_at: string | null;
  metric_gap: number | null;
  rate_per_week: number | null;
  eta_weeks: number | null;
  metric_samples: number | null;
  effort_known: boolean;
  rank_score: number | null;
}

/**
 * Movement, in three states that must never collapse into one another — the same discipline the
 * seams screen applies to match rates.
 *
 *   unmeasured — fewer than two measurements exist. We have not watched it long enough to say.
 *   stalled    — measured repeatedly, and it has not moved. This is the loud one.
 *   moving     — measured repeatedly, and it is moving, in some direction.
 *
 * A want that has never been measured twice renders "no trend yet", not "+0/wk". Printing +0/wk
 * for a metric we have only ever seen once would accuse the work of being stuck when the truth is
 * that nobody has looked.
 */
export type Movement = 'unmeasured' | 'stalled' | 'moving';

export function movement(w: Pick<WantRow, 'metric_samples' | 'rate_per_week'>): Movement {
  if ((w.metric_samples ?? 0) < 2 || w.rate_per_week === null) return 'unmeasured';
  return Number(w.rate_per_week) === 0 ? 'stalled' : 'moving';
}

export function movementLabel(w: WantRow): string {
  const m = movement(w);
  if (m === 'unmeasured') return 'no trend yet';
  const r = Number(w.rate_per_week);
  const unit = w.metric_unit === 'pct' ? 'pp' : '';
  if (m === 'stalled') return `+0${unit}/wk`;
  return `${r > 0 ? '+' : ''}${r}${unit}/wk`;
}

/**
 * Whether the metric is moving towards its target or away from it. Direction matters: a rate of
 * -2/wk is progress on a lower_better metric and a rout on a higher_better one.
 */
export function isImproving(w: WantRow): boolean | null {
  if (movement(w) !== 'moving' || !w.metric_direction) return null;
  const r = Number(w.rate_per_week);
  return w.metric_direction === 'higher_better' ? r > 0 : r < 0;
}

export const EFFORT_WEIGHT: Record<'S' | 'M' | 'L', number> = { S: 1, M: 3, L: 9 };

export function effortLabel(w: WantRow): string {
  return w.effort_known && w.unlock_effort ? `EFFORT ${w.unlock_effort}` : 'NOT PRICED';
}

/**
 * Screen order. rank_score first, then how far short the metric is in its own unit. Without the
 * second key the ranking collapses into three effort bands — no want carries a dollar figure yet
 * and none unlocks another question — and rows would shuffle arbitrarily inside each band on
 * every render.
 */
export function rankWants(rows: WantRow[]): WantRow[] {
  return [...rows].sort((a, b) => {
    const r = Number(b.rank_score ?? 0) - Number(a.rank_score ?? 0);
    if (r !== 0) return r;
    const g = Number(b.metric_gap ?? -1) - Number(a.metric_gap ?? -1);
    if (g !== 0) return g;
    return a.slug.localeCompare(b.slug);
  });
}

export function formatMetric(value: number | null, unit: string | null): string {
  if (value === null || value === undefined) return '—';
  const n = Number(value);
  return unit === 'pct' ? `${n.toFixed(1)}%` : n.toLocaleString('en-AU');
}

export function targetLabel(w: WantRow): string {
  if (w.metric_target === null) return 'no target set';
  const arrow = w.metric_direction === 'higher_better' ? '≥' : '≤';
  return `target ${arrow} ${formatMetric(w.metric_target, w.metric_unit)}`;
}
