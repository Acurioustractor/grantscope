import { unstable_cache } from 'next/cache';
import { getServiceSupabase } from '@/lib/supabase';
import { GOODS_SERVED_PLACES, type ServedPlaceStatus } from '@/lib/services/goods-served-places';

// Who buys beds, mattresses and whitegoods for people in communities. The classification rules live
// in goods-demand-rules.ts, which has no imports so the Goods app's scripts can load it directly.
export { classifyPurchase, communityRole, ROLES, type PurchaseKind, type CommunityRole } from './goods-demand-rules';
import { classifyPurchase, communityRole, ROLES, type PurchaseKind, type CommunityRole } from './goods-demand-rules';

export type GovPurchase = { title: string; value: number | null; date: string | null; source: 'austender' | 'qld-tenders' };
export type GovBuyer = {
  buyer: string;
  kind: PurchaseKind;
  purchases: GovPurchase[];
  total: number;
  last: string | null;
};
export type CommunityBuyer = {
  id: string;
  gsId: string | null;
  name: string;
  role: CommunityRole;
  state: string | null;
  remoteness: string | null;
  communityControlled: boolean;
  postcode: string | null;
  lgaCode: string | null;
  /** Recorded money in across every dataset (mv_gs_entity_stats), a sign of budget, not of bed spend. */
  moneyIn: number | null;
};
/** A served community with the community buyers nearby: same postcode or same LGA code. Nearby, not belonging. */
export type ServedPlaceDemand = {
  slug: string;
  name: string;
  status: ServedPlaceStatus;
  communityId: string | null;
  postcode: string | null;
  lgaCode: string | null;
  nearby: { id: string; how: 'postcode' | 'lga' }[];
};
export type DemandMap = { household: GovBuyer[]; custodial: GovBuyer[]; community: CommunityBuyer[]; places: ServedPlaceDemand[] };

/** Attach community buyers to a place on an exact postcode, else an exact LGA code. Never by name. */
export function placeNearby(
  place: { postcode: string | null; lgaCode: string | null },
  orgs: Pick<CommunityBuyer, 'id' | 'postcode' | 'lgaCode'>[],
): ServedPlaceDemand['nearby'] {
  const out: ServedPlaceDemand['nearby'] = [];
  for (const o of orgs) {
    if (place.postcode && o.postcode === place.postcode) out.push({ id: o.id, how: 'postcode' });
    else if (place.lgaCode && o.lgaCode === place.lgaCode) out.push({ id: o.id, how: 'lga' });
  }
  return out;
}

type RawPurchase = { buyer: string; title: string; value: number | null; date: string | null; source: GovPurchase['source'] };

/** Group classified purchases by buyer; biggest recent spenders first. Duplicated rows (same buyer, title, value, date) count once. */
export function groupPurchases(rows: RawPurchase[]): { household: GovBuyer[]; custodial: GovBuyer[] } {
  const seen = new Set<string>();
  const by = new Map<string, GovBuyer>();
  for (const r of rows) {
    const kind = classifyPurchase(r.title, r.buyer);
    if (!kind) continue;
    const dupe = `${r.buyer}|${r.title}|${r.value}|${r.date}`;
    if (seen.has(dupe)) continue;
    seen.add(dupe);
    const key = `${kind}|${r.buyer}`;
    const g = by.get(key) ?? { buyer: r.buyer, kind, purchases: [], total: 0, last: null };
    g.purchases.push({ title: r.title, value: r.value, date: r.date, source: r.source });
    g.total += r.value ?? 0;
    if (r.date && (!g.last || r.date > g.last)) g.last = r.date;
    by.set(key, g);
  }
  const all = [...by.values()];
  for (const g of all) g.purchases.sort((a, b) => (b.date ?? '').localeCompare(a.date ?? ''));
  const rank = (a: GovBuyer, b: GovBuyer) => (b.last ?? '').localeCompare(a.last ?? '') || b.total - a.total;
  return {
    household: all.filter((g) => g.kind === 'household').sort(rank),
    custodial: all.filter((g) => g.kind === 'custodial').sort(rank),
  };
}

// Broad on purpose; classifyPurchase does the real filtering. Both tables have a trigram index or are small enough.
const TITLE_OR = ['%mattress%', '%bed%', '%whitegood%', '%white good%', '%washing machine%', '%fridge%', '%refrigerator%', '%household%', '%appliance%', '%dryer%']
  .map((p) => `title.ilike.${p}`).join(',');

async function loadPurchases(): Promise<RawPurchase[]> {
  const db = getServiceSupabase();
  const out: RawPurchase[] = [];
  for (const [table, buyerCol, valueCol, dateCol, source] of [
    ['austender_contracts', 'buyer_name', 'contract_value', 'contract_start', 'austender'],
    ['state_tenders', 'buyer_name', 'contract_value', 'awarded_date', 'qld-tenders'],
  ] as const) {
    for (let from = 0; ; from += 1000) {
      const { data, error } = await db
        .from(table)
        .select(`${buyerCol}, title, ${valueCol}, ${dateCol}`)
        .or(TITLE_OR)
        .order('id')
        .range(from, from + 999);
      if (error) throw new Error(`demand map (${table}): ${error.message}`);
      for (const r of (data ?? []) as unknown as Record<string, unknown>[]) {
        out.push({
          buyer: String(r[buyerCol] ?? 'Unknown buyer'),
          title: String(r.title ?? ''),
          value: r[valueCol] == null ? null : Number(r[valueCol]),
          date: r[dateCol] ? String(r[dateCol]).slice(0, 10) : null,
          source,
        });
      }
      if (!data || data.length < 1000) break;
    }
  }
  return out;
}

const ROLE_NAME_REGEX = ROLES.map(([, re]) => re.source).join('|');

async function loadCommunity(): Promise<CommunityBuyer[]> {
  const db = getServiceSupabase();
  const ents: { id: string; gs_id: string | null; canonical_name: string; state: string | null; remoteness: string | null; is_community_controlled: boolean | null; postcode: string | null; lga_code: string | null }[] = [];
  for (let from = 0; ; from += 1000) {
    const { data, error } = await db
      .from('gs_entities')
      .select('id, gs_id, canonical_name, state, remoteness, is_community_controlled, postcode, lga_code')
      .in('remoteness', ['Very Remote Australia', 'Remote Australia'])
      .filter('canonical_name', 'imatch', ROLE_NAME_REGEX)
      .order('id')
      .range(from, from + 999);
    if (error) throw new Error(`demand map (community): ${error.message}`);
    ents.push(...((data ?? []) as typeof ents));
    if (!data || data.length < 1000) break;
  }
  const money = new Map<string, number>();
  const ids = ents.map((e) => e.id);
  for (let i = 0; i < ids.length; i += 300) {
    const { data, error } = await db.from('mv_gs_entity_stats').select('id, total_inbound_amount').in('id', ids.slice(i, i + 300));
    if (error) throw new Error(`demand map (money in): ${error.message}`);
    for (const r of data ?? []) if (r.total_inbound_amount != null) money.set(r.id as string, Number(r.total_inbound_amount));
  }
  return ents
    .map((e) => {
      const role = communityRole(e.canonical_name);
      return role && {
        id: e.id, gsId: e.gs_id, name: e.canonical_name, role, state: e.state, remoteness: e.remoteness,
        communityControlled: !!e.is_community_controlled, postcode: e.postcode, lgaCode: e.lga_code, moneyIn: money.get(e.id) ?? null,
      };
    })
    .filter((c): c is CommunityBuyer => !!c)
    .sort((a, b) => (b.moneyIn ?? -1) - (a.moneyIn ?? -1));
}

async function loadServedPlaces(): Promise<Omit<ServedPlaceDemand, 'nearby'>[]> {
  const ids = GOODS_SERVED_PLACES.map((p) => p.communityId).filter((id): id is string => !!id);
  const { data, error } = await getServiceSupabase().from('goods_communities').select('id, postcode, lga_code').in('id', ids);
  if (error) throw new Error(`demand map (served places): ${error.message}`);
  const byId = new Map((data ?? []).map((r) => [r.id as string, r as { postcode: string | null; lga_code: string | null }]));
  return GOODS_SERVED_PLACES.map((p) => {
    const row = p.communityId ? byId.get(p.communityId) : undefined;
    return { slug: p.slug, name: p.name, status: p.status, communityId: p.communityId, postcode: row?.postcode ?? null, lgaCode: row?.lga_code ?? null };
  });
}

/** Cached for a day: the sources change weekly at most. Bump the key when the shape changes. */
export const getGoodsDemandMap = unstable_cache(
  async (): Promise<DemandMap> => {
    const [purchases, community, places] = await Promise.all([loadPurchases(), loadCommunity(), loadServedPlaces()]);
    return {
      ...groupPurchases(purchases),
      community,
      places: places.map((p) => ({ ...p, nearby: placeNearby(p, community) })),
    };
  },
  ['goods-demand-map-v2'],
  { revalidate: 86400 },
);
