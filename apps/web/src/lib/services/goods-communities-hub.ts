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
  total_beds_demanded: number;
  total_beds_deployed: number;
  total_washers_demanded: number;
};

export type CommunitiesHubResult = {
  communities: CommunityHubRow[];
  summary: CommunityHubSummary;
};

const ACTIVE_PRIORITIES = ['lead', 'active', 'warm'];

async function fetchChunked(db: any, table: string, columns: string, ids: string[], chunkSize = 100): Promise<any[]> {
  if (ids.length === 0) return [];
  const chunks: string[][] = [];
  for (let i = 0; i < ids.length; i += chunkSize) chunks.push(ids.slice(i, i + chunkSize));
  const results = await Promise.all(chunks.map(async slice => {
    const { data, error } = await db.from(table).select(columns).in('community_id', slice);
    if (error) throw new Error(`${table} chunk fetch: ${error.message}`);
    return data || [];
  }));
  return results.flat();
}

export async function getGoodsCommunitiesHub({
  scope = 'active',
  state,
  search,
}: {
  scope?: 'active' | 'lead' | 'all' | 'with_deployments';
  state?: string;
  search?: string;
} = {}): Promise<CommunitiesHubResult> {
  const db = getServiceSupabase();

  let q = db
    .from('goods_communities')
    .select('id, community_name, state, postcode, region_label, priority, demand_beds, demand_washers, assets_deployed, land_council')
    .limit(2000);

  if (scope === 'active') q = q.in('priority', ACTIVE_PRIORITIES);
  else if (scope === 'lead') q = q.eq('priority', 'lead');
  else if (scope === 'with_deployments') q = q.gt('assets_deployed', 0);
  // 'all' = no filter

  if (state) q = q.eq('state', state);

  const { data: rawCommunities, error } = await q;
  if (error) throw new Error(`communities fetch: ${error.message}`);

  let communities = (rawCommunities || []) as any[];
  if (search) {
    const s = search.toLowerCase();
    communities = communities.filter(c =>
      c.community_name?.toLowerCase().includes(s) ||
      c.postcode?.toLowerCase().includes(s) ||
      c.region_label?.toLowerCase().includes(s)
    );
  }

  const ids = communities.map(c => c.id);

  // Signals and buyers per community — parallel chunked fetches
  const [signals, buyers] = await Promise.all([
    fetchChunked(db, 'goods_procurement_signals', 'community_id, status, actioned_at', ids),
    fetchChunked(db, 'goods_procurement_entities', 'community_id, ghl_contact_id', ids),
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

  const rows: CommunityHubRow[] = communities.map(c => {
    const sig = sigByCommunity.get(c.id) || { open: 0, reviewing: 0, actioned: 0, total: 0, last_action: null };
    const buy = buyerByCommunity.get(c.id) || { mapped: 0, ghl_linked: 0 };
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
      open_signals: sig.open,
      reviewing_signals: sig.reviewing,
      actioned_signals: sig.actioned,
      total_signals: sig.total,
      mapped_buyer_count: buy.mapped,
      ghl_linked_buyer_count: buy.ghl_linked,
      last_action_at: sig.last_action,
    };
  });

  // Default sort: priority (lead first) → demand desc → name
  const priorityRank: Record<string, number> = { lead: 4, active: 3, warm: 2, monitor: 1, background: 0 };
  rows.sort((a, b) => {
    const pr = (priorityRank[b.priority] || 0) - (priorityRank[a.priority] || 0);
    if (pr !== 0) return pr;
    if (b.total_demand !== a.total_demand) return b.total_demand - a.total_demand;
    return (a.community_name || '').localeCompare(b.community_name || '');
  });

  const summary: CommunityHubSummary = {
    total: rows.length,
    by_state: {},
    by_priority: {},
    with_deployments: 0,
    with_open_signals: 0,
    with_ghl: 0,
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
    summary.total_beds_demanded += r.demand_beds;
    summary.total_beds_deployed += r.assets_deployed;
    summary.total_washers_demanded += r.demand_washers;
  }

  return { communities: rows, summary };
}
