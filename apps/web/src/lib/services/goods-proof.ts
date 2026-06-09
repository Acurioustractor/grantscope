import { getServiceSupabase } from '@/lib/supabase';
import { getGoodsRelationships } from './goods-engagement';
import type { GoodsRelationship, GoodsRelType, GoodsStage } from './goods-engagement-shared';

/**
 * Goods Command Center — Proof Pack (the artifacts showcase).
 * Assembles the proof we ALREADY hold into two audience-framed views:
 *  - Impact (for philanthropy): beds/washers delivered vs the curated demand
 *    gap (goods_communities active+lead), communities served, top demand.
 *  - Commercial scale (for loans): lifetime received (Xero-reconciled registry),
 *    buyers engaged/advancing, committed funders — the repayment-capacity story.
 * No fabricated figures; link-outs to the live Asset Register for asset truth.
 * Plan: thoughts/shared/plans/goods-command-center-2026-06-09.md
 */

// DELIVERED — sourced from the Goods v2 assets sync (project cwsyhpiuepvdjtxaozwf),
// a DIFFERENT database than CivicGraph's, so it can't be queried here. Keep in
// lockstep with scripts/build-goods-impact-data.mjs (DELIVERED const) +
// apps/video/src/goodsImpactData.ts. As of 2026-05-28.
export const GOODS_DELIVERED = { beds: 520, washers: 41, asOf: '2026-05-28' };

export const ASSET_REGISTER_URL = 'https://www.goodsoncountry.com';
export const QBE_COCKPIT_URL = 'https://www.goodsoncountry.com/admin/qbe-program';

export type ProofImpact = {
  bedsDelivered: number;
  washersDelivered: number;
  deliveredAsOf: string;
  communitiesActive: number;
  bedsDemand: number;
  washersDemand: number;
  bedsGap: number;
  washersGap: number;
  pctBedsMet: number; // 0..100, delivered / demand
  topCommunities: { name: string; state: string; beds: number }[];
};

export type ProofCommercial = {
  lifetimeReceived: number;
  fundersEngaged: number;
  committedFunders: number;
  buyersEngaged: number;
  buyersAdvancing: number;
};

export type GoodsProof = {
  impact: ProofImpact;
  commercial: ProofCommercial;
  links: { assetRegister: string; qbeCockpit: string };
};

const FUNDER_TYPES: GoodsRelType[] = ['funder', 'impact_investor', 'repayable_finance'];
const COMMITTED_STAGES: GoodsStage[] = ['committed', 'repeat'];
const ADVANCING_STAGES: GoodsStage[] = ['contacted', 'in_conversation', 'proposal'];

/** Pure: delivered vs demand → gap + % met. Unit-tested. */
export function computeImpactGap(
  delivered: { beds: number; washers: number },
  demand: { beds: number; washers: number },
): { bedsGap: number; washersGap: number; pctBedsMet: number } {
  return {
    bedsGap: Math.max(0, demand.beds - delivered.beds),
    washersGap: Math.max(0, demand.washers - delivered.washers),
    pctBedsMet: demand.beds > 0 ? Math.round((delivered.beds / demand.beds) * 100) : 0,
  };
}

/** Pure: roll the registry into the commercial-scale proof. Unit-tested. */
export function rollupCommercial(rels: GoodsRelationship[], lifetimeReceived: number): ProofCommercial {
  const funders = rels.filter((r) => FUNDER_TYPES.includes(r.relationship_type));
  const buyers = rels.filter((r) => r.relationship_type === 'buyer');
  return {
    lifetimeReceived,
    fundersEngaged: funders.length,
    committedFunders: funders.filter((r) => COMMITTED_STAGES.includes(r.stage)).length,
    buyersEngaged: buyers.length,
    buyersAdvancing: buyers.filter((r) => ADVANCING_STAGES.includes(r.stage) || COMMITTED_STAGES.includes(r.stage)).length,
  };
}

// DB stores community names uppercase; title-case for display (place names, not shouting).
function titleCase(s: string): string {
  return s.toLowerCase().replace(/\b\w/g, (c) => c.toUpperCase());
}

type CommunityRow = {
  community_name: string | null;
  state: string | null;
  demand_beds: number | string | null;
  demand_washers: number | string | null;
};

export async function getGoodsProof(): Promise<GoodsProof> {
  const supabase = getServiceSupabase();

  // Demand = the curated active+lead slice (reproduces the impact film's `need`).
  // Only ~64 rows, so one query yields both the aggregate and the top list.
  const [commRes, rels] = await Promise.all([
    supabase
      .from('goods_communities')
      .select('community_name, state, demand_beds, demand_washers')
      .in('priority', ['active', 'lead']),
    getGoodsRelationships(),
  ]);

  const communities = (commRes.data as CommunityRow[] | null) ?? [];
  let bedsDemand = 0;
  let washersDemand = 0;
  for (const c of communities) {
    bedsDemand += Number(c.demand_beds) || 0;
    washersDemand += Number(c.demand_washers) || 0;
  }
  const communitiesActive = communities.length;

  const topCommunities = communities
    .filter((c) => (Number(c.demand_beds) || 0) > 0)
    .sort((a, b) => (Number(b.demand_beds) || 0) - (Number(a.demand_beds) || 0))
    .slice(0, 8)
    .map((c) => ({
      name: titleCase(c.community_name ?? ''),
      state: (c.state ?? '').toUpperCase(),
      beds: Number(c.demand_beds) || 0,
    }));

  const lifetimeReceived = rels.reduce((sum, r) => sum + (Number(r.total_received_aud) || 0), 0);
  const gap = computeImpactGap(GOODS_DELIVERED, { beds: bedsDemand, washers: washersDemand });

  return {
    impact: {
      bedsDelivered: GOODS_DELIVERED.beds,
      washersDelivered: GOODS_DELIVERED.washers,
      deliveredAsOf: GOODS_DELIVERED.asOf,
      communitiesActive,
      bedsDemand,
      washersDemand,
      ...gap,
      topCommunities,
    },
    commercial: rollupCommercial(rels, lifetimeReceived),
    links: { assetRegister: ASSET_REGISTER_URL, qbeCockpit: QBE_COCKPIT_URL },
  };
}
