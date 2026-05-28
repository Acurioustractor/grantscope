/**
 * Revolving Door Atlas — data access.
 *
 * Reads `mv_revolving_door` (entities active across 2+ influence vectors:
 * lobbying, donations, contracts, funding). `revolving_door_score` is a
 * composite that scales with the number of vectors and the dollar magnitude.
 */

import { getDirectServiceSupabase } from '@/lib/supabase';

export type RevolvingDoorRow = {
  id: string;
  gs_id: string;
  canonical_name: string;
  entity_type: string | null;
  abn: string | null;
  state: string | null;
  lga_name: string | null;
  is_community_controlled: boolean;
  lobbies: boolean;
  donates: boolean;
  contracts: boolean;
  receives_funding: boolean;
  influence_vectors: number;
  total_donated: number;
  donation_count: number;
  parties_funded: string[];
  total_contracts: number;
  contract_count: number;
  distinct_buyers: number;
  total_funded: number;
  funding_count: number;
  revolving_door_score: number;
};

function toNum(v: unknown): number {
  if (v === null || v === undefined) return 0;
  const n = typeof v === 'number' ? v : Number(v);
  return Number.isFinite(n) ? n : 0;
}

function toBool(v: unknown): boolean {
  return v === true || v === 'true' || v === 't' || v === 1;
}

function mapRow(r: Record<string, unknown>): RevolvingDoorRow {
  return {
    id: String(r.id ?? ''),
    gs_id: String(r.gs_id ?? ''),
    canonical_name: String(r.canonical_name ?? ''),
    entity_type: (r.entity_type as string | null) ?? null,
    abn: (r.abn as string | null) ?? null,
    state: (r.state as string | null) ?? null,
    lga_name: (r.lga_name as string | null) ?? null,
    is_community_controlled: toBool(r.is_community_controlled),
    lobbies: toBool(r.lobbies),
    donates: toBool(r.donates),
    contracts: toBool(r.contracts),
    receives_funding: toBool(r.receives_funding),
    influence_vectors: Math.trunc(toNum(r.influence_vectors)),
    total_donated: toNum(r.total_donated),
    donation_count: Math.trunc(toNum(r.donation_count)),
    parties_funded: Array.isArray(r.parties_funded) ? (r.parties_funded as string[]) : [],
    total_contracts: toNum(r.total_contracts),
    contract_count: Math.trunc(toNum(r.contract_count)),
    distinct_buyers: Math.trunc(toNum(r.distinct_buyers)),
    total_funded: toNum(r.total_funded),
    funding_count: Math.trunc(toNum(r.funding_count)),
    revolving_door_score: Math.trunc(toNum(r.revolving_door_score)),
  };
}

const SELECT = 'id,gs_id,canonical_name,entity_type,abn,state,lga_name,is_community_controlled,lobbies,donates,contracts,receives_funding,influence_vectors,total_donated,donation_count,parties_funded,total_contracts,contract_count,distinct_buyers,total_funded,funding_count,revolving_door_score';

export type RevolvingListOptions = {
  limit?: number;
  offset?: number;
  state?: string | null;
  minVectors?: number | null;
  vector?: 'lobbies' | 'donates' | 'contracts' | 'receives_funding' | null;
};

export async function listRevolvingDoor(opts: RevolvingListOptions = {}): Promise<RevolvingDoorRow[]> {
  const supabase = getDirectServiceSupabase();
  let q = supabase.from('mv_revolving_door').select(SELECT);
  if (opts.state) q = q.eq('state', opts.state);
  if (opts.minVectors) q = q.gte('influence_vectors', opts.minVectors);
  if (opts.vector) q = q.eq(opts.vector, true);
  q = q.order('revolving_door_score', { ascending: false }).limit(opts.limit ?? 100);
  if (opts.offset) q = q.range(opts.offset, opts.offset + (opts.limit ?? 100) - 1);
  const { data, error } = await q;
  if (error) {
    console.error('[atlas/revolving-door] list error', error);
    return [];
  }
  return (data ?? []).map((r) => mapRow(r as Record<string, unknown>));
}

export async function getRevolvingDoorByGsId(gsId: string): Promise<RevolvingDoorRow | null> {
  const supabase = getDirectServiceSupabase();
  const { data, error } = await supabase.from('mv_revolving_door').select(SELECT).eq('gs_id', gsId).maybeSingle();
  if (error) {
    console.error('[atlas/revolving-door] get error', error);
    return null;
  }
  if (!data) return null;
  return mapRow(data as Record<string, unknown>);
}
