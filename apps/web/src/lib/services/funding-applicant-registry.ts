import { cache } from 'react';
import { getServiceSupabase } from '@/lib/supabase';
import { isActSlug } from '@/lib/services/fast-local-org';

export type ApplicantDgrStatus = 'endorsed' | 'not_endorsed' | 'unknown';
export type ApplicantVerificationStatus = 'verified' | 'needs_review';
export type ApplicantRouteStatus = 'ready' | 'needs_review' | 'blocked';

export interface FundingApplicantEntity {
  id: string;
  name: string;
  entityType: 'charity' | 'company' | 'pending_company' | 'auspice' | 'other';
  status: 'active' | 'pending' | 'archived';
  abn: string | null;
  acn: string | null;
  dgrStatus: ApplicantDgrStatus;
  verificationStatus: ApplicantVerificationStatus;
  verificationSource: string | null;
  isDefault: boolean;
}

export interface ProjectApplicantRoute {
  id: string;
  projectId: string;
  projectCode: string;
  projectName: string;
  projectSlug: string;
  routeType: 'direct' | 'charity' | 'auspice' | 'dgr' | 'partner' | 'commercial';
  status: ApplicantRouteStatus;
  isDefault: boolean;
  eligibleInstruments: string[];
  constraints: string[];
  rationale: string | null;
  entity: FundingApplicantEntity;
}

export interface ApplicantRequirements {
  requiresAbn: boolean;
  requiresDgr: boolean;
  eligibleOrgTypes: string[];
  eligibilityDecision: 'eligible_direct' | 'eligible_partner_led' | 'needs_verification' | null;
  profileCompleteness: string | null;
}

export interface ApplicantRouteOption {
  routeId: string;
  entityId: string;
  entityName: string;
  entityType: FundingApplicantEntity['entityType'];
  abn: string | null;
  dgrStatus: ApplicantDgrStatus;
  routeType: ProjectApplicantRoute['routeType'];
  isDefault: boolean;
  eligible: boolean;
  blockers: string[];
}

export interface FundingApplicantRegistry {
  summary: {
    entities: number;
    verifiedEntities: number;
    activeProjects: number;
    projectsWithDefaultRoute: number;
    readyDefaultRoutes: number;
    dgrEndorsedEntities: number;
  };
  entities: FundingApplicantEntity[];
  routes: ProjectApplicantRoute[];
}

interface RawEntity {
  id: string;
  name: FundingApplicantEntity['name'];
  entity_type: FundingApplicantEntity['entityType'];
  status: FundingApplicantEntity['status'];
  abn: string | null;
  acn: string | null;
  dgr_status: ApplicantDgrStatus;
  verification_status: ApplicantVerificationStatus;
  verification_source: string | null;
  is_default: boolean;
}

interface RawProject {
  id: string;
  code: string | null;
  name: string;
  slug: string;
}

interface RawRoute {
  id: string;
  org_project_id: string;
  applicant_entity_id: string;
  route_type: ProjectApplicantRoute['routeType'];
  status: ApplicantRouteStatus;
  is_default: boolean;
  eligible_instruments: string[] | null;
  constraints: string[] | null;
  rationale: string | null;
}

function asStringArray(value: unknown): string[] {
  return Array.isArray(value)
    ? value.filter((item): item is string => typeof item === 'string' && Boolean(item.trim()))
    : [];
}

export function applicantRequirementsFromEvidence(
  evidence: Record<string, unknown> | null | undefined,
): ApplicantRequirements {
  return {
    requiresAbn: evidence?.requires_abn === true,
    requiresDgr: evidence?.requires_dgr === true,
    eligibleOrgTypes: asStringArray(evidence?.eligible_org_types).map(value => value.toLowerCase()),
    eligibilityDecision: ['eligible_direct', 'eligible_partner_led', 'needs_verification'].includes(String(evidence?.eligibility_decision))
      ? String(evidence?.eligibility_decision) as ApplicantRequirements['eligibilityDecision']
      : null,
    profileCompleteness: typeof evidence?.profile_completeness === 'string' ? evidence.profile_completeness : null,
  };
}

const KNOWN_ORG_TYPES = new Set([
  'company',
  'business',
  'for_profit',
  'social_enterprise',
  'charity',
  'not_for_profit',
  'nonprofit',
  'community_organisation',
  'community_org',
  'arts_organisation',
  'collective',
  'aboriginal_corporation',
  'indigenous_charity',
  'indigenous_org',
]);

function entityMatchesPublishedTypes(entityType: FundingApplicantEntity['entityType'], values: string[]) {
  const published = values.filter(value => KNOWN_ORG_TYPES.has(value));
  if (!published.length) return true;
  const compatible = entityType === 'company'
    ? new Set(['company', 'business', 'for_profit', 'social_enterprise'])
    : entityType === 'charity' || entityType === 'auspice'
      ? new Set(['charity', 'not_for_profit', 'nonprofit', 'community_organisation', 'community_org', 'arts_organisation', 'collective'])
      : new Set<string>();
  return published.some(value => compatible.has(value));
}

export function applicantRouteBlockers(
  route: ProjectApplicantRoute,
  requirements: ApplicantRequirements,
): string[] {
  const blockers: string[] = [];
  if (route.routeType === 'charity' && !['charity', 'auspice'].includes(route.entity.entityType)) {
    blockers.push('A charity route requires a registered charity or auspice entity.');
  }
  if (route.routeType === 'auspice' && !['charity', 'auspice'].includes(route.entity.entityType)) {
    blockers.push('An auspice route requires a charity or auspice entity.');
  }
  if (route.routeType === 'commercial' && route.entity.entityType !== 'company') {
    blockers.push('A commercial route requires a company entity.');
  }
  if (route.routeType === 'dgr' && route.entity.dgrStatus !== 'endorsed') {
    blockers.push('A DGR route requires verified DGR endorsement.');
  }
  if (requirements.profileCompleteness && requirements.profileCompleteness !== 'decision_ready') {
    blockers.push('The project funding profile is not decision-ready.');
  }
  if (requirements.eligibilityDecision === 'needs_verification') {
    blockers.push('Project and opportunity eligibility still needs verification.');
  }
  if (
    requirements.eligibilityDecision === 'eligible_partner_led'
    && !['partner', 'auspice', 'charity', 'dgr'].includes(route.routeType)
  ) {
    blockers.push('This opportunity requires a partner-led applicant route.');
  }
  if (route.status === 'blocked') blockers.push('This project applicant route is blocked.');
  if (route.status === 'needs_review') blockers.push('This project applicant route needs review.');
  if (route.entity.status !== 'active') blockers.push(`${route.entity.name} is not an active applicant entity.`);
  if (route.entity.verificationStatus !== 'verified') blockers.push(`${route.entity.name} has not been verified.`);
  if (requirements.requiresAbn && !route.entity.abn) blockers.push('This opportunity requires an ABN.');
  if (requirements.requiresDgr && route.entity.dgrStatus !== 'endorsed') {
    blockers.push('This opportunity requires verified DGR endorsement.');
  }
  if (!entityMatchesPublishedTypes(route.entity.entityType, requirements.eligibleOrgTypes)) {
    blockers.push(`${route.entity.name} does not match the published eligible organisation types.`);
  }
  return [...new Set(blockers)];
}

export function toApplicantRouteOption(
  route: ProjectApplicantRoute,
  evidence?: Record<string, unknown> | null,
): ApplicantRouteOption {
  const blockers = applicantRouteBlockers(route, applicantRequirementsFromEvidence(evidence));
  return {
    routeId: route.id,
    entityId: route.entity.id,
    entityName: route.entity.name,
    entityType: route.entity.entityType,
    abn: route.entity.abn,
    dgrStatus: route.entity.dgrStatus,
    routeType: route.routeType,
    isDefault: route.isDefault,
    eligible: blockers.length === 0,
    blockers,
  };
}

export const getFundingApplicantRegistry = cache(async function getFundingApplicantRegistry(
  slug = 'act',
): Promise<FundingApplicantRegistry | null> {
  if (!isActSlug(slug)) return null;
  const db = getServiceSupabase();
  const { data: org, error: orgError } = await db
    .from('org_profiles')
    .select('id')
    .eq('slug', 'act')
    .single();
  if (orgError || !org) throw new Error(orgError?.message || 'ACT org profile not found');

  const [entitiesResult, projectsResult, routesResult] = await Promise.all([
    db.from('org_applicant_entities')
      .select('id, name, entity_type, status, abn, acn, dgr_status, verification_status, verification_source, is_default')
      .eq('org_profile_id', org.id)
      .neq('status', 'archived')
      .order('is_default', { ascending: false })
      .order('name'),
    db.from('org_projects')
      .select('id, code, name, slug')
      .eq('org_profile_id', org.id)
      .eq('status', 'active')
      .order('sort_order'),
    db.from('project_applicant_routes')
      .select('id, org_project_id, applicant_entity_id, route_type, status, is_default, eligible_instruments, constraints, rationale')
      .eq('org_profile_id', org.id)
      .order('is_default', { ascending: false })
      .order('created_at'),
  ]);
  for (const result of [entitiesResult, projectsResult, routesResult]) {
    if (result.error) throw new Error(`Applicant registry unavailable: ${result.error.message}`);
  }

  const entities = ((entitiesResult.data || []) as RawEntity[]).map(entity => ({
    id: entity.id,
    name: entity.name,
    entityType: entity.entity_type,
    status: entity.status,
    abn: entity.abn,
    acn: entity.acn,
    dgrStatus: entity.dgr_status,
    verificationStatus: entity.verification_status,
    verificationSource: entity.verification_source,
    isDefault: entity.is_default,
  }));
  const entityById = new Map(entities.map(entity => [entity.id, entity]));
  const projectById = new Map(((projectsResult.data || []) as RawProject[]).map(project => [project.id, project]));
  const routes = ((routesResult.data || []) as RawRoute[]).flatMap((route): ProjectApplicantRoute[] => {
    const project = projectById.get(route.org_project_id);
    const entity = entityById.get(route.applicant_entity_id);
    if (!project?.code || !entity) return [];
    return [{
      id: route.id,
      projectId: project.id,
      projectCode: project.code,
      projectName: project.name,
      projectSlug: project.slug,
      routeType: route.route_type,
      status: route.status,
      isDefault: route.is_default,
      eligibleInstruments: route.eligible_instruments || [],
      constraints: route.constraints || [],
      rationale: route.rationale,
      entity,
    }];
  });
  const defaultRoutes = routes.filter(route => route.isDefault);
  return {
    summary: {
      entities: entities.length,
      verifiedEntities: entities.filter(entity => entity.verificationStatus === 'verified').length,
      activeProjects: projectById.size,
      projectsWithDefaultRoute: new Set(defaultRoutes.map(route => route.projectId)).size,
      readyDefaultRoutes: defaultRoutes.filter(route => route.status === 'ready').length,
      dgrEndorsedEntities: entities.filter(entity => entity.dgrStatus === 'endorsed').length,
    },
    entities,
    routes,
  };
});
