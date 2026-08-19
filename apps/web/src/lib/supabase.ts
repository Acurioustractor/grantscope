import { createClient, type SupabaseClient } from '@supabase/supabase-js';
import { getSupabasePublicKey, getSupabaseSecretKey, getSupabaseUrl } from './supabase-env';

function getUrl() {
  return getSupabaseUrl();
}

// Arbitrary-SQL agent RPCs that must never run from the app runtime — they bypass RLS and
// accept writes. `exec_sql` is handled separately: it is the read path the data routes depend
// on, so SELECT/WITH reads are allowed through (the DB function is itself SELECT-wrapped) while
// any write shape is rejected. See commit 02213dd.
const fullyBlockedSqlRpcNames = new Set(['exec', 'execute_sql', 'exec_agent_sql']);

/**
 * exec_sql read-only guard (defense-in-depth). Allows a single SELECT/WITH read; rejects
 * non-reads, stacked statements, and data-modifying CTEs. The DB function additionally wraps
 * input as `SELECT row_to_json(t) FROM (<query>) t`, so writes fail there too.
 */
function isReadOnlyExecSql(query: string | undefined): boolean {
  if (typeof query !== 'string') return false;
  const stripped = query
    .replace(/\/\*[\s\S]*?\*\//g, ' ') // block comments
    .replace(/--[^\n]*/g, ' ') // line comments
    .trim();
  if (!stripped) return false;
  if (!/^(select|with)\b/i.test(stripped)) return false; // top-level read only
  if (/;\s*\S/.test(stripped.replace(/;\s*$/, ''))) return false; // no stacked statements
  if (/\b(insert\s+into|update\s+[\w".]+\s+set|delete\s+from|merge\s+into)\b/i.test(stripped)) {
    return false; // no data-modifying CTE
  }
  return true;
}

/** Client-side Supabase (anon key, RLS enforced) */
let _supabase: SupabaseClient | null = null;
export function getSupabase() {
  if (!_supabase) {
    _supabase = createRuntimeSupabaseClient(createClient(getUrl(), getSupabasePublicKey()));
  }
  return _supabase;
}

/** Backwards-compatible export (lazy) */
export const supabase = new Proxy({} as SupabaseClient, {
  get(_, prop) {
    return (getSupabase() as unknown as Record<string | symbol, unknown>)[prop];
  },
});

/** Server-side Supabase (service role, bypasses RLS) */
let _serviceSupabase: SupabaseClient | null = null;

type LocalQueryError = {
  message: string;
  code: string;
  details: string | null;
  hint: string | null;
};
type QueryResult = { data: null; error: LocalQueryError | null; count: number | null };
type EmptyQueryBuilder = ((...args: unknown[]) => EmptyQueryBuilder) & PromiseLike<QueryResult>;

const emptyQueryResult: QueryResult = { data: null, error: null, count: 0 };

function createStaticQueryBuilder(queryResult: QueryResult): EmptyQueryBuilder {
  const result = Promise.resolve(queryResult);
  let builder: EmptyQueryBuilder;

  builder = new Proxy(function noop() {
    return builder;
  } as EmptyQueryBuilder, {
    get(_, prop) {
      if (prop === 'then') return result.then.bind(result);
      if (prop === 'catch') return result.catch.bind(result);
      if (prop === 'finally') return result.finally.bind(result);
      return () => builder;
    },
    apply() {
      return builder;
    },
  });

  return builder;
}

function createEmptyQueryBuilder(): EmptyQueryBuilder {
  return createStaticQueryBuilder(emptyQueryResult);
}

function createBlockedSqlRpcBuilder(functionName: string): EmptyQueryBuilder {
  return createStaticQueryBuilder({
    data: null,
    error: {
      message: `${functionName} RPC is disabled in the app runtime. Use typed Supabase reads or a dedicated safe view/RPC instead.`,
      code: 'SQL_RPC_DISABLED',
      details: null,
      hint: 'This avoids repeatedly calling revoked arbitrary-SQL functions in Supabase.',
    },
    count: null,
  });
}

function createReadOnlyViolationBuilder(): EmptyQueryBuilder {
  return createStaticQueryBuilder({
    data: null,
    error: {
      message: 'exec_sql only accepts read-only (SELECT/WITH) queries from the app runtime.',
      code: 'SQL_RPC_READONLY',
      details: null,
      hint: 'Use a typed Supabase read or a dedicated write RPC for mutations.',
    },
    count: null,
  });
}

function createRuntimeSupabaseClient(client: SupabaseClient): SupabaseClient {
  return new Proxy(client, {
    get(target, prop, receiver) {
      if (prop === 'rpc') {
        const rpc = Reflect.get(target, prop, receiver) as (...args: unknown[]) => unknown;
        return (functionName: string, ...args: unknown[]) => {
          if (fullyBlockedSqlRpcNames.has(functionName)) {
            return createBlockedSqlRpcBuilder(functionName);
          }
          if (functionName === 'exec_sql') {
            const params = args[0] as { query?: unknown } | undefined;
            const query = typeof params?.query === 'string' ? params.query : undefined;
            if (!isReadOnlyExecSql(query)) {
              return createReadOnlyViolationBuilder();
            }
          }
          return rpc.apply(target, [functionName, ...args]);
        };
      }

      const value = Reflect.get(target, prop, receiver);
      return typeof value === 'function' ? value.bind(target) : value;
    },
  }) as SupabaseClient;
}

const reportSnapshotSupabase = new Proxy({} as SupabaseClient, {
  get(_, prop) {
    if (prop === 'rpc') return () => createEmptyQueryBuilder();
    if (prop === 'from') return () => createEmptyQueryBuilder();
    return undefined;
  },
});

export function getReportSnapshotSupabase() {
  return reportSnapshotSupabase;
}

/**
 * The client a caller asks for is the client it gets.
 *
 * This used to consult `new Error().stack` and silently swap in the empty report-snapshot client
 * if the string contained '/app/reports/', 'src_app_reports' or 'app_reports'. Three problems with
 * that, all of which cost us on 2026-08-19:
 *
 *   1. Whether it fired depended on how a page happened to be bundled, so it applied to some
 *      report pages and not others with nothing distinguishing them.
 *   2. It was invisible at the call site. Nothing in a page.tsx hinted that its queries might not
 *      run, which is how two public reports came to publish "0 entities scored across 7 datasets".
 *   3. It made the fix unavailable to the person reading the page: there was no import to change.
 *
 * Report pages that want the snapshot now say so, by importing from `@/lib/report-supabase`.
 * `apps/web/src/lib/report-client-convention.test.ts` fails the build if one forgets, which is the
 * guarantee the stack sniffing was reaching for and could not provide.
 */
export function getServiceSupabase() {
  return getDirectServiceSupabase();
}

export function getDirectServiceSupabase() {
  if (!_serviceSupabase) {
    _serviceSupabase = createRuntimeSupabaseClient(createClient(getUrl(), getSupabaseSecretKey()));
  }
  return _serviceSupabase;
}
