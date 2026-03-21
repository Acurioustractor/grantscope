import { NextRequest, NextResponse } from 'next/server';
import { createSupabaseServer } from '@/lib/supabase-server';
import { getServiceSupabase } from '@/lib/supabase';

export const dynamic = 'force-dynamic';

/** GET /api/agent/usage — usage stats for the authenticated user's keys */
export async function GET(request: NextRequest) {
  const supabase = await createSupabaseServer();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const serviceDb = getServiceSupabase();

  // Get user's org
  const { data: org } = await serviceDb
    .from('org_profiles')
    .select('id')
    .eq('user_id', user.id)
    .single();

  if (!org) {
    return NextResponse.json({ error: 'No org profile' }, { status: 404 });
  }

  // Get all key IDs for this org
  const { data: keys } = await serviceDb
    .from('api_keys')
    .select('id, name, key_prefix, total_requests, total_errors')
    .eq('org_id', org.id)
    .is('revoked_at', null);

  if (!keys || keys.length === 0) {
    return NextResponse.json({
      keys: [],
      totals: { requests: 0, errors: 0 },
      recent: [],
    });
  }

  const keyIds = keys.map(k => k.id);

  // Recent usage by day (last 30 days)
  const days = request.nextUrl.searchParams.get('days') || '30';
  const daysInt = Math.min(parseInt(days) || 30, 90);

  const { data: recent } = await serviceDb
    .from('api_usage')
    .select('action, status_code, response_ms, created_at')
    .in('key_id', keyIds)
    .gte('created_at', new Date(Date.now() - daysInt * 86400000).toISOString())
    .order('created_at', { ascending: false })
    .limit(500);

  // Aggregate by day
  const byDay = new Map<string, { requests: number; errors: number; avg_ms: number; total_ms: number }>();
  for (const row of recent || []) {
    const day = (row.created_at as string).slice(0, 10);
    const entry = byDay.get(day) || { requests: 0, errors: 0, avg_ms: 0, total_ms: 0 };
    entry.requests++;
    entry.total_ms += (row.response_ms as number) || 0;
    if ((row.status_code as number) >= 400) entry.errors++;
    entry.avg_ms = Math.round(entry.total_ms / entry.requests);
    byDay.set(day, entry);
  }

  const totals = keys.reduce((acc, k) => ({
    requests: acc.requests + (k.total_requests as number),
    errors: acc.errors + (k.total_errors as number),
  }), { requests: 0, errors: 0 });

  return NextResponse.json({
    keys: keys.map(k => ({
      id: k.id,
      name: k.name,
      prefix: k.key_prefix,
      requests: k.total_requests,
      errors: k.total_errors,
    })),
    totals,
    daily: Array.from(byDay.entries()).map(([day, stats]) => ({ day, ...stats })),
  });
}
