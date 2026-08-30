import { NextResponse } from 'next/server';
import { requireAdminApi } from '@/lib/admin-auth';
import { getServiceSupabase } from '@/lib/supabase';
import { getFundingApplicantRegistry } from '@/lib/services/funding-applicant-registry';

const ENTITY_TYPES = new Set(['charity', 'company', 'pending_company', 'auspice', 'other']);
const ENTITY_STATUSES = new Set(['active', 'pending']);
const DGR_STATUSES = new Set(['endorsed', 'not_endorsed', 'unknown']);
const ROUTE_TYPES = new Set(['direct', 'charity', 'auspice', 'dgr', 'partner', 'commercial']);

function stringValue(value: unknown) {
  return typeof value === 'string' ? value.trim() : '';
}

function digits(value: unknown) {
  return stringValue(value).replace(/\D/g, '');
}

function uniqueStrings(value: unknown) {
  return Array.isArray(value)
    ? [...new Set(value.filter((item): item is string => typeof item === 'string').map(item => item.trim()).filter(Boolean))]
    : [];
}

function validEvidenceUrl(value: string) {
  if (!value) return false;
  try {
    const url = new URL(value);
    return url.protocol === 'https:' || url.protocol === 'http:';
  } catch {
    return false;
  }
}

export async function GET() {
  const auth = await requireAdminApi();
  if (auth.error) return auth.error;
  try {
    return NextResponse.json(await getFundingApplicantRegistry('act'));
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : 'Applicant registry unavailable' }, { status: 500 });
  }
}

export async function POST(request: Request) {
  const auth = await requireAdminApi();
  if (auth.error) return auth.error;
  let body: Record<string, unknown>;
  try {
    body = await request.json() as Record<string, unknown>;
  } catch {
    return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 });
  }
  const db = getServiceSupabase();
  const { data: org, error: orgError } = await db.from('org_profiles').select('id').eq('slug', 'act').single();
  if (orgError || !org) return NextResponse.json({ error: orgError?.message || 'ACT org profile not found' }, { status: 500 });

  if (body.action === 'create_entity') {
    const name = stringValue(body.name);
    const entityType = stringValue(body.entityType);
    const status = stringValue(body.status) || 'active';
    const abn = digits(body.abn) || null;
    const acn = digits(body.acn) || null;
    const dgrStatus = stringValue(body.dgrStatus) || 'unknown';
    const verificationSource = stringValue(body.verificationSource) || null;
    const notes = stringValue(body.notes) || null;
    if (!name) return NextResponse.json({ error: 'name is required' }, { status: 400 });
    if (!ENTITY_TYPES.has(entityType)) return NextResponse.json({ error: 'Unsupported entityType' }, { status: 400 });
    if (!ENTITY_STATUSES.has(status)) return NextResponse.json({ error: 'Unsupported status' }, { status: 400 });
    if (abn && abn.length !== 11) return NextResponse.json({ error: 'ABN must contain 11 digits' }, { status: 400 });
    if (acn && acn.length !== 9) return NextResponse.json({ error: 'ACN must contain 9 digits' }, { status: 400 });
    if (!DGR_STATUSES.has(dgrStatus)) return NextResponse.json({ error: 'Unsupported dgrStatus' }, { status: 400 });
    if (dgrStatus !== 'unknown' && !validEvidenceUrl(verificationSource || '')) {
      return NextResponse.json({ error: 'A public evidence URL is required for a DGR assertion' }, { status: 400 });
    }

    let linkedEntityId: string | null = null;
    if (abn) {
      const { data: graphRows, error: graphError } = await db
        .from('gs_entities')
        .select('id')
        .eq('abn', abn)
        .limit(2);
      if (graphError) return NextResponse.json({ error: graphError.message }, { status: 500 });
      if (graphRows?.length === 1) linkedEntityId = graphRows[0].id;
    }
    const verificationStatus = status === 'active' && linkedEntityId ? 'verified' : 'needs_review';
    const { data, error } = await db.from('org_applicant_entities').insert({
      org_profile_id: org.id,
      name,
      entity_type: entityType,
      status,
      abn,
      acn,
      dgr_status: dgrStatus,
      linked_gs_entity_id: linkedEntityId,
      verification_status: verificationStatus,
      verified_at: verificationStatus === 'verified' ? new Date().toISOString() : null,
      verification_source: verificationSource || (linkedEntityId ? 'gs_entities' : null),
      notes,
      is_default: false,
      updated_at: new Date().toISOString(),
    }).select('id, name, verification_status, dgr_status').single();
    if (error) return NextResponse.json({ error: error.message }, { status: 409 });
    return NextResponse.json({ entity: data }, { status: 201 });
  }

  if (body.action === 'assign_routes') {
    const applicantEntityId = stringValue(body.applicantEntityId);
    const routeType = stringValue(body.routeType);
    const projectCodes = uniqueStrings(body.projectCodes);
    if (!applicantEntityId) return NextResponse.json({ error: 'applicantEntityId is required' }, { status: 400 });
    if (!ROUTE_TYPES.has(routeType)) return NextResponse.json({ error: 'Unsupported routeType' }, { status: 400 });
    if (!projectCodes.length) return NextResponse.json({ error: 'At least one projectCode is required' }, { status: 400 });

    const [{ data: entity, error: entityError }, { data: projects, error: projectsError }] = await Promise.all([
      db.from('org_applicant_entities')
        .select('id, name, entity_type, status, verification_status, dgr_status')
        .eq('id', applicantEntityId)
        .eq('org_profile_id', org.id)
        .neq('status', 'archived')
        .single(),
      db.from('org_projects')
        .select('id, code')
        .eq('org_profile_id', org.id)
        .eq('status', 'active')
        .in('code', projectCodes),
    ]);
    if (entityError || !entity) return NextResponse.json({ error: entityError?.message || 'Applicant entity not found' }, { status: 404 });
    if (projectsError) return NextResponse.json({ error: projectsError.message }, { status: 500 });
    if ((projects || []).length !== projectCodes.length) return NextResponse.json({ error: 'One or more project codes are not active ACT projects' }, { status: 400 });

    const routeEntityCompatible = routeType === 'charity' || routeType === 'auspice'
      ? ['charity', 'auspice'].includes(entity.entity_type)
      : routeType === 'commercial'
        ? entity.entity_type === 'company'
        : true;
    const routeStatus = entity.status !== 'active' || !routeEntityCompatible
      ? 'blocked'
      : entity.verification_status !== 'verified' || (routeType === 'dgr' && entity.dgr_status !== 'endorsed')
        ? 'needs_review'
        : 'ready';
    const constraints = routeType === 'dgr' && entity.dgr_status !== 'endorsed'
      ? ['DGR endorsement evidence is required before this route can be pursued.']
      : [`Confirm ${routeType} eligibility against each opportunity before pursuing.`];
    const rows = (projects || []).map(project => ({
      org_profile_id: org.id,
      org_project_id: project.id,
      applicant_entity_id: entity.id,
      route_type: routeType,
      status: routeStatus,
      eligible_instruments: routeType === 'commercial' ? ['commercial', 'contract'] : ['grant', 'philanthropy'],
      constraints,
      rationale: stringValue(body.rationale) || `Batch ${routeType} route through ${entity.name}.`,
      provenance: [{ type: 'admin_batch', userId: auth.user.id, at: new Date().toISOString() }],
      created_by: auth.user.id,
      updated_at: new Date().toISOString(),
    }));
    const { data, error } = await db.from('project_applicant_routes')
      .upsert(rows, { onConflict: 'org_project_id,applicant_entity_id,route_type' })
      .select('id');
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    if ((data || []).length !== rows.length) return NextResponse.json({ error: `Attempted ${rows.length} routes but wrote ${data?.length || 0}` }, { status: 500 });
    return NextResponse.json({ assigned: data?.length || 0, routeStatus });
  }

  return NextResponse.json({ error: 'Unsupported action' }, { status: 400 });
}
