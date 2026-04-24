import { NextRequest, NextResponse } from 'next/server';
import { requireAuth } from '@/lib/api-auth';
import { createOpportunity, getPipelines, updateOpportunity, upsertContact } from '@/lib/ghl';
import { getServiceSupabase } from '@/lib/supabase';

type TargetType = 'buyer' | 'capital' | 'partner';

interface PushTargetInput {
  key?: string | null;
  type: TargetType;
  name?: string | null;
  company?: string | null;
  provider?: string | null;
  community?: string | null;
  state?: string | null;
  reason?: string | null;
  score?: number | null;
  nextAction?: string | null;
  recommendedAsk?: string | null;
  targetSummary?: string | null;
  contactSurface?: string | null;
  relationshipStatus?: string | null;
  link?: string | null;
  source?: string | null;
  tags?: string[] | null;
}

interface PushBody {
  dryRun?: boolean;
  maxTargets?: number;
  targets?: PushTargetInput[];
  ownerMode?: 'unassigned' | 'default-owner';
  relationshipMode?: 'preserve' | 'advance';
}

type ExistingOpportunityRow = {
  ghl_id: string;
  ghl_stage_id: string | null;
  name: string | null;
  assigned_to: string | null;
};

function slugify(value: string): string {
  return value
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 60);
}

function toSafeTargets(body: PushBody): PushTargetInput[] {
  const list = Array.isArray(body.targets) ? body.targets : [];
  const maxTargets = Math.max(1, Math.min(body.maxTargets ?? 30, 120));
  return list
    .filter((target) => target && typeof target === 'object')
    .slice(0, maxTargets)
    .map((target) => ({
      key: typeof target.key === 'string' ? target.key.trim() : null,
      type: target.type === 'capital' || target.type === 'partner' ? target.type : 'buyer',
      name: typeof target.name === 'string' ? target.name.trim() : null,
      company: typeof target.company === 'string' ? target.company.trim() : null,
      provider: typeof target.provider === 'string' ? target.provider.trim() : null,
      community: typeof target.community === 'string' ? target.community.trim() : null,
      state: typeof target.state === 'string' ? target.state.trim() : null,
      reason: typeof target.reason === 'string' ? target.reason.trim() : null,
      score: typeof target.score === 'number' ? target.score : null,
      nextAction: typeof target.nextAction === 'string' ? target.nextAction.trim() : null,
      recommendedAsk: typeof target.recommendedAsk === 'string' ? target.recommendedAsk.trim() : null,
      targetSummary: typeof target.targetSummary === 'string' ? target.targetSummary.trim() : null,
      contactSurface: typeof target.contactSurface === 'string' ? target.contactSurface.trim() : null,
      relationshipStatus: typeof target.relationshipStatus === 'string' ? target.relationshipStatus.trim() : null,
      link: typeof target.link === 'string' ? target.link.trim() : null,
      source: typeof target.source === 'string' ? target.source.trim() : null,
      tags: Array.isArray(target.tags) ? target.tags.filter((tag) => typeof tag === 'string').slice(0, 16) : [],
    }));
}

async function resolvePipelineAndStage() {
  const explicitPipelineId = process.env.GHL_GOODS_PIPELINE_ID || null;
  const explicitStageId = process.env.GHL_GOODS_PIPELINE_STAGE_ID || null;
  const pipelinesResponse = await getPipelines();
  const pipelines = Array.isArray(pipelinesResponse?.pipelines) ? pipelinesResponse.pipelines : [];
  const selectedPipeline =
    pipelines.find((pipeline: { id: string }) => explicitPipelineId && pipeline.id === explicitPipelineId) ||
    pipelines.find((pipeline: { name?: string }) => (pipeline.name || '').toLowerCase().includes('goods')) ||
    pipelines[0] ||
    null;
  if (!selectedPipeline) {
    return { pipelineId: null, stageId: null, pipelineName: null, stages: [] as Array<{ id?: string; name?: string }> };
  }

  const stages = Array.isArray(selectedPipeline.stages) ? selectedPipeline.stages : [];
  const selectedStage =
    stages.find((stage: { id: string }) => explicitStageId && stage.id === explicitStageId) ||
    stages.find((stage: { name?: string }) => (stage.name || '').toLowerCase().includes('new')) ||
    stages[0] ||
    null;

  return {
    pipelineId: selectedPipeline.id || null,
    stageId: selectedStage?.id || null,
    pipelineName: selectedPipeline.name || null,
    stages,
  };
}

function stageKeywordsForTarget(targetType: TargetType): string[] {
  switch (targetType) {
    case 'capital':
      return ['capital', 'funder', 'grant', 'new'];
    case 'partner':
      return ['partner', 'new'];
    case 'buyer':
    default:
      return ['buyer', 'new lead', 'new', 'contacted'];
  }
}

function findStageIdByKeywords(
  stages: Array<{ id?: string; name?: string }>,
  keywords: string[],
): string | null {
  const matchedStage = stages.find((stage) => {
    const name = (stage.name || '').toLowerCase();
    return keywords.some((keyword) => name.includes(keyword));
  });
  return matchedStage?.id || null;
}

function pickStageId(
  target: PushTargetInput,
  relationshipMode: 'preserve' | 'advance',
  fallbackStageId: string | null,
  stages: Array<{ id?: string; name?: string }>,
): string | null {
  if (target.type === 'buyer' && relationshipMode === 'advance') {
    return (
      process.env.GHL_GOODS_CONTACTED_STAGE_ID ||
      findStageIdByKeywords(stages, ['contacted']) ||
      fallbackStageId
    );
  }

  const targetType = target.type;
  const explicitKey =
    targetType === 'buyer'
      ? process.env.GHL_GOODS_BUYER_STAGE_ID
      : targetType === 'capital'
        ? process.env.GHL_GOODS_CAPITAL_STAGE_ID
        : process.env.GHL_GOODS_PARTNER_STAGE_ID;
  if (explicitKey) return explicitKey;

  const keywords = stageKeywordsForTarget(targetType);
  const matchedStage = stages.find((stage) => {
    const name = (stage.name || '').toLowerCase();
    return keywords.some((keyword) => name.includes(keyword));
  });
  return matchedStage?.id || fallbackStageId;
}

function maybeField(id: string | undefined, value: string | null | undefined) {
  if (!id || !value) return null;
  return { id, value: value.slice(0, 500) };
}

function normaliseRelationshipStatus(value: string | null | undefined): string | null {
  const text = (value || '').trim().toLowerCase();
  if (!text) return null;
  if (text === 'active') return 'active';
  if (text === 'warm' || text === 'prospect' || text === 'reviewing') return 'prospect';
  if (text === 'cold' || text === 'new' || text === 'new lead') return 'lead';
  return null;
}

function deriveEngagementStatus(
  target: PushTargetInput,
  relationshipMode: 'preserve' | 'advance',
): string {
  if (relationshipMode === 'preserve') {
    const preserved = normaliseRelationshipStatus(target.relationshipStatus);
    if (preserved) return preserved;
  }
  if (target.type === 'capital') return 'prospect';
  if (target.type === 'partner') return 'prospect';
  return target.contactSurface ? 'prospect' : 'lead';
}

function buildOpportunityPrefix(targetType: TargetType, name: string): string {
  const label =
    targetType === 'buyer'
      ? '[Buyer]'
      : targetType === 'capital'
        ? '[Capital]'
        : '[Partner]';
  return `${label} ${name}`;
}

function buildOpportunityName(target: PushTargetInput, name: string): string {
  return `${buildOpportunityPrefix(target.type, name)} — ${target.recommendedAsk || target.reason || 'Goods target'}`;
}

function stageNameFromId(
  stages: Array<{ id?: string; name?: string }>,
  stageId: string | null,
): string | null {
  if (!stageId) return null;
  return stages.find((stage) => stage.id === stageId)?.name || null;
}

async function findExistingOpportunity(
  serviceDb: ReturnType<typeof getServiceSupabase>,
  pipelineId: string,
  contactId: string,
  targetType: TargetType,
  name: string,
) {
  const prefix = buildOpportunityPrefix(targetType, name);
  const { data } = await serviceDb
    .from('ghl_opportunities')
    .select('ghl_id, ghl_stage_id, name, assigned_to')
    .eq('ghl_pipeline_id', pipelineId)
    .eq('ghl_contact_id', contactId)
    .ilike('name', `${prefix}%`)
    .order('ghl_updated_at', { ascending: false, nullsFirst: false })
    .limit(1)
    .maybeSingle<ExistingOpportunityRow>();

  return data || null;
}

async function writeOpportunityShadow(params: {
  serviceDb: ReturnType<typeof getServiceSupabase>;
  ghlId: string;
  contactId: string;
  pipelineId: string;
  pipelineName: string | null;
  stageId: string | null;
  stageName: string | null;
  name: string;
  assignedTo: string | null;
  monetaryValue: number;
}) {
  const now = new Date().toISOString();
  await params.serviceDb.from('ghl_opportunities').upsert(
    {
      ghl_id: params.ghlId,
      ghl_contact_id: params.contactId,
      ghl_pipeline_id: params.pipelineId,
      ghl_stage_id: params.stageId,
      name: params.name,
      pipeline_name: params.pipelineName,
      stage_name: params.stageName,
      status: 'open',
      monetary_value: params.monetaryValue,
      assigned_to: params.assignedTo,
      ghl_updated_at: now,
      last_synced_at: now,
      updated_at: now,
    },
    { onConflict: 'ghl_id', ignoreDuplicates: false },
  );
}

function buildCustomFields(target: PushTargetInput) {
  return [
    maybeField(process.env.GHL_GOODS_TARGET_TYPE_FIELD_ID, target.type),
    maybeField(process.env.GHL_GOODS_REASON_FIELD_ID, target.reason),
    maybeField(process.env.GHL_GOODS_NEXT_ACTION_FIELD_ID, target.nextAction),
    maybeField(process.env.GHL_GOODS_ASK_FIELD_ID, target.recommendedAsk),
    maybeField(process.env.GHL_GOODS_SUMMARY_FIELD_ID, target.targetSummary),
    maybeField(process.env.GHL_GOODS_COMMUNITY_FIELD_ID, target.community),
    maybeField(process.env.GHL_GOODS_STATE_FIELD_ID, target.state),
    maybeField(process.env.GHL_GOODS_LINK_FIELD_ID, target.link),
    maybeField(process.env.GHL_GOODS_CONTACT_SURFACE_FIELD_ID, target.contactSurface),
    maybeField(process.env.GHL_GOODS_RELATIONSHIP_FIELD_ID, target.relationshipStatus),
    maybeField(process.env.GHL_GOODS_SOURCE_FIELD_ID, target.source),
    maybeField(process.env.GHL_GOODS_SCORE_FIELD_ID, target.score != null ? String(target.score) : null),
  ].filter(Boolean) as Array<{ id: string; value: string }>;
}

export async function POST(request: NextRequest) {
  const auth = await requireAuth();
  if (auth.error) return auth.error;
  const { user } = auth;

  const apiKey = process.env.GHL_API_KEY;
  const locationId = process.env.GHL_LOCATION_ID;
  if (!apiKey || !locationId) {
    return NextResponse.json(
      { error: 'GHL environment variables are missing. Set GHL_API_KEY and GHL_LOCATION_ID.' },
      { status: 500 },
    );
  }

  const body = (await request.json().catch(() => ({}))) as PushBody;
  const dryRun = !!body.dryRun;
  const targets = toSafeTargets(body);
  const ownerMode = body.ownerMode === 'default-owner' ? 'default-owner' : 'unassigned';
  const relationshipMode = body.relationshipMode === 'advance' ? 'advance' : 'preserve';
  const assignedTo = ownerMode === 'default-owner' ? process.env.GHL_GOODS_DEFAULT_ASSIGNED_TO || null : null;

  if (targets.length === 0) {
    return NextResponse.json({ error: 'No targets provided.' }, { status: 400 });
  }

  if (ownerMode === 'default-owner' && !assignedTo) {
    return NextResponse.json(
      { error: 'GHL_GOODS_DEFAULT_ASSIGNED_TO is not configured for default-owner pushes.' },
      { status: 500 },
    );
  }

  const pipeline = dryRun
    ? { pipelineId: null, stageId: null, pipelineName: null, stages: [] as Array<{ id?: string; name?: string }> }
    : await resolvePipelineAndStage();
  const results: Array<Record<string, unknown>> = [];
  const serviceDb = getServiceSupabase();
  let createdCount = 0;
  let updatedCount = 0;

  for (const target of targets) {
    const name = target.name || target.company || 'Unnamed target';
    const targetType = target.type;
    const company = target.company || target.provider || name;
    const engagementStatus = deriveEngagementStatus(target, relationshipMode);
    const emailParts = [
      slugify(name),
      target.community ? slugify(target.community) : null,
      target.state ? slugify(target.state) : null,
      targetType,
      'goods',
      'civicgraph',
    ].filter(Boolean);
    const email = `${emailParts.join('.')}@targets.goods`;
    const tags = Array.from(
      new Set([
        `goods-${targetType}`,
        target.state ? `state-${target.state.toLowerCase()}` : null,
        target.community ? `community-${slugify(target.community)}` : null,
        ...(target.tags || []),
      ].filter(Boolean) as string[]),
    );

    if (dryRun) {
      results.push({
        ok: true,
        dryRun: true,
        key: target.key,
        type: targetType,
        name,
        email,
        pipeline: pipeline.pipelineName,
        nextAction: target.nextAction,
        recommendedAsk: target.recommendedAsk,
        ownerMode,
        assignedTo,
        engagementStatus,
      });
      continue;
    }

    try {
      const stageId = pickStageId(target, relationshipMode, pipeline.stageId, pipeline.stages);
      const stageName = stageNameFromId(pipeline.stages, stageId);
      const customFields = buildCustomFields(target);
      const contact = await upsertContact({
        email,
        firstName: name,
        companyName: company,
        source: 'CivicGraph Goods Workspace',
        tags,
        customFields: customFields.length > 0 ? customFields : undefined,
        projects: ['goods-workspace'],
        engagementStatus,
        lastContactDate: new Date().toISOString(),
        website: target.link || undefined,
      });

      let opportunityId: string | null = null;
      const opportunityName = buildOpportunityName(target, name);
      let operation: 'created' | 'updated' | 'contact-only' = 'contact-only';
      if (pipeline.pipelineId && stageId) {
        const existingOpportunity = await findExistingOpportunity(
          serviceDb,
          pipeline.pipelineId,
          contact.id,
          targetType,
          name,
        );
        const monetaryValue = Math.max(0, Math.round(target.score || 0) * 1000);

        if (existingOpportunity?.ghl_id) {
          await updateOpportunity(existingOpportunity.ghl_id, {
            name: opportunityName,
            pipelineStageId: stageId,
            status: 'open',
            monetaryValue,
            assignedTo: assignedTo || existingOpportunity.assigned_to || undefined,
          });
          opportunityId = existingOpportunity.ghl_id;
          operation = 'updated';
          updatedCount += 1;
        } else {
          const opportunity = await createOpportunity({
            name: opportunityName,
            stage: 'new',
            monetaryValue,
            pipelineId: pipeline.pipelineId,
            pipelineStageId: stageId,
            contactId: contact.id,
            assignedTo: assignedTo || undefined,
          });
          opportunityId = opportunity?.opportunity?.id || null;
          operation = opportunityId ? 'created' : 'contact-only';
          if (opportunityId) createdCount += 1;
        }

        if (opportunityId) {
          await writeOpportunityShadow({
            serviceDb,
            ghlId: opportunityId,
            contactId: contact.id,
            pipelineId: pipeline.pipelineId,
            pipelineName: pipeline.pipelineName,
            stageId,
            stageName,
            name: opportunityName,
            assignedTo: assignedTo || existingOpportunity?.assigned_to || null,
            monetaryValue,
          });
        }
      }

      results.push({
        ok: true,
        key: target.key,
        type: targetType,
        name,
        contactId: contact.id,
        opportunityId,
        stageId,
        stageName,
        operation,
        ownerMode,
        assignedTo,
        engagementStatus,
      });
    } catch (error) {
      results.push({
        ok: false,
        key: target.key,
        type: targetType,
        name,
        error: error instanceof Error ? error.message : 'Unknown push error',
        ownerMode,
      });
    }
  }

  const succeeded = results.filter((result) => result.ok).length;
  const failed = results.length - succeeded;

  await serviceDb.from('ghl_sync_log').insert({
    operation: 'GoodsWorkspacePush',
    entity_type: 'opportunity',
    entity_id: pipeline.pipelineId,
    direction: dryRun ? 'preview' : 'push',
    status: failed === 0 ? 'success' : succeeded > 0 ? 'partial' : 'error',
    records_processed: results.length,
    records_created: createdCount,
    records_updated: updatedCount,
    records_skipped: 0,
    records_failed: failed,
    started_at: new Date().toISOString(),
    completed_at: new Date().toISOString(),
    duration_ms: null,
    triggered_by: user.email || user.id,
    metadata: {
      dryRun,
      ownerMode,
      relationshipMode,
      assignedTo,
      pipeline: pipeline.pipelineName,
      targetCount: targets.length,
      targetTypes: targets.reduce<Record<string, number>>((acc, target) => {
        acc[target.type] = (acc[target.type] || 0) + 1;
        return acc;
      }, {}),
      selectedKeys: targets.map((target) => target.key).filter(Boolean),
    },
  });

  return NextResponse.json({
    ok: failed === 0,
    requestedBy: user.email || user.id,
    dryRun,
    ownerMode,
    relationshipMode,
    assignedTo,
    total: results.length,
    succeeded,
    failed,
    created: createdCount,
    updated: updatedCount,
    pipeline: pipeline.pipelineName,
    results,
  });
}
