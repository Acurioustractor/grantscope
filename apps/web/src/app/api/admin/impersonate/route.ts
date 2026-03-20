import { NextRequest, NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import { createSupabaseServer } from '@/lib/supabase-server';
import { isAdminEmail } from '@/lib/admin';
import { getServiceSupabase } from '@/lib/supabase';

export const dynamic = 'force-dynamic';

const COOKIE_NAME = 'cg_impersonate_org';

/**
 * POST /api/admin/impersonate
 * Body: { slug: string } — set impersonation
 * Body: { clear: true } — clear impersonation
 *
 * Admin-only. Sets a cookie that overrides the active org context.
 */
export async function POST(request: NextRequest) {
  const supabase = await createSupabaseServer();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user || !isAdminEmail(user.email)) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 403 });
  }

  const body = await request.json();
  const cookieStore = await cookies();

  if (body.clear) {
    cookieStore.delete(COOKIE_NAME);
    return NextResponse.json({ ok: true, impersonating: null });
  }

  const slug = body.slug;
  if (!slug || typeof slug !== 'string') {
    return NextResponse.json({ error: 'slug required' }, { status: 400 });
  }

  // Verify the org exists
  const db = getServiceSupabase();
  const { data: org } = await db
    .from('org_profiles')
    .select('id, name, slug, subscription_plan')
    .eq('slug', slug)
    .maybeSingle();

  if (!org) {
    return NextResponse.json({ error: 'Org not found' }, { status: 404 });
  }

  cookieStore.set(COOKIE_NAME, slug, {
    path: '/',
    httpOnly: true,
    sameSite: 'lax',
    maxAge: 60 * 60 * 4, // 4 hours
  });

  return NextResponse.json({ ok: true, impersonating: org });
}
