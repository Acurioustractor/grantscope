import { createServerClient } from '@supabase/ssr';
import { cookies } from 'next/headers';
import { getSupabasePublicKey, getSupabaseUrl, hasSupabasePublicEnv } from './supabase-env';

function getSupabaseServerEnv() {
  const url = getSupabaseUrl();
  const publicKey = getSupabasePublicKey();

  if (!url || !publicKey) {
    return null;
  }

  return { url, publicKey };
}

export function hasSupabaseServerEnv() {
  return hasSupabasePublicEnv();
}

export async function createSupabaseServer() {
  const env = getSupabaseServerEnv();
  if (!env) {
    throw new Error('Supabase server env is not configured');
  }

  const cookieStore = await cookies();

  return createServerClient(
    env.url,
    env.publicKey,
    {
      cookies: {
        getAll() {
          return cookieStore.getAll();
        },
        setAll(cookiesToSet) {
          try {
            cookiesToSet.forEach(({ name, value, options }) =>
              cookieStore.set(name, value, options)
            );
          } catch {
            // Called from a Server Component — ignore
          }
        },
      },
    }
  );
}
