/**
 * The shape the ledger client receives. Deliberately terse keys: the whole catalog is
 * inlined into the RSC payload so the client can filter in memory with zero round trips,
 * and at ~1,455 rows the key names are a measurable fraction of the bytes.
 *
 * 724 objects is small by catalog standards — Airbnb's ran against 200,000 tables — which
 * is why shipping the lot beats paginating it. Verified in the prototype at ~500KB.
 */
export type ObjectKind = 'table' | 'matview' | 'view' | 'function';

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
}
