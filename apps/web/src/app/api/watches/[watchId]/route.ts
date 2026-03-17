import { NextRequest, NextResponse } from 'next/server';
import { requireModule } from '@/lib/api-auth';
import { getServiceSupabase } from '@/lib/supabase';

type Params = { params: Promise<{ watchId: string }> };

/** DELETE /api/watches/[watchId] — remove entity watch */
export async function DELETE(_req: NextRequest, { params }: Params) {
  const auth = await requireModule('tracker');
  if (auth.error) return auth.error;
  const { user } = auth;

  const { watchId } = await params;
  const db = getServiceSupabase();

  const { error } = await db
    .from('entity_watches')
    .delete()
    .eq('id', watchId)
    .eq('user_id', user.id);

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ ok: true });
}
