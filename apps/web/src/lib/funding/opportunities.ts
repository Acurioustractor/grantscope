import { getServiceSupabase } from '@/lib/supabase';

/**
 * One place to read a fundable thing: `v_funding_opportunities`
 * (supabase/migrations/20260905180000, deduped in 20260905181000).
 *
 * The view unions the canonical rounds in `grant_opportunities` with foundation programs that were never promoted into
 * it, plus the handful of ALMA-native rows, and suppresses duplicates by name. It is READ ONLY on purpose: every source
 * table keeps its own writers, including the eleven that write `alma_funding_opportunities`.
 *
 * It deliberately does not rank. `relevance_score` is the column default 50 on 26,659 of 26,698 grant rows and 0 on
 * 13,100 of 13,102 ALMA rows, so ordering by it orders by a constant. Rank by closing date, amount, or the ACT
 * recommendations matview, which is the one real scorer.
 */
export type FundingOpportunity = {
  origin: 'grant_opportunities' | 'foundation_programs' | 'alma_funding_opportunities';
  origin_id: string;
  opportunity_key: string;
  name: string;
  funder: string | null;
  description: string | null;
  amount_min: number | null;
  amount_max: number | null;
  closes_at: string | null;
  is_open: boolean;
  url: string | null;
  categories: string[] | null;
  focus_areas: string[] | null;
  source: string | null;
  grant_type: string | null;
  foundation_id: string | null;
  verification_status: string | null;
  alma_opportunity_type: string | null;
  is_national: boolean | null;
  jurisdictions: string[] | null;
  eligible_org_types: string[] | null;
  requires_dgr: boolean | null;
  in_alma: boolean;
  created_at: string | null;
  updated_at: string | null;
  href: string | null;
};

export type FundingQuery = {
  /** Only rounds that have not closed. A round with no closing date counts as open. */
  openOnly?: boolean;
  /** Case-insensitive match on the round's name. */
  search?: string;
  /** Restrict to one origin, e.g. to compare the canonical rounds against the rest. */
  origin?: FundingOpportunity['origin'];
  closesBefore?: string;
  minAmount?: number;
  limit?: number;
};

const MAX_LIMIT = 200;

export async function listFundingOpportunities(query: FundingQuery = {}): Promise<FundingOpportunity[]> {
  const db = getServiceSupabase();
  let q = db.from('v_funding_opportunities').select('*');

  if (query.openOnly) q = q.eq('is_open', true);
  if (query.origin) q = q.eq('origin', query.origin);
  if (query.search) q = q.ilike('name', `%${query.search.replace(/[%_]/g, '')}%`);
  if (query.closesBefore) q = q.lte('closes_at', query.closesBefore);
  if (query.minAmount != null) q = q.gte('amount_max', query.minAmount);

  // Closing soonest first, and rounds with no closing date last: they are ongoing, not urgent.
  const { data, error } = await q
    .order('closes_at', { ascending: true, nullsFirst: false })
    .limit(Math.min(Math.max(query.limit ?? 50, 1), MAX_LIMIT));

  if (error) throw new Error(`v_funding_opportunities read failed: ${error.message}`);
  return (data ?? []) as FundingOpportunity[];
}

/** Counts by origin, for a surface that wants to say where its list came from. */
export async function fundingOpportunityCounts(): Promise<Array<{ origin: string; total: number; open: number }>> {
  const db = getServiceSupabase();
  const { data, error } = await db.rpc('exec_sql', {
    query: `SELECT origin, count(*) AS total, count(*) FILTER (WHERE is_open) AS open
            FROM v_funding_opportunities GROUP BY origin ORDER BY count(*) DESC`,
  });
  if (error) throw new Error(`v_funding_opportunities counts failed: ${error.message}`);
  return (data ?? []) as Array<{ origin: string; total: number; open: number }>;
}
