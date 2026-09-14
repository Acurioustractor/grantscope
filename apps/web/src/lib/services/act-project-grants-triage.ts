import { getServiceSupabase } from '@/lib/supabase';

/** Grant rounds for all six ACT projects, not just Goods. goods-grants-triage.ts stays
 *  Goods-only (it backs the dedicated /goods/grants triage page); this widens the One
 *  Desk pool (act-one-desk.ts) so JusticeHub/Empathy Ledger/Harvest/Farm/Contained grant
 *  rounds show up too, using the fit scorers from scripts/lib/project-relevance.mjs
 *  (persisted in project_relevance by scripts/score-project-relevance.mjs). */

export const PROJECT_CODES: Record<string, string> = {
  goods: 'ACT-GD',
  justicehub: 'ACT-JH',
  'empathy-ledger': 'ACT-EL',
  harvest: 'ACT-HV',
  farm: 'ACT-FM',
  contained: 'ACT-CN',
};

export interface ProjectGrantRow {
  id: string;
  rowId: string;
  project: string;
  code: string;
  name: string;
  provider: string | null;
  fitScore: number;
  deadline: string | null;
  daysToDeadline: number | null;
  amountMax: number | null;
  url: string | null;
  ghlOpportunityId: string | null;
}

interface ProjectRelevanceEntry {
  score?: number;
}

export async function getAllProjectsGrantsTriage(): Promise<ProjectGrantRow[]> {
  const db = getServiceSupabase();
  const { data, error } = await db
    .from('grant_opportunities')
    .select('id, name, provider, deadline, amount_max, url, status, ghl_opportunity_id, aligned_projects, goods_relevance_score, project_relevance')
    .in('status', ['open', 'ongoing', 'upcoming'])
    .overlaps('aligned_projects', Object.values(PROJECT_CODES))
    .limit(3000);
  if (error) throw new Error(`project grants triage: ${error.message}`);

  const now = Date.now();
  const rows: ProjectGrantRow[] = [];
  for (const r of data ?? []) {
    const aligned = (r.aligned_projects as string[] | null) ?? [];
    const t = r.deadline ? new Date(r.deadline as string).getTime() : NaN;
    const daysToDeadline = Number.isNaN(t) ? null : Math.ceil((t - now) / 86_400_000);
    if (daysToDeadline != null && daysToDeadline < 0) continue;

    const relevance = (r.project_relevance as Record<string, ProjectRelevanceEntry> | null) ?? {};
    for (const [project, code] of Object.entries(PROJECT_CODES)) {
      if (!aligned.includes(code)) continue;
      const fitScore = project === 'goods'
        ? ((r.goods_relevance_score as number | null) ?? 0)
        : (relevance[project]?.score ?? 0);
      rows.push({
        id: `${r.id as string}:${project}`,
        rowId: r.id as string,
        project,
        code,
        name: r.name as string,
        provider: (r.provider as string | null) ?? null,
        fitScore,
        deadline: (r.deadline as string | null) ?? null,
        daysToDeadline,
        amountMax: (r.amount_max as number | null) ?? null,
        url: (r.url as string | null) ?? null,
        ghlOpportunityId: (r.ghl_opportunity_id as string | null) ?? null,
      });
    }
  }
  return rows;
}
