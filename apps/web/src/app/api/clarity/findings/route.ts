import { NextResponse } from 'next/server';
import { requireAdminApi } from '@/lib/admin-auth';
import { getDirectServiceSupabase } from '@/lib/supabase';

export const dynamic = 'force-dynamic';

/**
 * POST /api/clarity/findings — adjudicate a finding, or re-run the detectors.
 *
 * { action: 'verdict', id, verdict: 'confirmed' | 'dismissed', reason? }
 * { action: 'run' }
 *
 * A machine-proposed finding never counts as true until a human confirms it here. Verdicts are
 * recorded with who and when, same mechanism as clarity_object adjudication.
 */
export async function POST(request: Request) {
  const auth = await requireAdminApi();
  if (auth.error) return auth.error;

  let body: {
    action?: unknown;
    id?: unknown;
    verdict?: unknown;
    reason?: unknown;
  };
  try {
    body = (await request.json()) as typeof body;
  } catch {
    return NextResponse.json({ error: 'invalid JSON body' }, { status: 400 });
  }

  const supabase = getDirectServiceSupabase();

  if (body.action === 'run') {
    const { data, error } = await supabase.rpc('clarity_run_detectors');
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    return NextResponse.json({ ok: true, counts: data });
  }

  if (body.action === 'verdict') {
    if (typeof body.id !== 'number' || !Number.isInteger(body.id)) {
      return NextResponse.json({ error: 'id must be an integer' }, { status: 400 });
    }
    if (body.verdict !== 'confirmed' && body.verdict !== 'dismissed') {
      return NextResponse.json({ error: 'verdict must be confirmed or dismissed' }, { status: 400 });
    }
    const reason = typeof body.reason === 'string' && body.reason.trim() ? body.reason.trim() : null;
    const { data, error } = await supabase
      .from('clarity_finding')
      .update({
        verdict: body.verdict,
        verdict_by: auth.user.email ?? 'admin',
        verdict_at: new Date().toISOString(),
        verdict_reason: reason,
      })
      .eq('id', body.id)
      .select('id')
      .limit(1);
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    if (!data?.length) return NextResponse.json({ error: 'no such finding' }, { status: 404 });
    return NextResponse.json({ ok: true });
  }

  return NextResponse.json({ error: 'unknown action' }, { status: 400 });
}
