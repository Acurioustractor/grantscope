import { NextRequest, NextResponse } from 'next/server';
import { requireModule } from '@/lib/api-auth';
import { getServiceSupabase } from '@/lib/supabase';

export async function GET(request: NextRequest) {
  const auth = await requireModule('tracker');
  if (auth.error) return auth.error;
  const { user } = auth;

  const serviceDb = getServiceSupabase();
  const view = request.nextUrl.searchParams.get('view') || 'personal';

  if (view === 'org') {
    const { data: membership } = await serviceDb
      .from('org_members')
      .select('org_profile_id')
      .eq('user_id', user.id)
      .limit(1)
      .maybeSingle();

    if (!membership) {
      return NextResponse.json([]);
    }

    const { data, error } = await serviceDb
      .from('saved_foundations')
      .select(`
        *,
        foundation:foundations(id, name, type, total_giving_annual, thematic_focus, geographic_focus, profile_confidence, enriched_at)
      `)
      .eq('org_profile_id', membership.org_profile_id)
      .order('updated_at', { ascending: false });

    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    return NextResponse.json(data);
  }

  // Default: personal foundations (backwards compatible)
  const { data, error } = await serviceDb
    .from('saved_foundations')
    .select(`
      *,
      foundation:foundations(id, name, type, total_giving_annual, thematic_focus, geographic_focus, profile_confidence, enriched_at)
    `)
    .eq('user_id', user.id)
    .order('updated_at', { ascending: false });

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json(data);
}
