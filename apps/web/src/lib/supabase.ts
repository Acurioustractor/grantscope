import { createClient, type SupabaseClient } from '@supabase/supabase-js';

function getUrl() {
  return process.env.NEXT_PUBLIC_SUPABASE_URL || process.env.SUPABASE_URL || '';
}

const blockedSqlRpcNames = new Set(['exec_sql', 'exec', 'execute_sql', 'exec_agent_sql']);

/** Client-side Supabase (anon key, RLS enforced) */
let _supabase: SupabaseClient | null = null;
export function getSupabase() {
  if (!_supabase) {
    _supabase = createRuntimeSupabaseClient(createClient(getUrl(), process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || ''));
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

function createRuntimeSupabaseClient(client: SupabaseClient): SupabaseClient {
  return new Proxy(client, {
    get(target, prop, receiver) {
      if (prop === 'rpc') {
        const rpc = Reflect.get(target, prop, receiver) as (...args: unknown[]) => unknown;
        return (functionName: string, ...args: unknown[]) => {
          if (blockedSqlRpcNames.has(functionName)) {
            return createBlockedSqlRpcBuilder(functionName);
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

function shouldUseReportSnapshotClient() {
  if (process.env.CIVICGRAPH_LIVE_REPORTS === 'true') return false;
  const stack = new Error().stack || '';
  return stack.includes('/app/reports/') || stack.includes('src_app_reports') || stack.includes('app_reports');
}

export function getServiceSupabase() {
  if (shouldUseReportSnapshotClient()) {
    return reportSnapshotSupabase;
  }

  return getDirectServiceSupabase();
}

export function getDirectServiceSupabase() {
  if (!_serviceSupabase) {
    _serviceSupabase = createRuntimeSupabaseClient(createClient(getUrl(), process.env.SUPABASE_SERVICE_ROLE_KEY || ''));
  }
  return _serviceSupabase;
}
