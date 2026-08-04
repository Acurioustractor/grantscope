import { NextRequest, NextResponse } from 'next/server';
import { requireOrgAccess, requireOrgWriteAccess, type OrgAuthResult } from '../../_lib/auth';
import {
  buildDecisionOutcomeMetadata,
  dailyActionSourceRef,
  decisionOutcomeSourceRef,
  getOrgDailyActionStates,
  isActDailyActionStatus,
  perthDayKey,
  relationshipFollowUpIdFromAction,
} from '@/lib/services/act-daily-actions';

type Params = { params: Promise<{ orgProfileId: string }> };

interface LinkedOpportunityDecision {
  id: string;
  decision: string;
  reason: string | null;
  evidence_gaps: string[] | null;
  judgment: unknown;
}

function plainText(value: unknown): string | null {
  return typeof value === 'string' && value.trim() ? value.trim() : null;
}

function objectValue(value: unknown): Record<string, unknown> | null {
  return value && typeof value === 'object' && !Array.isArray(value)
    ? value as Record<string, unknown>
    : null;
}

function optionalText(body: Record<string, unknown>, key: string, limit = 800): string | null {
  return plainText(body[key])?.slice(0, limit) ?? null;
}

function judgmentPromiseOrReturn(judgment: Record<string, unknown>): string | null {
  const commitment = objectValue(judgment.commitment);
  if (!commitment) return null;
  const detail = plainText(commitment.action);
  if (!detail) return null;
  const owner = plainText(commitment.owner);
  const kind = plainText(commitment.kind) === 'return' ? 'Return' : 'Promise';
  return owner ? `${kind} — ${owner}: ${detail}` : `${kind} — ${detail}`;
}

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
  const decisionId = optionalText(body, 'decision_id', 100);
  const status = body.status;
  if (!actionId || !title || !isActDailyActionStatus(status)) {
    return NextResponse.json({ error: 'action_id, title, and a valid status are required' }, { status: 400 });
  }

  const day = perthDayKey();
  const now = new Date().toISOString();
  let linkedDecision: LinkedOpportunityDecision | null = null;

  if (status === 'done' && decisionId) {
    const { data: decision, error: decisionError } = await auth.serviceDb
      .from('opportunity_decisions')
      .select('id, decision, reason, evidence_gaps, judgment')
      .eq('id', decisionId)
      .eq('org_profile_id', orgProfileId)
      .maybeSingle();
    if (decisionError) return NextResponse.json({ error: decisionError.message }, { status: 500 });
    if (!decision) {
      return NextResponse.json({ error: 'The linked decision was not found for this organisation' }, { status: 400 });
    }
    linkedDecision = decision as LinkedOpportunityDecision;
  }

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

  let decisionOutcome = null;
  if (status === 'done' && linkedDecision) {
    const judgment = objectValue(linkedDecision.judgment) ?? {};
    const metadata = buildDecisionOutcomeMetadata({
      actionId,
      day,
      decision: linkedDecision.decision,
      decisionReason: plainText(judgment.whatChanged) ?? linkedDecision.reason,
      decisionEvidenceGaps: linkedDecision.evidence_gaps ?? [],
      whatHappened: optionalText(body, 'what_happened'),
      promiseOrReturn: optionalText(body, 'promise_or_return') ?? judgmentPromiseOrReturn(judgment),
      nextQuestion: optionalText(body, 'next_question') ?? plainText(judgment.nextLearningQuestion),
      recordedBy: auth.userId,
    });
    const { data: outcome, error: outcomeError } = await auth.serviceDb
      .from('opportunity_context_events')
      .upsert({
        org_profile_id: orgProfileId,
        decision_id: linkedDecision.id,
        source_system: 'civicgraph',
        source_type: 'daily_action',
        source_ref: decisionOutcomeSourceRef(linkedDecision.id, actionId, day),
        source_thread_id: actionId,
        source_url: href || null,
        title: `Outcome · ${title}`,
        summary: String(metadata.what_happened),
        lane: 'operations',
        signal_kind: 'decision_outcome',
        confidence: 1,
        happened_at: now,
        metadata,
        updated_at: now,
      }, {
        onConflict: 'org_profile_id,source_system,source_ref,signal_kind',
        ignoreDuplicates: true,
      })
      .select('id, decision_id, source_thread_id, happened_at, metadata')
      .maybeSingle();
    if (outcomeError) {
      return NextResponse.json({
        error: `Today was updated, but the decision outcome could not be appended: ${outcomeError.message}`,
      }, { status: 500 });
    }
    decisionOutcome = outcome;
  }

  return NextResponse.json({ day, action: data, outcome: decisionOutcome });
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
