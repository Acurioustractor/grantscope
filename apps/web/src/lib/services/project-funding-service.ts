import { cache } from 'react';
import { getServiceSupabase } from '@/lib/supabase';
import { isActSlug } from '@/lib/services/fast-local-org';

export type FundingProfileCompleteness = 'baseline' | 'partial' | 'decision_ready';

export interface ProjectFundingProfileSummary {
  projectId: string;
  projectCode: string;
  projectName: string;
  projectSlug: string;
  description: string | null;
  profileVersion: string;
  completeness: FundingProfileCompleteness;
  unresolvedDecisions: string[];
  entities: number;
  fundingBlocks: number;
  geographies: string[];
}

export interface WeeklyFundingQueueItem {
  opportunityId: string;
  opportunityName: string;
  funderName: string | null;
  projectCode: string;
  projectName: string;
  projectSlug: string;
  fitScore: number;
  deadline: string;
  maxAmount: number | null;
  sourceUrl: string | null;
  applicationUrl: string | null;
  eligibilityDecision: 'eligible_direct' | 'eligible_partner_led' | 'needs_verification';
  eligibilityReason: string;
  daysRemaining: number;
  lexicalScore?: number;
  semanticScore?: number;
  recommendationScore?: number;
  hybridScore?: number;
  eligibilityEvidence?: Record<string, unknown>;
}

export interface ProjectFundingPortfolio {
  profiles: ProjectFundingProfileSummary[];
  weeklyQueue: WeeklyFundingQueueItem[];
  candidateCount: number;
  generatedAt: string;
}

interface RawProject {
  id: string;
  code: string;
  name: string;
  slug: string;
  description: string | null;
}

interface RawProfile {
  org_project_id: string;
  profile_version: string;
  completeness_status: FundingProfileCompleteness;
  profile: Record<string, unknown>;
}

interface RawRecommendation {
  project_code: string;
  opportunity_id: string;
  opportunity_name: string;
  funder_name: string | null;
  deadline: string | null;
  max_grant_amount: number | null;
  fit_score: number;
  eligibility_score: number;
  source_url: string | null;
  application_url: string | null;
}

interface RawDecision {
  project_code: string;
  opportunity_id: string;
  decision: string;
}

interface RawHybridMatch {
  opportunity_id: string;
  project_code: string;
  opportunity_name: string;
  funder_name: string | null;
  deadline: string;
  max_grant_amount: number | null;
  source_url: string | null;
  application_url: string | null;
  lexical_score: number;
  semantic_score: number;
  recommendation_score: number;
  hybrid_score: number;
  eligibility_decision: WeeklyFundingQueueItem['eligibilityDecision'];
  eligibility_evidence: Record<string, unknown>;
}

function asRecord(value: unknown): Record<string, unknown> {
  return value && typeof value === 'object' && !Array.isArray(value)
    ? value as Record<string, unknown>
    : {};
}

function asStringArray(value: unknown): string[] {
  return Array.isArray(value) ? value.filter((item): item is string => typeof item === 'string') : [];
}

function asArray(value: unknown): unknown[] {
  return Array.isArray(value) ? value : [];
}

export function buildWeeklyFundingQueue({
  recommendations,
  decisions,
  profiles,
  now = new Date(),
  limit = 5,
}: {
  recommendations: RawRecommendation[];
  decisions: RawDecision[];
  profiles: ProjectFundingProfileSummary[];
  now?: Date;
  limit?: number;
}): WeeklyFundingQueueItem[] {
  const decided = new Set(decisions.map(row => `${row.project_code}|${row.opportunity_id}`));
  const profilesByCode = new Map(profiles.map(profile => [profile.projectCode, profile]));
  const bestByOpportunity = new Map<string, WeeklyFundingQueueItem & { rank: number }>();

  for (const recommendation of recommendations) {
    if (decided.has(`${recommendation.project_code}|${recommendation.opportunity_id}`)) continue;
    if (!recommendation.deadline || !recommendation.source_url || !recommendation.application_url) continue;
    const profile = profilesByCode.get(recommendation.project_code);
    if (!profile) continue;
    const deadline = new Date(recommendation.deadline);
    if (Number.isNaN(deadline.getTime()) || deadline <= now) continue;
    const daysRemaining = Math.max(0, Math.ceil((deadline.getTime() - now.getTime()) / 86_400_000));
    const readinessPenalty = profile.completeness === 'decision_ready' ? 0 : profile.completeness === 'partial' ? 4 : 10;
    const urgencyBoost = daysRemaining <= 14 ? 12 : daysRemaining <= 30 ? 7 : daysRemaining <= 60 ? 3 : 0;
    const eligibilityDecision = profile.completeness !== 'decision_ready'
      ? 'needs_verification'
      : recommendation.eligibility_score >= 70
        ? 'eligible_direct'
        : recommendation.eligibility_score >= 45
          ? 'eligible_partner_led'
          : 'needs_verification';
    const eligibilityReason = profile.completeness !== 'decision_ready'
      ? `${profile.projectName} has a ${profile.completeness} profile with ${profile.unresolvedDecisions.length} unresolved decision${profile.unresolvedDecisions.length === 1 ? '' : 's'}.`
      : eligibilityDecision === 'eligible_direct'
        ? 'Current project facts and opportunity evidence support a direct applicant route.'
        : eligibilityDecision === 'eligible_partner_led'
          ? 'The opportunity appears viable through a partner or auspice route.'
          : 'Applicant eligibility still requires evidence review.';
    const item = {
      opportunityId: recommendation.opportunity_id,
      opportunityName: recommendation.opportunity_name,
      funderName: recommendation.funder_name,
      projectCode: recommendation.project_code,
      projectName: profile.projectName,
      projectSlug: profile.projectSlug,
      fitScore: recommendation.fit_score,
      deadline: recommendation.deadline,
      maxAmount: recommendation.max_grant_amount,
      sourceUrl: recommendation.source_url,
      applicationUrl: recommendation.application_url,
      eligibilityDecision,
      eligibilityReason,
      daysRemaining,
      rank: recommendation.fit_score + urgencyBoost - readinessPenalty,
    } satisfies WeeklyFundingQueueItem & { rank: number };
    const existing = bestByOpportunity.get(item.opportunityId);
    if (!existing || item.rank > existing.rank) bestByOpportunity.set(item.opportunityId, item);
  }

  return [...bestByOpportunity.values()]
    .sort((left, right) => right.rank - left.rank || left.daysRemaining - right.daysRemaining)
    .slice(0, limit)
    .map(({ rank: _rank, ...item }) => item);
}

export function buildHybridWeeklyQueue({
  matches,
  decisions,
  profiles,
  now = new Date(),
  limit = 5,
}: {
  matches: RawHybridMatch[];
  decisions: RawDecision[];
  profiles: ProjectFundingProfileSummary[];
  now?: Date;
  limit?: number;
}): WeeklyFundingQueueItem[] {
  const decidedOpportunities = new Set(decisions.map(row => row.opportunity_id));
  const profileByCode = new Map(profiles.map(profile => [profile.projectCode, profile]));
  const bestByOpportunity = new Map<string, WeeklyFundingQueueItem>();
  for (const match of matches) {
    if (decidedOpportunities.has(match.opportunity_id)) continue;
    const profile = profileByCode.get(match.project_code);
    if (!profile) continue;
    const deadline = new Date(match.deadline);
    if (Number.isNaN(deadline.getTime()) || deadline <= now) continue;
    const daysRemaining = Math.ceil((deadline.getTime() - now.getTime()) / 86_400_000);
    const item: WeeklyFundingQueueItem = {
      opportunityId: match.opportunity_id,
      opportunityName: match.opportunity_name,
      funderName: match.funder_name,
      projectCode: match.project_code,
      projectName: profile.projectName,
      projectSlug: profile.projectSlug,
      fitScore: match.recommendation_score,
      deadline: match.deadline,
      maxAmount: match.max_grant_amount,
      sourceUrl: match.source_url,
      applicationUrl: match.application_url,
      eligibilityDecision: match.eligibility_decision,
      eligibilityReason: match.eligibility_decision === 'eligible_direct'
        ? 'The current profile and published eligibility support a direct applicant route.'
        : match.eligibility_decision === 'eligible_partner_led'
          ? 'A DGR, auspice or eligible delivery partner is required for this route.'
          : `${profile.projectName} still has ${profile.unresolvedDecisions.length} unresolved profile decision${profile.unresolvedDecisions.length === 1 ? '' : 's'}.`,
      daysRemaining,
      lexicalScore: match.lexical_score,
      semanticScore: match.semantic_score,
      recommendationScore: match.recommendation_score,
      hybridScore: match.hybrid_score,
      eligibilityEvidence: match.eligibility_evidence,
    };
    const fingerprint = `${match.funder_name || ''}|${match.opportunity_name}`
      .toLowerCase()
      .replace(/\b(round|program|grant|grants|funding|the|and|for|of)\b/g, ' ')
      .replace(/[^a-z0-9]+/g, ' ')
      .trim();
    const existing = bestByOpportunity.get(fingerprint);
    if (!existing || (item.hybridScore || 0) > (existing.hybridScore || 0)) bestByOpportunity.set(fingerprint, item);
  }
  return [...bestByOpportunity.values()]
    .sort((left, right) => (right.hybridScore || 0) - (left.hybridScore || 0) || left.daysRemaining - right.daysRemaining)
    .slice(0, limit);
}

export const getProjectFundingPortfolio = cache(async function getProjectFundingPortfolio(
  slug: string,
): Promise<ProjectFundingPortfolio | null> {
  if (!isActSlug(slug)) return null;
  const db = getServiceSupabase();
  const orgResult = await db.from('org_profiles').select('id').eq('slug', 'act').single();
  if (orgResult.error || !orgResult.data) {
    throw new Error(`Project funding data unavailable: ${orgResult.error?.message || 'ACT org profile not found'}`);
  }

  const [projectsResult, profilesResult] = await Promise.all([
    db.from('org_projects')
      .select('id, code, name, slug, description')
      .eq('org_profile_id', orgResult.data.id)
      .eq('status', 'active')
      .order('sort_order'),
    db.from('project_funding_profiles')
      .select('org_project_id, profile_version, completeness_status, profile')
      .eq('org_profile_id', orgResult.data.id)
      .eq('is_current', true),
  ]);

  for (const result of [projectsResult, profilesResult]) {
    if (result.error) throw new Error(`Project funding data unavailable: ${result.error.message}`);
  }

  const projects = (projectsResult.data || []) as RawProject[];
  const projectCodes = projects
    .map(project => project.code)
    .filter((code): code is string => Boolean(code));
  const [recommendationsResult, decisionsResult] = await Promise.all([
    db.from('act_grant_recommendations_current')
      .select('project_code, opportunity_id, opportunity_name, funder_name, deadline, max_grant_amount, fit_score, eligibility_score, source_url, application_url')
      .in('project_code', projectCodes)
      .eq('is_strong_fit', true)
      .order('fit_score', { ascending: false })
      .limit(1000),
    db.from('act_grant_recommendation_decisions')
      .select('project_code, opportunity_id, decision')
      .in('project_code', projectCodes)
      .eq('decision_scope', 'operational'),
  ]);

  for (const result of [recommendationsResult, decisionsResult]) {
    if (result.error) throw new Error(`Project funding data unavailable: ${result.error.message}`);
  }

  const rawProfiles = (profilesResult.data || []) as RawProfile[];
  const projectById = new Map(projects.map(project => [project.id, project]));
  const profiles = rawProfiles.flatMap((row): ProjectFundingProfileSummary[] => {
    const project = projectById.get(row.org_project_id);
    if (!project) return [];
    const profile = asRecord(row.profile);
    const fundingNeed = asRecord(profile.fundingNeed);
    return [{
      projectId: project.id,
      projectCode: project.code,
      projectName: project.name,
      projectSlug: project.slug,
      description: project.description,
      profileVersion: row.profile_version,
      completeness: row.completeness_status,
      unresolvedDecisions: asStringArray(profile.unresolvedDecisions),
      entities: asArray(profile.entities).length,
      fundingBlocks: asArray(fundingNeed.blocks).length,
      geographies: asStringArray(profile.geographies),
    }];
  });
  const recommendations = (recommendationsResult.data || []) as RawRecommendation[];
  const decisions = (decisionsResult.data || []) as RawDecision[];
  const hybridResults = await Promise.all(profiles.map(profile => db.rpc('search_project_funding_hybrid', {
    p_org_project_id: profile.projectId,
    p_match_count: 15,
  })));
  const hybridMatches: RawHybridMatch[] = [];
  for (const result of hybridResults) {
    if (result.error) {
      console.warn(`[project-funding] Hybrid search unavailable: ${result.error.message}`);
      continue;
    }
    hybridMatches.push(...((result.data || []) as RawHybridMatch[]));
  }
  const hybridQueue = buildHybridWeeklyQueue({ matches: hybridMatches, decisions, profiles });

  return {
    profiles,
    weeklyQueue: hybridQueue.length > 0
      ? hybridQueue
      : buildWeeklyFundingQueue({ recommendations, decisions, profiles }),
    candidateCount: hybridMatches.length > 0 ? hybridMatches.length : recommendations.length,
    generatedAt: new Date().toISOString(),
  };
});
