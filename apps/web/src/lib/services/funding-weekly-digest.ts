import { getServiceSupabase } from '@/lib/supabase';
import { getProjectFundingPortfolio } from '@/lib/services/project-funding-service';

export interface FundingDigestMetrics { applyNow: number; quarantined: number; queueSize: number; decisionsThisWeek: number; pursuedTotal: number; submittedTotal: number; wonTotal: number; pursueToSubmissionRate: number | null; medianDecisionHours: number | null; decisionReadyProfiles: number; activeProfiles: number; failingSources: number; queueWithinLimit: boolean; unsupportedInQueue: number; benchmarkReviewedThisWeek: number; benchmarkWeeklyRemaining: number; benchmarkBalancedProjects: number }
export interface FundingWeeklyDigest { weekStart: string; generatedAt: string; metrics: FundingDigestMetrics; priorityActions: string[]; markdown: string }

export function calculateFundingDigestMetrics(input: { applyNow: number; quarantined: number; queueSize: number; decisionHours: number[]; decisionsThisWeek: number; pursuedTotal: number; submittedTotal: number; wonTotal: number; decisionReadyProfiles: number; activeProfiles: number; failingSources: number; unsupportedInQueue?: number; benchmarkReviewedThisWeek?: number; benchmarkWeeklyRemaining?: number; benchmarkBalancedProjects?: number }): FundingDigestMetrics {
  const sorted = [...input.decisionHours].sort((a, b) => a - b); const middle = Math.floor(sorted.length / 2);
  const median = sorted.length === 0 ? null : sorted.length % 2 ? sorted[middle] : (sorted[middle - 1] + sorted[middle]) / 2;
  const activeFunnel = input.pursuedTotal + input.submittedTotal;
  return { ...input, medianDecisionHours: median == null ? null : Math.round(median * 10) / 10, pursueToSubmissionRate: activeFunnel > 0 ? Math.round((input.submittedTotal / activeFunnel) * 1000) / 10 : null, queueWithinLimit: input.queueSize <= 5, unsupportedInQueue: input.unsupportedInQueue || 0, benchmarkReviewedThisWeek: input.benchmarkReviewedThisWeek || 0, benchmarkWeeklyRemaining: input.benchmarkWeeklyRemaining ?? 12, benchmarkBalancedProjects: input.benchmarkBalancedProjects || 0 };
}

function monday(date = new Date()) { const copy = new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate())); const day = copy.getUTCDay(); copy.setUTCDate(copy.getUTCDate() - (day === 0 ? 6 : day - 1)); return copy.toISOString().slice(0, 10); }
export function buildPriorityActions(metrics: FundingDigestMetrics): string[] { const actions: string[] = []; if (metrics.queueSize > 0) actions.push(`Resolve the ${Math.min(metrics.queueSize, 5)} funding decisions in this week's bounded queue.`); if (metrics.benchmarkWeeklyRemaining > 0) actions.push(`Review ${metrics.benchmarkWeeklyRemaining} remaining benchmark cases to improve project matching without exceeding the weekly learning cap.`); if (metrics.decisionReadyProfiles < metrics.activeProfiles) actions.push(`Complete applicant, geography, funding-block and evidence facts for ${metrics.activeProfiles - metrics.decisionReadyProfiles} project profiles.`); if (metrics.failingSources > 0) actions.push(`Repair or review ${metrics.failingSources} funding source failures recorded this week.`); if (metrics.unsupportedInQueue > 0) actions.push(`Remove ${metrics.unsupportedInQueue} unsupported opportunities from the decision queue.`); if (!actions.length) actions.push('Review outcomes and refresh the next five funding decisions.'); return actions.slice(0, 5); }

export async function generateFundingWeeklyDigest(slug = 'act'): Promise<FundingWeeklyDigest> {
  const db = getServiceSupabase(); const portfolio = await getProjectFundingPortfolio(slug); if (!portfolio) throw new Error('Funding portfolio is unavailable');
  const { data: org, error: orgError } = await db.from('org_profiles').select('id').eq('slug', 'act').single(); if (orgError || !org) throw new Error(orgError?.message || 'ACT org profile not found');
  const weekStart = monday(); const weekIso = `${weekStart}T00:00:00.000Z`;
  const [statusResult, decisionsResult, recommendationsResult, profilesResult, failuresResult, benchmarkResult, projectsResult] = await Promise.all([
    db.from('act_funding_opportunity_current_status').select('feed_status'),
    db.from('act_grant_recommendation_decisions').select('decision, decided_at, opportunity_id, project_code'),
    db.from('act_grant_recommendations_current').select('opportunity_id, project_code, computed_at'),
    db.from('project_funding_profiles').select('completeness_status').eq('is_current', true),
    db.from('agent_runs').select('agent_id, status, started_at').gte('started_at', weekIso).order('started_at', { ascending: false }),
    db.from('act_opportunity_benchmark_cases').select('project_code, expected_label, review_status, label_source, reviewed_at').eq('benchmark_version', 'act-opportunity-v1'),
    db.from('org_projects').select('code').eq('status', 'active'),
  ]);
  for (const result of [statusResult, decisionsResult, recommendationsResult, profilesResult, failuresResult, benchmarkResult, projectsResult]) if (result.error) throw new Error(result.error.message);
  const statuses = statusResult.data || []; const decisions = decisionsResult.data || []; const profiles = profilesResult.data || [];
  const weeklyDecisions = decisions.filter(row => row.decided_at && row.decided_at >= weekIso);
  const stateCounts = decisions.reduce<Record<string, number>>((acc, row) => { acc[row.decision] = (acc[row.decision] || 0) + 1; return acc; }, {});
  const recommendationTimes = new Map((recommendationsResult.data || []).map(row => [`${row.project_code}:${row.opportunity_id}`, row.computed_at]));
  const decisionHours = weeklyDecisions.flatMap(row => {
    const computedAt = recommendationTimes.get(`${row.project_code}:${row.opportunity_id}`);
    if (!computedAt || !row.decided_at) return [];
    return [Math.max(0, (new Date(row.decided_at).getTime() - new Date(computedAt).getTime()) / 3_600_000)];
  });
  const benchmarkCases = benchmarkResult.data || []; const activeCodes = new Set((projectsResult.data || []).map(row => row.code));
  const latestAgentStatus = new Map<string, string>(); for (const row of failuresResult.data || []) if (!latestAgentStatus.has(row.agent_id)) latestAgentStatus.set(row.agent_id, row.status);
  const failingSources = [...latestAgentStatus.values()].filter(status => ['failed', 'timeout', 'partial'].includes(status)).length;
  const benchmarkReviewedThisWeek = benchmarkCases.filter(row => row.label_source === 'human_benchmark_review' && row.reviewed_at && row.reviewed_at >= weekIso).length;
  const benchmarkBalancedProjects = [...activeCodes].filter(code => { const confirmed = benchmarkCases.filter(row => row.project_code === code && row.review_status === 'confirmed'); const relevant = confirmed.filter(row => row.expected_label === 'relevant').length; const notRelevant = confirmed.filter(row => row.expected_label === 'not_relevant').length; return confirmed.length >= 20 && relevant >= 5 && notRelevant >= 5; }).length;
  const metrics = calculateFundingDigestMetrics({ applyNow: statuses.filter(row => row.feed_status === 'apply_now').length, quarantined: statuses.filter(row => row.feed_status !== 'apply_now').length, queueSize: portfolio.weeklyQueue.length, decisionHours, decisionsThisWeek: weeklyDecisions.length, pursuedTotal: stateCounts.pursuing || 0, submittedTotal: (stateCounts.applied || 0) + (stateCounts.submitted || 0), wonTotal: stateCounts.won || 0, decisionReadyProfiles: profiles.filter(row => row.completeness_status === 'decision_ready').length, activeProfiles: profiles.length, failingSources, unsupportedInQueue: portfolio.weeklyQueue.filter(item => !item.sourceUrl || !item.applicationUrl || !item.deadline).length, benchmarkReviewedThisWeek, benchmarkWeeklyRemaining: Math.max(0, 12 - benchmarkReviewedThisWeek), benchmarkBalancedProjects });
  const priorityActions = buildPriorityActions(metrics); const generatedAt = new Date().toISOString();
  const markdown = [`# ACT Funding Week — ${weekStart}`, '', `- Apply now: ${metrics.applyNow}; quarantined: ${metrics.quarantined}`, `- Decision queue: ${metrics.queueSize}/5; decisions this week: ${metrics.decisionsThisWeek}`, `- Benchmark learning: ${metrics.benchmarkReviewedThisWeek}/12 reviewed; ${metrics.benchmarkBalancedProjects}/${metrics.activeProfiles} active projects balanced`, `- Current pipeline — pursuing: ${metrics.pursuedTotal}; submitted/applied: ${metrics.submittedTotal}; won: ${metrics.wonTotal}`, `- Pursue-to-submission progression: ${metrics.pursueToSubmissionRate == null ? 'not enough active pipeline data' : `${metrics.pursueToSubmissionRate}%`}`, `- Median recommendation-to-decision time: ${metrics.medianDecisionHours == null ? 'not enough matched decisions' : `${metrics.medianDecisionHours} hours`}`, `- Decision-ready profiles: ${metrics.decisionReadyProfiles}/${metrics.activeProfiles}`, `- Failing sources: ${metrics.failingSources}`, '', '## This week', ...priorityActions.map(action => `- ${action}`)].join('\n');
  const { error } = await db.from('funding_weekly_cycles').upsert({ org_profile_id: org.id, week_start: weekStart, generated_at: generatedAt, metrics, queue_snapshot: portfolio.weeklyQueue, priority_actions: priorityActions, digest_markdown: markdown, delivery_status: 'in_app', updated_at: generatedAt }, { onConflict: 'org_profile_id,week_start' }); if (error) throw new Error(error.message);
  return { weekStart, generatedAt, metrics, priorityActions, markdown };
}

export async function getLatestFundingWeeklyDigest(slug = 'act'): Promise<FundingWeeklyDigest | null> { if (slug !== 'act') return null; const db = getServiceSupabase(); const { data: org } = await db.from('org_profiles').select('id').eq('slug', 'act').maybeSingle(); if (!org) return null; const { data } = await db.from('funding_weekly_cycles').select('week_start, generated_at, metrics, priority_actions, digest_markdown').eq('org_profile_id', org.id).order('week_start', { ascending: false }).limit(1).maybeSingle(); return data ? { weekStart: data.week_start, generatedAt: data.generated_at, metrics: data.metrics as FundingDigestMetrics, priorityActions: data.priority_actions as string[], markdown: data.digest_markdown } : null; }
