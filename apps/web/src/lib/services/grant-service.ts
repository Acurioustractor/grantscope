import type { SupabaseClient } from '@supabase/supabase-js';

// ── Column sets ──────────────────────────────────────────────────────
const GRANT_SEARCH_COLS =
  'id, name, amount_min, amount_max, closes_at, program_type, source' as const;

const GRANT_DETAIL_COLS =
  'id, name, amount_min, amount_max, closes_at, program_type, source, description' as const;

// ── Types ────────────────────────────────────────────────────────────
export interface GrantSummary {
  id: number;
  name: string;
  amount_min: number | null;
  amount_max: number | null;
  closes_at: string | null;
  program_type: string | null;
  source: string | null;
}

export interface GrantDetail extends GrantSummary {
  description: string | null;
}

// ── Service functions ────────────────────────────────────────────────

/** Grants linked to a foundation — ordered by close date */
export async function findByFoundationId(
  db: SupabaseClient,
  foundationId: number | string
) {
  const { data, error } = await db
    .from('grant_opportunities')
    .select(GRANT_DETAIL_COLS)
    .eq('foundation_id', foundationId)
    .order('closes_at', { ascending: true, nullsFirst: false });

  return { data: (data || []) as GrantDetail[], error };
}

/** Text search grants by name */
export async function search(
  db: SupabaseClient,
  query: string,
  limit: number = 5
) {
  const { data, error } = await db
    .from('grant_opportunities')
    .select(GRANT_SEARCH_COLS)
    .ilike('name', `%${query}%`)
    .limit(limit);

  return { data: (data || []) as GrantSummary[], error };
}

/** Grant count (head-only query) */
export async function count(db: SupabaseClient) {
  const { count: total, error } = await db
    .from('grant_opportunities')
    .select('*', { count: 'exact', head: true });

  return { count: total ?? 0, error };
}

/** Count open grants (closes_at in the future) */
export async function countOpen(db: SupabaseClient) {
  const { count: total, error } = await db
    .from('grant_opportunities')
    .select('*', { count: 'exact', head: true })
    .gt('closes_at', new Date().toISOString());

  return { count: total ?? 0, error };
}
