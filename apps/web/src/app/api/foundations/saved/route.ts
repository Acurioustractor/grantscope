import { NextResponse } from 'next/server';
import { createSupabaseServer } from '@/lib/supabase-server';
import { getServiceSupabase } from '@/lib/supabase';

export async function GET() {
  const supabase = await createSupabaseServer();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const serviceDb = getServiceSupabase();
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
