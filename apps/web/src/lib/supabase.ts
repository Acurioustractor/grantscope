import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || process.env.SUPABASE_URL || '';
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || '';
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY || '';

/** Client-side Supabase (anon key, RLS enforced) */
export const supabase = createClient(supabaseUrl, supabaseAnonKey);

/** Server-side Supabase (service role, bypasses RLS) */
export function getServiceSupabase() {
  return createClient(supabaseUrl, supabaseServiceKey);
}
