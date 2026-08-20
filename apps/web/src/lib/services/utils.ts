// Shared service utilities — DRY helpers used across multiple service files

/**
 * Swallow a query failure and return null, having said WHICH query failed.
 *
 * `context` is REQUIRED, and that is the whole point of this function's current shape. It used to
 * be optional, and 65 of 68 call sites in report-service.ts omitted it — so a failure logged as
 *
 *     [report-service] query failed: canceling statement due to statement timeout
 *
 * with nothing identifying the query. On 2026-08-20 a single production build emitted eight of
 * those lines and not one could be attributed to a page without re-deriving it by hand. Every
 * caller already sits inside a named function; passing that name costs nothing and turns an
 * anonymous log line into a location.
 *
 * The failure mode this guards is not the error — it is the SILENCE after it. `safe()` returns
 * null, the caller coerces with `|| []`, and the page renders as though it measured something.
 * If a query is allowed to fail quietly, the log line is the only evidence it existed.
 */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export async function safe<T = any>(p: PromiseLike<{ data: T; error: any }>, context: string): Promise<T | null> {
  try {
    const result = await p;
    if (result.error) {
      console.error(`[report-service] ${context} failed:`, result.error.message || result.error);
      return null;
    }
    return result.data;
  } catch (err) {
    console.error(`[report-service] ${context} threw:`, err instanceof Error ? err.message : err);
    return null;
  }
}
