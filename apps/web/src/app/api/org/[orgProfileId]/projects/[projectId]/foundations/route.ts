import { NextRequest, NextResponse } from 'next/server';
import { requireOrgAccess } from '../../../../_lib/auth';
import type { getServiceSupabase } from '@/lib/supabase';

type Params = { params: Promise<{ orgProfileId: string; projectId: string }> };

type EngagementStatus =
  | 'researching'
  | 'ready_to_approach'
  | 'approached'
  | 'meeting'
  | 'proposal'
  | 'won'
  | 'lost'
  | 'parked';

const PROJECT_FOUNDATION_SELECT = `
  id,
  org_profile_id,
  org_project_id,
  foundation_id,
  applicant_entity_id,
  stage,
  engagement_status,
  engagement_updated_at,
  fit_score,
  fit_summary,
  message_alignment,
  next_step,
  next_touch_at,
  next_touch_note,
  last_interaction_at,
  notes,
  created_at,
  updated_at,
  applicant_entity:org_applicant_entities(
    id,
    name,
    entity_type,
    status,
    abn,
    is_default
  ),
  research:org_project_foundation_research(
    id,
    foundation_thesis,
    evidence_summary,
    relationship_path,
    ask_shape,
    fit_status,
    proof_status,
    applicant_status,
    relationship_status,
    ask_status,
    missing_items,
    updated_at
  ),
  interactions:org_project_foundation_interactions(
    id,
    interaction_type,
    summary,
    notes,
    happened_at,
    status_snapshot,
    created_at
  ),
  foundation:foundations(
    id,
    name,
    type,
    total_giving_annual,
    thematic_focus,
    geographic_focus
  )
`;

type OrgProjectRecord = {
  id: string;
  name: string;
  slug: string;
  metadata: Record<string, unknown> | null;
};

type PipelineRow = {
  id: string;
  name: string;
  funder: string | null;
  status: string | null;
  notes: string | null;
  project_id: string | null;
  updated_at: string;
};

type FoundationMatchRow = {
  id: string;
  name: string;
};

function normalizeFoundationLabel(value: string | null | undefined) {
  return (value || '')
    .toLowerCase()
    .replace(/\bas trustee for\b/g, ' ')
    .replace(/\bthe trustee for\b/g, ' ')
    .replace(/\blimited\b/g, ' ')
    .replace(/\bltd\b/g, ' ')
    .replace(/\bpty\b/g, ' ')
    .replace(/\btrust\b/g, ' trust ')
    .replace(/[^a-z0-9\s]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

function foundationNamesMatch(funder: string | null | undefined, foundationName: string) {
  const normalizedFunder = normalizeFoundationLabel(funder);
  const normalizedFoundation = normalizeFoundationLabel(foundationName);

  if (!normalizedFunder || !normalizedFoundation) return false;
  if (normalizedFunder === normalizedFoundation) return true;
  if (normalizedFoundation.includes(normalizedFunder)) return true;
  if (normalizedFunder.includes(normalizedFoundation)) return true;
  return false;
}

function buildProjectKeywords(project: OrgProjectRecord) {
  const tagValues = Array.isArray(project.metadata?.funding_tags)
    ? project.metadata?.funding_tags.filter((value): value is string => typeof value === 'string')
    : [];

  return [project.name, project.slug, ...tagValues]
    .map((value) => value.toLowerCase().trim())
    .filter(Boolean);
}

function isRelevantPipelineRow(row: PipelineRow, project: OrgProjectRecord) {
  if (row.project_id === project.id) return true;
  if (row.project_id && row.project_id !== project.id) return false;

  const haystack = `${row.name} ${row.funder || ''} ${row.notes || ''}`.toLowerCase();
  return buildProjectKeywords(project).some((keyword) => haystack.includes(keyword));
}

function deriveImportDefaults(row: PipelineRow, hasApplicantEntity: boolean) {
  const combined = `${row.name} ${row.status || ''} ${row.notes || ''}`.toLowerCase();
  const warmSignal = /warm|priority|strong fit|qualified|recommended|project-specific|goods-specific/.test(combined);
  const activeSignal = /active|existing|already|submitted|applied|pending|proposal|in conversation/.test(combined);

  const stage = activeSignal ? 'approach_now' : warmSignal ? 'priority' : 'saved';
  const engagementStatus = activeSignal ? 'approached' : warmSignal ? 'ready_to_approach' : 'researching';
  const relationshipStatus = activeSignal ? 'partial' : warmSignal ? 'partial' : 'missing';

  const missingItems = [];
  if (relationshipStatus === 'missing') missingItems.push('Need intro path');
  if (!hasApplicantEntity) missingItems.push('Need vehicle');
  if (!row.notes) missingItems.push('Need ask');

  return {
    stage,
    engagementStatus,
    relationshipStatus,
    fitStatus: row.notes ? 'partial' : 'missing',
    proofStatus: row.notes ? 'partial' : 'missing',
    applicantStatus: hasApplicantEntity ? 'ready' : 'missing',
    askStatus: row.notes ? 'partial' : 'missing',
    missingItems,
  };
}

async function getPipelineFoundationCandidates(
  serviceDb: ReturnType<typeof getServiceSupabase>,
  orgProfileId: string,
  project: OrgProjectRecord,
) {
  const [{ data: pipelineRows, error: pipelineError }, { data: foundations, error: foundationsError }, { data: existingRows, error: existingError }] =
    await Promise.all([
      serviceDb
        .from('org_pipeline')
        .select('id, name, funder, status, notes, project_id, updated_at')
        .eq('org_profile_id', orgProfileId)
        .order('updated_at', { ascending: false }),
      serviceDb
        .from('foundations')
        .select('id, name'),
      serviceDb
        .from('org_project_foundations')
        .select('foundation_id')
        .eq('org_profile_id', orgProfileId)
        .eq('org_project_id', project.id),
    ]);

  if (pipelineError) throw pipelineError;
  if (foundationsError) throw foundationsError;
  if (existingError) throw existingError;

  const existingFoundationIds = new Set((existingRows || []).map((row) => row.foundation_id));
  const candidates = new Map<string, { pipeline: PipelineRow; foundation: FoundationMatchRow }>();

  for (const row of (pipelineRows || []) as PipelineRow[]) {
    if (!row.funder || !isRelevantPipelineRow(row, project)) continue;

    const matchedFoundation = (foundations || []).find((foundation) =>
      foundationNamesMatch(row.funder, foundation.name),
    );

    if (!matchedFoundation || existingFoundationIds.has(matchedFoundation.id)) continue;

    if (!candidates.has(matchedFoundation.id)) {
      candidates.set(matchedFoundation.id, {
        pipeline: row,
        foundation: matchedFoundation,
      });
    }
  }

  return [...candidates.values()];
}

async function ensureProjectBelongsToOrg(
  serviceDb: ReturnType<typeof getServiceSupabase>,
  orgProfileId: string,
  projectId: string,
) {
  const { data: project, error } = await serviceDb
    .from('org_projects')
    .select('id, name, slug, metadata')
    .eq('id', projectId)
    .eq('org_profile_id', orgProfileId)
    .maybeSingle();

  if (error) return { error };
  if (!project) return { error: new Error('Project not found') };
  return { project };
}

async function fetchProjectFoundationRow(
  serviceDb: ReturnType<typeof getServiceSupabase>,
  orgProfileId: string,
  projectId: string,
  id: string,
) {
  const { data, error } = await serviceDb
    .from('org_project_foundations')
    .select(PROJECT_FOUNDATION_SELECT)
    .eq('id', id)
    .eq('org_project_id', projectId)
    .eq('org_profile_id', orgProfileId)
    .single();

  return { data, error };
}

function deriveInteractionEngagementStatus(
  interaction: Record<string, unknown> | undefined,
  currentStatus: EngagementStatus,
): EngagementStatus {
  const interactionType = interaction?.interaction_type;
  const explicitStatus = interaction?.status_snapshot;
  if (typeof explicitStatus === 'string') {
    return explicitStatus as EngagementStatus;
  }

  if (interactionType === 'proposal') return 'proposal';
  if (interactionType === 'meeting') return currentStatus === 'proposal' ? currentStatus : 'meeting';
  if (interactionType === 'email' || interactionType === 'call') {
    if (currentStatus === 'meeting' || currentStatus === 'proposal' || currentStatus === 'won') return currentStatus;
    return 'approached';
  }
  if (interactionType === 'decision') return currentStatus;
  return currentStatus;
}

export async function GET(req: NextRequest, { params }: Params) {
  const { orgProfileId, projectId } = await params;
  const auth = await requireOrgAccess(orgProfileId);
  if (auth instanceof NextResponse) return auth;

  const projectCheck = await ensureProjectBelongsToOrg(auth.serviceDb, orgProfileId, projectId);
  if (projectCheck.error) {
    return NextResponse.json({ error: projectCheck.error.message }, { status: 404 });
  }

  const q = req.nextUrl.searchParams.get('q')?.trim();

  if (q) {
    const { data: existingRows, error: existingError } = await auth.serviceDb
      .from('org_project_foundations')
      .select('foundation_id')
      .eq('org_project_id', projectId);

    if (existingError) {
      return NextResponse.json({ error: existingError.message }, { status: 500 });
    }

    const excludedIds = (existingRows || []).map((row) => row.foundation_id);
    const excludedList = `(${excludedIds.map((id) => JSON.stringify(id)).join(',')})`;
    let query = auth.serviceDb
      .from('foundations')
      .select('id, name, type, total_giving_annual, thematic_focus, geographic_focus')
      .or(`name.ilike.%${q}%,description.ilike.%${q}%`)
      .order('total_giving_annual', { ascending: false, nullsFirst: false })
      .limit(10);

    if (excludedIds.length > 0) {
      query = query.not('id', 'in', excludedList);
    }

    const { data, error } = await query;
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    return NextResponse.json(data ?? []);
  }

  const [{ data, error }, { data: applicantEntities, error: applicantError }, pipelineCandidates] = await Promise.all([
    auth.serviceDb
    .from('org_project_foundations')
    .select(PROJECT_FOUNDATION_SELECT)
    .eq('org_project_id', projectId)
    .order('fit_score', { ascending: false, nullsFirst: false })
    .order('updated_at', { ascending: false }),
    auth.serviceDb
      .from('org_applicant_entities')
      .select('id, name, entity_type, status, abn, is_default')
      .eq('org_profile_id', orgProfileId)
      .order('is_default', { ascending: false })
      .order('name', { ascending: true }),
    getPipelineFoundationCandidates(auth.serviceDb, orgProfileId, projectCheck.project as OrgProjectRecord),
  ]);

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  if (applicantError) return NextResponse.json({ error: applicantError.message }, { status: 500 });
  return NextResponse.json({
    items: data ?? [],
    applicant_entities: applicantEntities ?? [],
    pipeline_candidates: pipelineCandidates.map((candidate) => ({
      pipeline_id: candidate.pipeline.id,
      name: candidate.pipeline.name,
      funder: candidate.pipeline.funder,
      status: candidate.pipeline.status,
      foundation_id: candidate.foundation.id,
      foundation_name: candidate.foundation.name,
      notes: candidate.pipeline.notes,
    })),
  });
}

export async function POST(req: NextRequest, { params }: Params) {
  const { orgProfileId, projectId } = await params;
  const auth = await requireOrgAccess(orgProfileId);
  if (auth instanceof NextResponse) return auth;

  const projectCheck = await ensureProjectBelongsToOrg(auth.serviceDb, orgProfileId, projectId);
  if (projectCheck.error) {
    return NextResponse.json({ error: projectCheck.error.message }, { status: 404 });
  }

  const body = await req.json();
  if (body.import_pipeline_candidates === true) {
    const { data: applicantEntities, error: applicantError } = await auth.serviceDb
      .from('org_applicant_entities')
      .select('id, is_default')
      .eq('org_profile_id', orgProfileId)
      .order('is_default', { ascending: false })
      .order('name', { ascending: true });

    if (applicantError) {
      return NextResponse.json({ error: applicantError.message }, { status: 500 });
    }

    const defaultApplicantId =
      (body.applicant_entity_id as string | undefined) ||
      applicantEntities?.find((entity) => entity.is_default)?.id ||
      null;

    const candidates = await getPipelineFoundationCandidates(
      auth.serviceDb,
      orgProfileId,
      projectCheck.project as OrgProjectRecord,
    );

    const importedNames = [];

    for (const candidate of candidates) {
      const defaults = deriveImportDefaults(candidate.pipeline, Boolean(defaultApplicantId));
      const timestamp = new Date().toISOString();

      const { data: importedRow, error: importError } = await auth.serviceDb
        .from('org_project_foundations')
        .upsert({
          org_profile_id: orgProfileId,
          org_project_id: projectId,
          foundation_id: candidate.foundation.id,
          applicant_entity_id: defaultApplicantId,
          stage: defaults.stage,
          engagement_status: defaults.engagementStatus,
          engagement_updated_at: timestamp,
          fit_summary: candidate.pipeline.notes,
          next_step: `Turn "${candidate.pipeline.name}" into a named ${candidate.foundation.name} contact path.`,
          notes: candidate.pipeline.notes,
          updated_at: timestamp,
        }, { onConflict: 'org_project_id,foundation_id' })
        .select('id')
        .single();

      if (importError) {
        return NextResponse.json({ error: importError.message }, { status: 500 });
      }

      const { error: researchError } = await auth.serviceDb
        .from('org_project_foundation_research')
        .upsert({
          org_profile_id: orgProfileId,
          org_project_id: projectId,
          org_project_foundation_id: importedRow.id,
          foundation_thesis: candidate.pipeline.notes,
          evidence_summary: candidate.pipeline.notes,
          relationship_path: null,
          ask_shape: null,
          fit_status: defaults.fitStatus,
          proof_status: defaults.proofStatus,
          applicant_status: defaults.applicantStatus,
          relationship_status: defaults.relationshipStatus,
          ask_status: defaults.askStatus,
          missing_items: defaults.missingItems,
          updated_at: timestamp,
        }, { onConflict: 'org_project_foundation_id' });

      if (researchError) {
        return NextResponse.json({ error: researchError.message }, { status: 500 });
      }

      importedNames.push(candidate.foundation.name);
    }

    const [{ data, error }, { data: refreshedApplicantEntities, error: refreshedApplicantError }, refreshedPipelineCandidates] = await Promise.all([
      auth.serviceDb
        .from('org_project_foundations')
        .select(PROJECT_FOUNDATION_SELECT)
        .eq('org_project_id', projectId)
        .order('fit_score', { ascending: false, nullsFirst: false })
        .order('updated_at', { ascending: false }),
      auth.serviceDb
        .from('org_applicant_entities')
        .select('id, name, entity_type, status, abn, is_default')
        .eq('org_profile_id', orgProfileId)
        .order('is_default', { ascending: false })
        .order('name', { ascending: true }),
      getPipelineFoundationCandidates(auth.serviceDb, orgProfileId, projectCheck.project as OrgProjectRecord),
    ]);

    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    if (refreshedApplicantError) return NextResponse.json({ error: refreshedApplicantError.message }, { status: 500 });

    return NextResponse.json({
      items: data ?? [],
      applicant_entities: refreshedApplicantEntities ?? [],
      imported_count: importedNames.length,
      imported_foundations: importedNames,
      pipeline_candidates: refreshedPipelineCandidates.map((candidate) => ({
        pipeline_id: candidate.pipeline.id,
        name: candidate.pipeline.name,
        funder: candidate.pipeline.funder,
        status: candidate.pipeline.status,
        foundation_id: candidate.foundation.id,
        foundation_name: candidate.foundation.name,
        notes: candidate.pipeline.notes,
      })),
    });
  }

  const foundationId = body.foundation_id as string | undefined;
  const research = body.research as Record<string, unknown> | undefined;
  const newInteraction = body.new_interaction as Record<string, unknown> | undefined;
  const initialEngagementStatus = deriveInteractionEngagementStatus(
    newInteraction,
    (body.engagement_status as EngagementStatus | undefined) ?? 'researching',
  );

  if (!foundationId) {
    return NextResponse.json({ error: 'foundation_id is required' }, { status: 400 });
  }

  const { data, error } = await auth.serviceDb
    .from('org_project_foundations')
    .upsert({
      org_profile_id: orgProfileId,
      org_project_id: projectId,
      foundation_id: foundationId,
      applicant_entity_id: body.applicant_entity_id ?? null,
      stage: body.stage ?? 'saved',
      engagement_status: initialEngagementStatus,
      engagement_updated_at: new Date().toISOString(),
      fit_score: body.fit_score ?? null,
      fit_summary: body.fit_summary ?? null,
      message_alignment: body.message_alignment ?? null,
      next_step: body.next_step ?? null,
      next_touch_at: body.next_touch_at ?? null,
      next_touch_note: body.next_touch_note ?? null,
      notes: body.notes ?? null,
      updated_at: new Date().toISOString(),
    }, { onConflict: 'org_project_id,foundation_id' })
    .select('id')
    .single();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  if (research) {
    const researchUpdates = {
      org_profile_id: orgProfileId,
      org_project_id: projectId,
      org_project_foundation_id: data.id,
      foundation_thesis: research.foundation_thesis ?? null,
      evidence_summary: research.evidence_summary ?? null,
      relationship_path: research.relationship_path ?? null,
      ask_shape: research.ask_shape ?? null,
      fit_status: research.fit_status ?? 'missing',
      proof_status: research.proof_status ?? 'missing',
      applicant_status: research.applicant_status ?? 'missing',
      relationship_status: research.relationship_status ?? 'missing',
      ask_status: research.ask_status ?? 'missing',
      missing_items: Array.isArray(research.missing_items) ? research.missing_items : [],
      updated_at: new Date().toISOString(),
    };

    const { error: researchError } = await auth.serviceDb
      .from('org_project_foundation_research')
      .upsert(researchUpdates, { onConflict: 'org_project_foundation_id' });

    if (researchError) return NextResponse.json({ error: researchError.message }, { status: 500 });
  }

  if (newInteraction?.interaction_type && newInteraction?.summary) {
    const { error: interactionError } = await auth.serviceDb
      .from('org_project_foundation_interactions')
      .insert({
        org_profile_id: orgProfileId,
        org_project_id: projectId,
        org_project_foundation_id: data.id,
        interaction_type: newInteraction.interaction_type,
        summary: newInteraction.summary,
        notes: newInteraction.notes ?? null,
        happened_at: newInteraction.happened_at ?? new Date().toISOString(),
        status_snapshot: deriveInteractionEngagementStatus(newInteraction, initialEngagementStatus),
      });

    if (interactionError) return NextResponse.json({ error: interactionError.message }, { status: 500 });

    const { error: interactionStampError } = await auth.serviceDb
      .from('org_project_foundations')
      .update({
        last_interaction_at: newInteraction.happened_at ?? new Date().toISOString(),
        updated_at: new Date().toISOString(),
      })
      .eq('id', data.id)
      .eq('org_project_id', projectId)
      .eq('org_profile_id', orgProfileId);

    if (interactionStampError) {
      return NextResponse.json({ error: interactionStampError.message }, { status: 500 });
    }
  }

  const row = await fetchProjectFoundationRow(auth.serviceDb, orgProfileId, projectId, data.id);
  if (row.error) return NextResponse.json({ error: row.error.message }, { status: 500 });
  return NextResponse.json(row.data, { status: 201 });
}

export async function PATCH(req: NextRequest, { params }: Params) {
  const { orgProfileId, projectId } = await params;
  const auth = await requireOrgAccess(orgProfileId);
  if (auth instanceof NextResponse) return auth;

  const projectCheck = await ensureProjectBelongsToOrg(auth.serviceDb, orgProfileId, projectId);
  if (projectCheck.error) {
    return NextResponse.json({ error: projectCheck.error.message }, { status: 404 });
  }

  const body = await req.json();
  const id = body.id as string | undefined;
  const research = body.research as Record<string, unknown> | undefined;
  const newInteraction = body.new_interaction as Record<string, unknown> | undefined;

  if (!id) {
    return NextResponse.json({ error: 'id is required' }, { status: 400 });
  }

  const currentRow = await fetchProjectFoundationRow(auth.serviceDb, orgProfileId, projectId, id);
  if (currentRow.error) return NextResponse.json({ error: currentRow.error.message }, { status: 500 });

  const currentStatus =
    ((currentRow.data as { engagement_status?: EngagementStatus } | null)?.engagement_status ?? 'researching') as EngagementStatus;
  const derivedInteractionStatus =
    body.engagement_status !== undefined
      ? (body.engagement_status as EngagementStatus)
      : deriveInteractionEngagementStatus(newInteraction, currentStatus);

  const updates = {
    ...(body.applicant_entity_id !== undefined && { applicant_entity_id: body.applicant_entity_id || null }),
    ...(body.stage !== undefined && { stage: body.stage }),
    ...((body.engagement_status !== undefined || newInteraction !== undefined) && {
      engagement_status: derivedInteractionStatus,
      engagement_updated_at: new Date().toISOString(),
    }),
    ...(body.fit_score !== undefined && { fit_score: body.fit_score === '' ? null : body.fit_score }),
    ...(body.fit_summary !== undefined && { fit_summary: body.fit_summary }),
    ...(body.message_alignment !== undefined && { message_alignment: body.message_alignment }),
    ...(body.next_step !== undefined && { next_step: body.next_step }),
    ...(body.next_touch_at !== undefined && { next_touch_at: body.next_touch_at || null }),
    ...(body.next_touch_note !== undefined && { next_touch_note: body.next_touch_note || null }),
    ...(body.notes !== undefined && { notes: body.notes }),
    updated_at: new Date().toISOString(),
  };

  const { error } = await auth.serviceDb
    .from('org_project_foundations')
    .update(updates)
    .eq('id', id)
    .eq('org_project_id', projectId)
    .eq('org_profile_id', orgProfileId);

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  if (research) {
    const researchUpdates = {
      org_profile_id: orgProfileId,
      org_project_id: projectId,
      org_project_foundation_id: id,
      ...(research.foundation_thesis !== undefined && { foundation_thesis: research.foundation_thesis }),
      ...(research.evidence_summary !== undefined && { evidence_summary: research.evidence_summary }),
      ...(research.relationship_path !== undefined && { relationship_path: research.relationship_path }),
      ...(research.ask_shape !== undefined && { ask_shape: research.ask_shape }),
      ...(research.fit_status !== undefined && { fit_status: research.fit_status }),
      ...(research.proof_status !== undefined && { proof_status: research.proof_status }),
      ...(research.applicant_status !== undefined && { applicant_status: research.applicant_status }),
      ...(research.relationship_status !== undefined && { relationship_status: research.relationship_status }),
      ...(research.ask_status !== undefined && { ask_status: research.ask_status }),
      ...(research.missing_items !== undefined && {
        missing_items: Array.isArray(research.missing_items) ? research.missing_items : [],
      }),
      updated_at: new Date().toISOString(),
    };

    const { error: researchError } = await auth.serviceDb
      .from('org_project_foundation_research')
      .upsert(researchUpdates, { onConflict: 'org_project_foundation_id' });

    if (researchError) return NextResponse.json({ error: researchError.message }, { status: 500 });
  }

  if (newInteraction?.interaction_type && newInteraction?.summary) {
    const { error: interactionError } = await auth.serviceDb
      .from('org_project_foundation_interactions')
      .insert({
        org_profile_id: orgProfileId,
        org_project_id: projectId,
        org_project_foundation_id: id,
        interaction_type: newInteraction.interaction_type,
        summary: newInteraction.summary,
        notes: newInteraction.notes ?? null,
        happened_at: newInteraction.happened_at ?? new Date().toISOString(),
        status_snapshot: deriveInteractionEngagementStatus(newInteraction, derivedInteractionStatus),
      });

    if (interactionError) return NextResponse.json({ error: interactionError.message }, { status: 500 });

    const { error: interactionStampError } = await auth.serviceDb
      .from('org_project_foundations')
      .update({
        last_interaction_at: newInteraction.happened_at ?? new Date().toISOString(),
        updated_at: new Date().toISOString(),
      })
      .eq('id', id)
      .eq('org_project_id', projectId)
      .eq('org_profile_id', orgProfileId);

    if (interactionStampError) {
      return NextResponse.json({ error: interactionStampError.message }, { status: 500 });
    }
  }

  const row = await fetchProjectFoundationRow(auth.serviceDb, orgProfileId, projectId, id);
  if (row.error) return NextResponse.json({ error: row.error.message }, { status: 500 });
  return NextResponse.json(row.data);
}

export async function DELETE(req: NextRequest, { params }: Params) {
  const { orgProfileId, projectId } = await params;
  const auth = await requireOrgAccess(orgProfileId);
  if (auth instanceof NextResponse) return auth;

  const projectCheck = await ensureProjectBelongsToOrg(auth.serviceDb, orgProfileId, projectId);
  if (projectCheck.error) {
    return NextResponse.json({ error: projectCheck.error.message }, { status: 404 });
  }

  const body = await req.json();
  const id = body.id as string | undefined;

  if (!id) {
    return NextResponse.json({ error: 'id is required' }, { status: 400 });
  }

  const { error } = await auth.serviceDb
    .from('org_project_foundations')
    .delete()
    .eq('id', id)
    .eq('org_project_id', projectId)
    .eq('org_profile_id', orgProfileId);

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ success: true });
}
