import { revalidateTag } from 'next/cache';
import { NextResponse } from 'next/server';
import { getActFunderIntelligence } from '@/lib/services/act-funder-intelligence';
import { funderOutcomeEffect, isActFunderOutcome } from '@/lib/services/act-funder-learning';
import { requireOrgAccess, requireOrgWriteAccess } from '../../_lib/auth';

type RouteContext = { params: Promise<{ orgProfileId: string }> };

export async function GET(_request: Request, context: RouteContext) {
  const { orgProfileId } = await context.params;
  const auth = await requireOrgAccess(orgProfileId);
  if (auth instanceof NextResponse) return auth;

  return NextResponse.json(await getActFunderIntelligence(orgProfileId));
}

const ENGAGEMENT_STATUSES = new Set(['researching', 'ready_to_approach', 'approached', 'meeting', 'proposal', 'parked']);

export async function PATCH(request: Request, context: RouteContext) {
  const { orgProfileId } = await context.params;
  const auth = await requireOrgWriteAccess(orgProfileId);
  if (auth instanceof NextResponse) return auth;

  const body = await request.json() as Record<string, unknown>;
  const relationshipId = typeof body.relationship_id === 'string' ? body.relationship_id.trim() : '';
  const projectId = typeof body.project_id === 'string' ? body.project_id.trim() : '';
  const foundationName = typeof body.foundation_name === 'string' ? body.foundation_name.trim().slice(0, 240) : 'Foundation';
  const engagementStatus = typeof body.engagement_status === 'string' ? body.engagement_status.trim() : '';
  const nextStep = typeof body.next_step === 'string' ? body.next_step.trim().slice(0, 600) : '';
  const nextTouchAt = typeof body.next_touch_at === 'string' ? body.next_touch_at.trim() : '';

  if (!relationshipId || !projectId || !nextStep) {
    return NextResponse.json({ error: 'relationship_id, project_id, and next_step are required' }, { status: 400 });
  }
  if (!ENGAGEMENT_STATUSES.has(engagementStatus)) {
    return NextResponse.json({ error: 'A valid relationship state is required' }, { status: 400 });
  }
  if (nextTouchAt && Number.isNaN(Date.parse(nextTouchAt))) {
    return NextResponse.json({ error: 'Follow-up date is invalid' }, { status: 400 });
  }

  const now = new Date().toISOString();
  const { data, error } = await auth.serviceDb
    .from('org_project_foundations')
    .update({
      engagement_status: engagementStatus,
      engagement_updated_at: now,
      next_step: nextStep,
      next_touch_at: nextTouchAt || null,
      updated_at: now,
    })
    .eq('id', relationshipId)
    .eq('org_project_id', projectId)
    .eq('org_profile_id', orgProfileId)
    .select('id, org_project_id, foundation_id, engagement_status, next_step, next_touch_at')
    .single();

  if (error || !data) {
    return NextResponse.json({ error: error?.message || 'Foundation relationship not found' }, { status: 404 });
  }

  const { error: memoryError } = await auth.serviceDb
    .from('opportunity_context_events')
    .upsert({
      org_profile_id: orgProfileId,
      source_system: 'civicgraph',
      source_type: 'funder_relationship',
      source_ref: `funder-next-move:${relationshipId}`,
      title: `${foundationName}: next move`,
      summary: nextStep,
      organisation: foundationName,
      lane: 'foundation',
      signal_kind: 'funder_next_move',
      confidence: 1,
      happened_at: now,
      metadata: {
        relationship_id: relationshipId,
        project_id: projectId,
        foundation_id: data.foundation_id,
        engagement_status: engagementStatus,
        next_touch_at: nextTouchAt || null,
        recorded_by: auth.userId,
      },
      updated_at: now,
    }, { onConflict: 'org_profile_id,source_system,source_ref,signal_kind' });

  revalidateTag('act-funder-intelligence');
  return NextResponse.json({ ...data, context_memory_recorded: !memoryError, context_memory_warning: memoryError?.message ?? null });
}

export async function POST(request: Request, context: RouteContext) {
  const { orgProfileId } = await context.params;
  const auth = await requireOrgWriteAccess(orgProfileId);
  if (auth instanceof NextResponse) return auth;

  const body = await request.json() as Record<string, unknown>;
  const relationshipId = typeof body.relationship_id === 'string' ? body.relationship_id.trim() : '';
  const projectId = typeof body.project_id === 'string' ? body.project_id.trim() : '';
  const foundationName = typeof body.foundation_name === 'string' ? body.foundation_name.trim().slice(0, 240) : 'Foundation';
  const outcome = body.outcome;
  const summary = typeof body.summary === 'string' ? body.summary.trim().slice(0, 1_200) : '';
  const nextStep = typeof body.next_step === 'string' ? body.next_step.trim().slice(0, 600) : '';
  const nextTouchAt = typeof body.next_touch_at === 'string' ? body.next_touch_at.trim() : '';
  const happenedAt = typeof body.happened_at === 'string' && !Number.isNaN(Date.parse(body.happened_at))
    ? new Date(body.happened_at).toISOString()
    : new Date().toISOString();

  if (!relationshipId || !projectId || !summary || !isActFunderOutcome(outcome)) {
    return NextResponse.json({ error: 'relationship_id, project_id, outcome, and summary are required' }, { status: 400 });
  }
  if (nextTouchAt && Number.isNaN(Date.parse(nextTouchAt))) {
    return NextResponse.json({ error: 'Follow-up date is invalid' }, { status: 400 });
  }

  const { data: relationship, error: relationshipError } = await auth.serviceDb
    .from('org_project_foundations')
    .select('id, foundation_id')
    .eq('id', relationshipId)
    .eq('org_project_id', projectId)
    .eq('org_profile_id', orgProfileId)
    .single();
  if (relationshipError || !relationship) {
    return NextResponse.json({ error: relationshipError?.message || 'Foundation relationship not found' }, { status: 404 });
  }

  const effect = funderOutcomeEffect(outcome);
  const { data: interaction, error: interactionError } = await auth.serviceDb
    .from('org_project_foundation_interactions')
    .insert({
      org_profile_id: orgProfileId,
      org_project_id: projectId,
      org_project_foundation_id: relationshipId,
      interaction_type: effect.interactionType,
      summary,
      notes: `Outcome: ${outcome}`,
      happened_at: happenedAt,
      status_snapshot: effect.engagementStatus,
    })
    .select('id, interaction_type, summary, happened_at, status_snapshot')
    .single();
  if (interactionError || !interaction) {
    return NextResponse.json({ error: interactionError?.message || 'Could not record the funder outcome' }, { status: 500 });
  }

  const now = new Date().toISOString();
  const relationshipUpdates = {
    engagement_status: effect.engagementStatus,
    engagement_updated_at: now,
    last_interaction_at: happenedAt,
    next_step: effect.clearsNextMove ? null : nextStep || null,
    next_touch_at: effect.clearsNextMove ? null : nextTouchAt || null,
    updated_at: now,
  };
  const { error: updateError } = await auth.serviceDb
    .from('org_project_foundations')
    .update(relationshipUpdates)
    .eq('id', relationshipId)
    .eq('org_project_id', projectId)
    .eq('org_profile_id', orgProfileId);
  if (updateError) return NextResponse.json({ error: updateError.message }, { status: 500 });

  const [learningWrite, contextWrite] = await Promise.all([
    auth.serviceDb.from('opportunity_decisions').insert({
      user_id: auth.userId,
      org_profile_id: orgProfileId,
      source_type: 'funder_relationship',
      source_ref: relationship.foundation_id,
      project_code: null,
      pathway: 'foundation',
      decision: effect.learningDecision,
      reason: summary,
      notes: `${foundationName}: ${outcome}`,
      evidence_gaps: [],
      outcome: `funder_interaction:${interaction.id}:${outcome}`,
    }),
    auth.serviceDb.from('opportunity_context_events').upsert({
      org_profile_id: orgProfileId,
      source_system: 'civicgraph',
      source_type: 'funder_relationship',
      source_ref: `funder-outcome:${interaction.id}`,
      title: `${foundationName}: ${outcome.replaceAll('_', ' ')}`,
      summary,
      organisation: foundationName,
      lane: 'foundation',
      signal_kind: 'funder_outcome',
      confidence: 1,
      happened_at: happenedAt,
      metadata: {
        interaction_id: interaction.id,
        relationship_id: relationshipId,
        project_id: projectId,
        foundation_id: relationship.foundation_id,
        outcome,
        learning_decision: effect.learningDecision,
        recorded_by: auth.userId,
      },
      updated_at: now,
    }, { onConflict: 'org_profile_id,source_system,source_ref,signal_kind' }),
  ]);

  revalidateTag('act-funder-intelligence');
  return NextResponse.json({
    interaction,
    relationship: relationshipUpdates,
    learning_memory_recorded: !learningWrite.error,
    learning_memory_warning: learningWrite.error?.message ?? null,
    context_memory_recorded: !contextWrite.error,
    context_memory_warning: contextWrite.error?.message ?? null,
  }, { status: 201 });
}
