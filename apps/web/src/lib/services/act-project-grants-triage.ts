import { getServiceSupabase } from '@/lib/supabase';
import { projectEligibility, type ActProject, type ProjectEligibility } from '@/lib/act-grant-eligibility';

/** Grant rounds for all six ACT projects, not just Goods. goods-grants-triage.ts stays
 *  Goods-only (it backs the dedicated /goods/grants triage page); this widens the One
 *  Desk pool (act-one-desk.ts) so JusticeHub/Empathy Ledger/Harvest/Farm/Contained grant
 *  rounds show up too.
 *
 *  Each row carries both reasons it is on the desk: the keyword score (goods_relevance_score for Goods,
 *  project_relevance.<project>.score for the rest) and Jev's verdict (project_relevance.<project>.rubric,
 *  written by scripts/score-project-rubric.mjs), plus which of the two tagged it. */

export const PROJECT_CODES: Record<ActProject, string> = {
  goods: 'ACT-GD',
  justicehub: 'ACT-JH',
  'empathy-ledger': 'ACT-EL',
  harvest: 'ACT-HV',
  farm: 'ACT-FM',
  contained: 'ACT-CN',
};

/** Jev's bar for a tag on its own. Mirrors RUBRIC_FIT_AT and RUBRIC_CONFIDENCE_AT in
 *  scripts/lib/project-relevance.mjs (measured 2026-09-21); change both together. */
export const JEV_FIT_AT = 2.5;
export const JEV_CONFIDENCE_AT = 0.5;

/** The keyword bar at which an untouched grant becomes a decision due. Goods' scorer runs on a tuned
 *  0-100 scale; the five-project scorer tops out lower (30 is its tag threshold). */
export const KEYWORD_DECISION_AT: Record<ActProject, number> = {
  goods: 85, justicehub: 40, 'empathy-ledger': 40, harvest: 40, farm: 40, contained: 40,
};

export type TaggedBy = 'keyword' | 'rubric' | 'both' | 'human' | null;

export interface ProjectGrantRow {
  id: string;
  rowId: string;
  project: ActProject;
  code: string;
  name: string;
  provider: string | null;
  /** Keyword score 0-100. */
  fitScore: number;
  /** Jev's 0-3 verdict for this project, null when Jev has not read the grant for it. */
  jevScore: number | null;
  jevConfidence: number | null;
  /** Jev read the grant but the project is outside the grant's area. */
  jevOutsideArea: boolean;
  taggedBy: TaggedBy;
  /** closes_at, else deadline (the scorers use the same order). */
  deadline: string | null;
  daysToDeadline: number | null;
  amountMin: number | null;
  amountMax: number | null;
  url: string | null;
  ghlOpportunityId: string | null;
  eligibility: ProjectEligibility;
}

interface RubricEntry { score?: number; confidence?: number; geography_excluded?: boolean }
interface ProjectRelevanceEntry { score?: number; tagged_by?: string | null; rubric?: RubricEntry }

export interface TriageSourceRow {
  id: string;
  name: string;
  provider: string | null;
  deadline: string | null;
  closes_at: string | null;
  amount_min: number | null;
  amount_max: number | null;
  url: string | null;
  status: string | null;
  geography: string | null;
  dgr_required: boolean | null;
  accepts_pty_ltd: boolean | null;
  place: unknown;
  ghl_opportunity_id: string | null;
  aligned_projects: string[] | null;
  goods_relevance_score: number | null;
  goods_relevance_signals: { tagged_by?: string | null } | null;
  project_relevance: Record<string, ProjectRelevanceEntry | undefined> | null;
}

function taggedBy(v: string | null | undefined): TaggedBy {
  if (v === 'keyword' || v === 'rubric' || v === 'both') return v;
  if (v === 'human_yes') return 'human';
  return null;
}

/** Pure: one desk row per (grant, tagged project), skipping rounds already closed. */
export function buildProjectGrantRows(data: TriageSourceRow[], today: Date = new Date()): ProjectGrantRow[] {
  const todayIso = today.toISOString().slice(0, 10);
  const todayMs = Date.parse(`${todayIso}T00:00:00Z`);
  const rows: ProjectGrantRow[] = [];
  for (const r of data) {
    const aligned = r.aligned_projects ?? [];
    const close = (r.closes_at ?? r.deadline ?? null)?.slice(0, 10) ?? null;
    if (close && close < todayIso) continue;
    const daysToDeadline = close ? Math.round((Date.parse(`${close}T00:00:00Z`) - todayMs) / 86_400_000) : null;
    const relevance = r.project_relevance ?? {};
    for (const [project, code] of Object.entries(PROJECT_CODES) as [ActProject, string][]) {
      if (!aligned.includes(code)) continue;
      const entry = relevance[project];
      const rubric = entry?.rubric;
      rows.push({
        id: `${r.id}:${project}`,
        rowId: r.id,
        project,
        code,
        name: r.name,
        provider: r.provider ?? null,
        fitScore: project === 'goods' ? (r.goods_relevance_score ?? 0) : (entry?.score ?? 0),
        jevScore: typeof rubric?.score === 'number' ? rubric.score : null,
        jevConfidence: typeof rubric?.confidence === 'number' ? rubric.confidence : null,
        jevOutsideArea: Boolean(rubric?.geography_excluded),
        taggedBy: taggedBy(project === 'goods' ? r.goods_relevance_signals?.tagged_by : entry?.tagged_by),
        deadline: close,
        daysToDeadline,
        // A stored 0 means the source did not say; showing "$0" would read as a measurement.
        amountMin: r.amount_min && r.amount_min > 0 ? r.amount_min : null,
        amountMax: r.amount_max && r.amount_max > 0 ? r.amount_max : null,
        url: r.url ?? null,
        ghlOpportunityId: r.ghl_opportunity_id ?? null,
        eligibility: projectEligibility(project, {
          dgr_required: r.dgr_required ?? null,
          accepts_pty_ltd: r.accepts_pty_ltd ?? null,
          geography: r.geography ?? null,
          place: r.place ?? null,
        }),
      });
    }
  }
  return rows;
}

export function jevStrongFit(g: Pick<ProjectGrantRow, 'jevScore' | 'jevConfidence' | 'jevOutsideArea'>): boolean {
  return g.jevScore != null && g.jevScore >= JEV_FIT_AT && (g.jevConfidence ?? 0) >= JEV_CONFIDENCE_AT && !g.jevOutsideArea;
}

/** A tagged grant nobody has decided on is due when it closes within 30 days, when the keyword score clears
 *  its project's bar, or when Jev calls it a strong fit (before 2026-09-24 Jev's finds never counted). */
export function grantDecisionDue(g: ProjectGrantRow): boolean {
  if (g.daysToDeadline != null && g.daysToDeadline <= 30) return true;
  if (g.fitScore >= KEYWORD_DECISION_AT[g.project]) return true;
  return jevStrongFit(g);
}

/** Jev's 0-3 scale in words. The rubric's own levels: 0 none, 1 adjacent, 2 plausible, 3 strong. */
export function jevWords(score: number | null): string {
  if (score == null) return 'not read yet';
  if (score >= JEV_FIT_AT) return 'strong fit';
  if (score >= 1.75) return 'plausible';
  if (score >= 0.75) return 'adjacent';
  return 'no connection';
}

export async function getAllProjectsGrantsTriage(): Promise<ProjectGrantRow[]> {
  const db = getServiceSupabase();
  const { data, error } = await db
    .from('grant_opportunities')
    .select('id, name, provider, deadline, closes_at, amount_min, amount_max, url, status, geography, dgr_required, accepts_pty_ltd, place:metadata->place, ghl_opportunity_id, aligned_projects, goods_relevance_score, goods_relevance_signals, project_relevance')
    .in('status', ['open', 'ongoing', 'upcoming'])
    .overlaps('aligned_projects', Object.values(PROJECT_CODES))
    .limit(3000);
  if (error) throw new Error(`project grants triage: ${error.message}`);
  return buildProjectGrantRows((data ?? []) as unknown as TriageSourceRow[]);
}
