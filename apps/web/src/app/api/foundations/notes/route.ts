import { NextRequest, NextResponse } from 'next/server';
import { requireModule } from '@/lib/api-auth';
import { getServiceSupabase } from '@/lib/supabase';

/**
 * GET /api/foundations/notes?abn=xxx — list notes for a foundation
 * POST /api/foundations/notes — create note
 */

export async function GET(request: NextRequest) {
  const auth = await requireModule('tracker');
  if (auth.error) return auth.error;
  const { user } = auth;

  const abn = request.nextUrl.searchParams.get('abn');

  const db = getServiceSupabase();
  let query = db
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
  const auth = await requireModule('tracker');
  if (auth.error) return auth.error;
  const { user } = auth;

  const body = await request.json();
  const { foundation_abn, note_type, title, content, contact_name, contact_role, contact_email, next_action, next_action_date } = body;

  if (!content) return NextResponse.json({ error: 'content required' }, { status: 400 });

  const db = getServiceSupabase();
  const { data, error } = await db
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
