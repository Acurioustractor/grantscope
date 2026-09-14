import { getServiceSupabase } from '@/lib/supabase';
import { ACT_PROJECTS, projectEligibility, type ActProject, type ProjectEligibility } from '@/lib/act-grant-eligibility';

/** The private ACT grants desk: every live grant from the public corpus (grant_opportunities) and ACT's
 *  private SmartyGrants rounds (act_private_grant_rounds), soonest close first. The private table is service
 *  role only and its rows must never reach a page without the admin gate in /org/[slug]/grants/page.tsx. */

export const LIVE_STATUSES = ['open', 'ongoing', 'upcoming'] as const;

export type DeskOrigin = 'public' | 'act-private';

export interface DeskSourceRow {
  id: string;
  name: string;
  provider: string | null;
  status: string | null;
  closes_at: string | null;
  deadline: string | null;
  amount_min: number | null;
  amount_max: number | null;
  geography: string | null;
  url: string | null;
  source: string | null;
  dgr_required?: boolean | null;
  accepts_pty_ltd?: boolean | null;
  place?: unknown;
  goods_relevance_score?: number | null;
  project_relevance?: Record<string, { score?: number }> | null;
}

export interface DeskGrant {
  id: string;
  origin: DeskOrigin;
  name: string;
  provider: string | null;
  closeDate: string | null;
  daysToClose: number | null;
  amountMin: number | null;
  amountMax: number | null;
  geography: string | null;
  url: string | null;
  source: string | null;
  eligibility: ProjectEligibility[];
  /** Fit score 0-100 per project. 'goods' comes from goods_relevance_score (both tables);
   *  the other five come from project_relevance, which only public rows carry. */
  fitScore: Partial<Record<ActProject, number>>;
}

const DAY = 86_400_000;

function normUrl(url: string | null): string | null {
  if (!url) return null;
  return url.trim().toLowerCase().replace(/^https?:\/\//, '').replace(/\/+$/, '');
}

/** Pure: filter to live, dedupe by URL (public row wins), sort soonest close first, undated last. */
export function buildDesk(
  publicRows: DeskSourceRow[],
  privateRows: DeskSourceRow[],
  today: Date = new Date(),
): DeskGrant[] {
  const todayIso = today.toISOString().slice(0, 10);
  const todayMs = Date.parse(`${todayIso}T00:00:00Z`);
  const seen = new Set<string>();
  const out: DeskGrant[] = [];

  const take = (rows: DeskSourceRow[], origin: DeskOrigin) => {
    for (const r of rows) {
      if (!r.status || !(LIVE_STATUSES as readonly string[]).includes(r.status)) continue;
      const closeDate = r.closes_at ?? r.deadline ?? null;
      if (closeDate && closeDate.slice(0, 10) < todayIso) continue;
      const key = normUrl(r.url);
      if (key) {
        if (seen.has(key)) continue;
        seen.add(key);
      }
      const relevance = r.project_relevance ?? {};
      const fitScore: Partial<Record<ActProject, number>> = {};
      if (r.goods_relevance_score != null) fitScore.goods = r.goods_relevance_score;
      for (const project of Object.keys(ACT_PROJECTS) as ActProject[]) {
        if (project === 'goods') continue;
        const score = relevance[project]?.score;
        if (score != null) fitScore[project] = score;
      }
      out.push({
        id: r.id,
        origin,
        name: r.name,
        provider: r.provider,
        closeDate,
        daysToClose: closeDate ? Math.round((Date.parse(`${closeDate.slice(0, 10)}T00:00:00Z`) - todayMs) / DAY) : null,
        amountMin: r.amount_min,
        amountMax: r.amount_max,
        geography: r.geography,
        url: r.url,
        source: r.source,
        eligibility: (Object.keys(ACT_PROJECTS) as ActProject[]).map((project) =>
          projectEligibility(project, {
            dgr_required: r.dgr_required ?? null,
            accepts_pty_ltd: r.accepts_pty_ltd ?? null,
            geography: r.geography,
            place: r.place ?? null,
          }),
        ),
        fitScore,
      });
    }
  };
  take(publicRows, 'public');
  take(privateRows, 'act-private');

  return out.sort((a, b) => {
    if (a.closeDate && b.closeDate) return a.closeDate.localeCompare(b.closeDate) || a.name.localeCompare(b.name);
    if (a.closeDate) return -1;
    if (b.closeDate) return 1;
    return a.name.localeCompare(b.name);
  });
}

const BASE_COLUMNS = 'id, name, provider, status, closes_at, deadline, amount_min, amount_max, geography, url, source, place:metadata->place, goods_relevance_score';
// act_private_grant_rounds has no dgr_required / accepts_pty_ltd / project_relevance columns.
const COLUMNS = {
  grant_opportunities: `${BASE_COLUMNS}, dgr_required, accepts_pty_ltd, project_relevance`,
  act_private_grant_rounds: BASE_COLUMNS,
};
const PAGE = 1000;

async function fetchLive(table: 'grant_opportunities' | 'act_private_grant_rounds'): Promise<DeskSourceRow[]> {
  const db = getServiceSupabase();
  const rows: DeskSourceRow[] = [];
  for (let from = 0; ; from += PAGE) {
    const { data, error } = await db
      .from(table)
      .select(COLUMNS[table])
      .in('status', [...LIVE_STATUSES])
      .order('id')
      .range(from, from + PAGE - 1);
    if (error) throw new Error(`act grants desk (${table}): ${error.message}`);
    rows.push(...((data ?? []) as unknown as DeskSourceRow[]));
    if (!data || data.length < PAGE) return rows;
  }
}

export async function getActGrantsDesk(): Promise<{ grants: DeskGrant[]; generatedAt: string }> {
  const [publicRows, privateRows] = await Promise.all([
    fetchLive('grant_opportunities'),
    fetchLive('act_private_grant_rounds'),
  ]);
  return { grants: buildDesk(publicRows, privateRows), generatedAt: new Date().toISOString() };
}
