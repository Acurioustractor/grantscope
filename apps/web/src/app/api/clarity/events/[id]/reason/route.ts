import { NextResponse } from 'next/server';
import { requireAdminApi } from '@/lib/admin-auth';
import { getDirectServiceSupabase } from '@/lib/supabase';

export const dynamic = 'force-dynamic';

/**
 * POST /api/clarity/events/[id]/reason — the write path behind
 * [ RECORD THE REASON → ] on /clarity/changes.
 *
 * Gated with requireAdminApi rather than relying on the /clarity layout: a route
 * handler does not run through a page layout, so the gate has to be here or it
 * does not exist. requireAdminApi is deliberately NOT covered by the local-dev
 * bypass — see admin-auth-bypass.ts.
 */
export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const auth = await requireAdminApi();
  if (auth.error) return auth.error;

  const { id } = await params;
  const eventId = Number(id);
  if (!Number.isInteger(eventId) || eventId <= 0) {
    return NextResponse.json({ error: 'Bad event id' }, { status: 400 });
  }

  let reason: unknown;
  try {
    ({ reason } = (await request.json()) as { reason?: unknown });
  } catch {
    return NextResponse.json({ error: 'Body must be JSON' }, { status: 400 });
  }

  const text = typeof reason === 'string' ? reason.trim() : '';
  if (!text) {
    return NextResponse.json({ error: 'A reason cannot be blank' }, { status: 400 });
  }
  if (text.length > 500) {
    return NextResponse.json({ error: 'Keep it under 500 characters' }, { status: 400 });
  }

  const supabase = getDirectServiceSupabase();
  const { data, error } = await supabase
    .from('clarity_event')
    .update({
      reason: text,
      reason_by: auth.user.email ?? 'admin',
      reason_at: new Date().toISOString(),
    })
    .eq('id', eventId)
    .select('id,reason,reason_by,reason_at')
    .maybeSingle();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  if (!data) return NextResponse.json({ error: `No event ${eventId}` }, { status: 404 });

  return NextResponse.json(data);
}
