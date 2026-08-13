import { getServiceSupabase } from '@/lib/supabase';
import { ACT_FAST_WRITE_PROFILE_ID } from '@/lib/services/fast-local-org';

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
  ghlOpportunityId: string | null;
  reviewState: 'new' | 'in_review' | 'dismissed' | 'promoted';
  notionPageUrl: string | null;
  description: string | null;
  requirementsSummary: string | null;
  lastVerifiedAt: string | null;
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
    newTotal: number;
    inReviewTotal: number;
    promotedTotal: number;
    dismissedTotal: number;
    byGeography: Record<string, number>;
  };
  sources: SourceFreshness[];
  fundingBlocks: Array<{ id: string; code: string; name: string; amountMinAud: number; amountMaxAud: number; targetedAud: number; committedAud: number; routeCount: number }>;
}

function normGeo(g: string | null): string {
  if (!g) return 'Unknown';
  const v = g.replace(/^AU-/i, '').toLowerCase();
  if (v === 'national') return 'National';
  return v.toUpperCase();
}

export async function getGoodsGrantsTriage(opts: {
  orgProfileId?: string;
  geography?: string;
  minFit?: number;
  scope?: 'closing' | 'all';
  view?: 'new' | 'review' | 'dismissed' | 'all';
  query?: string;
}): Promise<GrantsTriageResult> {
  const db = getServiceSupabase();
  let decisionOrgProfileId = opts.orgProfileId;
  if (decisionOrgProfileId === 'act-fast-local') {
    decisionOrgProfileId = ACT_FAST_WRITE_PROFILE_ID;
  }
  const decisionsQuery = db
    .from('opportunity_decisions')
    .select('source_ref, decision, created_at')
    .eq('source_type', 'grant')
    .order('created_at', { ascending: false })
    .limit(2000);
  const pipelineQuery = db
    .from('org_pipeline')
    .select('grant_opportunity_id, source_ref, ghl_opportunity_id')
    .or('source_type.eq.grant,grant_opportunity_id.not.is.null')
    .limit(2000);
  if (decisionOrgProfileId) {
    decisionsQuery.eq('org_profile_id', decisionOrgProfileId);
    pipelineQuery.eq('org_profile_id', decisionOrgProfileId);
  }

  const [liveRes, corpusRes, schedulesRes, runsRes, decisionsRes, pipelineRes, promotionsRes, blocksRes, allocationsRes] = await Promise.all([
    db
      .from('grant_opportunities')
      .select('id, name, description, provider, goods_relevance_score, deadline, amount_min, amount_max, geography, dgr_required, accepts_pty_ltd, pipeline_stage, url, status, ghl_opportunity_id, requirements_summary, last_verified_at')
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
    decisionsQuery,
    pipelineQuery,
    db.from('opportunity_promotions').select('source_ref, target_system, target_url').eq('source_type', 'grant').limit(2000),
    db.from('goods_capital_blocks').select('id, code, name, amount_min_aud, amount_max_aud').eq('project_code', 'ACT-GD').eq('state', 'active').order('sort_order'),
    db.from('goods_route_allocations').select('capital_block_id, proposed_amount_aud, accepted_amount_aud, route:goods_funding_routes(commitment_state, commitment_evidence_form)'),
  ]);

  if (liveRes.error) throw new Error(`grants triage: ${liveRes.error.message}`);

  const now = Date.now();
  const latestDecisions = new Map<string, string>();
  for (const row of decisionsRes.data || []) {
    const id = String(row.source_ref);
    if (!latestDecisions.has(id)) latestDecisions.set(id, String(row.decision));
  }
  const reviewedIds = new Set(latestDecisions.keys());
  const dismissedIds = new Set([...latestDecisions].filter(([, decision]) => decision === 'no').map(([id]) => id));
  const pipelineIds = new Set(
    (pipelineRes.data || []).flatMap((row) => [row.grant_opportunity_id, row.source_ref].filter(Boolean).map(String)),
  );
  const promotedIds = new Set([
    ...(promotionsRes.data || []).map((row) => String(row.source_ref)),
    ...(pipelineRes.data || []).filter((row) => row.ghl_opportunity_id).flatMap((row) => [row.grant_opportunity_id, row.source_ref].filter(Boolean).map(String)),
  ]);
  const notionUrls = new Map(
    (promotionsRes.data || []).filter((row) => row.target_system === 'notion').map((row) => [String(row.source_ref), row.target_url as string | null]),
  );
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
      ghlOpportunityId: (r.ghl_opportunity_id as string | null) ?? null,
      reviewState: ((r.ghl_opportunity_id || promotedIds.has(String(r.id)))
        ? 'promoted'
        : dismissedIds.has(String(r.id))
          ? 'dismissed'
        : (reviewedIds.has(String(r.id)) || pipelineIds.has(String(r.id)))
          ? 'in_review'
          : 'new') as TriageGrantRow['reviewState'],
      notionPageUrl: notionUrls.get(String(r.id)) ?? null,
      description: (r.description as string | null) ?? null,
      requirementsSummary: (r.requirements_summary as string | null) ?? null,
      lastVerifiedAt: (r.last_verified_at as string | null) ?? null,
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
  if (opts.view === 'new' || !opts.view) grants = grants.filter((r) => r.reviewState === 'new');
  if (opts.view === 'review') grants = grants.filter((r) => r.reviewState === 'in_review');
  if (opts.view === 'dismissed') grants = grants.filter((r) => r.reviewState === 'dismissed');
  if (opts.geography) grants = grants.filter((r) => r.geography === opts.geography);
  if (opts.minFit) grants = grants.filter((r) => (r.goodsScore ?? 0) >= opts.minFit!);
  if (opts.scope === 'closing') grants = grants.filter((r) => r.daysToDeadline != null && r.daysToDeadline <= 60);
  if (opts.query?.trim()) {
    const query = opts.query.trim().toLocaleLowerCase('en-AU');
    grants = grants.filter((r) => [r.name, r.provider, r.description, r.requirementsSummary, r.geography]
      .some((value) => value?.toLocaleLowerCase('en-AU').includes(query)));
  }

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
      newTotal: all.filter((r) => r.reviewState === 'new').length,
      inReviewTotal: all.filter((r) => r.reviewState === 'in_review').length,
      promotedTotal: all.filter((r) => r.reviewState === 'promoted').length,
      dismissedTotal: all.filter((r) => r.reviewState === 'dismissed').length,
      byGeography,
    },
    sources,
    fundingBlocks: (blocksRes.data || []).map(block => {
      const allocations = (allocationsRes.data || []).filter(allocation => String(allocation.capital_block_id) === String(block.id));
      const committed = allocations.filter(allocation => {
        const route = Array.isArray(allocation.route) ? allocation.route[0] : allocation.route;
        return ['accepted', 'fulfilled'].includes(String(route?.commitment_state)) && ['letter', 'executed_agreement'].includes(String(route?.commitment_evidence_form));
      });
      return {
        id: String(block.id), code: String(block.code), name: String(block.name),
        amountMinAud: Number(block.amount_min_aud || 0), amountMaxAud: Number(block.amount_max_aud || 0),
        targetedAud: allocations.reduce((sum, allocation) => sum + Number(allocation.proposed_amount_aud || 0), 0),
        committedAud: committed.reduce((sum, allocation) => sum + Number(allocation.accepted_amount_aud || 0), 0),
        routeCount: allocations.length,
      };
    }),
  };
}
