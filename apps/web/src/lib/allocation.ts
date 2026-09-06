/**
 * Allocation Intelligence: disadvantage versus dollars, per council.
 *
 * Reads mv_lga_allocation (migration 20260906120100), one row per council keyed by lga_code.
 * The numbers are attributed to the council where the RECIPIENT is placed, not where the money is
 * spent; a regional intermediary in a hub town collects for communities hours away. Every row also
 * carries how sure it is (placed_share_pct: placed entities over placed plus the entities that share
 * the council's postcodes and could not be placed), and the page prints that next to the figures.
 */
import { getDirectServiceSupabase } from '@/lib/supabase';

export interface AllocationRow {
  lga_code: string;
  lga_name: string;
  state: string;
  remoteness: string | null;
  population: number | null;
  irsd_decile: number | null;
  min_irsd_decile: number | null;
  org_count: number;
  community_controlled: number;
  charities_reporting: number;
  charity_revenue: number;
  charity_gov_revenue: number;
  charity_donations: number;
  charity_fte: number;
  cw_grant_count: number;
  cw_grant_value_24m: number;
  /** Delivery lane: GrantConnect awards spread by delivery_postcode through the postcode-to-council ratio. */
  cw_delivery_count: number;
  cw_delivery_value_24m: number;
  /** Recipient-lane 24m value on rows that also carry a mapped delivery postcode: the only fair comparison base. */
  cw_recipient_24m_with_delivery: number;
  /** That base as a share of the recipient lane. Low means the record is silent, not that money went elsewhere. */
  cw_delivery_stated_pct: number | null;
  jf_grant_count: number;
  jf_grant_value: number;
  contract_value_24m: number;
  unplaced_sharing_postcodes: number;
  /** Trajectory rollups from mv_charity_trajectory, charities placed here with at least one statement. */
  charities_tracked: number;
  charities_shrinking: number;
  charities_growing: number;
  charities_lapsed: number;
  charities_gov_dependent: number;
  charities_three_year_deficit: number;
  shrinking_revenue_lost: number;
  shrinking_share_pct: number | null;
  gov_revenue_per_head: number | null;
  donations_per_head: number | null;
  cw_grants_24m_per_head: number | null;
  cw_delivery_24m_per_head: number | null;
  orgs_per_10k: number | null;
  placed_share_pct: number | null;
}

export const ALLOCATION_SORTS = {
  need: { column: 'irsd_decile', ascending: true, label: 'most disadvantaged first' },
  gov_per_head: { column: 'gov_revenue_per_head', ascending: false, label: 'government revenue per head' },
  gov_per_head_asc: { column: 'gov_revenue_per_head', ascending: true, label: 'least government revenue per head' },
  donations_per_head: { column: 'donations_per_head', ascending: false, label: 'donations per head' },
  donations_per_head_asc: { column: 'donations_per_head', ascending: true, label: 'least donations per head' },
  grants_per_head: { column: 'cw_grants_24m_per_head', ascending: false, label: 'Commonwealth grants per head' },
  delivered_per_head: { column: 'cw_delivery_24m_per_head', ascending: false, label: 'Commonwealth grants delivered here, per head' },
  shrinking: { column: 'shrinking_share_pct', ascending: false, label: 'share of charities shrinking' },
  population: { column: 'population', ascending: false, label: 'population' },
  orgs: { column: 'org_count', ascending: false, label: 'organisations' },
  sure: { column: 'placed_share_pct', ascending: true, label: 'least sure first' },
  name: { column: 'lga_name', ascending: true, label: 'name' },
} as const;
export type AllocationSort = keyof typeof ALLOCATION_SORTS;

export const REMOTENESS_BANDS = [
  'Major Cities of Australia',
  'Inner Regional Australia',
  'Outer Regional Australia',
  'Remote Australia',
  'Very Remote Australia',
] as const;

export const STATES = ['NSW', 'VIC', 'QLD', 'SA', 'WA', 'TAS', 'NT', 'ACT'] as const;

export interface AllocationFilters {
  state: string;
  remoteness: string;
  /** '1-2', '3-5', '6-10' or '' */
  decile: string;
  sort: AllocationSort;
}

const DECILE_BANDS: Record<string, [number, number]> = { '1-2': [0, 2.5], '3-5': [2.5, 5.5], '6-10': [5.5, 11] };

/** Parse search params into a filter set; anything unrecognised falls back to the default. */
export function parseAllocationFilters(sp: Record<string, string | string[] | undefined>): AllocationFilters {
  const one = (k: string) => (typeof sp[k] === 'string' ? (sp[k] as string) : '');
  const state = (STATES as readonly string[]).includes(one('state')) ? one('state') : '';
  const remoteness = (REMOTENESS_BANDS as readonly string[]).includes(one('remoteness')) ? one('remoteness') : '';
  const decile = one('decile') in DECILE_BANDS ? one('decile') : '';
  const sort = (one('sort') in ALLOCATION_SORTS ? one('sort') : 'need') as AllocationSort;
  return { state, remoteness, decile, sort };
}

export async function listAllocation(f: AllocationFilters): Promise<AllocationRow[]> {
  const db = getDirectServiceSupabase();
  const s = ALLOCATION_SORTS[f.sort];
  let q = db.from('mv_lga_allocation').select('*');
  if (f.state) q = q.eq('state', f.state);
  if (f.remoteness) q = q.eq('remoteness', f.remoteness);
  if (f.decile) {
    const [lo, hi] = DECILE_BANDS[f.decile];
    q = q.gte('irsd_decile', lo).lt('irsd_decile', hi);
  }
  // Nulls last on every sort: a council with no SEIFA or no population must not lead the list.
  q = q.order(s.column, { ascending: s.ascending, nullsFirst: false }).order('lga_name', { ascending: true });
  const { data, error } = await q.limit(600);
  if (error) throw new Error(error.message);
  return (data ?? []) as AllocationRow[];
}

export interface AllocationSummary {
  councils: number;
  population: number;
  charity_gov_revenue: number;
  charity_donations: number;
  cw_grant_value_24m: number;
  cw_delivery_value_24m: number;
  cw_recipient_24m_with_delivery: number;
  charities_tracked: number;
  charities_shrinking: number;
  unplaced: number;
  /** Councils in decile 1-2 with fewer government dollars per head than the national median. */
  under_median_disadvantaged: number;
  median_gov_per_head: number;
}

/** Whole-of-nation figures for the header, derived from the same rows the table shows unfiltered. */
export function summariseAllocation(rows: AllocationRow[]): AllocationSummary {
  const sum = (k: keyof AllocationRow) => rows.reduce((a, r) => a + (Number(r[k]) || 0), 0);
  const perHead = rows.map((r) => r.gov_revenue_per_head).filter((v): v is number => v != null).sort((a, b) => a - b);
  const median = perHead.length ? perHead[Math.floor(perHead.length / 2)] : 0;
  return {
    councils: rows.length,
    population: sum('population'),
    charity_gov_revenue: sum('charity_gov_revenue'),
    charity_donations: sum('charity_donations'),
    cw_grant_value_24m: sum('cw_grant_value_24m'),
    cw_delivery_value_24m: sum('cw_delivery_value_24m'),
    cw_recipient_24m_with_delivery: sum('cw_recipient_24m_with_delivery'),
    charities_tracked: sum('charities_tracked'),
    charities_shrinking: sum('charities_shrinking'),
    unplaced: sum('unplaced_sharing_postcodes'),
    under_median_disadvantaged: rows.filter((r) => r.irsd_decile != null && r.irsd_decile <= 2.5 && (r.gov_revenue_per_head ?? 0) < median).length,
    median_gov_per_head: median,
  };
}

export async function allocationForCode(lgaCode: string): Promise<AllocationRow | null> {
  if (!/^\d{5}$/.test(lgaCode)) return null;
  const db = getDirectServiceSupabase();
  const { data, error } = await db.from('mv_lga_allocation').select('*').eq('lga_code', lgaCode).maybeSingle();
  if (error) throw new Error(error.message);
  return (data as AllocationRow | null) ?? null;
}

const NEIGHBOUR_COLS =
  'lga_code, lga_name, state, remoteness, population, irsd_decile, min_irsd_decile, org_count, community_controlled, charities_reporting, charity_revenue, charity_gov_revenue, charity_donations, charity_fte, cw_grant_count, cw_grant_value_24m, cw_delivery_count, cw_delivery_value_24m, cw_recipient_24m_with_delivery, cw_delivery_stated_pct, jf_grant_count, jf_grant_value, contract_value_24m, unplaced_sharing_postcodes, charities_tracked, charities_shrinking, charities_growing, charities_lapsed, charities_gov_dependent, charities_three_year_deficit, shrinking_revenue_lost, shrinking_share_pct, gov_revenue_per_head, donations_per_head, cw_grants_24m_per_head, cw_delivery_24m_per_head, orgs_per_10k, placed_share_pct';

/**
 * Councils where charities are shrinking, for /charities/trajectories. A council needs at least `minTracked`
 * charities with a statement before its share means anything: one shrinking charity out of one is 100%.
 * Sorted by share, then by revenue lost, so the list reads as places rather than as a rerun of the national list.
 */
export async function shrinkingCouncils(state: string, limit = 25, minTracked = 10): Promise<AllocationRow[]> {
  const db = getDirectServiceSupabase();
  let q = db.from('mv_lga_allocation').select(NEIGHBOUR_COLS).gte('charities_tracked', minTracked);
  if (state) q = q.eq('state', state);
  const { data, error } = await q
    .order('shrinking_share_pct', { ascending: false, nullsFirst: false })
    .order('shrinking_revenue_lost', { ascending: false, nullsFirst: false })
    .limit(limit);
  if (error) throw new Error(error.message);
  return (data ?? []) as AllocationRow[];
}

/** Councils in the same state, ordered by need, for the "read the row with its neighbours" strip. */
export async function stateNeighbours(state: string, limit = 12): Promise<AllocationRow[]> {
  const db = getDirectServiceSupabase();
  const { data, error } = await db
    .from('mv_lga_allocation')
    .select(NEIGHBOUR_COLS)
    .eq('state', state)
    .order('irsd_decile', { ascending: true, nullsFirst: false })
    .limit(limit);
  if (error) throw new Error(error.message);
  return (data ?? []) as AllocationRow[];
}
