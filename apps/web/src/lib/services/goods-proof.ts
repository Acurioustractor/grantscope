import { getServiceSupabase } from '@/lib/supabase';
import { getGoodsRelationshipsSafe } from './goods-engagement';
import { REL_TRACK } from './goods-engagement-shared';
import { canonical } from './goods-canonical-numbers';
import type { GoodsRelationship, GoodsRelType, GoodsStage, FundingTrack } from './goods-engagement-shared';

// Midpoint planning cost per bed (from goods-cost-evidence: $550-$650 production
// band, $600 midpoint). Used only for the funding-quantum estimate, labelled.
export const BED_COST_MID = 600;
export const BED_COST_LOW = 550;
export const BED_COST_HIGH = 650;
/** Re-sync from Goods v2 if the delivered figures are older than this. */
export const DELIVERED_STALE_DAYS = 30;

/**
 * Goods Command Center — Proof Pack (the artifacts showcase).
 * Assembles the proof we ALREADY hold into two audience-framed views:
 *  - Impact (for philanthropy): beds deployed / washers in community vs the
 *    curated demand gap (goods_communities active+lead), communities served,
 *    top demand.
 *  - Commercial scale (for loans): lifetime received (Xero-reconciled registry),
 *    buyers engaged/advancing, committed funders — the repayment-capacity story.
 * No fabricated figures; link-outs to the live Asset Register for asset truth.
 * Plan: thoughts/shared/plans/goods-command-center-2026-06-09.md
 */

// Current physical footprint from the shared Goods canon. Beds are deployed;
// washers are the manual in-community ruling, not a count of register rows.
const CANON_BEDS = canonical('deployed_bed_units');
const CANON_WASHERS = canonical('washers_in_community');
export const GOODS_DELIVERED = {
  beds: Number(CANON_BEDS.value),
  washers: Number(CANON_WASHERS.value),
  asOf: CANON_BEDS.asOf,
};

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

/** One funding track's lifetime received + committed count. */
export type TrackProof = {
  track: FundingTrack;
  lifetimeReceived: number;
  committedCount: number;
};

export type ProofCommercial = {
  lifetimeReceived: number;
  /** Funders engaged, EXCLUDING declined relationships. */
  fundersEngaged: number;
  committedFunders: number;
  buyersEngaged: number;
  buyersAdvancing: number;
  /** Lifetime + committed split by track: philanthropy / repayable / procurement. */
  philanthropy: TrackProof;
  investment: TrackProof;
  procurement: TrackProof;
};

/** Funding quantum: closing the unmet bed gap, mid + low/high band. */
export type FundingQuantum = {
  bedsGap: number;
  mid: number;
  low: number;
  high: number;
};

export type GoodsProof = {
  impact: ProofImpact;
  commercial: ProofCommercial;
  fundingQuantum: FundingQuantum;
  /** How old the delivered figures are at render, and whether that's stale. */
  deliveredAgeDays: number;
  deliveredStale: boolean;
  links: { assetRegister: string; qbeCockpit: string };
  fetchError: string | null;
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

function trackProof(track: FundingTrack, rels: GoodsRelationship[]): TrackProof {
  const inTrack = rels.filter((r) => REL_TRACK[r.relationship_type] === track);
  return {
    track,
    lifetimeReceived: inTrack.reduce((s, r) => s + (Number(r.total_received_aud) || 0), 0),
    committedCount: inTrack.filter((r) => COMMITTED_STAGES.includes(r.stage)).length,
  };
}

/** Pure: roll the registry into the commercial-scale proof. Unit-tested. */
export function rollupCommercial(rels: GoodsRelationship[], lifetimeReceived: number): ProofCommercial {
  // fundersEngaged excludes declined — a declined funder isn't "engaged".
  const funders = rels.filter(
    (r) => FUNDER_TYPES.includes(r.relationship_type) && r.stage !== 'declined',
  );
  const buyers = rels.filter((r) => r.relationship_type === 'buyer');
  return {
    lifetimeReceived,
    fundersEngaged: funders.length,
    committedFunders: funders.filter((r) => COMMITTED_STAGES.includes(r.stage)).length,
    buyersEngaged: buyers.length,
    buyersAdvancing: buyers.filter((r) => ADVANCING_STAGES.includes(r.stage) || COMMITTED_STAGES.includes(r.stage)).length,
    philanthropy: trackProof('grant', rels),
    investment: trackProof('investment', rels),
    procurement: trackProof('procurement', rels),
  };
}

/** Pure: whole-day age of an ISO/date string vs a clock. */
export function daysOld(asOf: string, now: number = Date.now()): number {
  const d = new Date(`${asOf}T00:00:00`);
  if (Number.isNaN(d.getTime())) return 0;
  return Math.max(0, Math.floor((now - d.getTime()) / 86_400_000));
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
  const [commRes, relsResult] = await Promise.all([
    supabase
      .from('goods_communities')
      .select('community_name, state, demand_beds, demand_washers')
      .in('priority', ['active', 'lead']),
    getGoodsRelationshipsSafe(),
  ]);

  const rels = relsResult.rows;
  const fetchError = relsResult.fetchError
    ?? (commRes.error ? commRes.error.message : null);
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

  const deliveredAgeDays = daysOld(GOODS_DELIVERED.asOf);
  const fundingQuantum: FundingQuantum = {
    bedsGap: gap.bedsGap,
    mid: gap.bedsGap * BED_COST_MID,
    low: gap.bedsGap * BED_COST_LOW,
    high: gap.bedsGap * BED_COST_HIGH,
  };

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
    fundingQuantum,
    deliveredAgeDays,
    deliveredStale: deliveredAgeDays > DELIVERED_STALE_DAYS,
    links: { assetRegister: ASSET_REGISTER_URL, qbeCockpit: QBE_COCKPIT_URL },
    fetchError,
  };
}
