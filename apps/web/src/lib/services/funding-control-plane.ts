import { getServiceSupabase } from '@/lib/supabase';
import { isActSlug } from '@/lib/services/fast-local-org';
import { createOrUpdateFundingBrief } from '@/lib/services/funding-notion';
import {
  compileFundingProfile,
  isFundingProfileCompiled,
  type FundingProfileCompilerOrg,
} from '@/lib/services/funding-profile-compiler';

export type FundingProfileStatus = 'missing' | 'baseline' | 'partial' | 'decision_ready';
export type FundingReconciliationActionType =
  | 'assign_project_code'
  | 'ensure_profile'
  | 'compile_profile'
  | 'complete_profile'
  | 'repair_handoff'
  | 'repair_ghl_link'
  | 'sync_notion_workspace';

export interface FundingReconciliationAction {
  key: string;
  type: FundingReconciliationActionType;
  mode: 'automatic' | 'human';
  projectCode: string | null;
  opportunityId: string | null;
  label: string;
}

export interface FundingControlPlaneProject {
  projectId: string;
  projectCode: string | null;
  projectName: string;
  projectSlug: string;
  profileStatus: FundingProfileStatus;
  profileVersion: string | null;
  compiled: boolean;
  unresolvedDecisions: number;
  evidenceSafeMatches: number;
  decisions: number;
  historicalWins: number;
  pursued: number;
  ghlLinked: number;
  notionLinked: number;
  attention: number;
}

export interface FundingControlPlane {
  generatedAt: string;
  ownership: {
    discovery: 'GrantScope';
    operations: 'GHL';
    writing: 'Notion';
    integration: 'Supabase';
  };
  summary: {
    activeProjects: number;
    profileCoverage: number;
    compiledProfiles: number;
    decisionReadyProfiles: number;
    evidenceSafeMatches: number;
    uniqueOpportunities: number;
    historicalWins: number;
    pursued: number;
    ghlLinked: number;
    notionLinked: number;
    automaticActions: number;
    humanActions: number;
  };
  projects: FundingControlPlaneProject[];
  actions: FundingReconciliationAction[];
}

interface RawProject {
  id: string;
  code: string | null;
  name: string;
  slug: string;
  description?: string | null;
  category?: string | null;
  parent_project_id?: string | null;
  status?: string | null;
  abn?: string | null;
  metadata?: Record<string, unknown> | null;
  org_profile_id?: string;
}

interface RawProfile {
  org_project_id: string;
  profile_version: string;
  completeness_status: Exclude<FundingProfileStatus, 'missing'>;
  profile: Record<string, unknown>;
  provenance?: unknown;
}

interface RawRecommendation {
  project_code: string;
  opportunity_id: string;
}

interface RawDecision {
  project_code: string;
  opportunity_id: string;
  decision: string;
  decision_scope?: 'operational' | 'historical_evidence';
  decision_origin?: string;
  notes?: string | null;
}

interface RawHandoff {
  project_code: string;
  opportunity_id: string;
  ghl_opportunity_id: string | null;
  notion_brief_url: string | null;
  sync_status: string;
  last_error: string | null;
}

interface FundingControlPlaneInput {
  org?: FundingProfileCompilerOrg;
  projects: RawProject[];
  profiles: RawProfile[];
  recommendations: RawRecommendation[];
  decisions: RawDecision[];
  handoffs: RawHandoff[];
  generatedAt?: string;
}

const OPERATIONAL_DECISIONS = new Set(['pursuing', 'applied', 'submitted', 'won']);

function isHistoricalEvidence(decision: RawDecision) {
  return decision.decision_scope === 'historical_evidence'
    || (!decision.decision_scope
      && decision.decision === 'won'
      && decision.notes?.startsWith('Backfilled from xero_invoices'));
}

function unresolvedCount(profile: Record<string, unknown> | undefined) {
  return Array.isArray(profile?.unresolvedDecisions) ? profile.unresolvedDecisions.length : 0;
}

export function buildFundingControlPlane(input: FundingControlPlaneInput): FundingControlPlane {
  const profilesByProject = new Map(input.profiles.map(profile => [profile.org_project_id, profile]));
  const recommendationsByProject = new Map<string, RawRecommendation[]>();
  const decisionsByProject = new Map<string, RawDecision[]>();
  const handoffsByProject = new Map<string, RawHandoff[]>();

  for (const recommendation of input.recommendations) {
    const rows = recommendationsByProject.get(recommendation.project_code) || [];
    rows.push(recommendation);
    recommendationsByProject.set(recommendation.project_code, rows);
  }
  for (const decision of input.decisions) {
    const rows = decisionsByProject.get(decision.project_code) || [];
    rows.push(decision);
    decisionsByProject.set(decision.project_code, rows);
  }
  for (const handoff of input.handoffs) {
    const rows = handoffsByProject.get(handoff.project_code) || [];
    rows.push(handoff);
    handoffsByProject.set(handoff.project_code, rows);
  }

  const actions: FundingReconciliationAction[] = [];
  const projects = input.projects.map(project => {
    const profile = profilesByProject.get(project.id);
    const code = project.code;
    const recommendations = code ? recommendationsByProject.get(code) || [] : [];
    const decisions = code ? decisionsByProject.get(code) || [] : [];
    const operationalDecisions = decisions.filter(decision => !isHistoricalEvidence(decision));
    const historicalWins = decisions.filter(
      decision => isHistoricalEvidence(decision) && decision.decision === 'won'
    );
    const handoffs = code ? handoffsByProject.get(code) || [] : [];
    const compiled = Boolean(profile && input.org && isFundingProfileCompiled(profile.profile, input.org, project));

    if (!code) {
      actions.push({
        key: `project:${project.id}:code`,
        type: 'assign_project_code',
        mode: 'human',
        projectCode: null,
        opportunityId: null,
        label: `${project.name} needs a canonical ACT project code.`,
      });
    } else if (!profile) {
      actions.push({
        key: `project:${code}:profile`,
        type: 'ensure_profile',
        mode: 'automatic',
        projectCode: code,
        opportunityId: null,
        label: `Create the baseline funding profile for ${project.name}.`,
      });
    } else {
      if (!compiled) {
        actions.push({
          key: `project:${code}:compile-profile`,
          type: 'compile_profile',
          mode: 'automatic',
          projectCode: code,
          opportunityId: null,
          label: `Compile canonical organisation and project facts into ${project.name}'s funding profile.`,
        });
      }
      if (profile.completeness_status !== 'decision_ready') {
        actions.push({
          key: `project:${code}:complete-profile`,
          type: 'complete_profile',
          mode: 'human',
          projectCode: code,
          opportunityId: null,
          label: `Complete ${project.name}'s applicant, place, funding-block and evidence facts.`,
        });
      }
    }

    const missingLegacyHandoffs = operationalDecisions.filter(
      decision => OPERATIONAL_DECISIONS.has(decision.decision)
        && !handoffs.some(handoff => handoff.opportunity_id === decision.opportunity_id)
    );
    if (code && missingLegacyHandoffs.length) {
      actions.push({
        key: `project:${code}:legacy-handoffs`,
        type: 'repair_handoff',
        mode: 'human',
        projectCode: code,
        opportunityId: null,
        label: `Reconcile ${missingLegacyHandoffs.length} legacy pursued ${missingLegacyHandoffs.length === 1 ? 'decision' : 'decisions'} for ${project.name} as one reviewed GHL handoff batch.`,
      });
    }

    const failedGhlHandoffs = handoffs.filter(
      handoff => handoff.sync_status !== 'succeeded' || !handoff.ghl_opportunity_id
    );
    if (code && failedGhlHandoffs.length) {
      actions.push({
        key: `project:${code}:ghl-links`,
        type: 'repair_ghl_link',
        mode: 'human',
        projectCode: code,
        opportunityId: null,
        label: `Review and repair ${failedGhlHandoffs.length} incomplete GHL ${failedGhlHandoffs.length === 1 ? 'link' : 'links'} for ${project.name} as one batch.`,
      });
    }

    for (const handoff of handoffs) {
      if (handoff.sync_status === 'succeeded' && handoff.ghl_opportunity_id && !handoff.notion_brief_url) {
        actions.push({
          key: `handoff:${code}:${handoff.opportunity_id}:notion`,
          type: 'sync_notion_workspace',
          mode: 'automatic',
          projectCode: code,
          opportunityId: handoff.opportunity_id,
          label: `Create the missing Notion writing workspace for ${code}.`,
        });
      }
    }

    return {
      projectId: project.id,
      projectCode: code,
      projectName: project.name,
      projectSlug: project.slug,
      profileStatus: profile?.completeness_status || 'missing',
      profileVersion: profile?.profile_version || null,
      compiled,
      unresolvedDecisions: unresolvedCount(profile?.profile),
      evidenceSafeMatches: recommendations.length,
      decisions: decisions.length,
      historicalWins: historicalWins.length,
      pursued: handoffs.length,
      ghlLinked: handoffs.filter(row => row.sync_status === 'succeeded' && row.ghl_opportunity_id).length,
      notionLinked: handoffs.filter(row => row.notion_brief_url).length,
      attention: 0,
    } satisfies FundingControlPlaneProject;
  });

  const attentionByProject = new Map<string, Set<FundingReconciliationActionType>>();
  for (const action of actions) {
    if (!action.projectCode) continue;
    const actionTypes = attentionByProject.get(action.projectCode) || new Set<FundingReconciliationActionType>();
    actionTypes.add(action.type);
    attentionByProject.set(action.projectCode, actionTypes);
  }
  for (const project of projects) {
    project.attention = project.projectCode ? attentionByProject.get(project.projectCode)?.size || 0 : 1;
  }

  const uniqueOpportunities = new Set(input.recommendations.map(row => row.opportunity_id));
  return {
    generatedAt: input.generatedAt || new Date().toISOString(),
    ownership: {
      discovery: 'GrantScope',
      operations: 'GHL',
      writing: 'Notion',
      integration: 'Supabase',
    },
    summary: {
      activeProjects: projects.length,
      profileCoverage: projects.filter(project => project.profileStatus !== 'missing').length,
      compiledProfiles: projects.filter(project => project.compiled).length,
      decisionReadyProfiles: projects.filter(project => project.profileStatus === 'decision_ready').length,
      evidenceSafeMatches: input.recommendations.length,
      uniqueOpportunities: uniqueOpportunities.size,
      historicalWins: input.decisions.filter(
        decision => isHistoricalEvidence(decision) && decision.decision === 'won'
      ).length,
      pursued: input.handoffs.length,
      ghlLinked: input.handoffs.filter(row => row.sync_status === 'succeeded' && row.ghl_opportunity_id).length,
      notionLinked: input.handoffs.filter(row => row.notion_brief_url).length,
      automaticActions: actions.filter(action => action.mode === 'automatic').length,
      humanActions: actions.filter(action => action.mode === 'human').length,
    },
    projects,
    actions,
  };
}

async function loadFundingControlPlaneInput(slug: string): Promise<FundingControlPlaneInput | null> {
  if (!isActSlug(slug)) return null;
  const db = getServiceSupabase();
  const { data: org, error: orgError } = await db
    .from('org_profiles')
    .select('id, name, abn, additional_abns, org_type, org_status, auspice_org_name, geographic_focus')
    .eq('slug', 'act')
    .single();
  if (orgError || !org) throw new Error(orgError?.message || 'ACT org profile not found');

  const [projectsResult, profilesResult] = await Promise.all([
    db.from('org_projects')
      .select('id, code, name, slug, description, category, parent_project_id, status, abn, metadata, org_profile_id')
      .eq('org_profile_id', org.id)
      .eq('status', 'active')
      .order('sort_order'),
    db.from('project_funding_profiles')
      .select('org_project_id, profile_version, completeness_status, profile, provenance')
      .eq('org_profile_id', org.id)
      .eq('is_current', true),
  ]);
  for (const result of [projectsResult, profilesResult]) {
    if (result.error) throw new Error(`Funding control plane unavailable: ${result.error.message}`);
  }

  const projects = (projectsResult.data || []) as RawProject[];
  const projectCodes = projects.flatMap(project => project.code ? [project.code] : []);
  let recommendations: RawRecommendation[] = [];
  let decisions: RawDecision[] = [];
  let handoffs: RawHandoff[] = [];
  if (projectCodes.length) {
    const [recommendationsResult, decisionsResult, handoffsResult] = await Promise.all([
      db.from('act_grant_recommendations_current')
        .select('project_code, opportunity_id')
        .in('project_code', projectCodes)
        .eq('is_strong_fit', true),
      db.from('act_grant_recommendation_decisions')
        .select('project_code, opportunity_id, decision, decision_scope, decision_origin, notes')
        .in('project_code', projectCodes),
      db.from('funding_ghl_handoffs')
        .select('project_code, opportunity_id, ghl_opportunity_id, notion_brief_url, sync_status, last_error')
        .eq('org_profile_id', org.id),
    ]);
    for (const result of [recommendationsResult, decisionsResult, handoffsResult]) {
      if (result.error) throw new Error(`Funding control plane unavailable: ${result.error.message}`);
    }
    recommendations = (recommendationsResult.data || []) as RawRecommendation[];
    decisions = (decisionsResult.data || []) as RawDecision[];
    handoffs = (handoffsResult.data || []) as RawHandoff[];
  }

  return {
    org: org as FundingProfileCompilerOrg,
    projects,
    profiles: (profilesResult.data || []) as RawProfile[],
    recommendations,
    decisions,
    handoffs,
  };
}

export async function getFundingControlPlane(slug = 'act') {
  const input = await loadFundingControlPlaneInput(slug);
  return input ? buildFundingControlPlane(input) : null;
}

export async function reconcileFundingSystem(slug = 'act') {
  const input = await loadFundingControlPlaneInput(slug);
  if (!input) throw new Error('Funding control plane is unavailable');
  const before = buildFundingControlPlane(input);
  const db = getServiceSupabase();
  if (!input.org) throw new Error('Funding organisation context is unavailable');
  const profileCodes = new Set(
    before.actions
      .filter(action => ['ensure_profile', 'compile_profile'].includes(action.type) && action.projectCode)
      .map(action => action.projectCode as string)
  );
  const profilesByProject = new Map(input.profiles.map(profile => [profile.org_project_id, profile]));
  const profileRows = input.projects.flatMap(project => {
    if (!project.code || !project.org_profile_id || !profileCodes.has(project.code)) return [];
    return [compileFundingProfile({
      org: input.org as FundingProfileCompilerOrg,
      project,
      existing: profilesByProject.get(project.id),
    })];
  });

  let profilesCreated = 0;
  if (profileRows.length) {
    const { data, error } = await db
      .from('project_funding_profiles')
      .upsert(profileRows, { onConflict: 'org_project_id,profile_version' })
      .select('id');
    if (error) throw new Error(`Funding profile reconciliation failed: ${error.message}`);
    profilesCreated = data?.length || 0;
    if (profilesCreated !== profileRows.length) {
      throw new Error(`Funding profile reconciliation attempted ${profileRows.length} but wrote ${profilesCreated}`);
    }
  }

  const notionActions = before.actions.filter(
    action => action.type === 'sync_notion_workspace' && action.projectCode && action.opportunityId
  );
  const notionResults: Array<{
    projectCode: string;
    opportunityId: string;
    status: 'succeeded' | 'failed';
    operation?: string;
    pageUrl?: string;
    error?: string;
  }> = [];
  for (const action of notionActions) {
    try {
      const result = await createOrUpdateFundingBrief(action.projectCode as string, action.opportunityId as string);
      notionResults.push({
        projectCode: action.projectCode as string,
        opportunityId: action.opportunityId as string,
        status: 'succeeded',
        operation: result.operation,
        pageUrl: result.pageUrl,
      });
    } catch (error) {
      notionResults.push({
        projectCode: action.projectCode as string,
        opportunityId: action.opportunityId as string,
        status: 'failed',
        error: error instanceof Error ? error.message : 'Notion reconciliation failed',
      });
    }
  }

  return {
    attempted: {
      profiles: profileRows.length,
      notionWorkspaces: notionActions.length,
    },
    completed: {
      profiles: profilesCreated,
      notionWorkspaces: notionResults.filter(result => result.status === 'succeeded').length,
    },
    notionResults,
    before,
    after: await getFundingControlPlane(slug),
  };
}
