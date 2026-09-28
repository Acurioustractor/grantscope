import { timingSafeEqual } from 'node:crypto';
import type { SupabaseClient } from '@supabase/supabase-js';

/**
 * The read feed Goods on Country calls at /api/goods-workspace/data.
 *
 * Restored 2026-09-28. The original route was deleted on 2026-03-26 (09054a32) while Goods'
 * funder pages kept calling it; its client swallows errors, so the section simply vanished.
 * The original also served a HARD-CODED community list with modelled demand ("500 mattresses")
 * and invented leverage scores. Goods withdrew modelled demand on 2026-09-15, so this version
 * sends sourced facts only: demand fields are always 0 and `demandProvided` is false.
 */

export const GOODS_FEED_SECTIONS = ['communities', 'wa-sweep', 'place'] as const;
export type GoodsFeedSection = (typeof GOODS_FEED_SECTIONS)[number];

export function goodsFeedSecret(): string {
  return (process.env.GRANTSCOPE_SYNC_SECRET || process.env.GOODS_GRANTSCOPE_SYNC_SECRET || '').trim();
}

/** Fails closed: no configured secret means nobody is authorised (the original served everyone). */
export function isGoodsFeedAuthorised(provided: string | null, secret: string): boolean {
  if (!secret || !provided) return false;
  const a = Buffer.from(provided.trim());
  const b = Buffer.from(secret);
  return a.length === b.length && timingSafeEqual(a, b);
}

/** Field names match Goods' GrantscopeCommunityProof so its client keeps working unchanged. */
export interface GoodsCommunityFact {
  id: string;
  community: string;
  state: string;
  postcode: string;
  regionLabel: string;
  totalAssets: number;
  bedsDelivered: number;
  washersDelivered: number;
  demandBeds: 0;
  demandWashers: 0;
  needLeverageScore: 0;
  needReasons: string[];
  proofLine: string;
  story: string;
  keyPartnerNames: string[];
  knownBuyer: null;
  demandProvided: false;
  evidence: {
    overcrowdedPct: number | null;
    overcrowdingSource: string | null;
    overcrowdingAsAt: string | null;
    assetsDeployedSource: 'goods_register' | null;
    partnersBasis: 'community-controlled entities registered in this postcode (inferred: registered address, not service area)';
  };
}

/** Exact UUID read for a reviewed Goods place link. An absent row stays absent. */
export async function getGoodsPlaceFact(db: SupabaseClient, id: string) {
  const { data, error } = await db
    .from('goods_communities')
    .select('id, community_name, state, postcode, region_label, overcrowded_pct, overcrowding_source, overcrowding_as_at')
    .eq('id', id)
    .maybeSingle();
  if (error) throw new Error(`goods_communities: ${error.message}`);
  return data;
}

type CommunityRow = {
  id: string;
  community_name: string;
  state: string | null;
  postcode: string | null;
  region_label: string | null;
  assets_deployed: number | null;
  overcrowded_pct: number | null;
  overcrowding_source: string | null;
  overcrowding_as_at: string | null;
};

export async function getVerifiedCommunities(
  db: SupabaseClient,
  opts: { states?: string[] | null; limit?: number } = {},
): Promise<GoodsCommunityFact[]> {
  let q = db
    .from('goods_communities')
    .select('id, community_name, state, postcode, region_label, assets_deployed, overcrowded_pct, overcrowding_source, overcrowding_as_at')
    .or('overcrowding_source.not.is.null,assets_deployed.gt.0')
    .order('community_name');
  if (opts.states?.length) q = q.in('state', opts.states);
  if (opts.limit && opts.limit > 0) q = q.limit(opts.limit);
  const { data, error } = await q;
  if (error) throw new Error(`goods_communities: ${error.message}`);
  const rows = (data ?? []) as CommunityRow[];

  const postcodes = [...new Set(rows.map((r) => r.postcode).filter((p): p is string => !!p))];
  const partners = new Map<string, string[]>();
  if (postcodes.length) {
    const { data: ents, error: entErr } = await db
      .from('gs_entities')
      .select('canonical_name, postcode')
      .eq('is_community_controlled', true)
      .in('postcode', postcodes)
      .order('canonical_name')
      .limit(5000);
    if (entErr) throw new Error(`gs_entities: ${entErr.message}`);
    for (const e of (ents ?? []) as { canonical_name: string; postcode: string }[]) {
      const list = partners.get(e.postcode) ?? [];
      if (list.length < 6) list.push(e.canonical_name);
      partners.set(e.postcode, list);
    }
  }

  return rows.map((r) => {
    const deployed = r.assets_deployed ?? 0;
    const facts: string[] = [];
    if (r.overcrowded_pct != null && r.overcrowding_source) {
      facts.push(`${r.overcrowded_pct}% of dwellings overcrowded (${r.overcrowding_source}${r.overcrowding_as_at ? `, ${r.overcrowding_as_at}` : ''})`);
    }
    if (deployed > 0) facts.push(`${deployed} Goods assets on the register`);
    return {
      id: r.id,
      community: r.community_name,
      state: r.state ?? '',
      postcode: r.postcode ?? '',
      regionLabel: r.region_label ?? '',
      totalAssets: deployed,
      bedsDelivered: 0,
      washersDelivered: 0,
      demandBeds: 0,
      demandWashers: 0,
      needLeverageScore: 0,
      needReasons: [],
      proofLine: facts.join('; '),
      story: '',
      keyPartnerNames: r.postcode ? partners.get(r.postcode) ?? [] : [],
      knownBuyer: null,
      demandProvided: false,
      evidence: {
        overcrowdedPct: r.overcrowded_pct,
        overcrowdingSource: r.overcrowding_source,
        overcrowdingAsAt: r.overcrowding_as_at,
        assetsDeployedSource: deployed > 0 ? 'goods_register' : null,
        partnersBasis: 'community-controlled entities registered in this postcode (inferred: registered address, not service area)',
      },
    };
  });
}

export interface WaSeller {
  entityId: string;
  name: string;
  abn: string | null;
  contracts: number;
  kimberleyContracts: number;
  buyers: string[];
  serviceFamilies: string[];
  regions: string[];
  latestExpiry: string | null;
  sampleContracts: { reference: string | null; title: string; buyer: string | null; expiry: string | null }[];
}

type SweepRow = {
  matched_entity_id: string;
  service_family: string;
  is_kimberley: boolean;
  state_tenders: { source_reference: string | null; title: string; buyer_name: string | null; regions: string[] | null; expiry_date: string | null } | null;
  gs_entities: { canonical_name: string; abn: string | null } | null;
};

/**
 * Community-controlled organisations that already hold WA Government contracts: the sellers
 * Goods can work through, since its own company fails the 51% First Nations ownership test.
 * Identity is exact-match (resolver v2); community-controlled status comes from ORIC/ACNC flags.
 * Contract counts and expiry only: no dollar totals, which would need a money audit first.
 */
export async function getWaSellerSweep(db: SupabaseClient, opts: { limit?: number } = {}): Promise<WaSeller[]> {
  const { data, error } = await db
    .from('wa_transition_candidates')
    .select('matched_entity_id, service_family, is_kimberley, state_tenders(source_reference, title, buyer_name, regions, expiry_date), gs_entities(canonical_name, abn)')
    .eq('supplier_is_community_controlled', true)
    .not('matched_entity_id', 'is', null)
    .limit(5000);
  if (error) throw new Error(`wa_transition_candidates: ${error.message}`);

  const byEntity = new Map<string, WaSeller>();
  for (const row of (data ?? []) as unknown as SweepRow[]) {
    const t = row.state_tenders;
    if (!t || !row.gs_entities) continue;
    const s = byEntity.get(row.matched_entity_id) ?? {
      entityId: row.matched_entity_id,
      name: row.gs_entities.canonical_name,
      abn: row.gs_entities.abn,
      contracts: 0,
      kimberleyContracts: 0,
      buyers: [],
      serviceFamilies: [],
      regions: [],
      latestExpiry: null,
      sampleContracts: [],
    };
    s.contracts += 1;
    if (row.is_kimberley) s.kimberleyContracts += 1;
    if (t.buyer_name && !s.buyers.includes(t.buyer_name)) s.buyers.push(t.buyer_name);
    if (!s.serviceFamilies.includes(row.service_family)) s.serviceFamilies.push(row.service_family);
    for (const r of t.regions ?? []) if (!s.regions.includes(r)) s.regions.push(r);
    if (t.expiry_date && (!s.latestExpiry || t.expiry_date > s.latestExpiry)) s.latestExpiry = t.expiry_date;
    if (s.sampleContracts.length < 3) s.sampleContracts.push({ reference: t.source_reference, title: t.title, buyer: t.buyer_name, expiry: t.expiry_date });
    byEntity.set(row.matched_entity_id, s);
  }

  const sellers = [...byEntity.values()].sort((a, b) => b.kimberleyContracts - a.kimberleyContracts || b.contracts - a.contracts);
  return opts.limit && opts.limit > 0 ? sellers.slice(0, opts.limit) : sellers;
}
