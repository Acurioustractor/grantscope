import { getServiceSupabase } from '@/lib/supabase';

function normaliseFunderName(value: string) {
  return value
    .toLowerCase()
    .replace(/\bthe trustee for\b/g, ' ')
    .replace(/\bfoundation limited\b/g, ' ')
    .replace(/\b(?:pty|ltd|limited|trust|foundation|charitable)\b/g, ' ')
    .replace(/[^a-z0-9]+/g, ' ')
    .trim()
    .replace(/\s+/g, ' ');
}

function funderMatchScore(target: string, candidate: { funder_name: string; funder_aliases?: string[] | null }) {
  const targetName = normaliseFunderName(target);
  const names = [candidate.funder_name, ...(candidate.funder_aliases ?? [])].map(normaliseFunderName);
  if (names.includes(targetName)) return 3;
  if (targetName.length >= 6 && names.some((name) => name.includes(targetName) || targetName.includes(name))) return 2;
  return 0;
}

export type BenchmarkLane = 'commercial_public_benefit' | 'community_partner' | 'arts_cultural' | 'portfolio';

export function benchmarkLane(projectCode: string): BenchmarkLane {
  if (projectCode === 'ACT-GD') return 'commercial_public_benefit';
  if (['ACT-HV', 'ACT-PI', 'ACT-PI-ER', 'ACT-PI-SP'].includes(projectCode)) return 'community_partner';
  if (['ACT-EL', 'ACT-JH-CT'].includes(projectCode)) return 'arts_cultural';
  return 'portfolio';
}

export function selectWeeklyBenchmarkBatch<T extends { id: string; project_code: string; name?: string | null; candidate_role?: string | null }>(cases: T[], limit = 12): T[] {
  const lanes: BenchmarkLane[] = ['commercial_public_benefit', 'community_partner', 'arts_cultural'];
  const projectOrder: Record<BenchmarkLane, string[]> = {
    commercial_public_benefit: ['ACT-GD'],
    community_partner: ['ACT-HV', 'ACT-PI', 'ACT-PI-ER', 'ACT-PI-SP'],
    arts_cultural: ['ACT-JH-CT', 'ACT-EL'],
    portfolio: [],
  };
  const selected: T[] = [];
  const selectedIds = new Set<string>();
  const selectedNames = new Set<string>();
  const add = (item: T | undefined) => {
    if (!item || selectedIds.has(item.id)) return false;
    const name = String(item.name || '').toLowerCase().trim();
    const nameKey = `${benchmarkLane(item.project_code)}:${name}`;
    if (name && selectedNames.has(nameKey)) return false;
    selected.push(item); selectedIds.add(item.id); if (name) selectedNames.add(nameKey); return true;
  };
  for (const lane of lanes) {
    const laneCases = cases.filter((item) => benchmarkLane(item.project_code) === lane);
    const laneStart = selected.length;
    for (let index = 0; selected.length - laneStart < 4 && index < 20; index += 1) {
      const projectCode = projectOrder[lane][index % projectOrder[lane].length];
      const role = index % 2 === 0 ? 'plausible' : 'control';
      add(laneCases.find((item) => item.project_code === projectCode && item.candidate_role === role && !selectedIds.has(item.id)));
    }
    for (const item of laneCases) {
      if (selected.length - laneStart >= 4) break;
      add(item);
    }
  }
  for (const item of cases) {
    if (selected.length >= limit) break;
    add(item);
  }
  return selected.slice(0, limit);
}

export interface ActResearchExperiment {
  id: string;
  name: string;
  provider: string;
  hypothesis: string;
  status: 'planned' | 'running' | 'evaluated' | 'stopped';
  budget_cap_aud: number;
  actual_cost_aud: number;
  benchmark_version: string | null;
  sample_size: number;
  precision_at_10: number | null;
  recall_at_10: number | null;
  false_positive_rate: number | null;
  community_benefit_score: number | null;
  findings: string | null;
}

export interface ActResearchInitiative {
  id: string;
  slug: string;
  title: string;
  purpose: string;
  status: 'design' | 'benchmarking' | 'pilot' | 'paused' | 'complete';
  current_phase: number;
  budget_cap_aud: number;
  spend_to_date_aud: number;
  community_benefit_commitment: string;
  governance_principles: string[];
  success_metrics: Record<string, number>;
  stop_conditions: string[];
  next_decision: string;
  next_decision_at: string | null;
  evidence_urls: string[];
  experiments: ActResearchExperiment[];
  benchmark: {
    version: string;
    total: number;
    confirmed: number;
    pending: number;
    relevant: number;
    notRelevant: number;
    weeklyLimit: number;
    reviewedThisWeek: number;
    weeklyRemaining: number;
    coverage: Array<{
      projectCode: string;
      projectName: string;
      confirmed: number;
      relevant: number;
      notRelevant: number;
      pending: number;
      target: number;
      shortfall: number;
      balanced: boolean;
    }>;
    pendingCases: Array<{
      id: string;
      project_code: string;
      name: string;
      funder_name: string | null;
      source_url: string | null;
      deadline: string | null;
      rationale: string | null;
      description: string | null;
      min_grant_amount: number | null;
      max_grant_amount: number | null;
      total_pool_amount: number | null;
      eligible_org_types: string[];
      jurisdictions: string[];
      is_national: boolean;
      focus_areas: string[];
      keywords: string[];
      opportunity_type: string | null;
      verification_status: string | null;
      verification_notes: string | null;
      verified_at: string | null;
      application_url: string | null;
      project_label: string | null;
      project_notes: string | null;
      project_theme_keywords: string[];
      benchmark_lane: BenchmarkLane;
      candidate_role: string | null;
      available_projects: Array<{ code: string; label: string }>;
      foundation_context: {
        foundation_id: string | null;
        funder_name: string;
        website: string | null;
        annual_giving: number | null;
        relationship_score: number;
        contacts_count: number;
        contacts: Array<{ name?: string; email?: string; last_contact_date?: string }>;
        most_recent_contact_at: string | null;
        email_count: number;
        email_last_date: string | null;
        xero_paid_total: number;
        notion_org_name: string | null;
        total_decisions: number;
      } | null;
    }>;
  };
}

export async function getActResearchInitiative(): Promise<ActResearchInitiative | null> {
  const db = getServiceSupabase();
  const [{ data, error }, { data: cases, error: casesError }, { data: projects, error: projectsError }, { data: activeProjects, error: activeProjectsError }] = await Promise.all([
    db.from('act_research_initiatives')
      .select(`
        id, slug, title, purpose, status, current_phase, budget_cap_aud, spend_to_date_aud,
        community_benefit_commitment, governance_principles, success_metrics, stop_conditions,
        next_decision, next_decision_at, evidence_urls,
        experiments:act_research_experiments(
          id, name, provider, hypothesis, status, budget_cap_aud, actual_cost_aud,
          benchmark_version, sample_size, precision_at_10, recall_at_10,
          false_positive_rate, community_benefit_score, findings
        )
      `)
      .eq('slug', 'community-opportunity-intelligence')
      .single(),
    db.from('act_opportunity_benchmark_cases')
      .select(`
        id, benchmark_version, project_code, name, funder_name, source_url, deadline,
        expected_label, review_status, rationale, evidence, label_source, reviewed_at,
        opportunity:alma_funding_opportunities(
          description, min_grant_amount, max_grant_amount, total_pool_amount,
          eligible_org_types, jurisdictions, is_national, focus_areas, keywords,
          opportunity_type, verification_status, verification_notes, verified_at,
          application_url
        )
      `)
      .eq('benchmark_version', 'act-opportunity-v1')
      .order('review_status', { ascending: false })
      .order('created_at', { ascending: true }),
    db.from('act_grant_recommendation_projects')
      .select('project_code, project_label, notes, theme_keywords')
      .eq('in_scope', true),
    db.from('org_projects')
      .select('code, name')
      .eq('status', 'active')
      .order('sort_order'),
  ]);

  if (error) {
    console.error('[act-research] initiative query failed:', error.message);
    return null;
  }
  if (casesError) {
    console.error('[act-research] benchmark query failed:', casesError.message);
  }
  if (projectsError) {
    console.error('[act-research] project context query failed:', projectsError.message);
  }
  if (activeProjectsError) {
    console.error('[act-research] active project query failed:', activeProjectsError.message);
  }
  const benchmarkCases = cases ?? [];
  const funderNames = [...new Set(benchmarkCases.map((item) => item.funder_name).filter((name): name is string => Boolean(name)))];
  const searchableFunderNames = [...new Set(funderNames
    .map(normaliseFunderName)
    .filter((name) => name.length >= 4)
    .map((name) => name.replaceAll(',', ' ')))];
  const { data: funderContexts, error: funderContextError } = searchableFunderNames.length
    ? await db.from('funder_context_snapshot')
        .select('foundation_id, funder_name, funder_aliases, website, annual_giving, relationship_score, contacts_count, contacts, most_recent_contact_at, email_count, email_last_date, xero_paid_total, notion_org_name, total_decisions')
        .or(searchableFunderNames.map((name) => `funder_name.ilike.%${name.replaceAll(' ', '%')}%`).join(','))
        .limit(200)
    : { data: [], error: null };
  if (funderContextError) {
    console.error('[act-research] funder context query failed:', funderContextError.message);
  }
  const projectByCode = new Map((projects ?? []).map((project) => [project.project_code, project]));
  const availableProjects = (projects ?? []).map((project) => ({
    code: project.project_code,
    label: project.project_label || project.notes || project.project_code,
  }));
  const confirmed = benchmarkCases.filter((item) => item.review_status === 'confirmed');
  const now = new Date();
  const monday = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()));
  monday.setUTCDate(monday.getUTCDate() - (monday.getUTCDay() === 0 ? 6 : monday.getUTCDay() - 1));
  const reviewedThisWeek = benchmarkCases.filter((item) => item.label_source === 'human_benchmark_review' && item.reviewed_at && new Date(item.reviewed_at) >= monday).length;
  const weeklyLimit = 12;
  const weeklyRemaining = Math.max(0, weeklyLimit - reviewedThisWeek);
  const coverage = (activeProjects ?? []).map((project) => {
    const projectCases = benchmarkCases.filter((item) => item.project_code === project.code);
    const projectConfirmed = projectCases.filter((item) => item.review_status === 'confirmed');
    const relevant = projectConfirmed.filter((item) => item.expected_label === 'relevant').length;
    const notRelevant = projectConfirmed.filter((item) => item.expected_label === 'not_relevant').length;
    return {
      projectCode: project.code,
      projectName: project.name,
      confirmed: projectConfirmed.length,
      relevant,
      notRelevant,
      pending: projectCases.filter((item) => item.review_status === 'pending').length,
      target: 20,
      shortfall: Math.max(0, 20 - projectConfirmed.length),
      balanced: projectConfirmed.length >= 20 && relevant >= 5 && notRelevant >= 5,
    };
  });
  const pendingCases = benchmarkCases
    .filter((item) => item.review_status === 'pending')
    .map((item) => {
      const opportunity = Array.isArray(item.opportunity) ? item.opportunity[0] : item.opportunity;
      const project = projectByCode.get(item.project_code);
      const foundationContext = item.funder_name
        ? (funderContexts ?? [])
            .map((context) => ({ context, score: funderMatchScore(item.funder_name!, context) }))
            .filter((match) => match.score > 0)
            .sort((a, b) => b.score - a.score)[0]?.context ?? null
        : null;
      const evidence = item.evidence && typeof item.evidence === 'object' ? item.evidence as Record<string, unknown> : {};
      return {
        id: item.id, project_code: item.project_code, name: item.name, funder_name: item.funder_name,
        source_url: item.source_url, deadline: item.deadline, rationale: item.rationale,
        description: opportunity?.description ?? null, min_grant_amount: opportunity?.min_grant_amount ?? null,
        max_grant_amount: opportunity?.max_grant_amount ?? null, total_pool_amount: opportunity?.total_pool_amount ?? null,
        eligible_org_types: opportunity?.eligible_org_types ?? [], jurisdictions: opportunity?.jurisdictions ?? [],
        is_national: opportunity?.is_national ?? false, focus_areas: opportunity?.focus_areas ?? [], keywords: opportunity?.keywords ?? [],
        opportunity_type: opportunity?.opportunity_type ?? null, verification_status: opportunity?.verification_status ?? null,
        verification_notes: opportunity?.verification_notes ?? null, verified_at: opportunity?.verified_at ?? null,
        application_url: opportunity?.application_url ?? null, project_label: project?.project_label ?? null,
        project_notes: project?.notes ?? null, project_theme_keywords: project?.theme_keywords ?? [], available_projects: availableProjects,
        benchmark_lane: benchmarkLane(item.project_code), candidate_role: typeof evidence.candidate_role === 'string' ? evidence.candidate_role : null,
        foundation_context: foundationContext ? { foundation_id: foundationContext.foundation_id, funder_name: foundationContext.funder_name, website: foundationContext.website, annual_giving: foundationContext.annual_giving, relationship_score: foundationContext.relationship_score, contacts_count: foundationContext.contacts_count, contacts: Array.isArray(foundationContext.contacts) ? foundationContext.contacts : [], most_recent_contact_at: foundationContext.most_recent_contact_at, email_count: foundationContext.email_count, email_last_date: foundationContext.email_last_date, xero_paid_total: foundationContext.xero_paid_total, notion_org_name: foundationContext.notion_org_name, total_decisions: foundationContext.total_decisions } : null,
      };
    });
  return {
    ...(data as unknown as Omit<ActResearchInitiative, 'benchmark'>),
    benchmark: {
      version: 'act-opportunity-v1',
      total: benchmarkCases.length,
      confirmed: confirmed.length,
      pending: benchmarkCases.filter((item) => item.review_status === 'pending').length,
      relevant: confirmed.filter((item) => item.expected_label === 'relevant').length,
      notRelevant: confirmed.filter((item) => item.expected_label === 'not_relevant').length,
      weeklyLimit,
      reviewedThisWeek,
      weeklyRemaining,
      coverage,
      pendingCases: selectWeeklyBenchmarkBatch(pendingCases, weeklyRemaining),
    },
  };
}
