import { redirect } from 'next/navigation';
import { NextResponse } from 'next/server';
import type { User } from '@supabase/supabase-js';
import { isAdminEmail } from '@/lib/admin';
import { isLocalDevBypass, localDevAdminUser } from '@/lib/admin-auth-bypass';
import { createSupabaseServer } from '@/lib/supabase-server';

type AdminApiSuccess = {
  user: User;
  error?: undefined;
};

type AdminApiFailure = {
  user?: undefined;
  error: NextResponse;
};

type AdminApiResult = AdminApiSuccess | AdminApiFailure;

export async function requireAdminApi(): Promise<AdminApiResult> {
  const supabase = await createSupabaseServer();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  // Same rule as requireAdminPage: the bypass covers ONLY the no-session case in local dev
  // (never production, never Vercel), so the admin write paths are HTTP-testable on 3013 —
  // slice 2's requirement — while a real signed-in non-admin still gets 403 below.
  if (!user && isLocalDevBypass()) {
    return { user: localDevAdminUser() };
  }

  if (!user) {
    return {
      error: NextResponse.json({ error: 'Unauthorized' }, { status: 401 }),
    };
  }

  if (!isAdminEmail(user.email)) {
    return {
      error: NextResponse.json({ error: 'Forbidden' }, { status: 403 }),
    };
  }

  return { user };
}

export async function requireAdminPage(pathname: string, fallback = '/home'): Promise<User> {
  const supabase = await createSupabaseServer();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  // A real session always wins. The bypass only covers the no-session case, so signing in as a
  // NON-admin in local dev still redirects to the fallback rather than being silently upgraded.
  if (!user && isLocalDevBypass()) {
    return localDevAdminUser();
  }

  if (!user) {
    redirect(`/login?next=${encodeURIComponent(pathname)}`);
  }

  if (!isAdminEmail(user.email)) {
    redirect(fallback);
  }

  return user;
}
