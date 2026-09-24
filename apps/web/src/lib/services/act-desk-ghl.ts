import type { SupabaseClient } from '@supabase/supabase-js';
import { pushGoodsGrantToGHL } from '@/lib/services/goods-grant-ghl';

// Pursue on a desk grant sends it to GHL. A stamped grant_opportunities.ghl_opportunity_id proves nothing
// on its own (all 725 stamps on 2026-09-24 were set, and most point at deleted opps), so "in GHL" means
// the stamp resolves to a synced row in the ghl_opportunities mirror. Stamps hold either the 20-char GHL
// id or, on 290 older rows, the mirror row UUID; both resolve here.

export type GhlPursueResult =
  | { status: 'pushed' | 'already'; opportunityId: string }
  | { status: 'failed'; detail: string };

type MirrorRow = { id: string; ghl_id: string };

/** stamp -> live GHL opportunity id, for stamps that resolve to a synced mirror row. */
export function resolveGhlStamps(stamps: string[], mirror: MirrorRow[]): Map<string, string> {
  const byId = new Map<string, string>();
  for (const m of mirror) {
    byId.set(m.ghl_id, m.ghl_id);
    byId.set(m.id, m.ghl_id);
  }
  const out = new Map<string, string>();
  for (const s of stamps) {
    const live = byId.get(s);
    if (live) out.set(s, live);
  }
  return out;
}

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export async function liveGhlOpportunityIds(db: SupabaseClient, stamps: string[]): Promise<Map<string, string>> {
  const unique = [...new Set(stamps.filter(Boolean))];
  if (!unique.length) return new Map();
  const mirror: MirrorRow[] = [];
  for (let i = 0; i < unique.length; i += 200) {
    const chunk = unique.slice(i, i + 200);
    const uuids = chunk.filter((s) => UUID.test(s));
    const ghlIds = chunk.filter((s) => !UUID.test(s));
    for (const [col, ids] of [['ghl_id', ghlIds], ['id', uuids]] as const) {
      if (!ids.length) continue;
      const { data, error } = await db
        .from('ghl_opportunities')
        .select('id, ghl_id')
        .eq('sync_status', 'synced')
        .in(col, ids);
      if (error) throw new Error(`ghl mirror: ${error.message}`);
      mirror.push(...((data ?? []) as MirrorRow[]));
    }
  }
  return resolveGhlStamps(unique, mirror);
}

/** Put a pursued grant into the GHL Grants pipeline at Identified, unless a live opp already holds it. */
export async function pursueGrantInGhl(db: SupabaseClient, grantId: string): Promise<GhlPursueResult> {
  const { data: g, error } = await db
    .from('grant_opportunities')
    .select('id, name, provider, deadline, closes_at, url, geography, amount_min, amount_max, goods_relevance_score, ghl_opportunity_id')
    .eq('id', grantId)
    .maybeSingle();
  if (error) return { status: 'failed', detail: error.message };
  if (!g) return { status: 'failed', detail: 'That grant is not in grant_opportunities' };

  if (g.ghl_opportunity_id) {
    const live = await liveGhlOpportunityIds(db, [g.ghl_opportunity_id]);
    const id = live.get(g.ghl_opportunity_id);
    if (id) return { status: 'already', opportunityId: id };
  }

  const res = await pushGoodsGrantToGHL({
    grantId: g.id,
    name: g.name,
    provider: g.provider ?? null,
    fitScore: g.goods_relevance_score ?? null,
    deadline: g.closes_at ?? g.deadline ?? null,
    url: g.url ?? null,
    geography: g.geography ?? null,
    amountMin: g.amount_min ?? null,
    amountMax: g.amount_max ?? null,
  });
  if (!res.ok) return { status: 'failed', detail: res.status ? `GHL said ${res.status}` : res.reason };

  const { error: stampErr } = await db.from('grant_opportunities').update({ ghl_opportunity_id: res.opportunityId }).eq('id', g.id);
  if (stampErr) return { status: 'failed', detail: `In GHL as ${res.opportunityId}, but the stamp did not save: ${stampErr.message}` };
  return { status: 'pushed', opportunityId: res.opportunityId };
}
