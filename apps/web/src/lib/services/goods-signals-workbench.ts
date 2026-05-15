import { getServiceSupabase } from '@/lib/supabase';

export type GoodsSignalRow = {
  id: string;
  signal_type: 'demand_unmet' | 'asset_end_of_life' | string;
  status: string;
  priority: string;
  title: string;
  description: string | null;
  estimated_value: number | null;
  estimated_units: number | null;
  products_needed: string[] | null;
  funding_confidence: string | null;
  created_at: string;
  community: {
    id: string;
    community_name: string;
    state: string | null;
    postcode: string | null;
    priority: string | null;
  } | null;
  buyer: {
    id: string;
    entity_name: string;
    buyer_role: string | null;
  } | null;
  matched_grants: Array<{
    id: string;
    name: string;
    provider: string | null;
    amount_max: number | null;
    geography: string | null;
    closes_at: string | null;
    goods_relevance_score: number | null;
  }>;
  matched_foundations: Array<{
    id: string;
    name: string;
    total_giving_annual: number | null;
    geographic_focus: string[] | null;
    thematic_focus: string[] | null;
  }>;
  // Computed triage fields
  fit_score: number; // 0-100; max(per-grant fit) within signal
  is_noise: boolean; // no fit grants; hidden by default
  days_until_deadline: number | null; // min closes_at on matched grants
  triage_reason: string; // why this row is/isn't surfaced
};

export type GoodsSignalsSummary = {
  total: number;
  visible: number;
  noise_hidden: number;
  out_of_footprint_hidden: number; // signals from states Goods doesn't operate in
  by_status: Record<string, number>;
  by_priority: Record<string, number>;
  by_state: Record<string, number>;
  by_confidence: Record<string, number>;
  with_grants: number;
  with_foundations: number;
  with_buyer: number;
};

export type GoodsSignalsWorkbench = {
  signals: GoodsSignalRow[];
  summary: GoodsSignalsSummary;
};

const DEFAULT_LIMIT = 200;

// Noise thresholds — a signal is "noise" only if it has NO grant that passes all
// three. Any one strong grant rescues a signal.
const MIN_FIT_AMOUNT = 10_000;
const MIN_FIT_RELEVANCE = 30;

// States Goods physically operates in. Signals from communities outside this set
// get tagged 'out_of_footprint' and hidden by default — there are NSW community
// signals in the data but Goods doesn't deliver beds there.
export const GOODS_FOOTPRINT_STATES = new Set(['NT', 'QLD', 'WA', 'SA']);

const NATIONAL_GEOGRAPHIES = new Set(['AU-National', 'AU', '', null]);

function grantFitsCommunity(grant: GoodsSignalRow['matched_grants'][number], communityState: string | null | undefined): { fit: boolean; geo_fit: 'state-exact' | 'national' | 'unknown' | 'mismatch'; reason: string } {
  const amountOk = !grant.amount_max || grant.amount_max >= MIN_FIT_AMOUNT;
  const scoreOk = (grant.goods_relevance_score || 0) >= MIN_FIT_RELEVANCE;

  let geo_fit: 'state-exact' | 'national' | 'unknown' | 'mismatch' = 'mismatch';
  if (!grant.geography) geo_fit = 'unknown';
  else if (NATIONAL_GEOGRAPHIES.has(grant.geography)) geo_fit = 'national';
  else if (communityState && grant.geography === `AU-${communityState}`) geo_fit = 'state-exact';

  const geoOk = geo_fit !== 'mismatch';
  const fit = amountOk && scoreOk && geoOk;

  const reasons: string[] = [];
  if (!amountOk) reasons.push(`amount<${MIN_FIT_AMOUNT}`);
  if (!scoreOk) reasons.push(`score<${MIN_FIT_RELEVANCE}`);
  if (!geoOk) reasons.push(`geo:${grant.geography}!=${communityState}`);
  return { fit, geo_fit, reason: fit ? 'fit' : reasons.join(' · ') };
}

function daysUntil(iso: string | null | undefined): number | null {
  if (!iso) return null;
  const t = new Date(iso).getTime();
  if (isNaN(t)) return null;
  return Math.ceil((t - Date.now()) / 86_400_000);
}

function confidenceRank(c: string | null | undefined): number {
  if (c === 'confirmed') return 4;
  if (c === 'likely') return 3;
  if (c === 'possible') return 2;
  if (c === 'none') return 1;
  return 0;
}

export async function getGoodsSignalsWorkbench({
  status,
  priority,
  state,
  limit = DEFAULT_LIMIT,
  includeNoise = false,
  includeOutOfFootprint = false,
}: {
  status?: string[];
  priority?: string;
  state?: string;
  limit?: number;
  includeNoise?: boolean;
  includeOutOfFootprint?: boolean;
} = {}): Promise<GoodsSignalsWorkbench> {
  const db = getServiceSupabase();

  // Fetch the full signal universe — at ~1k rows this is cheaper than getting
  // clever about pagination. Priority-based ordering happens client-side after
  // joining community.priority, which PostgREST can't do natively.
  const fetchLimit = 2000;
  let q = db
    .from('goods_procurement_signals')
    .select('id, signal_type, status, priority, title, description, estimated_value, estimated_units, products_needed, funding_confidence, created_at, community_id, buyer_entity_id, matched_grant_ids, matched_foundation_ids')
    .limit(fetchLimit);

  if (status && status.length > 0) q = q.in('status', status);
  else q = q.in('status', ['new', 'reviewing']);
  if (priority) q = q.eq('priority', priority);

  // Universe-wide status counts so filter pills show accurate counts even when
  // a status is filtered out. Cheap: one COUNT-only PostgREST call per status.
  const statusUniverseQuery = db
    .from('goods_procurement_signals')
    .select('status');
  const [{ data: rawSignals, error }, { data: universeRows }] = await Promise.all([
    q,
    statusUniverseQuery,
  ]);
  if (error) throw new Error(`signals fetch: ${error.message}`);
  const universeStatusCounts: Record<string, number> = {};
  for (const r of universeRows || []) {
    const s = (r.status as string) || 'unknown';
    universeStatusCounts[s] = (universeStatusCounts[s] || 0) + 1;
  }

  const communityIds = [...new Set((rawSignals || []).map(s => s.community_id).filter(Boolean) as string[])];
  const buyerIds = [...new Set((rawSignals || []).map(s => s.buyer_entity_id).filter(Boolean) as string[])];
  const grantIds = [...new Set((rawSignals || []).flatMap(s => (s.matched_grant_ids || []) as string[]))];
  const foundationIds = [...new Set((rawSignals || []).flatMap(s => (s.matched_foundation_ids || []) as string[]))];

  // Chunked + parallel lookups. PostgREST silently truncates IN clauses past
  // ~100 IDs; chunking fixes that. Parallelising the chunks cuts community
  // join time from ~1.2s (12 sequential round-trips) to ~100ms.
  async function fetchChunked(table: string, columns: string, ids: string[], chunkSize = 100): Promise<any[]> {
    if (ids.length === 0) return [];
    const chunks: string[][] = [];
    for (let i = 0; i < ids.length; i += chunkSize) chunks.push(ids.slice(i, i + chunkSize));
    const results = await Promise.all(chunks.map(async slice => {
      const { data, error } = await db.from(table).select(columns).in('id', slice);
      if (error) throw new Error(`${table} chunk fetch: ${error.message}`);
      return data || [];
    }));
    return results.flat();
  }

  // Fire all 4 entity-type fetches in parallel. Each one internally parallelises
  // its chunks, so total wall time = slowest single chunk, not sum of chunks.
  const [communitiesData, buyersData, grantsData, foundationsData] = await Promise.all([
    fetchChunked('goods_communities', 'id, community_name, state, postcode, priority', communityIds),
    fetchChunked('goods_procurement_entities', 'id, entity_name, buyer_role', buyerIds),
    fetchChunked('grant_opportunities', 'id, name, provider, amount_max, geography, closes_at, goods_relevance_score', grantIds),
    fetchChunked('foundations', 'id, name, total_giving_annual, geographic_focus, thematic_focus', foundationIds),
  ]);
  const communityMap = new Map(communitiesData.map((c: any) => [c.id, c]));
  const buyerMap = new Map(buyersData.map((b: any) => [b.id, b]));
  const grantMap = new Map(grantsData.map((g: any) => [g.id, g]));
  const foundationMap = new Map(foundationsData.map((f: any) => [f.id, f]));

  let signals: GoodsSignalRow[] = (rawSignals || []).map(s => {
    const community = (s.community_id ? (communityMap.get(s.community_id) || null) : null) as GoodsSignalRow['community'];
    const buyer = (s.buyer_entity_id ? (buyerMap.get(s.buyer_entity_id) || null) : null) as GoodsSignalRow['buyer'];
    const matched_grants = (s.matched_grant_ids || [])
      .map((id: string) => grantMap.get(id))
      .filter(Boolean) as GoodsSignalRow['matched_grants'];
    const matched_foundations = (s.matched_foundation_ids || [])
      .map((id: string) => foundationMap.get(id))
      .filter(Boolean) as GoodsSignalRow['matched_foundations'];

    // Compute fit per matched grant; signal is noise if no grant fits.
    const grantFits = matched_grants.map(g => ({ grant: g, ...grantFitsCommunity(g, community?.state) }));
    const fittingGrants = grantFits.filter(gf => gf.fit);
    const is_noise = fittingGrants.length === 0;

    // fit_score = max(per-grant) where per-grant = relevance + geo bonus + amount bonus
    let fit_score = 0;
    for (const gf of grantFits) {
      const relevance = Math.min(50, Math.round((gf.grant.goods_relevance_score || 0) * 0.5));
      const geo = gf.geo_fit === 'state-exact' ? 25 : gf.geo_fit === 'national' ? 15 : gf.geo_fit === 'unknown' ? 5 : 0;
      const amt = (gf.grant.amount_max || 0) >= 100_000 ? 15 : (gf.grant.amount_max || 0) >= 10_000 ? 8 : 0;
      const total = relevance + geo + amt;
      if (total > fit_score) fit_score = total;
    }

    // days_until_deadline = min(closes_at) across fitting grants (urgency driver)
    let days_until_deadline: number | null = null;
    for (const gf of (fittingGrants.length ? fittingGrants : grantFits)) {
      const d = daysUntil(gf.grant.closes_at);
      if (d === null) continue;
      if (days_until_deadline === null || d < days_until_deadline) days_until_deadline = d;
    }

    const triage_reason = is_noise
      ? `noise — ${grantFits.length === 0 ? 'no matched grants' : 'no grant fits: ' + grantFits.map(g => g.reason).slice(0, 2).join('; ')}`
      : `${fittingGrants.length} fit grant(s)${days_until_deadline !== null ? ` · top closes in ${days_until_deadline}d` : ''}`;

    return {
      id: s.id,
      signal_type: s.signal_type,
      status: s.status,
      priority: s.priority,
      title: s.title,
      description: s.description,
      estimated_value: s.estimated_value,
      estimated_units: s.estimated_units,
      products_needed: s.products_needed,
      funding_confidence: s.funding_confidence,
      created_at: s.created_at,
      community,
      buyer,
      matched_grants,
      matched_foundations,
      fit_score,
      is_noise,
      days_until_deadline,
      triage_reason,
    };
  });

  // Collapse signals that share community + signal_type + title (e.g., 6
  // identical "Washing Machine replacement" rows from 6 separate asset records
  // at the same community). Keep the first, sum estimated_units, retain the
  // group's signal IDs for future batch-action support.
  {
    const groups = new Map<string, GoodsSignalRow & { _groupIds?: string[]; _groupSize?: number }>();
    for (const s of signals) {
      const key = `${s.community?.id || 'none'}|${s.signal_type}|${s.title}`;
      const existing = groups.get(key);
      if (existing) {
        existing.estimated_units = (existing.estimated_units || 0) + (s.estimated_units || 0);
        existing._groupIds!.push(s.id);
        existing._groupSize = (existing._groupSize || 1) + 1;
      } else {
        groups.set(key, { ...s, _groupIds: [s.id], _groupSize: 1 });
      }
    }
    signals = Array.from(groups.values()).map(g => {
      // Decorate title with group size if collapsed
      if ((g._groupSize || 1) > 1) {
        return { ...g, title: `${g.title} (×${g._groupSize})` };
      }
      const { _groupIds, _groupSize, ...rest } = g;
      void _groupIds; void _groupSize;
      return rest;
    });
  }

  const totalBeforeFilter = signals.length;
  if (state) signals = signals.filter(s => s.community?.state === state);
  // Footprint filter — drop signals from states Goods doesn't operate in. Skipped
  // when the user has explicitly picked a state (they want to see it).
  const outOfFootprintBeforeHide = (includeOutOfFootprint || state)
    ? 0
    : signals.filter(s => !s.community?.state || !GOODS_FOOTPRINT_STATES.has(s.community.state)).length;
  if (!includeOutOfFootprint && !state) {
    signals = signals.filter(s => s.community?.state && GOODS_FOOTPRINT_STATES.has(s.community.state));
  }
  const noiseBeforeHide = signals.filter(s => s.is_noise).length;
  if (!includeNoise) signals = signals.filter(s => !s.is_noise);

  // Triage sort:
  //   1. community priority (lead > active > warm > monitor > background/null)
  //      — lead/active are the communities Goods is actually operating in
  //   2. confidence tier (likely > possible > none/null)
  //   3. fit_score desc
  //   4. days_until_deadline asc (sooner = higher), nulls last
  //   5. created_at desc
  const communityPriorityRank = (p: string | null | undefined): number => {
    switch (p) {
      case 'lead': return 5;
      case 'active': return 4;
      case 'warm': return 3;
      case 'monitor': return 2;
      case 'background': return 1;
      default: return 0;
    }
  };
  signals.sort((a, b) => {
    const pRank = communityPriorityRank(b.community?.priority) - communityPriorityRank(a.community?.priority);
    if (pRank !== 0) return pRank;
    const cRank = confidenceRank(b.funding_confidence) - confidenceRank(a.funding_confidence);
    if (cRank !== 0) return cRank;
    if (b.fit_score !== a.fit_score) return b.fit_score - a.fit_score;
    const aDeadline = a.days_until_deadline ?? 99_999;
    const bDeadline = b.days_until_deadline ?? 99_999;
    if (aDeadline !== bDeadline) return aDeadline - bDeadline;
    return (b.created_at || '').localeCompare(a.created_at || '');
  });

  signals = signals.slice(0, limit);

  const summary: GoodsSignalsSummary = {
    total: totalBeforeFilter,
    visible: signals.length,
    noise_hidden: includeNoise ? 0 : noiseBeforeHide,
    out_of_footprint_hidden: outOfFootprintBeforeHide,
    by_status: {},
    by_priority: {},
    by_state: {},
    by_confidence: {},
    with_grants: 0,
    with_foundations: 0,
    with_buyer: 0,
  };
  // Status counts come from the unfiltered universe so filter pills show
  // accurate counts (e.g., you can see "Dismissed (12)" even while looking at New).
  summary.by_status = universeStatusCounts;

  for (const s of signals) {
    summary.by_priority[s.priority] = (summary.by_priority[s.priority] || 0) + 1;
    const st = s.community?.state || 'unknown';
    summary.by_state[st] = (summary.by_state[st] || 0) + 1;
    const conf = s.funding_confidence || 'none';
    summary.by_confidence[conf] = (summary.by_confidence[conf] || 0) + 1;
    if (s.matched_grants.length > 0) summary.with_grants++;
    if (s.matched_foundations.length > 0) summary.with_foundations++;
    if (s.buyer) summary.with_buyer++;
  }

  return { signals, summary };
}
