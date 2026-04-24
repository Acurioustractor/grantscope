import { NextRequest, NextResponse } from 'next/server';
import { requireAdminApi } from '@/lib/admin-auth';
import { getServiceSupabase } from '@/lib/supabase';

export const dynamic = 'force-dynamic';

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ agentId: string }> }
) {
  const auth = await requireAdminApi();
  if (auth.error) return auth.error;
  const { user } = auth;

  const { agentId } = await params;
  const body = await request.json().catch(() => null);
  const rawCursor = body?.cursor;

  if (!Number.isInteger(rawCursor) || rawCursor < 0) {
    return NextResponse.json({ error: 'Cursor must be a non-negative integer' }, { status: 400 });
  }

  const svc = getServiceSupabase();
  const { data: runtimeState, error: fetchError } = await svc
    .from('agent_runtime_state')
    .select('agent_id, state')
    .eq('agent_id', agentId)
    .maybeSingle();

  if (fetchError) {
    return NextResponse.json({ error: fetchError.message }, { status: 500 });
  }

  if (!runtimeState?.state || typeof runtimeState.state !== 'object') {
    return NextResponse.json({ error: 'Runtime sweep state not found' }, { status: 404 });
  }

  const state = runtimeState.state as Record<string, unknown>;
  const candidateCount = Number(state.fullSweepCandidateCount || 0);
  if (!Number.isInteger(candidateCount) || candidateCount <= 0) {
    return NextResponse.json({ error: 'Sweep candidate count is not available' }, { status: 400 });
  }

  if (rawCursor >= candidateCount) {
    return NextResponse.json(
      { error: `Cursor must be between 0 and ${candidateCount - 1}` },
      { status: 400 }
    );
  }

  const nextState = {
    ...state,
    fullSweepCursor: rawCursor,
    fullSweepCursorManuallySetAt: new Date().toISOString(),
    fullSweepCursorManuallySetBy: user.email || user.id,
  };

  const { data: updatedState, error: updateError } = await svc
    .from('agent_runtime_state')
    .update({
      state: nextState,
      updated_at: new Date().toISOString(),
    })
    .eq('agent_id', agentId)
    .select('agent_id, state')
    .single();

  if (updateError) {
    return NextResponse.json({ error: updateError.message }, { status: 500 });
  }

  return NextResponse.json({ runtimeSweep: updatedState });
}
