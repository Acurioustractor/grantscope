import { NextRequest, NextResponse } from 'next/server';
import { createSupabaseServer } from '@/lib/supabase-server';

/**
 * PATCH /api/alerts/[id] — update alert
 * DELETE /api/alerts/[id] — delete alert
 */

export async function PATCH(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const supabase = await createSupabaseServer();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: 'Auth required' }, { status: 401 });

  const { id } = await params;
  const body = await request.json();

  const { data, error } = await supabase
    .from('alert_preferences')
    .update({ ...body, updated_at: new Date().toISOString() })
    .eq('id', id)
    .eq('user_id', user.id)
    .select()
    .single();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ alert: data });
}

export async function DELETE(_request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const supabase = await createSupabaseServer();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: 'Auth required' }, { status: 401 });

  const { id } = await params;
  const { error } = await supabase
    .from('alert_preferences')
    .delete()
    .eq('id', id)
    .eq('user_id', user.id);

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ deleted: true });
}
