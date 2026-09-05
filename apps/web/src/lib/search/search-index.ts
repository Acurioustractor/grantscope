/**
 * The one search over the spine: charities, companies, Indigenous corporations, government bodies, social
 * enterprises, foundations, open grant rounds, people on boards, council areas, published interventions.
 * Backed by mv_search_index (nightly) and the search_index_query RPC (supabase/migrations/20260905160000).
 */
import { getServiceSupabase } from '@/lib/supabase';

export const SEARCH_KINDS = [
  'charity',
  'company',
  'indigenous_corp',
  'government_body',
  'program',
  'social_enterprise',
  'foundation',
  'grant_round',
  'person',
  'place',
  'intervention',
] as const;
export type SearchKind = (typeof SEARCH_KINDS)[number];

export const KIND_LABEL: Record<SearchKind, string> = {
  charity: 'Charity',
  company: 'Company',
  indigenous_corp: 'Indigenous corporation',
  government_body: 'Government body',
  program: 'Program',
  social_enterprise: 'Social enterprise',
  foundation: 'Foundation',
  grant_round: 'Grant round',
  person: 'Person',
  place: 'Council area',
  intervention: 'Intervention',
};

export type SearchHit = {
  kind: SearchKind;
  id: string;
  name: string;
  abn: string | null;
  state: string | null;
  place: string | null;
  sector: string | null;
  money_in: number | null;
  money_out: number | null;
  tier: string | null;
  meta: string | null;
  href: string | null;
  score: number;
};

export type SearchQuery = { q: string; kinds?: SearchKind[]; state?: string; limit?: number };

const STATES = new Set(['NSW', 'VIC', 'QLD', 'SA', 'WA', 'TAS', 'NT', 'ACT']);

/** Validate untrusted input into a query the RPC will accept. Returns null when there is nothing to search. */
export function parseSearchQuery(input: { q?: string | null; kinds?: string | null; state?: string | null; limit?: string | null }): SearchQuery | null {
  const q = (input.q ?? '').trim().slice(0, 120);
  if (q.length < 2) return null;
  const kinds = (input.kinds ?? '')
    .split(',')
    .map((k) => k.trim())
    .filter((k): k is SearchKind => (SEARCH_KINDS as readonly string[]).includes(k));
  const state = (input.state ?? '').trim().toUpperCase();
  const limit = Math.min(Math.max(parseInt(input.limit ?? '20', 10) || 20, 1), 100);
  return { q, kinds: kinds.length ? kinds : undefined, state: STATES.has(state) ? state : undefined, limit };
}

export async function searchIndex(query: SearchQuery): Promise<SearchHit[]> {
  const db = getServiceSupabase();
  const { data, error } = await db.rpc('search_index_query', {
    q: query.q,
    kinds: query.kinds ?? null,
    p_state: query.state ?? null,
    p_limit: query.limit ?? 20,
  });
  if (error) throw new Error(`search_index_query failed: ${error.message}`);
  return (data ?? []) as SearchHit[];
}
