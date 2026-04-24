import { NextRequest, NextResponse } from 'next/server';
import { requireAdminApi } from '@/lib/admin-auth';
import { getServiceSupabase } from '@/lib/supabase';

export const dynamic = 'force-dynamic';

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const auth = await requireAdminApi();
  if (auth.error) return auth.error;

  const { id } = await params;
  const body = await request.json();
  const { action } = body;

  if (!action || !['dismiss', 'review'].includes(action)) {
    return NextResponse.json({ error: 'Invalid action. Use "dismiss" or "review".' }, { status: 400 });
  }

  const svc = getServiceSupabase();
  const update = action === 'dismiss'
    ? { dismissed: true, reviewed_at: new Date().toISOString() }
    : { reviewed_at: new Date().toISOString() };

  const { error } = await svc
    .from('discoveries')
    .update(update)
    .eq('id', id);

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  return NextResponse.json({ ok: true });
}
