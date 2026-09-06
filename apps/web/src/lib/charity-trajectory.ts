/**
 * Charity trajectories: direction, not a snapshot.
 *
 * Reads mv_charity_trajectory (migration 20260906120200), one row per ABN across the ACNC Annual
 * Information Statements 2017-2023. The figures are each charity's own statement, unfiltered; the
 * view adds first/last/peak revenue, growth, government share, donation share, margin, reserves and
 * a trend label. 'lapsed' means the last statement on file is before 2022, which can be a charity
 * that closed or one whose 2022-23 statement is not in the extract; the page says so.
 */
import { getDirectServiceSupabase } from '@/lib/supabase';

export interface TrajectoryRow {
  abn: string;
  charity_name: string;
  charity_size: string | null;
  state: string | null;
  lga_code: string | null;
  lga_name: string | null;
  gs_id: string | null;
  years_reported: number;
  first_year: number;
  last_year: number;
  revenue_first: number | null;
  revenue_prev: number | null;
  revenue_last: number | null;
  peak_revenue: number | null;
  revenue_cagr_pct: number | null;
  revenue_change_pct: number | null;
  revenue_change_yoy_pct: number | null;
  gov_share_last_pct: number | null;
  gov_share_first_pct: number | null;
  donation_share_last_pct: number | null;
  donation_share_first_pct: number | null;
  gov_revenue_last: number | null;
  donations_last: number | null;
  donations_first: number | null;
  margin_last_pct: number | null;
  deficit_years_last3: number;
  net_assets_last: number | null;
  reserve_months: number | null;
  fte_first: number | null;
  fte_last: number | null;
  volunteers_last: number | null;
  trend: 'growing' | 'steady' | 'shrinking' | 'single_year' | 'lapsed';
  gov_dependent: boolean;
  three_year_deficit: boolean;
}

export const TREND_LABEL: Record<TrajectoryRow['trend'], string> = {
  growing: 'Growing',
  steady: 'Steady',
  shrinking: 'Shrinking',
  single_year: 'One statement only',
  lapsed: 'No statement since 2021',
};

export interface CohortStat {
  trend: TrajectoryRow['trend'];
  n: number;
  revenue_last: number;
  gov_dependent: number;
  three_year_deficit: number;
}

const COLS =
  'abn, charity_name, charity_size, state, lga_code, lga_name, gs_id, years_reported, first_year, last_year, revenue_first, revenue_prev, revenue_last, peak_revenue, revenue_cagr_pct, revenue_change_pct, revenue_change_yoy_pct, gov_share_last_pct, gov_share_first_pct, donation_share_last_pct, donation_share_first_pct, gov_revenue_last, donations_last, donations_first, margin_last_pct, deficit_years_last3, net_assets_last, reserve_months, fte_first, fte_last, volunteers_last, trend, gov_dependent, three_year_deficit';

export async function trajectoryForAbn(abn: string): Promise<TrajectoryRow | null> {
  const db = getDirectServiceSupabase();
  const { data } = await db.from('mv_charity_trajectory').select(COLS).eq('abn', abn).maybeSingle();
  return (data as TrajectoryRow | null) ?? null;
}

export interface TrajectoryLists {
  cohort: CohortStat[];
  /** Large charities (revenue at peak over $1m) that have lost more than a fifth of their revenue. */
  shrinkingLarge: TrajectoryRow[];
  /** Fastest compound growth among charities that started above $1m. */
  growingLarge: TrajectoryRow[];
  /** Over $1m, 70%+ government revenue, sorted by that share. */
  govDependent: TrajectoryRow[];
  /** Deficits in each of the last three statements, ordered by revenue. */
  threeYearDeficit: TrajectoryRow[];
  /** Where donations became a materially bigger or smaller share of revenue. */
  donationShift: TrajectoryRow[];
}

/**
 * Six lists in parallel, all filtered by state when given. Each list is a distinct question, so a
 * charity can appear in more than one; the page says which list it is reading.
 */
export async function trajectoryLists(state: string, limit = 25): Promise<TrajectoryLists> {
  const db = getDirectServiceSupabase();
  const base = () => {
    let q = db.from('mv_charity_trajectory').select(COLS);
    if (state) q = q.eq('state', state);
    return q;
  };
  const cohortQ = (() => {
    let q = db.from('mv_charity_trajectory').select('trend, revenue_last, gov_dependent, three_year_deficit');
    if (state) q = q.eq('state', state);
    return q.limit(100000);
  })();
  const [cohortRes, shrink, grow, gov, deficit, shift] = await Promise.all([
    cohortQ,
    base().eq('trend', 'shrinking').gte('peak_revenue', 1_000_000).order('revenue_change_pct', { ascending: true, nullsFirst: false }).limit(limit),
    base().eq('trend', 'growing').gte('revenue_first', 1_000_000).order('revenue_cagr_pct', { ascending: false, nullsFirst: false }).limit(limit),
    base().eq('gov_dependent', true).gte('revenue_last', 1_000_000).order('gov_share_last_pct', { ascending: false, nullsFirst: false }).order('revenue_last', { ascending: false }).limit(limit),
    base().eq('three_year_deficit', true).order('revenue_last', { ascending: false, nullsFirst: false }).limit(limit),
    base().gte('revenue_last', 1_000_000).gte('years_reported', 4).not('donation_share_first_pct', 'is', null).order('donation_share_last_pct', { ascending: false, nullsFirst: false }).limit(400),
  ]);
  for (const r of [cohortRes, shrink, grow, gov, deficit, shift]) if (r.error) throw new Error(r.error.message);

  const acc = new Map<string, CohortStat>();
  for (const r of (cohortRes.data ?? []) as Pick<TrajectoryRow, 'trend' | 'revenue_last' | 'gov_dependent' | 'three_year_deficit'>[]) {
    const c = acc.get(r.trend) ?? { trend: r.trend, n: 0, revenue_last: 0, gov_dependent: 0, three_year_deficit: 0 };
    c.n += 1;
    c.revenue_last += Number(r.revenue_last) || 0;
    if (r.gov_dependent) c.gov_dependent += 1;
    if (r.three_year_deficit) c.three_year_deficit += 1;
    acc.set(r.trend, c);
  }
  const order: TrajectoryRow['trend'][] = ['growing', 'steady', 'shrinking', 'lapsed', 'single_year'];
  const cohort = order.map((t) => acc.get(t)).filter((c): c is CohortStat => !!c);

  // Donation shift is computed here rather than sorted in SQL: the interesting rows are the ones
  // whose share moved most in either direction, which is |last - first|, not a column.
  const donationShift = ((shift.data ?? []) as TrajectoryRow[])
    .map((r) => ({ r, d: Math.abs((r.donation_share_last_pct ?? 0) - (r.donation_share_first_pct ?? 0)) }))
    .filter((x) => x.d >= 15)
    .sort((a, b) => b.d - a.d)
    .slice(0, limit)
    .map((x) => x.r);

  return {
    cohort,
    shrinkingLarge: (shrink.data ?? []) as TrajectoryRow[],
    growingLarge: (grow.data ?? []) as TrajectoryRow[],
    govDependent: (gov.data ?? []) as TrajectoryRow[],
    threeYearDeficit: (deficit.data ?? []) as TrajectoryRow[],
    donationShift,
  };
}
