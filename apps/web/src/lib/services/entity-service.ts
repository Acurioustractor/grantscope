import type { SupabaseClient } from '@supabase/supabase-js';

// ── Column sets ──────────────────────────────────────────────────────
const ENTITY_SUMMARY_COLS =
  'gs_id, canonical_name, abn, entity_type, sector, state, postcode, remoteness, seifa_irsd_decile, lga_name, is_community_controlled' as const;

const ENTITY_DETAIL_COLS =
  'gs_id, canonical_name, abn, entity_type, sector, state, postcode, remoteness, seifa_irsd_decile, lga_name, is_community_controlled, website, description' as const;

const ENTITY_SEARCH_COLS =
  'gs_id, canonical_name, entity_type, abn, state, source_count, latest_revenue' as const;

const ENTITY_PLACE_COLS =
  'id, gs_id, canonical_name, entity_type, is_community_controlled, latest_revenue' as const;

// ── Types ────────────────────────────────────────────────────────────
export interface EntitySummary {
  gs_id: string;
  canonical_name: string;
  abn: string | null;
  entity_type: string | null;
  sector: string | null;
  state: string | null;
  postcode: string | null;
  remoteness: string | null;
  seifa_irsd_decile: number | null;
  lga_name: string | null;
  is_community_controlled: boolean | null;
}

export interface EntityDetail extends EntitySummary {
  website: string | null;
  description: string | null;
}

export interface EntitySearchResult {
  gs_id: string;
  canonical_name: string;
  entity_type: string | null;
  abn: string | null;
  state: string | null;
  source_count: number | null;
  latest_revenue: number | null;
}

export interface EntityPlaceResult {
  id: number;
  gs_id: string;
  canonical_name: string;
  entity_type: string | null;
  is_community_controlled: boolean | null;
  latest_revenue: number | null;
}

export interface EntityListFilters {
  entity_type?: string;
  state?: string;
  postcode?: string;
  abn?: string;
  name?: string; // ilike search
  is_community_controlled?: boolean;
  remoteness?: string;
  lga_name?: string;
}

export interface PaginationOpts {
  limit?: number;
  offset?: number;
}

// ── Service functions ────────────────────────────────────────────────

/** Single entity by gs_id — full detail columns */
export async function findByGsId(db: SupabaseClient, gsId: string) {
  const { data, error } = await db
    .from('gs_entities')
    .select('*')
    .eq('gs_id', gsId)
    .single();

  return { data, error };
}

/** Single entity by ABN — detail columns */
export async function findByAbn(db: SupabaseClient, abn: string) {
  const { data, error } = await db
    .from('gs_entities')
    .select(ENTITY_DETAIL_COLS)
    .eq('abn', abn)
    .single();

  return { data: data as EntityDetail | null, error };
}

/** Batch lookup by ABN list — summary columns */
export async function findByAbns(db: SupabaseClient, abns: string[]) {
  const { data, error } = await db
    .from('gs_entities')
    .select(ENTITY_SUMMARY_COLS)
    .in('abn', abns);

  return { data: (data || []) as EntitySummary[], error };
}

/** Entities by postcode — place columns, ordered by revenue */
export async function findByPostcode(
  db: SupabaseClient,
  postcode: string,
  opts: { limit?: number } = {}
) {
  const { data, error } = await db
    .from('gs_entities')
    .select(ENTITY_PLACE_COLS)
    .eq('postcode', postcode)
    .order('latest_revenue', { ascending: false, nullsFirst: false })
    .limit(opts.limit ?? 200);

  return { data: (data || []) as EntityPlaceResult[], error };
}

/** Text search — entities matching name or ABN */
export async function search(
  db: SupabaseClient,
  query: string,
  limit: number = 10
) {
  const escaped = query.replace(/[%_]/g, '');

  const { data, error } = await db
    .from('gs_entities')
    .select(ENTITY_SEARCH_COLS)
    .or(`canonical_name.ilike.%${escaped}%,abn.eq.${escaped}`)
    .order('source_count', { ascending: false })
    .limit(Math.min(limit, 50));

  return { data: (data || []) as EntitySearchResult[], error };
}

/** Filtered + paginated entity list */
export async function list(
  db: SupabaseClient,
  filters: EntityListFilters = {},
  pagination: PaginationOpts = {}
) {
  const limit = Math.min(pagination.limit ?? 100, 1000);
  const offset = pagination.offset ?? 0;

  let query = db
    .from('gs_entities')
    .select(ENTITY_DETAIL_COLS, { count: 'exact' });

  if (filters.entity_type) query = query.eq('entity_type', filters.entity_type);
  if (filters.state) query = query.eq('state', filters.state);
  if (filters.postcode) query = query.eq('postcode', filters.postcode);
  if (filters.abn) query = query.eq('abn', filters.abn);
  if (filters.name) query = query.ilike('canonical_name', `%${filters.name}%`);
  if (filters.is_community_controlled !== undefined) {
    query = query.eq('is_community_controlled', filters.is_community_controlled);
  }
  if (filters.remoteness) query = query.eq('remoteness', filters.remoteness);
  if (filters.lga_name) query = query.ilike('lga_name', `%${filters.lga_name}%`);

  const { data, error, count } = await query
    .order('canonical_name', { ascending: true })
    .range(offset, offset + limit - 1);

  return { data: (data || []) as EntityDetail[], error, count };
}

/** Internal ID lookup — needed for relationship queries */
export async function getInternalId(db: SupabaseClient, gsId: string) {
  const { data } = await db
    .from('gs_entities')
    .select('id')
    .eq('gs_id', gsId)
    .single();

  return data?.id as number | undefined;
}

/** Find lobby entities that mention an entity name */
export async function findLobbyConnections(
  db: SupabaseClient,
  canonicalName: string,
  limit: number = 20
) {
  if (!canonicalName || canonicalName.length <= 5) return [];

  const searchTerms = canonicalName.split(' ').slice(0, 2).join(' ');
  const { data } = await db
    .from('gs_entities')
    .select('gs_id, canonical_name, sector')
    .like('gs_id', 'AU-LOBBY%')
    .ilike('canonical_name', `%${searchTerms}%`)
    .limit(limit);

  return data || [];
}

/** Entity count (head-only query) */
export async function count(db: SupabaseClient) {
  const { count: total, error } = await db
    .from('gs_entities')
    .select('*', { count: 'exact', head: true });

  return { count: total ?? 0, error };
}
