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
};

export type FoundationTargetSummary = {
  total: number;
  bridged: number;
  dgr: number;
};

type ViewRow = {
  id: string;
  name: string;
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

const num = (v: number | string | null): number | null => {
  if (v === null || v === undefined) return null;
  const n = Number(v);
  return Number.isFinite(n) ? n : null;
};

export async function getGoodsFoundationTargets(opts?: {
  bridgedOnly?: boolean;
  limit?: number;
}): Promise<{ targets: FoundationTarget[]; summary: FoundationTargetSummary }> {
  const empty = { targets: [], summary: { total: 0, bridged: 0, dgr: 0 } };
  try {
    const supabase = getServiceSupabase();

    let q = supabase
      .from('v_goods_foundation_targets')
      .select('id, name, total_giving_annual, avg_grant_size, grant_range_min, grant_range_max, has_dgr, theme_hits, matched_themes, geographic_focus, connector, bridged_org, has_bridge, priority_score')
      .order('priority_score', { ascending: false })
      .limit(opts?.limit ?? 60);
    if (opts?.bridgedOnly) q = q.eq('has_bridge', true);

    // Summary counts (cheap aggregate over the view) run alongside the page slice.
    const [rowsRes, totalRes, bridgedRes, dgrRes] = await Promise.all([
      q,
      supabase.from('v_goods_foundation_targets').select('id', { count: 'exact', head: true }),
      supabase.from('v_goods_foundation_targets').select('id', { count: 'exact', head: true }).eq('has_bridge', true),
      supabase.from('v_goods_foundation_targets').select('id', { count: 'exact', head: true }).eq('has_dgr', true),
    ]);

    if (rowsRes.error) {
      console.error('[goods-foundation-targets] query failed:', rowsRes.error.message);
      return empty;
    }

    const targets: FoundationTarget[] = ((rowsRes.data as ViewRow[] | null) ?? []).map((r) => ({
      id: r.id,
      name: r.name,
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
    }));

    return {
      targets,
      summary: {
        total: totalRes.count ?? targets.length,
        bridged: bridgedRes.count ?? 0,
        dgr: dgrRes.count ?? 0,
      },
    };
  } catch (e) {
    console.error('[goods-foundation-targets] unexpected:', e);
    return empty;
  }
}
