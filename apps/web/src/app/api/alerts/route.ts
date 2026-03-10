import { NextRequest, NextResponse } from 'next/server';
import { createSupabaseServer } from '@/lib/supabase-server';

/**
 * GET /api/alerts — list user's alert preferences
 * POST /api/alerts — create new alert
 */

export async function GET() {
  const supabase = await createSupabaseServer();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: 'Auth required' }, { status: 401 });

  const { data, error } = await supabase
    .from('alert_preferences')
    .select('*')
    .eq('user_id', user.id)
    .order('created_at', { ascending: false });

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ alerts: data });
}

export async function POST(request: NextRequest) {
  const supabase = await createSupabaseServer();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: 'Auth required' }, { status: 401 });

  const body = await request.json();
  const { name, frequency, categories, focus_areas, states, min_amount, max_amount, keywords, entity_types } = body;

  const { data, error } = await supabase
    .from('alert_preferences')
    .insert({
      user_id: user.id,
      name: name || 'My Alert',
      frequency: frequency || 'weekly',
      categories: categories || [],
      focus_areas: focus_areas || [],
      states: states || [],
      min_amount: min_amount || null,
      max_amount: max_amount || null,
      keywords: keywords || [],
      entity_types: entity_types || [],
    })
    .select()
    .single();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ alert: data }, { status: 201 });
}
