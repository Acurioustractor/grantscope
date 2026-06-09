import { getServiceSupabase } from '@/lib/supabase';
import { getGoodsFinanceLedger, type GoodsFinanceLedger } from './goods-finance-ledger';
import { getGoodsRelationshipsSafe, summarize, type TrackRollup } from './goods-engagement';
import type { GoodsRelationship, GoodsRelType, FundingTrack } from './goods-engagement-shared';

/**
 * Goods Command Center — Phase 2: Money (received + available).
 * Composes three real sources, no fabricated figures:
 *  - Received: the Xero ACT-GD income ledger (goods-finance-ledger.ts).
 *  - In play: open money conversations from the warmth registry (goods_relationships).
 *  - Available: open opportunities from the discovery engine (alma_funding_opportunities)
 *    matched to the Goods wheelhouse via focus_areas overlap.
 * Plan: thoughts/shared/plans/goods-command-center-2026-06-09.md
 */

export type GoodsOpportunity = {
  id: string;
  name: string;
  funder: string | null;
  amountLabel: string | null;
  deadline: string | null;
  focusAreas: string[];
  url: string | null;
  sourceType: string | null;
};

/** Open-ask + expected-pipeline dollars, split grant vs investment. */
export type PipelineStats = {
  /** Sum of open ask_amount_aud across all money tracks. */
  openAskTotal: number;
  /** Stage-weighted expected dollars across all money tracks. */
  weightedPipeline: number;
  grant: TrackRollup;
  investment: TrackRollup;
};

/**
 * Honest reconciliation: the warmth registry's lifetimeReceived is hand-entered;
 * Xero paid-invoices is the source of truth. Surface the delta, don't hide it.
 */
export type Reconciliation = {
  xeroPaid: number;
  registryReceived: number;
  delta: number; // registry - xero
};

export type GoodsMoney = {
  ledger: GoodsFinanceLedger;
  lifetimeReceived: number;
  openAsks: GoodsRelationship[];
  opportunities: GoodsOpportunity[];
  matchedPoolCount: number;
  pipeline: PipelineStats;
  reconciliation: Reconciliation;
  byTrack: Record<FundingTrack, TrackRollup>;
  /** Honest live-data strip when the registry fetch failed. */
  fetchError: string | null;
  // Registry agent the "scrape more" button dispatches via /api/mission-control/tasks.
  scrapeAgentId: string;
  scrapeAgentLabel: string;
};

/** Parse a compact-money string like "$1.2M" / "$450K" / "$1,234" back to a number. */
function parseMoneyLabel(s: string | null | undefined): number {
  if (!s) return 0;
  const cleaned = s.replace(/[$,\s]/g, '');
  const m = cleaned.match(/^(-?[0-9.]+)([MK]?)$/i);
  if (!m) {
    const n = Number(cleaned);
    return Number.isFinite(n) ? n : 0;
  }
  const v = Number(m[1]) || 0;
  const unit = m[2].toUpperCase();
  if (unit === 'M') return v * 1_000_000;
  if (unit === 'K') return v * 1_000;
  return v;
}

// The Goods wheelhouse — Indigenous-led social enterprise on Country, remote/
// regional economic development, regenerative agriculture, employment. These are
// real focus_areas tags in alma_funding_opportunities (verified against live
// vocab), deliberately excluding broad tags (community/youth/health/education)
// that over-match and turn the list into noise.
const GOODS_FOCUS = [
  'indigenous', 'aboriginal', 'enterprise', 'rural_remote',
  'regional', 'economic_development', 'regenerative', 'agriculture', 'employment',
];

// Relationship types that represent money IN (vs buyers/supporters/partners).
const MONEY_TYPES: GoodsRelType[] = ['funder', 'impact_investor', 'repayable_finance'];
// Stages that mean an open, live money conversation (not committed/declined/dormant/identified).
const OPEN_ASK_STAGES = new Set(['researching', 'contacted', 'in_conversation', 'proposal']);

// The Goods-scoped discovery agent the "scrape more" button queues.
const SCRAPE_AGENT_ID = 'sync-austender-open-tenders';
const SCRAPE_AGENT_LABEL = 'AusTender Open Tenders (Goods)';

function compactMoney(n: number | string | null | undefined): string | null {
  const v = Number(n);
  if (!Number.isFinite(v) || v <= 0) return null;
  if (v >= 1_000_000) return `$${(v / 1_000_000).toFixed(v % 1_000_000 === 0 ? 0 : 1)}M`;
  if (v >= 1_000) return `$${Math.round(v / 1_000)}K`;
  return `$${Math.round(v)}`;
}

type OppRow = {
  id: string;
  name: string | null;
  funder_name: string | null;
  max_grant_amount: number | string | null;
  min_grant_amount: number | string | null;
  total_pool_amount: number | string | null;
  deadline: string | null;
  focus_areas: string[] | null;
  application_url: string | null;
  source_url: string | null;
  source_type: string | null;
};

export async function getGoodsMoney(): Promise<GoodsMoney> {
  const supabase = getServiceSupabase();
  const nowIso = new Date().toISOString();
  // In supabase-js, each chained filter is AND-ed. `.or()` is a single OR-group
  // that is itself AND-ed with the other filters. So below resolves to:
  //   status='open' AND focus_areas && GOODS_FOCUS AND (deadline IS NULL OR deadline >= now)
  // i.e. open status + wheelhouse overlap + (rolling or still-future). All three AND correctly.
  const futureDeadline = `deadline.is.null,deadline.gte.${nowIso}`;

  const [ledger, relsResult, oppResult, countResult] = await Promise.all([
    getGoodsFinanceLedger(),
    getGoodsRelationshipsSafe(),
    supabase
      .from('alma_funding_opportunities')
      .select(
        'id, name, funder_name, max_grant_amount, min_grant_amount, total_pool_amount, deadline, focus_areas, application_url, source_url, source_type',
      )
      .eq('status', 'open')
      .overlaps('focus_areas', GOODS_FOCUS)
      .or(futureDeadline)
      .order('deadline', { ascending: true, nullsFirst: false })
      .limit(14),
    supabase
      .from('alma_funding_opportunities')
      .select('id', { count: 'exact', head: true })
      .eq('status', 'open')
      .overlaps('focus_areas', GOODS_FOCUS)
      .or(futureDeadline),
  ]);

  const rels = relsResult.rows;
  const summary = summarize(rels);

  const openAsks = rels
    .filter((r) => MONEY_TYPES.includes(r.relationship_type) && OPEN_ASK_STAGES.has(r.stage))
    .sort((a, b) => b.warmth_display - a.warmth_display);

  const opportunities: GoodsOpportunity[] = ((oppResult.data as OppRow[] | null) ?? []).map((o) => ({
    id: o.id,
    name: o.name ?? 'Untitled opportunity',
    funder: o.funder_name,
    amountLabel:
      compactMoney(o.max_grant_amount) ?? compactMoney(o.total_pool_amount) ?? compactMoney(o.min_grant_amount),
    deadline: o.deadline,
    focusAreas: (o.focus_areas ?? []).filter((f) => GOODS_FOCUS.includes(f)),
    url: o.application_url || o.source_url,
    sourceType: o.source_type,
  }));

  // Reconcile registry (manually entered) against Xero paid invoices (truth).
  const xeroPaid = parseMoneyLabel(ledger.totals.find((t) => t.label === 'Paid invoices')?.value);
  const registryReceived = summary.totalReceived;

  const pipeline: PipelineStats = {
    openAskTotal: summary.openAskTotal,
    weightedPipeline: summary.weightedPipeline,
    grant: summary.byTrack.grant,
    investment: summary.byTrack.investment,
  };

  return {
    ledger,
    lifetimeReceived: registryReceived,
    openAsks,
    opportunities,
    matchedPoolCount: countResult.count ?? opportunities.length,
    pipeline,
    reconciliation: { xeroPaid, registryReceived, delta: registryReceived - xeroPaid },
    byTrack: summary.byTrack,
    fetchError: relsResult.fetchError,
    scrapeAgentId: SCRAPE_AGENT_ID,
    scrapeAgentLabel: SCRAPE_AGENT_LABEL,
  };
}
