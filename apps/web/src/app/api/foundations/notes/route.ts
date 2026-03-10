import { NextRequest, NextResponse } from 'next/server';
import { createSupabaseServer } from '@/lib/supabase-server';

/**
 * GET /api/foundations/notes?abn=xxx — list notes for a foundation
 * POST /api/foundations/notes — create note
 */

export async function GET(request: NextRequest) {
  const supabase = await createSupabaseServer();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: 'Auth required' }, { status: 401 });

  const abn = request.nextUrl.searchParams.get('abn');

  let query = supabase
    .from('foundation_notes')
    .select('*')
    .eq('user_id', user.id)
    .order('created_at', { ascending: false });

  if (abn) query = query.eq('foundation_abn', abn);

  const { data, error } = await query;
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ notes: data });
}

export async function POST(request: NextRequest) {
  const supabase = await createSupabaseServer();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: 'Auth required' }, { status: 401 });

  const body = await request.json();
  const { foundation_abn, note_type, title, content, contact_name, contact_role, contact_email, next_action, next_action_date } = body;

  if (!content) return NextResponse.json({ error: 'content required' }, { status: 400 });

  const { data, error } = await supabase
    .from('foundation_notes')
    .insert({
      user_id: user.id,
      foundation_abn,
      note_type: note_type || 'note',
      title,
      content,
      contact_name,
      contact_role,
      contact_email,
      next_action,
      next_action_date,
    })
    .select()
    .single();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ note: data }, { status: 201 });
}
