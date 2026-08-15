/**
 * The shape the ledger client receives. Deliberately terse keys: the whole catalog is
 * inlined into the RSC payload so the client can filter in memory with zero round trips,
 * and at ~1,455 rows the key names are a measurable fraction of the bytes.
 *
 * 724 objects is small by catalog standards — Airbnb's ran against 200,000 tables — which
 * is why shipping the lot beats paginating it. Verified in the prototype at ~500KB.
 */
export type ObjectKind = 'table' | 'matview' | 'view' | 'function' | 'question';

/** Freshness has four states and they must never collapse into three. See issue #195. */
export type FreshnessProbe =
  | 'ok'                  // reports a real date
  | 'no_column'           // OUR omission — no timestamp column. Fixable in an afternoon.
  | 'deferred_too_large'  // genuinely unmeasurable cheaply. Needs a rebuild.
  | 'not_applicable'      // functions have no freshness
  | 'timeout'
  | 'error';

export interface LedgerRow {
  /** object_name */
  n: string;
  /** object_kind */
  k: ObjectKind;
  /** segment: SOURCES | DERIVED | LENSES | ROUTINES */
  s: string;
  /** row_count; null when not countable */
  r: number | null;
  /** row_count_is_estimate */
  e: boolean;
  /** bytes */
  b: number;
  /** domain — empty string means unclassified, which renders, never hides */
  d: string;
  /** lifecycle */
  l: string;
  /** freshness_probe */
  f: FreshnessProbe;
  /** last_write_at, YYYY-MM-DD */
  w: string;
  /** act_business — driven by catalog_object_scope, not a name guess. See 9f5532d. */
  a: boolean;
  /** degree */
  g: number;
  /** column_count */
  c: number;
  /** importance — the default sort */
  i: number;
  /** purpose */
  p: string;
  /** join_keys */
  j: string;
  /** caveat / flags */
  v: string;
  /** rls_enabled */
  rls: boolean;
  /** anon_readable */
  an: boolean;

  /**
   * Question rows.
   *
   * A registered question sits in the SAME index as the objects it is computed from, so
   * searching "watchhouse" returns the two source tables AND the answer built on them. Present
   * only on question rows; absent on catalog rows.
   */
  /** question slug — presence is what makes this a question row */
  qs?: string;
  /** headline, e.g. '85.1%' */
  qh?: string;
  /** headline_sub, e.g. '662 of 778 organisations' */
  qsub?: string;

  /**
   * Movement against the selected baseline (slice 3).
   *
   * `dp` undefined means we have no baseline for this object that far back, and it
   * renders `?` — never 0. A baseline we do not hold is not a baseline of zero, and
   * collapsing the two is exactly how a 28% loss went unnoticed for four months.
   */
  dp?: number;
}

export interface LedgerStats {
  catalogued: number;
  relations: number;
  routines: number;
  described: number;
  /** described / relations — NOT / catalogued. Routines were never in scope to describe. */
  coveragePct: number;
  noTimestampCol: number;
  anonReadable: number;
  actBusiness: number;
  refreshedAt: string | null;
  /** slice 3 — the WHAT CHANGED strip */
  baseline: string;
  /** objects whose row count moved more than 10% against the baseline */
  moved: number;
  /** critical events with no reason written */
  unexplained: number;
  /** objects with a real baseline row, so `?` always has its denominator on screen */
  measurable: number;
}
