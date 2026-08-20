/**
 * `foundations.total_giving_annual`, filtered honestly.
 *
 * The column does NOT mean "money this organisation gives away". Two separate defects, and six
 * surfaces ranked on it before this module existed (#390).
 *
 * 1. IT IS WRONG IN KIND FOR SOME TYPES. For service providers, school systems and universities it
 *    carries revenue or expenditure. Measured 2026-08-21, the top of "foundations by giving" was:
 *
 *      The University of Sydney                     $340.7M   a university
 *      Catholic Education Centre                    $281.5M   a school system
 *      Australian Red Cross Society                 $265.7M   a service charity
 *      Alice Springs Youth Accommodation & Support  $196.0M   a service provider
 *
 *    Alice Springs Youth Accommodation & Support Service ranked among Australia's largest
 *    philanthropic funders is the clearest tell: it is an organisation this project exists to show
 *    RECEIVING money.
 *
 * 2. NINETY PERCENT OF IT IS A PLACEHOLDER. Of 10,190 non-null values, 6,942 are exactly $25,000,
 *    1,474 are exactly $100,000 and 801 are exactly $500,000 — 9,217 of 10,190 on three round
 *    numbers, with only 964 distinct values in the whole column. A descending sort therefore
 *    returns a few miscategorised giants and then ~6,942 foundations tied at $25,000 in arbitrary
 *    order.
 *
 * So: rank only over types whose figure means grantmaking, and never render a placeholder as
 * though it were a measurement.
 */

/**
 * The types whose `total_giving_annual` plausibly means GRANTMAKING. An allowlist, not a denylist.
 *
 * The first version of this was a denylist of three receiving types, and it FAILED OPEN: `university`
 * was not on it, so The University of Sydney stayed at the top of the giving ranking at $340.7M
 * while the Red Cross and Alice Springs Youth Accommodation were correctly removed. `foundations.type`
 * has 27 values including `legal_aid`, `hospital`, `research_body`, `peak_body`, `sport_recreation`
 * and `emergency_relief` — all organisations that receive.
 *
 * A denylist means every type someone adds later counts as giving until a human notices. An
 * allowlist means a new type counts as nothing until a human decides. Given the failure mode here
 * is publishing a service provider as a major philanthropist, it fails closed.
 */
export const GRANTMAKING_TYPES: ReadonlySet<string> = new Set([
  'grantmaker',
  'philanthropic_foundation',
  'private_ancillary_fund',
  'public_ancillary_fund',
  'community_foundation',
  'corporate_foundation',
  'giving_circle',
  'trust',
  'trustee',
]);

export const PLACEHOLDER_GIVING: readonly number[] = [25_000, 100_000, 500_000];

export function isPlaceholderGiving(value: number | null | undefined): boolean {
  if (value === null || value === undefined) return false;
  return PLACEHOLDER_GIVING.includes(Number(value));
}

/** Whether this row's giving figure means grantmaking AND is not a placeholder. */
export function isGivingMeasured(
  type: string | null | undefined,
  value: number | null | undefined,
): boolean {
  if (value === null || value === undefined) return false;
  if (!(Number(value) > 0)) return false;
  // Fails closed: an unrecognised or missing type is not evidence of grantmaking.
  if (!type || !GRANTMAKING_TYPES.has(type)) return false;
  return !isPlaceholderGiving(value);
}

/**
 * What to print beside a foundation's giving figure. Never a bare number for an unmeasured row —
 * the point of #390 is that a bare number is exactly what misled.
 */
export function givingLabel(
  type: string | null | undefined,
  value: number | null | undefined,
  format: (n: number) => string,
): string {
  if (value === null || value === undefined || !(Number(value) > 0)) return 'Giving not recorded';
  if (!type || !GRANTMAKING_TYPES.has(type)) return 'Not a grantmaking figure';
  if (isPlaceholderGiving(Number(value))) return `${format(Number(value))} — placeholder`;
  return format(Number(value));
}

/**
 * SQL predicate for ranking. Use wherever a query orders by giving.
 *
 * `alias` must match the table alias in the query. Taken as an argument rather than left to
 * hand-editing, for the same reason `grantFilterSql()` does it in justice-money.ts.
 */
export function grantmakingGivingSql(alias?: string): string {
  const p = alias ? `${alias}.` : '';
  const types = [...GRANTMAKING_TYPES].map(t => `'${t}'`).join(',');
  const placeholders = PLACEHOLDER_GIVING.join(',');
  return `${p}total_giving_annual IS NOT NULL
    AND ${p}total_giving_annual > 0
    AND ${p}type = ANY (ARRAY[${types}])
    AND ${p}total_giving_annual <> ALL (ARRAY[${placeholders}]::numeric[])`;
}

/** PostgREST builder form, for `.from('foundations')` call sites. */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export function applyGrantmakingFilter<T extends { not: any; gt: any; in: any }>(query: T): T {
  let q = query.gt('total_giving_annual', 0).in('type', [...GRANTMAKING_TYPES]);
  for (const v of PLACEHOLDER_GIVING) q = q.not('total_giving_annual', 'eq', v);
  return q as T;
}

/**
 * ORDER BY expression that DEMOTES rather than excludes.
 *
 * Filtering is wrong for a browse or a sort: a university foundation is still worth finding, and
 * dropping it would be a second silent error on top of the first. This keeps every row and sends
 * the unmeasured ones to the bottom, so a revenue figure can never lead a giving ranking.
 *
 * Use `applyGrantmakingFilter` / `grantmakingGivingSql` only where the question genuinely is
 * "which foundations give the most" and a wrong-in-kind row would be an answer, not a listing.
 */
export function measuredGivingOrderSql(alias?: string): string {
  const p = alias ? `${alias}.` : '';
  const types = [...GRANTMAKING_TYPES].map(t => `'${t}'`).join(',');
  const placeholders = PLACEHOLDER_GIVING.join(',');
  return `CASE
      WHEN ${p}total_giving_annual IS NULL THEN NULL
      WHEN ${p}total_giving_annual <= 0 THEN NULL
      WHEN ${p}type IS NULL THEN NULL
      WHEN ${p}type <> ALL (ARRAY[${types}]) THEN NULL
      WHEN ${p}total_giving_annual = ANY (ARRAY[${placeholders}]::numeric[]) THEN NULL
      ELSE ${p}total_giving_annual
    END DESC NULLS LAST`;
}
