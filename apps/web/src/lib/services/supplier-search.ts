import { getServiceSupabase } from '@/lib/supabase';

/**
 * Need-first supplier search (buyer-wedge move 2).
 *
 * Wraps the search_suppliers RPC over se_search_index — ranked by revealed
 * capability (AusTender contract titles, weight A), then name/sectors (B),
 * description (C), with verification-tier and delivery-evidence boosts.
 * Index rebuilt by scripts/build-se-search-index.mjs.
 */

export interface SupplierResult {
  se_id: string;
  name: string;
  abn: string | null;
  state: string | null;
  city: string | null;
  sectors: string[] | null;
  description: string | null;
  source_primary: string | null;
  verification_tier: 'certified' | 'verified' | 'identified' | null;
  contract_count: number;
  contract_value: number;
  last_contract_end: string | null;
  buyer_count: number;
  rank: number;
  /** OP7: org carries all three proof signals — justice delivery + federal contract + ACNC governance. */
  triple_proof: boolean;
}

export async function searchSuppliers(
  q: string,
  state: string,
  limit = 30
): Promise<SupplierResult[]> {
  const supabase = getServiceSupabase();
  const { data, error } = await supabase.rpc('search_suppliers', {
    p_q: q,
    p_state: state,
    p_limit: limit,
  });
  if (error) {
    console.error('[supplier-search]', error.message);
    return [];
  }

  // OP7: flag triple-proof suppliers (justice delivery + federal contract + ACNC governance).
  // Enrich the ≤30 results by ABN against mv_triple_proof_suppliers — the deepest evidence tier.
  const base = (data ?? []) as Omit<SupplierResult, 'triple_proof'>[];
  const abns = [...new Set(base.map((r) => r.abn).filter((a): a is string => Boolean(a)))];
  let proven = new Set<string>();
  if (abns.length > 0) {
    const { data: tp, error: tpError } = await supabase
      .from('mv_triple_proof_suppliers')
      .select('abn')
      .in('abn', abns);
    if (tpError) {
      console.error('[supplier-search:triple-proof]', tpError.message);
    } else {
      proven = new Set((tp ?? []).map((r: { abn: string | null }) => r.abn).filter((a): a is string => Boolean(a)));
    }
  }
  return base.map((r) => ({ ...r, triple_proof: Boolean(r.abn && proven.has(r.abn)) }));
}
