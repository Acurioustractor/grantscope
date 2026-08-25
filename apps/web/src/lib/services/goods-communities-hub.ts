import { getServiceSupabase } from '@/lib/supabase';

export type CommunityHubRow = {
  id: string;
  community_name: string;
  state: string | null;
  postcode: string | null;
  region_label: string | null;
  priority: string;
  demand_beds: number;
  demand_washers: number;
  total_demand: number;
  assets_deployed: number;
  land_council: string | null;
  // SEIFA disadvantage overlay (v_goods_community_priority)
  seifa_irsd_decile: number | null;   // 1 = most disadvantaged, 10 = least; null if no SEIFA match
  disadvantage_score: number | null;  // 0..100, decile 1 -> 100
  unmet_beds: number;                 // GREATEST(demand_beds - assets_deployed, 0)
  serve_next_score: number;           // unmet beds amplified up to 2x by disadvantage
  open_signals: number;
  reviewing_signals: number;
  actioned_signals: number;
  total_signals: number;
  mapped_buyer_count: number;
  ghl_linked_buyer_count: number;
  last_action_at: string | null;
};

export type CommunityHubSummary = {
  total: number;
  by_state: Record<string, number>;
  by_priority: Record<string, number>;
  with_deployments: number;
  with_open_signals: number;
  with_ghl: number;
  high_disadvantage: number;  // SEIFA IRSD decile <= 3
  total_beds_demanded: number;
  total_beds_deployed: number;
  total_washers_demanded: number;
};

export type CommunitiesHubResult = {
  communities: CommunityHubRow[];
  summary: CommunityHubSummary;
};

const ACTIVE_PRIORITIES = ['lead', 'active', 'warm'];
const COMMUNITY_PAGE_SIZE = 1000;

async function fetchChunked(db: any, table: string, columns: string, ids: string[], chunkSize = 100, optional = false): Promise<any[]> {
  if (ids.length === 0) return [];
  const chunks: string[][] = [];
  for (let i = 0; i < ids.length; i += chunkSize) chunks.push(ids.slice(i, i + chunkSize));
  const results = await Promise.all(chunks.map(async slice => {
    const { data, error } = await db.from(table).select(columns).in('community_id', slice);
    if (error) {
      if (optional) return [];
      throw new Error(`${table} chunk fetch: ${error.message}`);
    }
    return data || [];
  }));
  return results.flat();
}

export async function fetchGoodsCommunityRows(
  db: any,
  filters: { scope: 'active' | 'lead' | 'all' | 'with_deployments'; state?: string }
): Promise<any[]> {
  const rows: any[] = [];
  for (let from = 0; ; from += COMMUNITY_PAGE_SIZE) {
    let page = db
      .from('goods_communities')
      .select('id, community_name, state, postcode, region_label, priority, demand_beds, demand_washers, assets_deployed, land_council')
      .order('id', { ascending: true });

    if (filters.scope === 'active') page = page.in('priority', ACTIVE_PRIORITIES);
    else if (filters.scope === 'lead') page = page.eq('priority', 'lead');
    else if (filters.scope === 'with_deployments') page = page.gt('assets_deployed', 0);
    if (filters.state) page = page.eq('state', filters.state);

    const { data, error } = await page.range(from, from + COMMUNITY_PAGE_SIZE - 1);
    if (error) throw new Error(`communities fetch: ${error.message}`);
    const batch = Array.isArray(data) ? data : [];
    rows.push(...batch);
    if (batch.length < COMMUNITY_PAGE_SIZE) return rows;
  }
}

export async function getGoodsCommunitiesHub({
  scope = 'active',
  state,
  search,
  sort = 'priority',
}: {
  scope?: 'active' | 'lead' | 'all' | 'with_deployments';
  state?: string;
  search?: string;
  sort?: 'priority' | 'serve_next';
} = {}): Promise<CommunitiesHubResult> {
  const db = getServiceSupabase();

  let communities = await fetchGoodsCommunityRows(db, { scope, state });
  if (search) {
    const s = search.toLowerCase();
    communities = communities.filter(c =>
      c.community_name?.toLowerCase().includes(s) ||
      c.postcode?.toLowerCase().includes(s) ||
      c.region_label?.toLowerCase().includes(s)
    );
  }

  const ids = communities.map(c => c.id);

  // Signals, buyers, and SEIFA/serve-next priority per community — parallel chunked fetches
  const [signals, buyers, priority] = await Promise.all([
    fetchChunked(db, 'goods_procurement_signals', 'community_id, status, actioned_at', ids),
    fetchChunked(db, 'goods_procurement_entities', 'community_id, ghl_contact_id', ids),
    fetchChunked(db, 'v_goods_community_priority', 'community_id, seifa_irsd_decile, disadvantage_score, unmet_beds, serve_next_score', ids, 100, true),
  ]);

  const sigByCommunity = new Map<string, { open: number; reviewing: number; actioned: number; total: number; last_action: string | null }>();
  for (const s of signals) {
    const cid = s.community_id;
    if (!cid) continue;
    const cur = sigByCommunity.get(cid) || { open: 0, reviewing: 0, actioned: 0, total: 0, last_action: null };
    cur.total++;
    if (s.status === 'new') cur.open++;
    else if (s.status === 'reviewing') cur.reviewing++;
    else if (s.status === 'actioned') cur.actioned++;
    if (s.actioned_at && (!cur.last_action || s.actioned_at > cur.last_action)) {
      cur.last_action = s.actioned_at;
    }
    sigByCommunity.set(cid, cur);
  }

  const buyerByCommunity = new Map<string, { mapped: number; ghl_linked: number }>();
  for (const b of buyers) {
    const cid = b.community_id;
    if (!cid) continue;
    const cur = buyerByCommunity.get(cid) || { mapped: 0, ghl_linked: 0 };
    cur.mapped++;
    if (b.ghl_contact_id) cur.ghl_linked++;
    buyerByCommunity.set(cid, cur);
  }

  const priorityByCommunity = new Map<string, { decile: number | null; disadvantage: number | null; unmet: number; serveNext: number }>();
  for (const p of priority) {
    const cid = p.community_id;
    if (!cid) continue;
    priorityByCommunity.set(cid, {
      decile: p.seifa_irsd_decile == null ? null : Number(p.seifa_irsd_decile),
      disadvantage: p.disadvantage_score == null ? null : Number(p.disadvantage_score),
      unmet: Number(p.unmet_beds) || 0,
      serveNext: Number(p.serve_next_score) || 0,
    });
  }

  const rows: CommunityHubRow[] = communities.map(c => {
    const sig = sigByCommunity.get(c.id) || { open: 0, reviewing: 0, actioned: 0, total: 0, last_action: null };
    const buy = buyerByCommunity.get(c.id) || { mapped: 0, ghl_linked: 0 };
    const pri = priorityByCommunity.get(c.id) || { decile: null, disadvantage: null, unmet: 0, serveNext: 0 };
    return {
      id: c.id,
      community_name: c.community_name,
      state: c.state,
      postcode: c.postcode,
      region_label: c.region_label,
      priority: c.priority || 'background',
      demand_beds: Number(c.demand_beds) || 0,
      demand_washers: Number(c.demand_washers) || 0,
      total_demand: (Number(c.demand_beds) || 0) + (Number(c.demand_washers) || 0),
      assets_deployed: Number(c.assets_deployed) || 0,
      land_council: c.land_council,
      seifa_irsd_decile: pri.decile,
      disadvantage_score: pri.disadvantage,
      unmet_beds: pri.unmet,
      serve_next_score: pri.serveNext,
      open_signals: sig.open,
      reviewing_signals: sig.reviewing,
      actioned_signals: sig.actioned,
      total_signals: sig.total,
      mapped_buyer_count: buy.mapped,
      ghl_linked_buyer_count: buy.ghl_linked,
      last_action_at: sig.last_action,
    };
  });

  if (sort === 'serve_next') {
    // Serve-next: SEIFA-weighted unmet demand desc → demand desc → name
    rows.sort((a, b) => {
      if (b.serve_next_score !== a.serve_next_score) return b.serve_next_score - a.serve_next_score;
      if (b.total_demand !== a.total_demand) return b.total_demand - a.total_demand;
      return (a.community_name || '').localeCompare(b.community_name || '');
    });
  } else {
    // Default sort: priority (lead first) → demand desc → name
    const priorityRank: Record<string, number> = { lead: 4, active: 3, warm: 2, monitor: 1, background: 0 };
    rows.sort((a, b) => {
      const pr = (priorityRank[b.priority] || 0) - (priorityRank[a.priority] || 0);
      if (pr !== 0) return pr;
      if (b.total_demand !== a.total_demand) return b.total_demand - a.total_demand;
      return (a.community_name || '').localeCompare(b.community_name || '');
    });
  }

  const summary: CommunityHubSummary = {
    total: rows.length,
    by_state: {},
    by_priority: {},
    with_deployments: 0,
    with_open_signals: 0,
    with_ghl: 0,
    high_disadvantage: 0,
    total_beds_demanded: 0,
    total_beds_deployed: 0,
    total_washers_demanded: 0,
  };
  for (const r of rows) {
    summary.by_state[r.state || 'unknown'] = (summary.by_state[r.state || 'unknown'] || 0) + 1;
    summary.by_priority[r.priority] = (summary.by_priority[r.priority] || 0) + 1;
    if (r.assets_deployed > 0) summary.with_deployments++;
    if (r.open_signals + r.reviewing_signals > 0) summary.with_open_signals++;
    if (r.ghl_linked_buyer_count > 0) summary.with_ghl++;
    if (r.seifa_irsd_decile != null && r.seifa_irsd_decile <= 3) summary.high_disadvantage++;
    summary.total_beds_demanded += r.demand_beds;
    summary.total_beds_deployed += r.assets_deployed;
    summary.total_washers_demanded += r.demand_washers;
  }

  return { communities: rows, summary };
}
