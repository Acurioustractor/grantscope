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
  return (data ?? []) as SupplierResult[];
}
