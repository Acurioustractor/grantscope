import { unstable_cache } from 'next/cache';
import { getServiceSupabase } from '@/lib/supabase';

// Who buys beds, mattresses and whitegoods for people in communities. Two halves:
//  1. Government purchases on record (austender_contracts, state_tenders), classified by title.
//  2. Community organisations shaped like the ones already buying from Goods (health services,
//     hostels, homeland schools, councils, stores, housing), found by role in remote Australia.
// Vetted by hand on 2026-09-24: title keywords alone are mostly noise (roadside "furniture",
// "4 x 2 bed dwellings", hospital beds, garden beds, reno mattresses), so every rule below exists
// because a false match was seen. Custodial buyers are kept apart: whether Goods sells into prisons
// and youth detention is Ben's call, and the page never mixes them into the main list.

export type PurchaseKind = 'household' | 'custodial';

const WANTED = /mattress|\bbeds?\b|bedding|bunk ?beds?|whitegoods?|white goods|washing machines?|dryers?|fridges?|refrigerators?|household (furniture|goods|items)|appliances/i;

const NOT_A_BED = new RegExp(
  [
    'hospital', 'patient', '\\bicu\\b', 'birthing', 'bariatric', 'medical', 'clinical', 'examination', 'ward',
    'palliative', 'aged care', 'mental health beds', 'bed mover', 'bed bay', 'overbed',
    'road', 'aerodrome', 'airfield', 'guardrail', 'garden', 'sludge', 'digester', 'reno ?mattress', 'fossil',
    'lake bed', 'stable bedding', 'embedding',
    'dwelling', 'bedroom', 'bedsit', '\\d+ ?x ?\\d+ ?bed', '\\d+ bed (quick|modular|unit|facility)',
    'office', 'workstation', 'laboratory', 'vaccine', 'freezers? and', 'fridge filling', 'recycling',
  ].join('|'),
  'i',
);

const CUSTODIAL = /correct|prison|custod|detention|youth justice|secure care|cell mattress|watch ?house|police/i;

/** household = beds and whitegoods for people to live with; custodial = prisons, detention, watch houses. */
export function classifyPurchase(title: string, buyer: string): PurchaseKind | null {
  if (!WANTED.test(title) || NOT_A_BED.test(title)) return null;
  return CUSTODIAL.test(`${title} ${buyer}`) ? 'custodial' : 'household';
}

export type CommunityRole =
  | 'health service' | 'hostel / accommodation' | 'housing' | 'council' | 'homelands / resource centre'
  | 'aged, women and youth' | 'community store' | 'school';

// Order matters: first match wins. Built from the buyers Goods already has (Anyinginyi and Miwatj
// health, Aboriginal Hostels, Homeland School Company, Centrecorp).
const ROLES: [CommunityRole, RegExp][] = [
  ['health service', /health|medical|clinic|nganampa|miwatj|anyinginyi|sunrise|wurli|katherine west/i],
  ['hostel / accommodation', /hostel|accommodation|lodge/i],
  ['housing', /housing|\bhomes\b/i],
  ['council', /regional council|shire|aboriginal council|community council/i],
  ['homelands / resource centre', /resource cent|homeland|outstation/i],
  ['aged, women and youth', /\baged\b|elder|women.?s cent|safe house|night patrol|youth/i],
  ['community store', /\bstores?\b|\bALPA\b|arnhem land progress/i],
  ['school', /school|college|education/i],
];

export function communityRole(name: string): CommunityRole | null {
  for (const [role, re] of ROLES) if (re.test(name)) return role;
  return null;
}

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
  /** Recorded money in across every dataset (mv_gs_entity_stats), a sign of budget, not of bed spend. */
  moneyIn: number | null;
};
export type DemandMap = { household: GovBuyer[]; custodial: GovBuyer[]; community: CommunityBuyer[] };

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
  const ents: { id: string; gs_id: string | null; canonical_name: string; state: string | null; remoteness: string | null; is_community_controlled: boolean | null }[] = [];
  for (let from = 0; ; from += 1000) {
    const { data, error } = await db
      .from('gs_entities')
      .select('id, gs_id, canonical_name, state, remoteness, is_community_controlled')
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
        communityControlled: !!e.is_community_controlled, moneyIn: money.get(e.id) ?? null,
      };
    })
    .filter((c): c is CommunityBuyer => !!c)
    .sort((a, b) => (b.moneyIn ?? -1) - (a.moneyIn ?? -1));
}

/** Cached for a day: the sources change weekly at most. Bump the key when the shape changes. */
export const getGoodsDemandMap = unstable_cache(
  async (): Promise<DemandMap> => {
    const [purchases, community] = await Promise.all([loadPurchases(), loadCommunity()]);
    return { ...groupPurchases(purchases), community };
  },
  ['goods-demand-map-v1'],
  { revalidate: 86400 },
);
