import { NextRequest, NextResponse } from 'next/server';
import { createSupabaseServer } from '@/lib/supabase-server';
import { getServiceSupabase } from '@/lib/supabase';

export async function GET(request: NextRequest) {
  const supabase = await createSupabaseServer();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const serviceDb = getServiceSupabase();
  const view = request.nextUrl.searchParams.get('view') || 'personal';

  if (view === 'org') {
    // Get user's org membership
    const { data: membership } = await serviceDb
      .from('org_members')
      .select('org_profile_id')
      .eq('user_id', user.id)
      .limit(1)
      .maybeSingle();

    if (!membership) {
      return NextResponse.json([]);
    }

    // Fetch org-shared grants
    const { data, error } = await serviceDb
      .from('saved_grants')
      .select(`
        *,
        grant:grant_opportunities(id, name, provider, amount_min, amount_max, closes_at, categories, url, application_status)
      `)
      .eq('org_profile_id', membership.org_profile_id)
      .order('updated_at', { ascending: false });

    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    return NextResponse.json(data);
  }

  // Default: personal grants (backwards compatible)
  const { data, error } = await serviceDb
    .from('saved_grants')
    .select(`
      *,
      grant:grant_opportunities(id, name, provider, amount_min, amount_max, closes_at, categories, url, application_status)
    `)
    .eq('user_id', user.id)
    .order('updated_at', { ascending: false });

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json(data);
}
