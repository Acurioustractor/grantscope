import { getServiceSupabase } from '@/lib/supabase';

/** Grants triage: cut the ~26K grant_opportunities corpus to the live set
 *  (status open/ongoing/upcoming), deadline-first. Grants are deadline-driven,
 *  not stage-driven. */

export interface TriageGrantRow {
  id: string;
  name: string;
  provider: string | null;
  goodsScore: number | null;
  deadline: string | null;
  daysToDeadline: number | null;
  amountMin: number | null;
  amountMax: number | null;
  geography: string | null;
  dgrRequired: boolean | null;
  acceptsPtyLtd: boolean | null;
  pipelineStage: string | null;
  url: string | null;
}

export interface SourceFreshness {
  agentId: string;
  enabled: boolean;
  intervalHours: number | null;
  lastRunAt: string | null;
  lastStatus: string | null;
  lastItemsNew: number | null;
}

export interface GrantsTriageResult {
  grants: TriageGrantRow[];
  summary: {
    liveTotal: number;
    corpusTotal: number;
    withDeadline: number;
    closingSoon: number; // deadline within 30 days
    highFit: number; // goods score >= 70
    byGeography: Record<string, number>;
  };
  sources: SourceFreshness[];
}

function normGeo(g: string | null): string {
  if (!g) return 'Unknown';
  const v = g.replace(/^AU-/i, '').toLowerCase();
  if (v === 'national') return 'National';
  return v.toUpperCase();
}

export async function getGoodsGrantsTriage(opts: {
  geography?: string;
  minFit?: number;
  scope?: 'closing' | 'all';
}): Promise<GrantsTriageResult> {
  const db = getServiceSupabase();

  const [liveRes, corpusRes, schedulesRes, runsRes] = await Promise.all([
    db
      .from('grant_opportunities')
      .select('id, name, provider, goods_relevance_score, deadline, amount_min, amount_max, geography, dgr_required, accepts_pty_ltd, pipeline_stage, url, status')
      .in('status', ['open', 'ongoing', 'upcoming'])
      .order('goods_relevance_score', { ascending: false, nullsFirst: false })
      .limit(3000),
    db.from('grant_opportunities').select('id', { count: 'exact', head: true }),
    db.from('agent_schedules').select('agent_id, enabled, interval_hours, last_run_at').ilike('agent_id', '%grant%'),
    db
      .from('agent_runs')
      .select('agent_id, status, items_new, started_at')
      .ilike('agent_id', '%grant%')
      .order('started_at', { ascending: false })
      .limit(100),
  ]);

  if (liveRes.error) throw new Error(`grants triage: ${liveRes.error.message}`);

  const now = Date.now();
  const all: TriageGrantRow[] = (liveRes.data || []).map((r) => {
    const t = r.deadline ? new Date(r.deadline as string).getTime() : NaN;
    return {
      id: r.id as string,
      name: r.name as string,
      provider: (r.provider as string | null) ?? null,
      goodsScore: (r.goods_relevance_score as number | null) ?? null,
      deadline: (r.deadline as string | null) ?? null,
      daysToDeadline: Number.isNaN(t) ? null : Math.ceil((t - now) / 86_400_000),
      amountMin: (r.amount_min as number | null) ?? null,
      amountMax: (r.amount_max as number | null) ?? null,
      geography: normGeo(r.geography as string | null),
      dgrRequired: (r.dgr_required as boolean | null) ?? null,
      acceptsPtyLtd: (r.accepts_pty_ltd as boolean | null) ?? null,
      pipelineStage: (r.pipeline_stage as string | null) ?? null,
      url: (r.url as string | null) ?? null,
    };
  }).filter((r) => r.daysToDeadline == null || r.daysToDeadline >= 0);

  // Deadline-first: dated rows soonest-first, then undated by fit.
  all.sort((a, b) => {
    const da = a.daysToDeadline ?? Infinity;
    const dbb = b.daysToDeadline ?? Infinity;
    if (da !== dbb) return da - dbb;
    return (b.goodsScore ?? 0) - (a.goodsScore ?? 0);
  });

  const byGeography: Record<string, number> = {};
  for (const r of all) byGeography[r.geography!] = (byGeography[r.geography!] || 0) + 1;

  let grants = all;
  if (opts.geography) grants = grants.filter((r) => r.geography === opts.geography);
  if (opts.minFit) grants = grants.filter((r) => (r.goodsScore ?? 0) >= opts.minFit!);
  if (opts.scope === 'closing') grants = grants.filter((r) => r.daysToDeadline != null && r.daysToDeadline <= 60);

  // Latest run per grant agent for the freshness panel.
  const latestRun = new Map<string, { status: string; items_new: number | null; started_at: string }>();
  for (const run of runsRes.data || []) {
    const id = run.agent_id as string;
    if (!latestRun.has(id)) latestRun.set(id, run as never);
  }
  const sources: SourceFreshness[] = (schedulesRes.data || [])
    .map((s) => {
      const run = latestRun.get(s.agent_id as string);
      return {
        agentId: s.agent_id as string,
        enabled: Boolean(s.enabled),
        intervalHours: (s.interval_hours as number | null) ?? null,
        lastRunAt: (s.last_run_at as string | null) ?? null,
        lastStatus: run?.status ?? null,
        lastItemsNew: run?.items_new ?? null,
      };
    })
    .sort((a, b) => (b.lastRunAt || '').localeCompare(a.lastRunAt || ''));

  return {
    grants: grants.slice(0, 300),
    summary: {
      liveTotal: all.length,
      corpusTotal: corpusRes.count ?? 0,
      withDeadline: all.filter((r) => r.daysToDeadline != null).length,
      closingSoon: all.filter((r) => r.daysToDeadline != null && r.daysToDeadline <= 30).length,
      highFit: all.filter((r) => (r.goodsScore ?? 0) >= 70).length,
      byGeography,
    },
    sources,
  };
}
