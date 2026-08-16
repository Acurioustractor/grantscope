/**
 * The object page — the article for one catalogued object.
 *
 * WHY THIS EXISTS
 *
 * `clarity_object` carries ~60 curated fields per object: purpose, caveat, grain, join_keys,
 * the reference counts, the link-graph degrees, the access posture. Until this page there was
 * nowhere to read any of it. All 1,479 objects rendered as three-line rows in a single
 * 1,222-row table, six columns wide. The content was an encyclopedia and the surface was a
 * spreadsheet. See `thoughts/shared/plans/clarity-console.md`.
 *
 * KEY FORMS — the trap this codebase has already fallen into once
 *
 * `clarity_object.object_key` and `clarity_edge.src_object`/`tgt_object` are BARE names
 * (`gs_entities`), verified across all 1,479 rows. `clarity_question_ingredient.object_key` is
 * PREFIXED (`public.gs_entities`) and is CHECK-constrained to stay that way, because it is
 * compared against `clarity_sentinel.guards_objects`. Joining the two needs `'public.' || key`.
 * Getting this wrong does not error — it silently returns nothing.
 */

export type ObjectKind = 'table' | 'matview' | 'view' | 'function';

/**
 * Three states that must never collapse into one, the same rule the seams and wants screens
 * already follow. A count of zero from a probe that ran means nothing uses this. A count of
 * zero from a probe that never ran means we do not know.
 */
export type Measured<T> =
  | { state: 'measured'; value: T }
  | { state: 'unmeasured'; why: string };

export interface ObjectRow {
  object_key: string;
  object_name: string;
  object_kind: ObjectKind;
  row_count: number | null;
  row_count_is_estimate: boolean | null;
  bytes: number | null;
  column_count: number | null;
  nullable_columns: number | null;

  fk_out: number | null;
  fk_in: number | null;
  lineage_out: number | null;
  lineage_in: number | null;
  join_out: number | null;
  join_in: number | null;
  degree: number | null;

  freshness_column: string | null;
  freshness_source: string | null;
  last_write_at: string | null;
  freshness_probe: string | null;

  routine_language: string | null;
  routine_kind: string | null;
  routine_returns: string | null;
  routine_volatility: string | null;
  routine_src_bytes: number | null;
  trigger_attachments: number | null;

  rls_enabled: boolean | null;
  policy_count: number | null;
  anon_grant: boolean | null;
  anon_open_policies: number | null;
  anon_readable: boolean | null;
  authenticated_grant: boolean | null;
  security_invoker: boolean | null;
  security_definer: boolean | null;
  anon_execute: boolean | null;

  domain: string | null;
  lifecycle: string | null;
  grain: string | null;
  purpose: string | null;
  caveat: string | null;
  join_keys: string | null;

  act_business: boolean | null;
  act_business_source: string | null;

  refs_app: number | null;
  refs_script: number | null;
  refs_migration: number | null;
  refs_db_function: number | null;
  owner_app: string | null;

  state: string | null;
  importance: number | null;
  verdict: string | null;
  verdict_reason: string | null;
  verdict_by: string | null;
  verdict_at: string | null;
  first_seen_at: string | null;
  refreshed_at: string | null;
  missing_since: string | null;
}

export interface ColumnRow {
  ordinal: number;
  column_name: string;
  data_type: string;
  is_nullable: boolean | null;
  is_pk: boolean | null;
  is_indexed: boolean | null;
  is_vector: boolean | null;
  vector_dim: number | null;
}

export interface EdgeRow {
  src_object: string;
  src_column: string | null;
  tgt_object: string;
  tgt_column: string | null;
  mechanism: string | null;
  declared: boolean | null;
  match_rate: number | null;
  match_numerator: number | null;
  match_denominator: number | null;
  rows_at_stake: number | null;
  note: string | null;
}

export interface CodeRefRow {
  ref_class: string;
  repo: string | null;
  file_path: string | null;
  hits: number | null;
}

export interface QuestionUse {
  question_slug: string;
  role: string | null;
}

/**
 * A stub is an object with none of the three curated fields. It is not a broken page — it is an
 * honest one, and 667 of 1,479 objects are in this state. The page says so plainly rather than
 * rendering empty panels that read like a bug.
 */
export function isStub(o: ObjectRow): boolean {
  return !o.purpose && !o.grain && !o.join_keys;
}

/**
 * `refs_app`, `refs_script` and `refs_migration` are 0 on ALL 1,479 rows — the code scanner that
 * populates them has never run. Only `refs_db_function` (328 objects) and the trigger/db_function
 * rows in `clarity_code_ref` are real.
 *
 * So a naive "nothing uses this" would be wrong about 1,151 objects, and wrong in the most
 * expensive direction: it would read as evidence of an orphan when it is only evidence of an
 * unrun scanner. Until the scanner ships, these three report UNMEASURED.
 */
export function usageMeasurement(o: ObjectRow): {
  app: Measured<number>;
  script: Measured<number>;
  migration: Measured<number>;
  dbFunction: Measured<number>;
} {
  const never = (what: string): Measured<number> => ({
    state: 'unmeasured',
    why: `the ${what} scanner has never run — 0 here means unknown, not unused`,
  });
  return {
    app: never('app'),
    script: never('script'),
    migration: never('migration'),
    dbFunction: { state: 'measured', value: o.refs_db_function ?? 0 },
  };
}

export function formatBytes(b: number | null): string {
  if (b === null || b === 0) return '—';
  const units = ['B', 'KB', 'MB', 'GB', 'TB'];
  let v = b;
  let i = 0;
  while (v >= 1024 && i < units.length - 1) {
    v /= 1024;
    i += 1;
  }
  return `${v < 10 && i > 0 ? v.toFixed(1) : Math.round(v)} ${units[i]}`;
}

export function formatCount(n: number | null, isEstimate: boolean | null): string {
  if (n === null) return '—';
  const s = new Intl.NumberFormat('en-AU').format(n);
  return isEstimate ? `~${s}` : s;
}

/** Percentage for a seam's match rate. A rate we never measured renders `?`, never 0. */
export function formatRate(r: number | null): string {
  if (r === null || Number.isNaN(Number(r))) return '?';
  return `${(Number(r) * 100).toFixed(1)}%`;
}
