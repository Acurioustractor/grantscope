import type { SupabaseClient } from '@supabase/supabase-js';

// ── Column sets ──────────────────────────────────────────────────────
const FOUNDATION_LIST_COLS =
  'id, name, acnc_abn, type, total_giving_annual, thematic_focus, geographic_focus' as const;

const FOUNDATION_SEARCH_COLS = FOUNDATION_LIST_COLS;

// ── Types ────────────────────────────────────────────────────────────
export interface FoundationSummary {
  id: number;
  name: string;
  acnc_abn: string | null;
  type: string | null;
  total_giving_annual: number | null;
  thematic_focus: string | null;
  geographic_focus: string | null;
}

// ── Service functions ────────────────────────────────────────────────

/** Single foundation by ID — all columns */
export async function findById(db: SupabaseClient, id: number | string) {
  const { data, error } = await db
    .from('foundations')
    .select('*')
    .eq('id', id)
    .single();

  return { data, error };
}

/** Text search foundations by name */
export async function search(
  db: SupabaseClient,
  query: string,
  limit: number = 5
) {
  const { data, error } = await db
    .from('foundations')
    .select(FOUNDATION_SEARCH_COLS)
    .ilike('name', `%${query}%`)
    .limit(limit);

  return { data: (data || []) as FoundationSummary[], error };
}

/** Corporate foundations list — ordered by annual giving */
export async function listCorporate(
  db: SupabaseClient,
  opts: { limit?: number } = {}
) {
  const { data, count, error } = await db
    .from('foundations')
    .select('id, name, parent_company, asx_code, total_giving_annual, giving_ratio, revenue_sources, thematic_focus', { count: 'exact' })
    .eq('type', 'corporate_foundation')
    .order('total_giving_annual', { ascending: false, nullsFirst: false })
    .limit(opts.limit ?? 100);

  return { data: data || [], count, error };
}

/** Foundation count (head-only query) */
export async function count(db: SupabaseClient) {
  const { count: total, error } = await db
    .from('foundations')
    .select('*', { count: 'exact', head: true });

  return { count: total ?? 0, error };
}

/** Count enriched foundations */
export async function countEnriched(db: SupabaseClient) {
  const { count: total, error } = await db
    .from('foundations')
    .select('*', { count: 'exact', head: true })
    .not('enriched_at', 'is', null);

  return { count: total ?? 0, error };
}
