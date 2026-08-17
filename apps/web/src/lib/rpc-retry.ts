/**
 * One retry for browse RPCs that fail transiently.
 *
 * UX audit pass 2, F11. A browse page that loses its query shows "The list could not be read" and
 * nothing else — no retry, no stale copy. That failure is honest, and for a genuinely broken query
 * it is the right behaviour. But the pooler on this project is shared, and a burst of load
 * elsewhere (an MV rebuild, another tenant) can cancel a statement that would succeed a second
 * later. Handing the user an error page for that is not honesty, it is just fragility.
 *
 * Deliberately narrow:
 * - ONE retry, after a short pause. If the query is actually too slow — as charity_browse was at
 *   10.4s — retrying twice more just makes the user wait three times as long for the same error.
 *   Slowness is a query problem and belongs in the query, not here.
 * - Only for errors that look transient. A missing column or a permission failure is retried zero
 *   times, because it will fail identically forever.
 */

const TRANSIENT =
  /statement timeout|canceling statement|connection|ECONNRESET|ETIMEDOUT|fetch failed|socket hang up|too many clients/i;

export function isTransientDbError(message: string | null | undefined): boolean {
  return !!message && TRANSIENT.test(message);
}

export interface RpcResult<T> {
  data: T | null;
  error: { message: string } | null;
}

export async function retryRpc<T>(
  run: () => PromiseLike<RpcResult<T>>,
  { delayMs = 400 }: { delayMs?: number } = {},
): Promise<RpcResult<T>> {
  const first = await run();
  if (!first.error || !isTransientDbError(first.error.message)) return first;
  await new Promise((resolve) => setTimeout(resolve, delayMs));
  return run();
}
