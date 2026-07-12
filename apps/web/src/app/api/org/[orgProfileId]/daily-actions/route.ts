import { NextRequest, NextResponse } from 'next/server';
import { requireOrgAccess, requireOrgWriteAccess } from '../../_lib/auth';
import {
  dailyActionSourceRef,
  getOrgDailyActionStates,
  isActDailyActionStatus,
  perthDayKey,
} from '@/lib/services/act-daily-actions';

type Params = { params: Promise<{ orgProfileId: string }> };

export async function GET(_request: NextRequest, { params }: Params) {
  const { orgProfileId } = await params;
  const auth = await requireOrgAccess(orgProfileId);
  if (auth instanceof NextResponse) return auth;
  return NextResponse.json({ day: perthDayKey(), states: await getOrgDailyActionStates(orgProfileId) });
}

export async function POST(request: NextRequest, { params }: Params) {
  const { orgProfileId } = await params;
  const auth = await requireOrgWriteAccess(orgProfileId);
  if (auth instanceof NextResponse) return auth;

  const body = await request.json() as Record<string, unknown>;
  const actionId = typeof body.action_id === 'string' ? body.action_id.trim().slice(0, 240) : '';
  const title = typeof body.title === 'string' ? body.title.trim().slice(0, 300) : '';
  const detail = typeof body.detail === 'string' ? body.detail.trim().slice(0, 800) : '';
  const href = typeof body.href === 'string' ? body.href.trim().slice(0, 800) : '';
  const status = body.status;
  if (!actionId || !title || !isActDailyActionStatus(status)) {
    return NextResponse.json({ error: 'action_id, title, and a valid status are required' }, { status: 400 });
  }

  const day = perthDayKey();
  const now = new Date().toISOString();
  const { data, error } = await auth.serviceDb
    .from('opportunity_context_events')
    .upsert({
      org_profile_id: orgProfileId,
      source_system: 'civicgraph',
      source_type: 'daily_action',
      source_ref: dailyActionSourceRef(actionId, day),
      source_thread_id: actionId,
      source_url: href || null,
      title,
      summary: detail || `Marked ${status} for today's ACT worklist.`,
      lane: 'operations',
      signal_kind: 'daily_action',
      confidence: 1,
      happened_at: now,
      metadata: { action_id: actionId, day, status, recorded_by: auth.userId },
      updated_at: now,
    }, { onConflict: 'org_profile_id,source_system,source_ref,signal_kind' })
    .select('id, source_thread_id, happened_at, metadata')
    .single();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ day, action: data });
}

export async function DELETE(request: NextRequest, { params }: Params) {
  const { orgProfileId } = await params;
  const auth = await requireOrgWriteAccess(orgProfileId);
  if (auth instanceof NextResponse) return auth;

  const body = await request.json() as Record<string, unknown>;
  const actionId = typeof body.action_id === 'string' ? body.action_id.trim().slice(0, 240) : '';
  if (!actionId) return NextResponse.json({ error: 'action_id is required' }, { status: 400 });

  const { error } = await auth.serviceDb
    .from('opportunity_context_events')
    .delete()
    .eq('org_profile_id', orgProfileId)
    .eq('source_system', 'civicgraph')
    .eq('signal_kind', 'daily_action')
    .eq('source_ref', dailyActionSourceRef(actionId));

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ success: true });
}
