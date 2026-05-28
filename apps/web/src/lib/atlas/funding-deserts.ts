/**
 * Funding Deserts Atlas — data access.
 *
 * Reads `mv_funding_deserts` (per LGA × state × remoteness rows) and aggregates
 * to one row per (lga_name, state). `desert_score` is a 0–200 disadvantage-vs-funding
 * score computed by the MV; higher = worse-served. Methodology: see /atlas/funding-deserts/methodology.
 */

import { getDirectServiceSupabase } from '@/lib/supabase';

export type FundingDesertRow = {
  lga_name: string;
  state: string;
  remoteness_modal: string | null;
  desert_score: number;
  total_funding: number;
  indexed_entities: number;
  community_controlled_entities: number;
  avg_irsd_decile: number | null;
  min_irsd_decile: number | null;
  postcode_count: number;
  procurement_dollars: number;
  justice_dollars: number;
  donation_dollars: number;
  multi_system_entities: number;
  funding_per_indexed_entity: number | null;
};

function toNum(v: unknown): number {
  if (v === null || v === undefined) return 0;
  const n = typeof v === 'number' ? v : Number(v);
  return Number.isFinite(n) ? n : 0;
}

function toMaybeNum(v: unknown): number | null {
  if (v === null || v === undefined) return null;
  const n = typeof v === 'number' ? v : Number(v);
  return Number.isFinite(n) ? n : null;
}

/**
 * Aggregate per-LGA × state. The MV has up to ~5 rows per LGA (one per remoteness
 * band) which would otherwise show duplicates in the table.
 */
type RawDesertRow = {
  lga_name: string | null;
  state: string | null;
  remoteness: string | null;
  desert_score: number | string | null;
  total_funding_all_sources: number | string | null;
  indexed_entities: number | string | null;
  community_controlled_entities: number | string | null;
  avg_irsd_decile: number | string | null;
  min_irsd_decile: number | string | null;
  postcode_count: number | string | null;
  procurement_dollars: number | string | null;
  justice_dollars: number | string | null;
  donation_dollars: number | string | null;
  multi_system_entities: number | string | null;
};

function aggregate(rows: RawDesertRow[]): FundingDesertRow[] {
  const byKey = new Map<string, FundingDesertRow & { _scoreWeight: number; _remotenessCounts: Map<string, number> }>();

  for (const r of rows) {
    if (!r.lga_name || !r.state) continue;
    const key = `${r.state}::${r.lga_name}`;
    const existing = byKey.get(key);
    const totalFunding = toNum(r.total_funding_all_sources);
    const indexedEntities = toNum(r.indexed_entities);
    const score = toNum(r.desert_score);

    if (!existing) {
      const remotenessCounts = new Map<string, number>();
      if (r.remoteness) remotenessCounts.set(r.remoteness, 1);
      byKey.set(key, {
        lga_name: r.lga_name,
        state: r.state,
        remoteness_modal: r.remoteness ?? null,
        desert_score: score,
        total_funding: totalFunding,
        indexed_entities: indexedEntities,
        community_controlled_entities: toNum(r.community_controlled_entities),
        avg_irsd_decile: toMaybeNum(r.avg_irsd_decile),
        min_irsd_decile: toMaybeNum(r.min_irsd_decile),
        postcode_count: toNum(r.postcode_count),
        procurement_dollars: toNum(r.procurement_dollars),
        justice_dollars: toNum(r.justice_dollars),
        donation_dollars: toNum(r.donation_dollars),
        multi_system_entities: toNum(r.multi_system_entities),
        funding_per_indexed_entity: null,
        _scoreWeight: 1,
        _remotenessCounts: remotenessCounts,
      });
    } else {
      // Sum dollar/entity rollups; take the MAX desert_score across remoteness bands
      // (worst slice represents the disadvantage signal best).
      existing.desert_score = Math.max(existing.desert_score, score);
      existing.total_funding += totalFunding;
      existing.indexed_entities += indexedEntities;
      existing.community_controlled_entities += toNum(r.community_controlled_entities);
      existing.procurement_dollars += toNum(r.procurement_dollars);
      existing.justice_dollars += toNum(r.justice_dollars);
      existing.donation_dollars += toNum(r.donation_dollars);
      existing.multi_system_entities += toNum(r.multi_system_entities);
      existing.postcode_count += toNum(r.postcode_count);

      const ai = toMaybeNum(r.avg_irsd_decile);
      if (ai !== null) {
        const prev = existing.avg_irsd_decile ?? ai;
        existing.avg_irsd_decile = (prev * existing._scoreWeight + ai) / (existing._scoreWeight + 1);
        existing._scoreWeight += 1;
      }
      const mi = toMaybeNum(r.min_irsd_decile);
      if (mi !== null) {
        existing.min_irsd_decile = existing.min_irsd_decile === null ? mi : Math.min(existing.min_irsd_decile, mi);
      }
      if (r.remoteness) {
        existing._remotenessCounts.set(r.remoteness, (existing._remotenessCounts.get(r.remoteness) ?? 0) + 1);
      }
    }
  }

  const out: FundingDesertRow[] = [];
  for (const r of byKey.values()) {
    // Pick the most common remoteness band as the modal label
    let modal: string | null = null;
    let bestCount = 0;
    for (const [k, v] of r._remotenessCounts) {
      if (v > bestCount) {
        bestCount = v;
        modal = k;
      }
    }
    r.remoteness_modal = modal;
    r.funding_per_indexed_entity = r.indexed_entities > 0 ? r.total_funding / r.indexed_entities : null;
    const { _scoreWeight, _remotenessCounts, ...clean } = r;
    void _scoreWeight;
    void _remotenessCounts;
    out.push(clean);
  }
  return out;
}

export type ListOptions = {
  limit?: number;
  offset?: number;
  state?: string | null;
  minDecile?: number | null;
  maxDecile?: number | null;
  remoteness?: string | null;
  sort?: 'desert_score' | 'total_funding' | 'indexed_entities' | 'avg_irsd_decile';
  order?: 'asc' | 'desc';
};

export async function listFundingDeserts(opts: ListOptions = {}): Promise<{
  rows: FundingDesertRow[];
  totalLgas: number;
}> {
  const supabase = getDirectServiceSupabase();
  // Pull a wide slice once, then aggregate + sort + slice. MV has only ~2.2K rows
  // so this is cheap and avoids paginating across MV rows that double-count LGAs.
  const { data, error } = await supabase
    .from('mv_funding_deserts')
    .select(
      'lga_name,state,remoteness,desert_score,total_funding_all_sources,indexed_entities,community_controlled_entities,avg_irsd_decile,min_irsd_decile,postcode_count,procurement_dollars,justice_dollars,donation_dollars,multi_system_entities'
    )
    .not('lga_name', 'is', null)
    .not('state', 'is', null)
    .neq('state', '')
    .limit(5000);

  if (error) {
    console.error('[atlas/funding-deserts] list error', error);
    return { rows: [], totalLgas: 0 };
  }

  let rows = aggregate((data ?? []) as RawDesertRow[]);

  if (opts.state) rows = rows.filter((r) => r.state === opts.state);
  if (opts.remoteness) rows = rows.filter((r) => r.remoteness_modal === opts.remoteness);
  if (opts.minDecile != null) rows = rows.filter((r) => (r.avg_irsd_decile ?? 99) >= opts.minDecile!);
  if (opts.maxDecile != null) rows = rows.filter((r) => (r.avg_irsd_decile ?? -1) <= opts.maxDecile!);

  const totalLgas = rows.length;

  const sortKey = opts.sort ?? 'desert_score';
  const order = opts.order ?? 'desc';
  rows.sort((a, b) => {
    const av = (a[sortKey] ?? -Infinity) as number;
    const bv = (b[sortKey] ?? -Infinity) as number;
    return order === 'desc' ? bv - av : av - bv;
  });

  const offset = opts.offset ?? 0;
  const limit = opts.limit ?? 50;
  return { rows: rows.slice(offset, offset + limit), totalLgas };
}

export async function getFundingDesertByLga(lgaName: string, state?: string | null): Promise<FundingDesertRow | null> {
  const supabase = getDirectServiceSupabase();
  let query = supabase
    .from('mv_funding_deserts')
    .select(
      'lga_name,state,remoteness,desert_score,total_funding_all_sources,indexed_entities,community_controlled_entities,avg_irsd_decile,min_irsd_decile,postcode_count,procurement_dollars,justice_dollars,donation_dollars,multi_system_entities'
    )
    .eq('lga_name', lgaName)
    .not('state', 'is', null)
    .neq('state', '');
  if (state) query = query.eq('state', state);
  const { data, error } = await query.limit(50);
  if (error) {
    console.error('[atlas/funding-deserts] get error', error);
    return null;
  }
  const agg = aggregate((data ?? []) as RawDesertRow[]);
  return agg[0] ?? null;
}

/**
 * Top recipients (gs_entities) inside a given LGA, summed across funding sources.
 * Bounded to indexed entities via gs_entities.lga_name match.
 */
export type LgaRecipient = {
  gs_id: string;
  canonical_name: string;
  entity_type: string | null;
  abn: string | null;
  is_community_controlled: boolean;
  total: number;
};

export async function getTopRecipientsForLga(lgaName: string, state: string, limit = 10): Promise<LgaRecipient[]> {
  const supabase = getDirectServiceSupabase();
  const { data, error } = await supabase
    .from('gs_entities')
    .select('id,gs_id,canonical_name,entity_type,abn,is_community_controlled,latest_revenue')
    .eq('lga_name', lgaName)
    .eq('state', state)
    .order('latest_revenue', { ascending: false, nullsFirst: false })
    .limit(limit);
  if (error) {
    console.error('[atlas/funding-deserts] recipients error', error);
    return [];
  }
  return (data ?? []).map((e) => ({
    gs_id: e.gs_id,
    canonical_name: e.canonical_name,
    entity_type: e.entity_type,
    abn: e.abn,
    is_community_controlled: Boolean(e.is_community_controlled),
    total: toNum(e.latest_revenue),
  }));
}

/** URL slug helpers: encode lga name + state into one slug segment. */
export function lgaToSlug(lgaName: string, state: string): string {
  const name = lgaName.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
  return `${state.toLowerCase()}-${name}`;
}

export function slugToLgaState(slug: string): { state: string; lgaSlug: string } | null {
  const m = /^([a-z]{2,3})-(.+)$/.exec(slug.toLowerCase());
  if (!m) return null;
  return { state: m[1].toUpperCase(), lgaSlug: m[2] };
}
