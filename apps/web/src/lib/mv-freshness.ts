import { getDirectServiceSupabase } from '@/lib/supabase';

/**
 * Matview freshness, as something a surface can say out loud.
 *
 * A stale matview does not error. It serves a confidently wrong number to whatever reads it, and
 * a confident non-zero is harder to spot than a confident zero. Until 2026-08-20 the only way to
 * discover staleness here was to refresh a matview by hand during unrelated work and watch the
 * counts move — which is exactly how it was found (#314).
 *
 * WHAT #314 FEARED AND WHAT WAS TRUE. The ticket reported that the nightly refresh had not run on
 * the night of 18→19 August. It ran, and succeeded, as it did every other night that week; the one
 * failure in the window was 2026-08-11, `server restarted`. The cluster of matviews reporting a
 * last success of 15–16 August were tier `weekly` (cron `0 15 * * 0`) and tier `retire`. They were
 * exactly as fresh as configured.
 *
 * That misreading is the reason this module exists. The raw log could not distinguish:
 *   - "fresh for its tier" from "overdue"
 *   - "refreshed by a path that does not log" from "never refreshed at all"
 * Both were reconstructible only by knowing the cron schedules by heart. Now `v_mv_refresh_drift`
 * carries a one-word verdict and this module gives it to callers with the words to print.
 *
 * THE TRAP THAT WAS ALSO FIXED. The drift view used to compute the last refresh from the last log
 * row OF ANY STATUS, so a failed refresh reset the staleness clock and a matview failing for a week
 * read as fresh. It now counts successes only, and reports the last attempt separately.
 * Always filter `mv_refresh_log` on `status IN ('success','success-fallback')` for the same reason.
 */

/** The verdict `v_mv_refresh_drift` assigns. Ordered here from best to worst. */
export type MvFreshness =
  | 'fresh'
  | 'unmanaged'
  | 'unlogged'
  | 'retired'
  | 'disabled'
  | 'stale'
  | 'never'
  | 'orphan'
  | 'unregistered';

export interface MvFreshnessRow {
  mv_name: string;
  tier: string | null;
  freshness: MvFreshness;
  age_hours: number | null;
  max_age_hours: number | null;
  last_success_at: string | null;
  last_attempt_status: string | null;
  notes: string | null;
}

/**
 * Verdicts that mean something is wrong and someone should act.
 *
 * `unlogged` is deliberately NOT here. Sixteen `on_demand` matviews are refreshed by paths that do
 * not write to the log — `refresh_alma_dashboards()`, the youth-justice report scripts — and each
 * names its owner in `notes`. Treating them as failures would cry wolf sixteen times a night and
 * the real alert would stop being read. It is an honest unknown, not a fault.
 */
const ACTIONABLE: ReadonlySet<MvFreshness> = new Set<MvFreshness>([
  'stale',
  'never',
  'orphan',
  'unregistered',
]);

export function isActionable(freshness: MvFreshness): boolean {
  return ACTIONABLE.has(freshness);
}

/**
 * Whether a surface reading this matview should warn the reader rather than just date the figure.
 * Narrower than `isActionable`: an orphaned registry row is an ops problem, not something a
 * visitor looking at a number needs to be told about.
 */
export function shouldWarnReader(freshness: MvFreshness): boolean {
  return freshness === 'stale' || freshness === 'never';
}

/**
 * The words a surface puts beside a figure. Never invent freshness the log cannot support: where
 * the as-of date is unknown the label says so instead of quietly omitting it.
 */
export function freshnessLabel(row: Pick<MvFreshnessRow, 'freshness' | 'last_success_at'>): string {
  const asOf = row.last_success_at ? formatAsOf(row.last_success_at) : null;
  switch (row.freshness) {
    case 'fresh':
    case 'unmanaged':
      return asOf ? `As at ${asOf}` : 'Last refresh not recorded';
    case 'stale':
      return asOf ? `As at ${asOf} — overdue a refresh` : 'Overdue a refresh';
    case 'never':
      return 'Never refreshed since records began';
    case 'unlogged':
      // The distinction #314 asked for: refreshed by another path, so the log cannot date it.
      return 'Refreshed outside the schedule — date not recorded';
    case 'retired':
      return asOf ? `Retired, frozen at ${asOf}` : 'Retired, no longer refreshed';
    case 'disabled':
      return asOf ? `Refresh disabled, frozen at ${asOf}` : 'Refresh disabled';
    case 'orphan':
      return 'Registry row for a matview that no longer exists';
    case 'unregistered':
      return 'Not on the refresh registry — nothing schedules it';
  }
}

/** Date only. A time-of-day on a nightly aggregate implies a precision the number does not have. */
export function formatAsOf(iso: string): string {
  return new Date(iso).toLocaleDateString('en-AU', {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
  });
}

export interface MvFreshnessSummary {
  total: number;
  fresh: number;
  /** Verdicts in ACTIONABLE — the count an ops tile should turn red on. */
  actionable: number;
  /** Known unknowns: owned elsewhere, or run without a schedule. Not faults. */
  unknown: number;
  worst: MvFreshnessRow[];
}

export function summariseFreshness(rows: readonly MvFreshnessRow[]): MvFreshnessSummary {
  const actionable = rows.filter(r => isActionable(r.freshness));
  return {
    total: rows.length,
    fresh: rows.filter(r => r.freshness === 'fresh').length,
    actionable: actionable.length,
    unknown: rows.filter(r => r.freshness === 'unlogged' || r.freshness === 'unmanaged').length,
    worst: [...actionable].sort((a, b) => (b.age_hours ?? Infinity) - (a.age_hours ?? Infinity)),
  };
}

const SELECT =
  'mv_name,tier,freshness,age_hours,max_age_hours,last_success_at,last_attempt_status,notes';

/** Every matview's verdict. Reads the live database, never the snapshot: a snapshot's refresh log
 * would date the snapshot, not production. */
export async function getAllMvFreshness(): Promise<MvFreshnessRow[]> {
  const { data, error } = await getDirectServiceSupabase()
    .from('v_mv_refresh_drift')
    .select(SELECT);
  if (error) throw new Error(`mv freshness query failed: ${error.message}`);
  return (data ?? []) as unknown as MvFreshnessRow[];
}

/**
 * One matview's verdict, for a surface that wants to date its own figure.
 *
 * Returns null when the view holds no row for that name, and callers must render that as "date
 * unknown" rather than as fresh — a missing verdict is the one case where saying nothing is the
 * same as claiming the number is current.
 */
export async function getMvFreshness(mvName: string): Promise<MvFreshnessRow | null> {
  const { data, error } = await getDirectServiceSupabase()
    .from('v_mv_refresh_drift')
    .select(SELECT)
    .eq('mv_name', mvName)
    .maybeSingle();
  if (error) throw new Error(`mv freshness query failed: ${error.message}`);
  return (data as unknown as MvFreshnessRow) ?? null;
}
