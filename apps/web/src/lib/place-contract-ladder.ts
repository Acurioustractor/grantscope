import { getDirectServiceSupabase } from '@/lib/supabase';

/**
 * Who already buys from organisations in a place, and how far up the ladder they are.
 *
 * #308 tested every candidate signal for "bankable" and concluded: do not build a score. Reserves
 * invert (they are measured against expenses, so dormant organisations rank best), board counts are
 * a nominee-block artefact, and the ACNC financial layer is a biased one-in-six subsample three
 * years stale. **The one honest, fully-covered signal is the contract ladder itself**, and the
 * product question it points at is ENTRY, not growth.
 *
 * That finding is what this module renders. Not "here is how bankable you are" — that verdict does
 * not exist — but "here is who already buys from organisations like yours, in your council".
 *
 * BUYER DIVERSITY IS THE RUNG. #308 measured it rising monotonically with contract count across
 * the bands: 1.0 → 1.6 → 3.3 → 12.8 distinct buyers. An organisation with ten contracts and one
 * buyer has not climbed; it got in one door and stayed. Measured on Ashburton 2026-08-21, EVERY
 * local contract-holder sits on that bottom rung — Karingal Neighbourhood Centre 10 contracts and
 * 1 buyer, Exmouth Civil 7 and 1. So the count and the buyer count must always render together,
 * for the same reason the dollar share never renders without the award share.
 *
 * TWO BIASES THAT MUST TRAVEL WITH IT.
 *
 * 1. Suppliers are matched on the ABN in their registered address, so this is who SUPPLIES FROM
 *    here, not what is spent here. Same bias the capture measure documents.
 * 2. `austender_contracts` records no delivery location at all — confirmed against 100 live OCDS
 *    releases, zero `deliveryAddress`. There is no version of this that says where work happened.
 */

export interface LadderBuyer {
  buyer: string;
  contracts: number;
  /** Distinct organisations in this council the buyer has contracted with. */
  localSuppliers: number;
}

export interface LadderHolder {
  name: string;
  contracts: number;
  /** The rung. One buyer and many contracts is the bottom of the ladder, not the top. */
  buyers: number;
  dollars: number;
  communityControlled: boolean;
}

export interface PlaceContractLadder {
  orgsWithContracts: number;
  totalContracts: number;
  buyers: LadderBuyer[];
  holders: LadderHolder[];
  /** True when every holder has exactly one buyer — the finding worth saying out loud. */
  allSingleBuyer: boolean;
}

/**
 * Excludes contracts whose `supplier_abn` is a government buyer's own ABN.
 *
 * That defect is real and measured: 613 notices, $870.2M, where AusTender recorded the buyer's ABN
 * in the supplier field, which made ABN-based resolution map a genuine external supplier onto the
 * buyer (#315 class B, repaired in the graph 2026-08-21). It cannot credit a council here — no
 * government department carries an `lga_name` — but the guard is cheap and the alternative is
 * trusting that to stay true.
 */
const SUPPLIER_ABN_GUARD = `
  AND NOT EXISTS (
    SELECT 1 FROM gs_entities gov
     WHERE gov.entity_type = 'government_body' AND gov.abn = c.supplier_abn
  )`;

export async function contractLadderForPlace(
  lgaName: string,
  limit = 6,
): Promise<PlaceContractLadder | null> {
  const safe = lgaName.replace(/'/g, "''");
  const cap = Math.max(1, Math.min(25, Math.floor(limit)));
  const db = getDirectServiceSupabase();

  async function run<T>(query: string): Promise<T[]> {
    const { data, error } = await db.rpc('exec_sql', { query });
    if (error) throw new Error(`contract ladder query failed: ${error.message}`);
    return (data ?? []) as T[];
  }

  const [totals, buyers, holders] = await Promise.all([
    run<{ orgs: string | number; contracts: string | number }>(`
      SELECT count(DISTINCT c.supplier_abn)::bigint AS orgs, count(*)::bigint AS contracts
        FROM austender_contracts c
        JOIN gs_entities e ON e.abn = c.supplier_abn
       WHERE e.lga_name = '${safe}' ${SUPPLIER_ABN_GUARD}`),
    run<{ buyer: string; contracts: string | number; local_suppliers: string | number }>(`
      SELECT c.buyer_name AS buyer, count(*)::bigint AS contracts,
             count(DISTINCT c.supplier_abn)::bigint AS local_suppliers
        FROM austender_contracts c
        JOIN gs_entities e ON e.abn = c.supplier_abn
       WHERE e.lga_name = '${safe}' ${SUPPLIER_ABN_GUARD}
       GROUP BY c.buyer_name ORDER BY count(*) DESC LIMIT ${cap}`),
    run<{
      name: string;
      contracts: string | number;
      buyers: string | number;
      dollars: string | number;
      cc: boolean;
    }>(`
      SELECT e.canonical_name AS name, count(*)::bigint AS contracts,
             count(DISTINCT c.buyer_name)::bigint AS buyers,
             COALESCE(sum(c.contract_value),0)::numeric AS dollars,
             bool_or(e.is_community_controlled) AS cc
        FROM austender_contracts c
        JOIN gs_entities e ON e.abn = c.supplier_abn
       WHERE e.lga_name = '${safe}' ${SUPPLIER_ABN_GUARD}
       GROUP BY e.canonical_name ORDER BY count(*) DESC LIMIT ${cap}`),
  ]);

  const n = (v: unknown) => Number(v ?? 0) || 0;
  const orgsWithContracts = n(totals[0]?.orgs);
  if (orgsWithContracts === 0) return null;

  const mappedHolders: LadderHolder[] = holders.map(h => ({
    name: h.name,
    contracts: n(h.contracts),
    buyers: n(h.buyers),
    dollars: n(h.dollars),
    communityControlled: h.cc === true,
  }));

  return {
    orgsWithContracts,
    totalContracts: n(totals[0]?.contracts),
    buyers: buyers.map(b => ({
      buyer: b.buyer,
      contracts: n(b.contracts),
      localSuppliers: n(b.local_suppliers),
    })),
    holders: mappedHolders,
    allSingleBuyer: mappedHolders.length > 0 && mappedHolders.every(h => h.buyers === 1),
  };
}
