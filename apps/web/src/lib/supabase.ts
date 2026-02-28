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
export function getServiceSupabase() {
  return createClient(getUrl(), process.env.SUPABASE_SERVICE_ROLE_KEY || '');
}
