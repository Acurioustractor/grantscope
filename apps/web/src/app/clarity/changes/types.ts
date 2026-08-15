/**
 * WHAT CHANGED — the estate's derivative. Slice 3.
 *
 * The four baselines are a URL parameter, not component state, so a link to
 * "/clarity/changes?b=90d" is a link to what somebody actually looked at, and the
 * same parameter drives the delta column on the ledger.
 */
export const BASELINES = ['last', '7d', '30d', '90d'] as const;
export type Baseline = (typeof BASELINES)[number];

export const BASELINE_LABEL: Record<Baseline, string> = {
  last: 'Last run',
  '7d': '7 days',
  '30d': '30 days',
  '90d': '90 days',
};

export function parseBaseline(v: string | undefined): Baseline {
  return (BASELINES as readonly string[]).includes(v ?? '') ? (v as Baseline) : 'last';
}

/**
 * Which baselines we can actually serve. `covered` is how many objects have a
 * real baseline row behind them; when it is 0 the option is disabled and carries
 * its own reason, because a greyed control with no explanation is just a bug.
 */
export interface BaselineAvailability {
  baseline: Baseline;
  covered: number;
  reason: string | null;
}

export interface ChangeEvent {
  id: number;
  at: string;
  event_type: string;
  object_key: string | null;
  question_slug: string | null;
  before_value: number | null;
  after_value: number | null;
  delta_pct: number | null;
  severity: 'info' | 'warn' | 'critical';
  note: string | null;
  reason: string | null;
  reason_by: string | null;
  reason_at: string | null;
  unexplained: boolean;
  domain: string | null;
  object_kind: string | null;
}

export interface ChangesStats {
  /** events inside the selected window */
  inWindow: number;
  unexplained: number;
  /** objects whose row count moved more than 10% against the selected baseline */
  moved: number;
  /** objects with a real baseline row for the selected baseline */
  measurable: number;
  /** objects in the catalog, so `measurable` always has its denominator on screen */
  objects: number;
  historyBegins: string | null;
  computedAt: string | null;
}
