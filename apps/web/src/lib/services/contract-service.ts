import type { SupabaseClient } from '@supabase/supabase-js';

// ── Column sets ──────────────────────────────────────────────────────
const CONTRACT_SUMMARY_COLS =
  'title, contract_value, buyer_name, contract_start, contract_end, category, procurement_method' as const;

const CONTRACT_BATCH_COLS =
  'supplier_abn, title, contract_value, buyer_name, contract_start, contract_end' as const;

// ── Types ────────────────────────────────────────────────────────────
export interface ContractSummary {
  title: string | null;
  contract_value: number | null;
  buyer_name: string | null;
  contract_start: string | null;
  contract_end: string | null;
  category: string | null;
  procurement_method: string | null;
}

export interface ContractBatchResult {
  supplier_abn: string;
  title: string | null;
  contract_value: number | null;
  buyer_name: string | null;
  contract_start: string | null;
  contract_end: string | null;
}

// ── Service functions ────────────────────────────────────────────────

/** Contracts by supplier ABN — ordered by contract value desc */
export async function findBySupplierAbn(
  db: SupabaseClient,
  abn: string,
  opts: { limit?: number } = {}
) {
  const { data, error } = await db
    .from('austender_contracts')
    .select(CONTRACT_SUMMARY_COLS)
    .eq('supplier_abn', abn)
    .order('contract_value', { ascending: false })
    .limit(opts.limit ?? 100);

  return { data: (data || []) as ContractSummary[], error };
}

/** Batch contracts for multiple supplier ABNs */
export async function findBySupplierAbns(
  db: SupabaseClient,
  abns: string[],
  opts: { limit?: number } = {}
) {
  const { data, error } = await db
    .from('austender_contracts')
    .select(CONTRACT_BATCH_COLS)
    .in('supplier_abn', abns.slice(0, 200))
    .order('contract_value', { ascending: false })
    .limit(opts.limit ?? 1000);

  return { data: (data || []) as ContractBatchResult[], error };
}

/** Aggregate contract stats for a set of ABNs (values + counts per ABN) */
export async function aggregateByAbns(
  db: SupabaseClient,
  abns: string[]
) {
  const { data, error } = await db
    .from('austender_contracts')
    .select('supplier_abn, contract_value')
    .in('supplier_abn', abns);

  if (error || !data) return { data: new Map<string, { count: number; total: number }>(), error };

  const agg = new Map<string, { count: number; total: number }>();
  for (const row of data) {
    const existing = agg.get(row.supplier_abn) || { count: 0, total: 0 };
    existing.count++;
    existing.total += Number(row.contract_value) || 0;
    agg.set(row.supplier_abn, existing);
  }

  return { data: agg, error: null };
}

/** Contract count (head-only query) */
export async function count(db: SupabaseClient) {
  const { count: total, error } = await db
    .from('austender_contracts')
    .select('*', { count: 'exact', head: true });

  return { count: total ?? 0, error };
}
