import { redirect } from 'next/navigation';
import { NextResponse } from 'next/server';
import type { User } from '@supabase/supabase-js';
import { isAdminEmail } from '@/lib/admin';
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

  if (!user) {
    redirect(`/login?next=${encodeURIComponent(pathname)}`);
  }

  if (!isAdminEmail(user.email)) {
    redirect(fallback);
  }

  return user;
}
