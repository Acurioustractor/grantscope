import { getServiceSupabase } from '@/lib/supabase';

/**
 * Per-project "Apply now" — the ten candidates Phase 1 specified for
 * `/org/act/{project}/funding`.
 *
 * The page previously filtered the portfolio-wide five-place queue by project.
 * With eleven projects and five places, at least six project pages were
 * structurally guaranteed to render "no opportunity this week", forever. This
 * reads the project's own ranked list instead.
 *
 * Rows come from `act_grant_recommendations_current`, which carries an
 * explainable five-factor breakdown rather than one opaque score, and now
 * exposes `feed_status` so dated rounds rank by urgency and rolling programs
 * rank by fit. Joined through `act_grant_recommendation_projects.org_project_id`
 * — the canonical link, not the historical `project_code` string.
 */

export type ApplyNowFeedStatus = 'apply_now' | 'rolling';

export interface ApplyNowCandidate {
  opportunityId: string;
  name: string;
  funderName: string | null;
  feedStatus: ApplyNowFeedStatus;
  deadline: string | null;
  daysRemaining: number | null;
  minAmount: number | null;
  maxAmount: number | null;
  fitScore: number | null;
  /** Absolute claim: this round is a good match on its merits. */
  isStrongFit: boolean;
  /** Relative position within this project's own list. Never a quality claim. */
  projectRank: number | null;
  /** The five factors behind the score, so the number is inspectable. */
  factors: { label: string; score: number | null }[];
  sourceUrl: string | null;
  applicationUrl: string | null;
  verifiedAt: string | null;
  wonFunder: boolean;
  flags: string[];
}

/** How the project is actually funded. Anything but 'grants' means an empty
 *  grant list is the expected result, not a discovery failure. */
export type FundingRoute = 'grants' | 'buyers' | 'overhead' | 'earned' | 'mixed';

export const FUNDING_ROUTE_NOTE: Record<Exclude<FundingRoute, 'grants' | 'mixed'>, string> = {
  buyers:
    'This project is funded by buyers, not grant rounds — free open registry for everyone, paid evidence and tender tools for buyers. Two candidate grants exist in the whole corpus, so an empty list here is the strategy working, not a gap.',
  overhead:
    'This is studio overhead — governance, operating model, cross-cutting infrastructure. Grants rarely fund overhead, and only 20 capacity-building or core-cost rounds exist across the corpus. Expect this list to stay short.',
  earned:
    'This project is funded by earned revenue rather than grant rounds. Anything below is opportunistic, not the plan.',
};

export interface ProjectApplyNow {
  projectSlug: string;
  projectCode: string | null;
  projectLabel: string | null;
  /** Recorded route; null when the project has no registry row yet. */
  fundingRoute: FundingRoute | null;
  /**
   * The question blocking a confident ranking, written by whoever knows the
   * project. Surfaced instead of guessing past it — the recommender saying
   * "I cannot rank these until you answer X" beats a fabricated score.
   */
  nextQuestion: string | null;
  dated: ApplyNowCandidate[];
  rolling: ApplyNowCandidate[];
  totalConsidered: number;
  /**
   * True when nothing in this project's list clears the portfolio-wide strong-fit
   * bar. The list is still real — Contained's Touring and Travel Fund and Visit
   * Victoria Regional Events ($500K) score 40 against a bar of 55 — so the page
   * says "best available for this project" rather than showing an unexplained
   * absence of highlights.
   */
  noStrongFits: boolean;
}

const PER_LANE_LIMIT = 10;

function daysUntil(deadline: string | null): number | null {
  if (!deadline) return null;
  const ms = new Date(deadline).getTime() - Date.now();
  return Math.round(ms / 86_400_000);
}

function toCandidate(r: Record<string, unknown>): ApplyNowCandidate {
  const deadline = (r.deadline as string | null) ?? null;
  return {
    opportunityId: String(r.opportunity_id),
    name: (r.opportunity_name as string) ?? '(unnamed opportunity)',
    funderName: (r.funder_name as string | null) ?? null,
    feedStatus: (r.feed_status as ApplyNowFeedStatus) ?? 'rolling',
    deadline,
    daysRemaining: daysUntil(deadline),
    minAmount: (r.min_grant_amount as number | null) ?? null,
    maxAmount: (r.max_grant_amount as number | null) ?? null,
    fitScore: (r.fit_score as number | null) ?? null,
    isStrongFit: Boolean(r.is_strong_fit),
    projectRank: (r.project_rank as number | null) ?? null,
    factors: [
      { label: 'Theme', score: (r.theme_score as number | null) ?? null },
      { label: 'Geography', score: (r.geography_score as number | null) ?? null },
      { label: 'Eligibility', score: (r.eligibility_score as number | null) ?? null },
      { label: 'Timing', score: (r.timing_score as number | null) ?? null },
      { label: 'Track record', score: (r.track_record_score as number | null) ?? null },
    ],
    sourceUrl: (r.source_url as string | null) ?? null,
    applicationUrl: (r.application_url as string | null) ?? null,
    verifiedAt: (r.verified_at as string | null) ?? null,
    wonFunder: Boolean(r.won_funder),
    flags: (r.flags as string[] | null) ?? [],
  };
}

export async function getProjectApplyNow(projectSlug: string): Promise<ProjectApplyNow | null> {
  const db = getServiceSupabase();

  const { data: project } = await db
    .from('org_projects')
    .select('id, slug, org_profiles!inner(slug)')
    .eq('slug', projectSlug)
    .eq('org_profiles.slug', 'act')
    .maybeSingle();
  if (!project) return null;

  const { data: registry } = await db
    .from('act_grant_recommendation_projects')
    .select('project_code, project_label, primary_funding_route, next_question')
    .eq('org_project_id', (project as { id: string }).id)
    .maybeSingle();
  const reg = registry as {
    project_code?: string; project_label?: string;
    primary_funding_route?: FundingRoute; next_question?: string;
  } | null;

  // A project with no registry row simply has no recommendations yet — an empty
  // page is the honest answer, not a 404.
  const projectCode = reg?.project_code ?? null;
  if (!projectCode) {
    return {
      projectSlug,
      projectCode: null,
      projectLabel: null,
      fundingRoute: null,
      nextQuestion: null,
      dated: [],
      rolling: [],
      totalConsidered: 0,
      noStrongFits: true,
    };
  }

  const { data, error } = await db
    .from('act_grant_recommendations_current')
    .select('*')
    .eq('project_code', projectCode)
    .order('fit_score', { ascending: false, nullsFirst: false })
    .limit(400);
  if (error) throw new Error(`apply-now: ${error.message}`);

  const rows = (data ?? []).map(toCandidate);
  // One opportunity can appear more than once in the source pool; keep the best.
  const seen = new Map<string, ApplyNowCandidate>();
  for (const c of rows) {
    const prior = seen.get(c.opportunityId);
    if (!prior || (c.fitScore ?? 0) > (prior.fitScore ?? 0)) seen.set(c.opportunityId, c);
  }
  const unique = [...seen.values()];

  return {
    projectSlug,
    projectCode,
    projectLabel: reg?.project_label ?? null,
    fundingRoute: reg?.primary_funding_route ?? null,
    nextQuestion: reg?.next_question ?? null,
    // Dated rounds rank by urgency — a closing deadline is the actionable signal.
    dated: unique
      .filter((c) => c.feedStatus === 'apply_now')
      .sort((a, b) => (a.daysRemaining ?? 1e9) - (b.daysRemaining ?? 1e9))
      .slice(0, PER_LANE_LIMIT),
    // Rolling programs have no clock, so fit is the only ordering that means anything.
    rolling: unique
      .filter((c) => c.feedStatus === 'rolling')
      .sort((a, b) => (b.fitScore ?? 0) - (a.fitScore ?? 0))
      .slice(0, PER_LANE_LIMIT),
    totalConsidered: unique.length,
    noStrongFits: unique.length > 0 && !unique.some((c) => c.isStrongFit),
  };
}
