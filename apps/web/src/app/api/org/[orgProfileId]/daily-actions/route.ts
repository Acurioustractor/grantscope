import { NextRequest, NextResponse } from 'next/server';
import { requireOrgAccess, requireOrgWriteAccess, type OrgAuthResult } from '../../_lib/auth';
import {
  dailyActionSourceRef,
  getOrgDailyActionStates,
  isActDailyActionStatus,
  perthDayKey,
  relationshipFollowUpIdFromAction,
} from '@/lib/services/act-daily-actions';

type Params = { params: Promise<{ orgProfileId: string }> };

async function updateRelationshipFollowUp(auth: OrgAuthResult, actionId: string, status: 'planned' | 'completed'): Promise<string | null> {
  const followUpId = relationshipFollowUpIdFromAction(actionId);
  if (!followUpId) return null;
  const { data: existing, error: existingError } = await auth.serviceDb.from('opportunity_context_events')
    .select('id, metadata')
    .eq('id', followUpId)
    .eq('org_profile_id', auth.orgProfileId)
    .eq('signal_kind', 'relationship_follow_up')
    .maybeSingle();
  if (existingError || !existing) return existingError?.message || 'Relationship follow-up was not found';
  const metadata = existing.metadata && typeof existing.metadata === 'object' && !Array.isArray(existing.metadata)
    ? existing.metadata as Record<string, unknown>
    : {};
  const now = new Date().toISOString();
  const { error } = await auth.serviceDb.from('opportunity_context_events').update({
    metadata: { ...metadata, status, completed_at: status === 'completed' ? now : null, updated_by: auth.userId },
    updated_at: now,
  }).eq('id', followUpId).eq('org_profile_id', auth.orgProfileId);
  return error?.message ?? null;
}

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
  if (status === 'done') {
    const followUpError = await updateRelationshipFollowUp(auth, actionId, 'completed');
    if (followUpError) return NextResponse.json({ error: `Today was updated, but the relationship follow-up could not be completed: ${followUpError}` }, { status: 500 });
  }
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
  const followUpError = await updateRelationshipFollowUp(auth, actionId, 'planned');
  if (followUpError) return NextResponse.json({ error: `Today was cleared, but the relationship follow-up could not be reopened: ${followUpError}` }, { status: 500 });
  return NextResponse.json({ success: true });
}
