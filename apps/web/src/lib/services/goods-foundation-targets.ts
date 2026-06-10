import { getServiceSupabase } from '@/lib/supabase';

/**
 * Goods Command Center — Foundation Target List.
 * Reads v_goods_foundation_targets (theme-fit + board-bridge + DGR + giving,
 * already excluding engaged foundations). Returns the ranked top targets +
 * portfolio summary. Plan: thoughts/shared/plans/goods-command-center-2026-06-09.md
 */

export type FoundationTarget = {
  id: string;
  name: string;
  gsEntityId: string | null;
  givingAnnual: number | null;
  avgGrant: number | null;
  grantMin: number | null;
  grantMax: number | null;
  hasDgr: boolean;
  themeHits: number;
  matchedThemes: string[];
  geographicFocus: string[];
  connector: string | null;
  bridgedOrg: string | null;
  hasBridge: boolean;
  priorityScore: number;
  /** Foundation type indicates an ancillary fund (PAF/PuAF). Can only fund Item 1 DGR. null = unknown. */
  requiresDgr: boolean | null;
  /** Newest of last_scraped_at / enriched_at for this foundation (ISO), null if neither set. */
  dataVintage: string | null;
};

export type FoundationTargetSummary = {
  total: number;
  bridged: number;
  dgr: number;
  /** Sum of total_giving_annual across the full fit set (not just the page slice). */
  totalAddressableGiving: number;
};

type ViewRow = {
  id: string;
  name: string;
  gs_entity_id: string | null;
  total_giving_annual: number | string | null;
  avg_grant_size: number | string | null;
  grant_range_min: number | string | null;
  grant_range_max: number | string | null;
  has_dgr: boolean | null;
  theme_hits: number;
  matched_themes: string[] | null;
  geographic_focus: string[] | null;
  connector: string | null;
  bridged_org: string | null;
  has_bridge: boolean;
  priority_score: number;
};

type AggRow = {
  id: string;
  has_bridge: boolean | null;
  has_dgr: boolean | null;
  total_giving_annual: number | string | null;
};

type EnrichRow = {
  id: string;
  type: string | null;
  last_scraped_at: string | null;
  enriched_at: string | null;
  updated_at: string | null;
};

const num = (v: number | string | null): number | null => {
  if (v === null || v === undefined) return null;
  const n = Number(v);
  return Number.isFinite(n) ? n : null;
};

/**
 * Ancillary funds (Private / Public Ancillary Funds) can only distribute to
 * Item 1 DGR entities — so a Goods ask must route via Butterfly DGR. We read the
 * literal `foundations.type` and only flag the two ancillary-fund types; any
 * other or absent type returns null (unknown), never a false positive.
 */
function deriveRequiresDgr(type: string | null): boolean | null {
  if (!type) return null;
  const t = type.toLowerCase();
  if (t.includes('ancillary') || t.includes('paf') || t.includes('puaf')) return true;
  return false;
}

/** Newest of the two freshness stamps, ISO string, or null. */
function newestVintage(a: string | null, b: string | null): string | null {
  if (a && b) return new Date(a) >= new Date(b) ? a : b;
  return a ?? b ?? null;
}

export async function getGoodsFoundationTargets(opts?: {
  bridgedOnly?: boolean;
  limit?: number;
}): Promise<{
  targets: FoundationTarget[];
  summary: FoundationTargetSummary;
  fetchError: string | null;
}> {
  const empty = {
    targets: [],
    summary: { total: 0, bridged: 0, dgr: 0, totalAddressableGiving: 0 },
    fetchError: null as string | null,
  };
  try {
    const supabase = getServiceSupabase();

    let q = supabase
      .from('v_goods_foundation_targets')
      .select('id, name, gs_entity_id, total_giving_annual, avg_grant_size, grant_range_min, grant_range_max, has_dgr, theme_hits, matched_themes, geographic_focus, connector, bridged_org, has_bridge, priority_score')
      .order('priority_score', { ascending: false })
      .limit(opts?.limit ?? 60);
    if (opts?.bridgedOnly) q = q.eq('has_bridge', true);

    // ONE lightweight pass over the full fit set computes every summary count
    // (total / bridged / dgr) AND totalAddressableGiving in JS — collapsing the
    // three separate count() round-trips into a single query.
    const [rowsRes, aggRes] = await Promise.all([
      q,
      supabase.from('v_goods_foundation_targets').select('id, has_bridge, has_dgr, total_giving_annual'),
    ]);

    if (rowsRes.error) {
      console.error('[goods-foundation-targets] query failed:', rowsRes.error.message);
      return { ...empty, fetchError: rowsRes.error.message };
    }

    const rows = (rowsRes.data as ViewRow[] | null) ?? [];

    // Batch-enrich the displayed foundations with one query against `foundations`.
    const displayedIds = rows.map((r) => r.id);
    const enrichById = new Map<string, EnrichRow>();
    if (displayedIds.length > 0) {
      const { data: enrichData, error: enrichErr } = await supabase
        .from('foundations')
        .select('id, type, last_scraped_at, enriched_at, updated_at')
        .in('id', displayedIds);
      if (enrichErr) {
        // Non-fatal: targets still render, just without vintage / DGR-routing flags.
        console.error('[goods-foundation-targets] enrich failed:', enrichErr.message);
      } else {
        for (const e of (enrichData as EnrichRow[] | null) ?? []) enrichById.set(e.id, e);
      }
    }

    const targets: FoundationTarget[] = rows.map((r) => {
      const e = enrichById.get(r.id);
      return {
        id: r.id,
        name: r.name,
        gsEntityId: r.gs_entity_id,
        givingAnnual: num(r.total_giving_annual),
        avgGrant: num(r.avg_grant_size),
        grantMin: num(r.grant_range_min),
        grantMax: num(r.grant_range_max),
        hasDgr: !!r.has_dgr,
        themeHits: Number(r.theme_hits) || 0,
        matchedThemes: r.matched_themes ?? [],
        geographicFocus: r.geographic_focus ?? [],
        connector: r.connector,
        bridgedOrg: r.bridged_org,
        hasBridge: !!r.has_bridge,
        priorityScore: Number(r.priority_score) || 0,
        requiresDgr: e ? deriveRequiresDgr(e.type) : null,
        dataVintage: e ? newestVintage(e.last_scraped_at, e.enriched_at) : null,
      };
    });

    // Aggregate over the full fit set (fall back to the page slice if it failed).
    let summary: FoundationTargetSummary;
    if (aggRes.error || !aggRes.data) {
      console.error('[goods-foundation-targets] aggregate failed:', aggRes.error?.message);
      summary = {
        total: targets.length,
        bridged: targets.filter((t) => t.hasBridge).length,
        dgr: targets.filter((t) => t.hasDgr).length,
        totalAddressableGiving: targets.reduce((s, t) => s + (t.givingAnnual ?? 0), 0),
      };
    } else {
      const agg = aggRes.data as AggRow[];
      summary = {
        total: agg.length,
        bridged: agg.filter((a) => !!a.has_bridge).length,
        dgr: agg.filter((a) => !!a.has_dgr).length,
        totalAddressableGiving: agg.reduce((s, a) => s + (num(a.total_giving_annual) ?? 0), 0),
      };
    }

    return { targets, summary, fetchError: null };
  } catch (e) {
    const msg = e instanceof Error ? e.message : 'Unexpected target load error.';
    console.error('[goods-foundation-targets] unexpected:', e);
    return { ...empty, fetchError: msg };
  }
}
