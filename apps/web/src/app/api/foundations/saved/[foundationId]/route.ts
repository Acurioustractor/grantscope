import { NextRequest, NextResponse } from 'next/server';
import { createSupabaseServer } from '@/lib/supabase-server';
import { getServiceSupabase } from '@/lib/supabase';

type RouteContext = { params: Promise<{ foundationId: string }> };

export async function PUT(request: NextRequest, context: RouteContext) {
  const supabase = await createSupabaseServer();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const { foundationId } = await context.params;
  const body = await request.json();
  const { stars, stage, notes, last_contact_date } = body;

  const serviceDb = getServiceSupabase();
  const { data, error } = await serviceDb
    .from('saved_foundations')
    .upsert(
      {
        user_id: user.id,
        foundation_id: foundationId,
        ...(stars !== undefined && { stars }),
        ...(stage !== undefined && { stage }),
        ...(notes !== undefined && { notes }),
        ...(last_contact_date !== undefined && { last_contact_date }),
        updated_at: new Date().toISOString(),
      },
      { onConflict: 'user_id,foundation_id' }
    )
    .select()
    .single();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json(data);
}

export async function DELETE(_request: NextRequest, context: RouteContext) {
  const supabase = await createSupabaseServer();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const { foundationId } = await context.params;

  const serviceDb = getServiceSupabase();
  const { error } = await serviceDb
    .from('saved_foundations')
    .delete()
    .eq('user_id', user.id)
    .eq('foundation_id', foundationId);

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ ok: true });
}
