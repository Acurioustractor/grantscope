import { getServiceSupabase } from '@/lib/supabase';

/**
 * Goods Command Center — Cross-System Power overlay.
 * Reads v_goods_relationship_power (mv_entity_power_index + mv_revolving_door
 * joined onto entity-linked Goods relationships) and returns a map keyed by
 * goods_relationships.id, so any Goods surface can show how cross-system
 * embedded a counterpart is without touching its own loader.
 * View: supabase/migrations/20260620120000_goods_relationship_power.sql
 */

export type RelationshipPower = {
  relId: string;
  powerScore: number;
  systemCount: number;
  systems: string[];          // human labels of the power systems present
  totalDollarFlow: number;    // procurement + justice + donations $
  influenceVectors: number;   // 0 if not in revolving-door set
  revolvingDoorScore: number;
  revolvingDoor: boolean;     // in mv_revolving_door (>=2 influence vectors)
  vectors: string[];          // lobbying / donations / contracts / funding
};

type ViewRow = {
  rel_id: string;
  power_score: number | string | null;
  system_count: number | string | null;
  in_procurement: number | null;
  in_recorded_grants: number | null;
  in_political_donations: number | null;
  in_charity_registry: number | null;
  in_foundation: number | null;
  in_alma_evidence: number | null;
  in_ato_transparency: number | null;
  total_dollar_flow: number | string | null;
  influence_vectors: number | string | null;
  revolving_door_score: number | string | null;
  lobbies: boolean | null;
  donates: boolean | null;
  contracts: boolean | null;
  receives_funding: boolean | null;
};

const num = (v: number | string | null | undefined): number => {
  const n = Number(v);
  return Number.isFinite(n) ? n : 0;
};

function systemsOf(r: ViewRow): string[] {
  const out: string[] = [];
  if (r.in_procurement) out.push('procurement');
  if (r.in_recorded_grants) out.push('justice funding');
  if (r.in_political_donations) out.push('donations');
  if (r.in_charity_registry) out.push('charity');
  if (r.in_foundation) out.push('foundation');
  if (r.in_alma_evidence) out.push('evidence');
  if (r.in_ato_transparency) out.push('ATO');
  return out;
}

function vectorsOf(r: ViewRow): string[] {
  const out: string[] = [];
  if (r.lobbies) out.push('lobbying');
  if (r.donates) out.push('donations');
  if (r.contracts) out.push('contracts');
  if (r.receives_funding) out.push('funding');
  return out;
}

/** Returns a map of goods_relationships.id -> cross-system power signal. */
export async function getGoodsRelationshipPower(): Promise<Map<string, RelationshipPower>> {
  const map = new Map<string, RelationshipPower>();
  try {
    const supabase = getServiceSupabase();
    const { data, error } = await supabase
      .from('v_goods_relationship_power')
      .select('*');
    if (error) {
      console.error('[goods-relationship-power] query failed:', error.message);
      return map;
    }
    for (const r of (data as ViewRow[] | null) ?? []) {
      const influenceVectors = num(r.influence_vectors);
      map.set(r.rel_id, {
        relId: r.rel_id,
        powerScore: num(r.power_score),
        systemCount: num(r.system_count),
        systems: systemsOf(r),
        totalDollarFlow: num(r.total_dollar_flow),
        influenceVectors,
        revolvingDoorScore: num(r.revolving_door_score),
        revolvingDoor: influenceVectors >= 2,
        vectors: vectorsOf(r),
      });
    }
    return map;
  } catch (e) {
    console.error('[goods-relationship-power] unexpected:', e);
    return map;
  }
}

/**
 * Compact band for the UI chip. "High" reach = embedded across many systems or
 * a strong revolving-door footprint; these are the counterparts whose yes (and
 * whose public profile) carry the most weight.
 */
export function powerBand(p: RelationshipPower): 'high' | 'notable' | 'low' {
  if (p.systemCount >= 4 || p.revolvingDoorScore >= 8) return 'high';
  if (p.systemCount >= 2 || p.revolvingDoor) return 'notable';
  return 'low';
}
