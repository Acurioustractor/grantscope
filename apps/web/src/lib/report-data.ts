/**
 * Tells a report page whether its data actually loaded, so it can refuse instead of printing zeros.
 *
 * WHY THIS EXISTS. On 2026-08-19 two public investigation reports were serving fabricated-looking
 * zeros with that day's date on them:
 *
 *   /reports/power-concentration  "0 Australian entities scored across 7 public datasets… 0 appear
 *                                  in 3+ systems… $0B of $0B"
 *   /reports/funding-deserts      "0 Local Government Areas scored… 0 LGAs score above 100"
 *
 * Both have real data behind them (mv_entity_power_index 188K rows, mv_funding_deserts 2,004). The
 * pages were reading through a snapshot client that returns `{ data: null, error: null }` for every
 * query, and each call site did `(result.data as Row[]) || []`, which turns "no answer" into "an
 * answer of zero". Nothing on screen distinguished the two.
 *
 * THE DISCRIMINATOR. A query that genuinely matched no rows returns `data: []`. Only a client that
 * never ran the query returns `data: null`. So:
 *
 *   data === null (or an error)  ->  UNAVAILABLE. Refuse. We do not know.
 *   data === []                  ->  a real, measured zero. Render it.
 *
 * That distinction is the whole point. `|| []` erases it, which is why it must not be the first
 * thing a report does with a result.
 *
 * This is the standard's "refuse at the claim, not at the index" rule made mechanical. See
 * docs/strategy/data-standard.md.
 */

export interface SupaLikeResult {
  data?: unknown;
  error?: unknown;
}

/** True when the query did not run or failed — as opposed to running and matching nothing. */
export function resultUnavailable(result: SupaLikeResult | null | undefined): boolean {
  if (!result) return true;
  if (result.error) return true;
  return result.data === null || result.data === undefined;
}

/**
 * True when ANY result the page depends on is unavailable. Deliberately "any" rather than "all":
 * a report rendering three real sections and one silent zero is the harder failure to spot, and
 * the zero is the part that gets quoted.
 */
export function reportDataUnavailable(results: (SupaLikeResult | null | undefined)[]): boolean {
  return results.some(resultUnavailable);
}

/** Rows, or null when the query never ran. Never silently an empty array. */
export function rowsOrNull<T>(result: SupaLikeResult | null | undefined): T[] | null {
  if (resultUnavailable(result)) return null;
  return (result?.data as T[]) ?? [];
}
