import { getServiceSupabase } from '@/lib/supabase';

/**
 * Goods Command Center — Funder Funding-History overlay.
 * Reads v_goods_relationship_funding (foundation grantmaking + political giving
 * = MONEY OUT; justice + procurement received = MONEY IN, joined onto
 * entity-linked Goods relationships) and returns a map keyed by
 * goods_relationships.id — what a counterpart actually funds vs what they have
 * received — so any Goods surface can show it without touching its own loader.
 * View: supabase/migrations/20260620120200_goods_relationship_funding.sql
 *
 * Coverage caveat: only ~⅓ of registry rows are entity-linked with an ABN, and
 * several top-dollar funders (e.g. Snow, FRRR) are name-only rows. Unmatched
 * relationships simply carry no funding signal — the chip degrades to nothing.
 */

export type RelationshipFunding = {
  relId: string;

  // MONEY OUT — what they give / fund
  foundationGivingAnnual: number; // 0 if not a registered grantmaker
  foundationAvgGrant: number;
  foundationThemes: string[];
  foundationGeo: string[];
  politicalTotal: number; // political donations made (donor side)
  politicalCount: number;
  politicalLatestFy: string | null;
  givesTotal: number; // foundation giving + political

  // MONEY IN — what they have received
  justiceTotal: number;
  justiceProgramCount: number;
  justiceLatestFy: string | null;
  austenderTotal: number;
  austenderContractCount: number;
  austenderLatest: string | null;
  receivesTotal: number; // justice + procurement
};

type ViewRow = {
  rel_id: string;
  foundation_giving_annual: number | string | null;
  foundation_avg_grant: number | string | null;
  foundation_themes: string[] | null;
  foundation_geo: string[] | null;
  political_total: number | string | null;
  political_count: number | string | null;
  political_latest_fy: string | null;
  justice_total: number | string | null;
  justice_program_count: number | string | null;
  justice_latest_fy: string | null;
  austender_total: number | string | null;
  austender_contract_count: number | string | null;
  austender_latest: string | null;
  gives_total: number | string | null;
  receives_total: number | string | null;
};

const num = (v: number | string | null | undefined): number => {
  const n = Number(v);
  return Number.isFinite(n) ? n : 0;
};

const arr = (v: string[] | null | undefined): string[] =>
  Array.isArray(v) ? v.filter((s): s is string => Boolean(s)) : [];

/** Returns a map of goods_relationships.id -> funding-history signal. */
export async function getGoodsRelationshipFunding(): Promise<Map<string, RelationshipFunding>> {
  const map = new Map<string, RelationshipFunding>();
  try {
    const supabase = getServiceSupabase();
    const { data, error } = await supabase
      .from('v_goods_relationship_funding')
      .select('*');
    if (error) {
      console.error('[goods-relationship-funding] query failed:', error.message);
      return map;
    }
    for (const r of (data as ViewRow[] | null) ?? []) {
      map.set(r.rel_id, {
        relId: r.rel_id,
        foundationGivingAnnual: num(r.foundation_giving_annual),
        foundationAvgGrant: num(r.foundation_avg_grant),
        foundationThemes: arr(r.foundation_themes),
        foundationGeo: arr(r.foundation_geo),
        politicalTotal: num(r.political_total),
        politicalCount: num(r.political_count),
        politicalLatestFy: r.political_latest_fy,
        givesTotal: num(r.gives_total),
        justiceTotal: num(r.justice_total),
        justiceProgramCount: num(r.justice_program_count),
        justiceLatestFy: r.justice_latest_fy,
        austenderTotal: num(r.austender_total),
        austenderContractCount: num(r.austender_contract_count),
        austenderLatest: r.austender_latest,
        receivesTotal: num(r.receives_total),
      });
    }
    return map;
  } catch (e) {
    console.error('[goods-relationship-funding] unexpected:', e);
    return map;
  }
}

export type FundingDirection = 'grantmaker' | 'recipient' | 'both' | 'none';

/**
 * Which way the money flows for this counterpart. A registered grantmaker (or a
 * pure political giver) is someone we'd *ask*; a recipient is a peer we might
 * *co-apply* with; both = a funder that also wins contracts/grants itself.
 */
export function fundingDirection(f: RelationshipFunding): FundingDirection {
  const gives = f.givesTotal > 0;
  const receives = f.receivesTotal > 0;
  if (gives && receives) return 'both';
  if (gives) return 'grantmaker';
  if (receives) return 'recipient';
  return 'none';
}

/** Headline for the UI chip — the most decision-relevant figure, foundation-first. */
export function fundingHeadline(f: RelationshipFunding): { label: string; amount: number } | null {
  if (f.foundationGivingAnnual > 0) return { label: 'funds', amount: f.foundationGivingAnnual };
  if (f.givesTotal > 0) return { label: 'gives', amount: f.givesTotal };
  if (f.receivesTotal > 0) return { label: 'receives', amount: f.receivesTotal };
  return null;
}
