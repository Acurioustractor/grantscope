import { NextRequest, NextResponse } from 'next/server';
import { requireModule } from '@/lib/api-auth';
import { getServiceSupabase } from '@/lib/supabase';

/**
 * PATCH /api/alerts/[id] — update alert
 * DELETE /api/alerts/[id] — delete alert
 */

export async function PATCH(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const auth = await requireModule('tracker');
  if (auth.error) return auth.error;
  const { user } = auth;

  const { id } = await params;
  const body = await request.json();

  const db = getServiceSupabase();
  const { data, error } = await db
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
  const auth = await requireModule('tracker');
  if (auth.error) return auth.error;
  const { user } = auth;

  const { id } = await params;
  const db = getServiceSupabase();
  const { error } = await db
    .from('alert_preferences')
    .delete()
    .eq('id', id)
    .eq('user_id', user.id);

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ deleted: true });
}
