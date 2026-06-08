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
  /** OP3: broad tier — justice/community delivery + a won federal contract (no ACNC requirement).
   * Superset of triple_proof; the strongest-badge-wins hierarchy shows the deeper badge where it applies. */
  proven_govt_delivery: boolean;
  /** OP7: org carries all three proof signals — justice delivery + federal contract + ACNC governance. */
  triple_proof: boolean;
  /** OP10: quad-proof — triple-proof PLUS an ALMA intervention with cited evidence AND measured outcomes. */
  proven_outcomes: boolean;
  /** OP1: a registered Indigenous corporation (ORIC) that has won a federal contract. Orthogonal to the
   * justice hierarchy above — an org can be both Indigenous-proven AND proven-govt-delivery at once. */
  indigenous_proven: boolean;
}

export interface RegistryStats {
  total: number;
  with_contracts: number;
  total_value: number;
  total_contracts: number;
}

export interface FeaturedSupplier {
  se_id: string;
  name: string;
  state: string | null;
  sector: string | null;
  contract_count: number;
  contract_value: number;
}

/**
 * Quad-proof exemplars for the search landing — enterprises that carry triple-proof PLUS cited
 * ALMA evidence AND measured outcomes (`has_alma_evidence_outcomes`), ranked by total evidence
 * dollars. Named, clickable proof shown pre-search. Two-query join (no migration): pull the proven
 * ABNs from the MV, then resolve them to directory profiles. Returns [] on error.
 */
export async function getProvenOutcomesSuppliers(limit = 6): Promise<FeaturedSupplier[]> {
  const supabase = getServiceSupabase();
  const { data: mv, error } = await supabase
    .from('mv_triple_proof_suppliers')
    .select('abn, sector, contract_count, contract_value, total_evidence_dollars')
    .eq('has_alma_evidence_outcomes', true)
    .not('abn', 'is', null)
    // Ordered by the figure the card actually shows (contract value) so the row reads top-down;
    // every row already clears the proven-outcomes depth bar via has_alma_evidence_outcomes.
    .order('contract_value', { ascending: false, nullsFirst: false })
    .limit(limit * 3);
  if (error || !mv?.length) {
    if (error) console.error('[supplier-search:proven-outcomes]', error.message);
    return [];
  }

  const abns = [...new Set(mv.map((r) => r.abn as string).filter(Boolean))];
  const { data: ses, error: seError } = await supabase
    .from('social_enterprises')
    .select('id, name, state, abn')
    .in('abn', abns);
  if (seError) {
    console.error('[supplier-search:proven-outcomes:se]', seError.message);
    return [];
  }

  // First directory profile per ABN (some ABNs have duplicate rows).
  const seByAbn = new Map<string, { id: string; name: string; state: string | null }>();
  for (const se of (ses ?? []) as { id: string; name: string; state: string | null; abn: string }[]) {
    if (se.abn && !seByAbn.has(se.abn)) seByAbn.set(se.abn, { id: se.id, name: se.name, state: se.state });
  }

  // Preserve the MV's evidence-desc order; keep only those resolvable to a profile.
  const out: FeaturedSupplier[] = [];
  for (const r of mv as { abn: string; sector: string | null; contract_count: number; contract_value: number }[]) {
    const se = seByAbn.get(r.abn);
    if (!se) continue;
    out.push({
      se_id: se.id,
      name: se.name,
      state: se.state,
      sector: r.sector,
      contract_count: r.contract_count,
      contract_value: r.contract_value,
    });
    if (out.length >= limit) break;
  }
  return out;
}

/** Live registry totals for the search landing (pre-search proof). Returns null on error. */
export async function getRegistryStats(): Promise<RegistryStats | null> {
  const supabase = getServiceSupabase();
  const { data, error } = await supabase.rpc('se_registry_stats').single();
  if (error) {
    console.error('[supplier-search:stats]', error.message);
    return null;
  }
  return data as RegistryStats;
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
  const base = (data ?? []) as Omit<SupplierResult, 'proven_govt_delivery' | 'triple_proof' | 'proven_outcomes' | 'indigenous_proven'>[];
  const abns = [...new Set(base.map((r) => r.abn).filter((a): a is string => Boolean(a)))];
  const proven = new Set<string>();
  const provenOutcomes = new Set<string>();
  const provenGovtDelivery = new Set<string>();
  const indigenousProven = new Set<string>();
  if (abns.length > 0) {
    const [tpRes, jpRes, ipRes] = await Promise.all([
      supabase.from('mv_triple_proof_suppliers').select('abn, has_alma_evidence_outcomes').in('abn', abns),
      // OP3: broad justice + federal-contract tier
      supabase.from('mv_justice_proven_suppliers').select('abn, has_alma_evidence_outcomes').in('abn', abns),
      // OP1: registered Indigenous corporation (ORIC) + federal contract — an orthogonal axis
      supabase.from('mv_indigenous_proven_suppliers').select('abn, has_alma_evidence_outcomes').in('abn', abns),
    ]);
    if (tpRes.error) {
      console.error('[supplier-search:triple-proof]', tpRes.error.message);
    } else {
      for (const row of (tpRes.data ?? []) as { abn: string | null; has_alma_evidence_outcomes: boolean | null }[]) {
        if (!row.abn) continue;
        proven.add(row.abn);
        if (row.has_alma_evidence_outcomes) provenOutcomes.add(row.abn);
      }
    }
    if (jpRes.error) {
      console.error('[supplier-search:justice-proven]', jpRes.error.message);
    } else {
      for (const row of (jpRes.data ?? []) as { abn: string | null; has_alma_evidence_outcomes: boolean | null }[]) {
        if (!row.abn) continue;
        provenGovtDelivery.add(row.abn);
        // The OP3 MV also carries the gold flag, so a justice-proven org with ALMA evidence
        // still lights up "Proven outcomes" even if it isn't triple-proof.
        if (row.has_alma_evidence_outcomes) provenOutcomes.add(row.abn);
      }
    }
    if (ipRes.error) {
      console.error('[supplier-search:indigenous-proven]', ipRes.error.message);
    } else {
      for (const row of (ipRes.data ?? []) as { abn: string | null; has_alma_evidence_outcomes: boolean | null }[]) {
        if (!row.abn) continue;
        indigenousProven.add(row.abn);
        // OP1 MV carries the gold flag too, so an Indigenous-proven org with ALMA evidence
        // also lights up "Proven outcomes".
        if (row.has_alma_evidence_outcomes) provenOutcomes.add(row.abn);
      }
    }
  }
  return base.map((r) => ({
    ...r,
    proven_govt_delivery: Boolean(r.abn && provenGovtDelivery.has(r.abn)),
    triple_proof: Boolean(r.abn && proven.has(r.abn)),
    proven_outcomes: Boolean(r.abn && provenOutcomes.has(r.abn)),
    indigenous_proven: Boolean(r.abn && indigenousProven.has(r.abn)),
  }));
}
