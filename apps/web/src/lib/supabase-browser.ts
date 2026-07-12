import { createBrowserClient } from '@supabase/ssr';
import { getSupabasePublicKey, getSupabaseUrl } from './supabase-env';

export function createSupabaseBrowser() {
  return createBrowserClient(
    getSupabaseUrl(),
    getSupabasePublicKey()
  );
}
