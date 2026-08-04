import { NextRequest, NextResponse } from 'next/server';
import { requireOrgAccess, requireOrgWriteAccess } from '../../_lib/auth';
import {
  isActPipelineStatus,
  pipelineLearningDecision,
  pipelineStatusRequiresReason,
} from '@/lib/services/act-pipeline-learning';

type Params = { params: Promise<{ orgProfileId: string }> };

export async function GET(_req: NextRequest, { params }: Params) {
  const { orgProfileId } = await params;
  const auth = await requireOrgAccess(orgProfileId);
  if (auth instanceof NextResponse) return auth;

  const { data, error } = await auth.serviceDb
    .from('org_pipeline')
    .select('*')
    .eq('org_profile_id', orgProfileId)
    .order('created_at');

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json(data);
}

export async function POST(req: NextRequest, { params }: Params) {
  const { orgProfileId } = await params;
  const auth = await requireOrgWriteAccess(orgProfileId);
  if (auth instanceof NextResponse) return auth;

  const body = await req.json();
  const { data, error } = await auth.serviceDb
    .from('org_pipeline')
    .insert({ ...body, org_profile_id: orgProfileId })
    .select()
    .single();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json(data, { status: 201 });
}

export async function PATCH(req: NextRequest, { params }: Params) {
  const { orgProfileId } = await params;
  const auth = await requireOrgWriteAccess(orgProfileId);
  if (auth instanceof NextResponse) return auth;

  const body = await req.json() as {
    id?: unknown;
    status?: unknown;
    outcome_reason?: unknown;
    owner_name?: unknown;
    next_action?: unknown;
    next_action_at?: unknown;
  };
  const id = typeof body.id === 'string' ? body.id : null;
  const status = typeof body.status === 'string' ? body.status : null;
  const outcomeReason = typeof body.outcome_reason === 'string' ? body.outcome_reason.trim() : '';
  const hasOwnerName = Object.prototype.hasOwnProperty.call(body, 'owner_name');
  const hasNextAction = Object.prototype.hasOwnProperty.call(body, 'next_action');
  const hasNextActionAt = Object.prototype.hasOwnProperty.call(body, 'next_action_at');
  const ownerName = typeof body.owner_name === 'string' ? body.owner_name.trim().slice(0, 120) : '';
  const nextAction = typeof body.next_action === 'string' ? body.next_action.trim().slice(0, 600) : '';
  const nextActionAtValue = typeof body.next_action_at === 'string' ? body.next_action_at.trim() : '';
  if (!id) return NextResponse.json({ error: 'id is required' }, { status: 400 });
  if (status && !isActPipelineStatus(status)) {
    return NextResponse.json({ error: 'A valid status is required' }, { status: 400 });
  }
  if (!status && !hasOwnerName && !hasNextAction && !hasNextActionAt) {
    return NextResponse.json({ error: 'No pipeline changes were provided' }, { status: 400 });
  }
  if (status && pipelineStatusRequiresReason(status) && !outcomeReason) {
    return NextResponse.json({ error: 'Record the main outcome factor before closing this item' }, { status: 400 });
  }
  if (hasNextActionAt && nextActionAtValue && Number.isNaN(Date.parse(nextActionAtValue))) {
    return NextResponse.json({ error: 'Next action date is invalid' }, { status: 400 });
  }

  const { data: existing, error: existingError } = await auth.serviceDb
    .from('org_pipeline')
    .select('id, grant_opportunity_id, source_type, source_ref, pathway, project_code, funder_type')
    .eq('id', id)
    .eq('org_profile_id', orgProfileId)
    .single();

  if (existingError || !existing) {
    return NextResponse.json({ error: existingError?.message ?? 'Pipeline item not found' }, { status: 404 });
  }

  const updates: Record<string, string | null> = { updated_at: new Date().toISOString() };
  if (status) updates.status = status;
  if (hasOwnerName) updates.owner_name = ownerName || null;
  if (hasNextAction) updates.next_action = nextAction || null;
  if (hasNextActionAt) updates.next_action_at = nextActionAtValue ? new Date(nextActionAtValue).toISOString() : null;

  const { data, error } = await auth.serviceDb
    .from('org_pipeline')
    .update(updates)
    .eq('id', id)
    .eq('org_profile_id', orgProfileId)
    .select()
    .single();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  const learningDecision = status ? pipelineLearningDecision(status, existing.pathway) : null;
  let learningMemoryRecorded = false;
  let learningMemoryWarning: string | null = null;

  if (learningDecision) {
    const sourceType = existing.source_type || (existing.grant_opportunity_id ? 'grant' : 'pipeline');
    const sourceRef = existing.source_ref || existing.grant_opportunity_id || existing.id;
    const pathway = existing.pathway || (existing.funder_type === 'foundation' ? 'foundation' : 'grant');
    const outcomeKey = `org_pipeline:${existing.id}:${status}`;
    const { data: priorMemory } = await auth.serviceDb
      .from('opportunity_decisions')
      .select('id')
      .eq('org_profile_id', orgProfileId)
      .eq('outcome', outcomeKey)
      .limit(1)
      .maybeSingle();

    if (priorMemory?.id) {
      learningMemoryRecorded = true;
    } else {
      const { error: memoryError } = await auth.serviceDb.from('opportunity_decisions').insert({
        user_id: auth.userId,
        org_profile_id: orgProfileId,
        source_type: sourceType,
        source_ref: String(sourceRef),
        project_code: existing.project_code,
        pathway,
        decision: learningDecision,
        reason: outcomeReason || `Pipeline moved to ${status}`,
        notes: `ACT pipeline status: ${status}`,
        evidence_gaps: [],
        outcome: outcomeKey,
      });
      learningMemoryRecorded = !memoryError;
      learningMemoryWarning = memoryError?.message ?? null;
    }
  }

  return NextResponse.json({
    ...data,
    learning_memory_recorded: learningMemoryRecorded,
    learning_memory_warning: learningMemoryWarning,
  });
}

export async function DELETE(req: NextRequest, { params }: Params) {
  const { orgProfileId } = await params;
  const auth = await requireOrgWriteAccess(orgProfileId);
  if (auth instanceof NextResponse) return auth;

  const { id } = await req.json();
  if (!id) return NextResponse.json({ error: 'id is required' }, { status: 400 });

  const { error } = await auth.serviceDb
    .from('org_pipeline')
    .delete()
    .eq('id', id)
    .eq('org_profile_id', orgProfileId);

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ success: true });
}
