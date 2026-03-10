import { NextRequest, NextResponse } from 'next/server';
import { createSupabaseServer } from '@/lib/supabase-server';
import { getServiceSupabase } from '@/lib/supabase';

/**
 * GET /api/alerts/matches?alertId=<id>
 * Returns grant_opportunities matching an alert's criteria.
 */
export async function GET(request: NextRequest) {
  const supabase = await createSupabaseServer();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: 'Auth required' }, { status: 401 });

  const alertId = request.nextUrl.searchParams.get('alertId');
  if (!alertId) return NextResponse.json({ error: 'alertId required' }, { status: 400 });

  const db = getServiceSupabase();

  // Fetch the alert (verify ownership)
  const { data: alert, error: alertErr } = await db
    .from('alert_preferences')
    .select('*')
    .eq('id', alertId)
    .eq('user_id', user.id)
    .single();

  if (alertErr || !alert) {
    return NextResponse.json({ error: 'Alert not found' }, { status: 404 });
  }

  // Build query for matching grants
  let query = db
    .from('grant_opportunities')
    .select('id, name, provider, amount_min, amount_max, closes_at, categories, url')
    .gt('closes_at', new Date().toISOString())
    .order('closes_at', { ascending: true })
    .limit(10);

  // Category overlap filter
  if (alert.categories && alert.categories.length > 0) {
    query = query.overlaps('categories', alert.categories);
  }

  // Amount range filters
  if (alert.min_amount) {
    query = query.gte('amount_max', alert.min_amount);
  }
  if (alert.max_amount) {
    query = query.lte('amount_min', alert.max_amount);
  }

  // Keyword filter — match any keyword in name
  if (alert.keywords && alert.keywords.length > 0) {
    const keywordFilter = alert.keywords.map((k: string) => `name.ilike.%${k}%`).join(',');
    query = query.or(keywordFilter);
  }

  const { data: grants, error } = await query;
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  return NextResponse.json({ grants: grants || [] });
}
