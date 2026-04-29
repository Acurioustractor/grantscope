import { createClient, type SupabaseClient } from '@supabase/supabase-js';

function getUrl() {
  return process.env.NEXT_PUBLIC_SUPABASE_URL || process.env.SUPABASE_URL || '';
}

/** Client-side Supabase (anon key, RLS enforced) */
let _supabase: SupabaseClient | null = null;
export function getSupabase() {
  if (!_supabase) {
    _supabase = createClient(getUrl(), process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || '');
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

type QueryResult = { data: null; error: null; count: 0 };
type EmptyQueryBuilder = ((...args: unknown[]) => EmptyQueryBuilder) & PromiseLike<QueryResult>;

const emptyQueryResult: QueryResult = { data: null, error: null, count: 0 };

function createEmptyQueryBuilder(): EmptyQueryBuilder {
  const result = Promise.resolve(emptyQueryResult);
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
    _serviceSupabase = createClient(getUrl(), process.env.SUPABASE_SERVICE_ROLE_KEY || '');
  }
  return _serviceSupabase;
}
