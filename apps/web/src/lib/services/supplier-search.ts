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
  /** Why this row matched the query: `capability` = won-contract titles (what govt actually bought),
   * `offering` = name + sectors, `description` = self-described. Null in browse (empty query). */
  match_source: 'capability' | 'offering' | 'description' | null;
  /** Highlighted fragment of the matched field (ts_headline, «term» delimiters). Null for offering
   * matches (name/sectors already on the card) and in browse mode. */
  match_snippet: string | null;
  /** OP7: org carries all three proof signals — justice delivery + federal contract + ACNC governance. */
  triple_proof: boolean;
  /** OP10: quad-proof — triple-proof PLUS an ALMA intervention with cited evidence AND measured outcomes. */
  proven_outcomes: boolean;
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

  // OP7/OP10: flag triple-proof suppliers (justice delivery + federal contract + ACNC governance)
  // and the quad-proof gold tier (those that ALSO carry ALMA evidence + measured outcomes).
  // Enrich the ≤30 results by ABN against mv_triple_proof_suppliers — the deepest evidence tiers.
  const base = (data ?? []) as Omit<SupplierResult, 'triple_proof' | 'proven_outcomes'>[];
  const abns = [...new Set(base.map((r) => r.abn).filter((a): a is string => Boolean(a)))];
  const proven = new Set<string>();
  const provenOutcomes = new Set<string>();
  if (abns.length > 0) {
    const { data: tp, error: tpError } = await supabase
      .from('mv_triple_proof_suppliers')
      .select('abn, has_alma_evidence_outcomes')
      .in('abn', abns);
    if (tpError) {
      console.error('[supplier-search:triple-proof]', tpError.message);
    } else {
      for (const row of (tp ?? []) as { abn: string | null; has_alma_evidence_outcomes: boolean | null }[]) {
        if (!row.abn) continue;
        proven.add(row.abn);
        if (row.has_alma_evidence_outcomes) provenOutcomes.add(row.abn);
      }
    }
  }
  return base.map((r) => ({
    ...r,
    triple_proof: Boolean(r.abn && proven.has(r.abn)),
    proven_outcomes: Boolean(r.abn && provenOutcomes.has(r.abn)),
  }));
}
