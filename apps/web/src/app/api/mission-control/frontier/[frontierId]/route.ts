import { NextRequest, NextResponse } from 'next/server';
import { requireAdminApi } from '@/lib/admin-auth';
import { getServiceSupabase } from '@/lib/supabase';

export const dynamic = 'force-dynamic';

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ frontierId: string }> }
) {
  const auth = await requireAdminApi();
  if (auth.error) return auth.error;
  const { user } = auth;

  const { frontierId } = await params;
  const body = await request.json().catch(() => null);

  if (body?.action !== 'reenable') {
    return NextResponse.json({ error: 'Unsupported action' }, { status: 400 });
  }

  const svc = getServiceSupabase();
  const { data: frontierRow, error: fetchError } = await svc
    .from('source_frontier')
    .select('id, metadata')
    .eq('id', frontierId)
    .maybeSingle();

  if (fetchError) {
    return NextResponse.json({ error: fetchError.message }, { status: 500 });
  }

  if (!frontierRow) {
    return NextResponse.json({ error: 'Frontier row not found' }, { status: 404 });
  }

  const checkedAt = new Date().toISOString();
  const metadata = {
    ...(frontierRow.metadata || {}),
    auto_disabled_reason: null,
    auto_disabled_at: null,
    auto_disabled_status: null,
    auto_disabled_failure_count: null,
    manually_reenabled_at: checkedAt,
    manually_reenabled_by: user.email || user.id,
  };

  const { data: updatedRow, error: updateError } = await svc
    .from('source_frontier')
    .update({
      enabled: true,
      failure_count: 0,
      last_http_status: null,
      last_error: null,
      next_check_at: checkedAt,
      metadata,
      updated_at: checkedAt,
    })
    .eq('id', frontierId)
    .select('id, enabled, next_check_at, metadata')
    .single();

  if (updateError) {
    return NextResponse.json({ error: updateError.message }, { status: 500 });
  }

  return NextResponse.json({ frontier: updatedRow });
}
