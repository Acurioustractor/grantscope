import { getDirectServiceSupabase } from '@/lib/supabase';
import { NON_RECIPIENT_NAMES, isRealRecipient } from '@/lib/justice-money';

/**
 * Place capture: of the grant money delivered into a place, how much does the place keep?
 *
 * `grantconnect_awards` carries `delivery_postcode`/`delivery_state` as columns SEPARATE from
 * `recipient_postcode`/`recipient_state`. Nothing in the codebase read them until 2026-08-19.
 * This module owns the measure and its exclusions so the next query cannot rewrite them from
 * memory — the same reason `justice-money.ts` exists.
 *
 * FOUR EXCLUSIONS, each with a measured cost. Do not relax one to widen coverage without
 * re-reading what it bought:
 *
 * 1. `delivery_postcode = 'Multiple'` — a literal string on 5,978 rows worth $19.55bn. These are
 *    multi-site grants; they are not a place. Because 'Multiple' never equals a recipient
 *    postcode, leaving them in counted every one as delivered off-site: $42.46bn away from the
 *    recipient instead of $22.91bn, and $17.79bn crossing state lines instead of $3.95bn. The
 *    cross-state figure was wrong by 4.5x.
 *
 * 2. Aggregate-shaped recipient names (2,663 rows) and `value_aud <= 0` (195 rows). The name list
 *    is `NON_RECIPIENT_NAMES` from `justice-money.ts`, reused rather than restated.
 *
 * 3. Single-LGA postcodes only. 521 of 2,859 postcodes touch more than one council; attributing
 *    them by picking one is how you get a wrong answer that looks right. Same discipline as the
 *    LGA attribution rebuild: unplaced beats confidently wrong.
 *
 * 4. `postcode_geo` rows whose `locality` is an SA3 name, not a locality — 443 of them, carrying
 *    WRONG councils. Postcode 4816 is recorded as locality 'Townsville - South' with
 *    `lga_name = 'Croydon'`, a council ~900km away. Left in, Croydon QLD ranked as the
 *    worst-capturing council in Australia on $72.9M that is really Palm Island money. Those rows
 *    are wrong for every consumer of `postcode_geo` and their repair is a separate issue; this
 *    module only refuses them; the repair is issue #301 and
 *    `migrations/2026-08-19-sa3-locality-lga-repair.sql`.
 *
 * TWO MEASURES, NEVER ONE. Every result carries both `pctAwardsLocal` and `pctDollarsLocal`, and
 * the module deliberately offers no single "capture rate", because the two disagree and the
 * disagreement is the finding. Nationally (measured 2026-08-20) 85.1% of awards but 59.6% of
 * dollars stay in the delivery council. Award share falls monotonically with remoteness; dollar
 * share does not fall at all. A surface showing only dollars would report that remote Australia
 * captures MORE than the cities — true, and deeply misleading alone.
 *
 * THE DENOMINATOR TRAP, found while implementing this (2026-08-20). 6,259 of the 85,898 covered
 * awards, worth $10.69bn — 31.7% of the covered dollars — have a delivery council but a recipient
 * postcode that does NOT resolve to a single trustworthy council. They are unresolved, not
 * off-site. Counting them as off-site is where the headline 59.6% comes from; on the resolved base
 * the dollar figure is 87.3%. Both are true of different questions, so both are returned:
 * `pctDollarsLocal` uses the resolved base and `pctDollarsLocalOfBase` uses the wider one. Any
 * surface must say which it is showing.
 *
 * COVERAGE. The council path is a well-measured MINORITY: 85,898 awards and $33.75bn of 291,264
 * awards and $230bn. The state path is near-complete: 281,016 awards and $200.22bn, losing only
 * the multi-state, National and Overseas delivery strings. Coverage counts ride on every result
 * so no caller recomputes them.
 */

/** Exclusion 1. A literal string in `delivery_postcode`, not a null and not a code. */
export const MULTI_SITE_SENTINEL = 'Multiple';

/**
 * Exclusion 4. `postcode_geo.locality` values shaped like an ABS SA3 name — `'Townsville - South'`
 * — rather than a locality. Matched on the ` - ` separator, which no real Australian locality name
 * in the table contains.
 */
export const SA3_LOCALITY_SEPARATOR = ' - ';

/** The eight state and territory codes. Anything else in `delivery_state` is multi-site,
 * 'National' or 'Overseas' and is not a place. */
export const STATE_CODES = ['NSW', 'VIC', 'QLD', 'WA', 'SA', 'ACT', 'TAS', 'NT'] as const;
export type StateCode = (typeof STATE_CODES)[number];

/** Defaults for any ranked list, set here rather than per caller so one large grant in a tiny
 * council cannot top the table as noise. */
export const CAPTURE_MIN_AWARDS = 20;
export const CAPTURE_MIN_DOLLARS = 5_000_000;

/** Exclusion 1 + 2, as a predicate over one award. */
export function isCapturableAward(award: {
  delivery_postcode?: string | null;
  value_aud?: number | null;
  recipient_name?: string | null;
}): boolean {
  if (!award.delivery_postcode) return false;
  if (award.delivery_postcode.trim() === MULTI_SITE_SENTINEL) return false;
  if (!(Number(award.value_aud) > 0)) return false;
  return isRealRecipient(award.recipient_name);
}

/** Exclusion 4, as a predicate over one `postcode_geo` row. */
export function isTrustworthyLocality(locality: string | null | undefined): boolean {
  if (!locality) return false;
  return !locality.includes(SA3_LOCALITY_SEPARATOR);
}

/**
 * Exclusions 3 + 4 together: postcode → council, for postcodes that resolve to exactly one
 * trustworthy council. A postcode touching two councils resolves to none.
 */
export function buildPostcodeLgaIndex(
  rows: readonly { postcode: string; locality: string | null; lga_name: string | null }[],
): Map<string, string> {
  const candidates = new Map<string, Set<string>>();
  for (const row of rows) {
    if (!row.lga_name) continue;
    if (!isTrustworthyLocality(row.locality)) continue;
    const set = candidates.get(row.postcode) ?? new Set<string>();
    set.add(row.lga_name);
    candidates.set(row.postcode, set);
  }
  const index = new Map<string, string>();
  for (const [postcode, lgas] of candidates) {
    if (lgas.size === 1) index.set(postcode, [...lgas][0]);
  }
  return index;
}

export interface CaptureTally {
  /** Awards and dollars after the exclusions — the base this row measures. */
  awards: number;
  dollars: number;
  /** Of the base, those whose recipient location also resolves. The honest denominator. */
  resolvedAwards: number;
  resolvedDollars: number;
  /** Delivery and recipient in the same place. */
  localAwards: number;
  localDollars: number;
  /** Resolved elsewhere, but inside the same state — regional centralisation. */
  sameStateElsewhereAwards: number;
  sameStateElsewhereDollars: number;
  /** Resolved elsewhere, across a state border — interstate extraction. */
  crossStateAwards: number;
  crossStateDollars: number;
  /** Recipient location does not resolve. NOT off-site: unmeasured. */
  unresolvedAwards: number;
  unresolvedDollars: number;
  /** Local share of the RESOLVED base, one decimal. */
  pctAwardsLocal: number;
  pctDollarsLocal: number;
  /** Local share of the WHOLE base, counting unresolved as not-local. The wider, gloomier
   * reading; correct only for a question that treats "we cannot tell" as "not here". */
  pctAwardsLocalOfBase: number;
  pctDollarsLocalOfBase: number;
}

/** One award as the tally sees it. Places are councils on the council path and state codes on
 * the state path — the tally does not care which, only whether they match. */
export interface CaptureAward {
  value: number;
  deliveryPlace: string;
  deliveryState: string | null;
  recipientPlace: string | null;
  recipientState: string | null;
}

function pct(part: number, whole: number): number {
  if (whole <= 0) return 0;
  return Math.round((part / whole) * 1000) / 10;
}

/**
 * The measure itself, pure. Both percentages are computed independently and may legitimately
 * diverge — that divergence is the finding, not a rounding artefact.
 */
export function tallyCapture(awards: readonly CaptureAward[]): CaptureTally {
  const t = {
    awards: 0,
    dollars: 0,
    resolvedAwards: 0,
    resolvedDollars: 0,
    localAwards: 0,
    localDollars: 0,
    sameStateElsewhereAwards: 0,
    sameStateElsewhereDollars: 0,
    crossStateAwards: 0,
    crossStateDollars: 0,
    unresolvedAwards: 0,
    unresolvedDollars: 0,
  };
  for (const a of awards) {
    const v = Number(a.value) || 0;
    t.awards += 1;
    t.dollars += v;
    if (!a.recipientPlace) {
      t.unresolvedAwards += 1;
      t.unresolvedDollars += v;
      continue;
    }
    t.resolvedAwards += 1;
    t.resolvedDollars += v;
    if (a.recipientPlace === a.deliveryPlace) {
      t.localAwards += 1;
      t.localDollars += v;
    } else if (a.recipientState && a.deliveryState && a.recipientState !== a.deliveryState) {
      t.crossStateAwards += 1;
      t.crossStateDollars += v;
    } else {
      t.sameStateElsewhereAwards += 1;
      t.sameStateElsewhereDollars += v;
    }
  }
  return {
    ...t,
    pctAwardsLocal: pct(t.localAwards, t.resolvedAwards),
    pctDollarsLocal: pct(t.localDollars, t.resolvedDollars),
    pctAwardsLocalOfBase: pct(t.localAwards, t.awards),
    pctDollarsLocalOfBase: pct(t.localDollars, t.dollars),
  };
}

export interface CapturePlace extends CaptureTally {
  place: string;
  state: string | null;
  remoteness: string | null;
}

export interface CaptureResult {
  places: CapturePlace[];
  national: CaptureTally;
  coverage: {
    /** Awards and dollars this path measures. */
    measuredAwards: number;
    measuredDollars: number;
    /** The whole GrantConnect register, so a surface can state the share without a second query. */
    totalAwards: number;
    totalDollars: number;
  };
}

/** `NON_RECIPIENT_NAMES` as a SQL array literal, so the list exists once in TypeScript and every
 * query is generated from it rather than retyped beside it. Exported because the Atlas map route
 * needs the same list, and a second hand-typed copy there is exactly how a filter drifts. */
export const NON_RECIPIENT_SQL_ARRAY = `ARRAY[${[...NON_RECIPIENT_NAMES]
  .map(n => `'${n.replace(/'/g, "''")}'`)
  .join(',')}]`;

/** The state-code whitelist as a SQL list, for the same reason. */
export const STATE_CODES_SQL = STATE_CODES.map(s => `'${s}'`).join(',');

function nonRecipientSql(): string {
  return NON_RECIPIENT_SQL_ARRAY;
}

/** The whole register, for the coverage denominator both paths report. */
const TOTALS_SQL = `SELECT count(*)::bigint AS awards, COALESCE(sum(value_aud),0)::numeric AS dollars
   FROM grantconnect_awards`;

interface RawPlaceRow {
  place: string;
  state: string | null;
  remoteness: string | null;
  awards: string | number;
  dollars: string | number;
  resolved_awards: string | number;
  resolved_dollars: string | number;
  local_awards: string | number;
  local_dollars: string | number;
  cross_state_awards: string | number;
  cross_state_dollars: string | number;
}

const n = (v: unknown) => Number(v ?? 0) || 0;

/** Rebuild a tally from the SQL group row. The arithmetic that derives the percentages lives in
 * `tallyCapture`; this only restates the group as awards so there is one implementation. */
function tallyFromRow(row: RawPlaceRow): CaptureTally {
  const awards = n(row.awards);
  const dollars = n(row.dollars);
  const resolvedAwards = n(row.resolved_awards);
  const resolvedDollars = n(row.resolved_dollars);
  const localAwards = n(row.local_awards);
  const localDollars = n(row.local_dollars);
  const crossStateAwards = n(row.cross_state_awards);
  const crossStateDollars = n(row.cross_state_dollars);
  const t = {
    awards,
    dollars,
    resolvedAwards,
    resolvedDollars,
    localAwards,
    localDollars,
    crossStateAwards,
    crossStateDollars,
    sameStateElsewhereAwards: resolvedAwards - localAwards - crossStateAwards,
    sameStateElsewhereDollars: resolvedDollars - localDollars - crossStateDollars,
    unresolvedAwards: awards - resolvedAwards,
    unresolvedDollars: dollars - resolvedDollars,
  };
  return {
    ...t,
    pctAwardsLocal: pct(localAwards, resolvedAwards),
    pctDollarsLocal: pct(localDollars, resolvedDollars),
    pctAwardsLocalOfBase: pct(localAwards, awards),
    pctDollarsLocalOfBase: pct(localDollars, dollars),
  };
}

function sumTallies(places: readonly CapturePlace[]): CaptureTally {
  const zero: CaptureAward[] = [];
  const base = tallyCapture(zero);
  const acc = { ...base };
  for (const p of places) {
    acc.awards += p.awards;
    acc.dollars += p.dollars;
    acc.resolvedAwards += p.resolvedAwards;
    acc.resolvedDollars += p.resolvedDollars;
    acc.localAwards += p.localAwards;
    acc.localDollars += p.localDollars;
    acc.sameStateElsewhereAwards += p.sameStateElsewhereAwards;
    acc.sameStateElsewhereDollars += p.sameStateElsewhereDollars;
    acc.crossStateAwards += p.crossStateAwards;
    acc.crossStateDollars += p.crossStateDollars;
    acc.unresolvedAwards += p.unresolvedAwards;
    acc.unresolvedDollars += p.unresolvedDollars;
  }
  acc.pctAwardsLocal = pct(acc.localAwards, acc.resolvedAwards);
  acc.pctDollarsLocal = pct(acc.localDollars, acc.resolvedDollars);
  acc.pctAwardsLocalOfBase = pct(acc.localAwards, acc.awards);
  acc.pctDollarsLocalOfBase = pct(acc.localDollars, acc.dollars);
  return acc;
}

async function runSql<T>(query: string): Promise<T[]> {
  const supabase = getDirectServiceSupabase();
  const { data, error } = await supabase.rpc('exec_sql', { query });
  if (error) throw new Error(`grant place capture query failed: ${error.message}`);
  return (data ?? []) as T[];
}

/**
 * Capture at state grain, across the near-whole register.
 *
 * Applies only exclusion 1 (via the state-code whitelist, which also drops 'National', 'Overseas'
 * and comma-joined multi-state strings) and exclusion 2. The council-only exclusions 3 and 4 do
 * NOT apply: `delivery_state` and `recipient_state` are recorded directly and need no postcode
 * lookup, which is why this path measures $200.22bn where the council path measures $33.75bn.
 */
export async function captureByState(): Promise<CaptureResult> {
  const states = STATE_CODES.map(s => `'${s}'`).join(',');
  const rows = await runSql<RawPlaceRow>(`
    WITH base AS (
      SELECT delivery_state, recipient_state, value_aud
        FROM grantconnect_awards
       WHERE value_aud > 0
         AND delivery_state IN (${states})
         AND lower(btrim(recipient_name)) <> ALL (${nonRecipientSql()})
    )
    SELECT delivery_state AS place,
           delivery_state AS state,
           NULL::text     AS remoteness,
           count(*)::bigint AS awards,
           sum(value_aud)::numeric AS dollars,
           count(*) FILTER (WHERE recipient_state IN (${states}))::bigint AS resolved_awards,
           COALESCE(sum(value_aud) FILTER (WHERE recipient_state IN (${states})),0)::numeric AS resolved_dollars,
           count(*) FILTER (WHERE recipient_state = delivery_state)::bigint AS local_awards,
           COALESCE(sum(value_aud) FILTER (WHERE recipient_state = delivery_state),0)::numeric AS local_dollars,
           count(*) FILTER (WHERE recipient_state IN (${states}) AND recipient_state <> delivery_state)::bigint AS cross_state_awards,
           COALESCE(sum(value_aud) FILTER (WHERE recipient_state IN (${states}) AND recipient_state <> delivery_state),0)::numeric AS cross_state_dollars
      FROM base
     GROUP BY delivery_state
     ORDER BY delivery_state`);
  const totals = await runSql<{ awards: string; dollars: string }>(TOTALS_SQL);
  const places: CapturePlace[] = rows.map(r => ({
    place: r.place,
    state: r.state,
    remoteness: null,
    ...tallyFromRow(r),
  }));
  const national = sumTallies(places);
  return {
    places,
    national,
    coverage: {
      measuredAwards: national.awards,
      measuredDollars: national.dollars,
      totalAwards: n(totals[0]?.awards),
      totalDollars: n(totals[0]?.dollars),
    },
  };
}

/**
 * Capture at council grain, reading `v_grant_place_capture`.
 *
 * The view holds all four exclusions (see `migrations/2026-08-19-grant-place-capture.sql`), so ad
 * hoc SQL and this module agree by construction. It is not reimplemented here.
 */
export async function captureByLga(): Promise<CaptureResult> {
  const rows = await runSql<RawPlaceRow>(`
    SELECT delivery_lga AS place,
           delivery_state AS state,
           max(delivery_remoteness) AS remoteness,
           count(*)::bigint AS awards,
           sum(value_aud)::numeric AS dollars,
           count(*) FILTER (WHERE recipient_lga IS NOT NULL)::bigint AS resolved_awards,
           COALESCE(sum(value_aud) FILTER (WHERE recipient_lga IS NOT NULL),0)::numeric AS resolved_dollars,
           count(*) FILTER (WHERE captured_locally)::bigint AS local_awards,
           COALESCE(sum(value_aud) FILTER (WHERE captured_locally),0)::numeric AS local_dollars,
           count(*) FILTER (WHERE recipient_lga IS NOT NULL AND recipient_state <> delivery_state)::bigint AS cross_state_awards,
           COALESCE(sum(value_aud) FILTER (WHERE recipient_lga IS NOT NULL AND recipient_state <> delivery_state),0)::numeric AS cross_state_dollars
      FROM v_grant_place_capture
     GROUP BY delivery_lga, delivery_state`);
  const totals = await runSql<{ awards: string; dollars: string }>(TOTALS_SQL);
  const places: CapturePlace[] = rows.map(r => ({
    place: r.place,
    state: r.state,
    remoteness: r.remoteness,
    ...tallyFromRow(r),
  }));
  const national = sumTallies(places);
  return {
    places,
    national,
    coverage: {
      measuredAwards: national.awards,
      measuredDollars: national.dollars,
      totalAwards: n(totals[0]?.awards),
      totalDollars: n(totals[0]?.dollars),
    },
  };
}

/**
 * Places that keep the least, thresholded so a single large grant in a tiny council cannot lead
 * the table. Ranked on the resolved base, because a place whose recipients simply do not resolve
 * has not been shown to leak anything.
 */
export function rankWorstCapturing(
  places: readonly CapturePlace[],
  opts: { by?: 'dollars' | 'awards'; minAwards?: number; minDollars?: number; limit?: number } = {},
): CapturePlace[] {
  const by = opts.by ?? 'dollars';
  const minAwards = opts.minAwards ?? CAPTURE_MIN_AWARDS;
  const minDollars = opts.minDollars ?? CAPTURE_MIN_DOLLARS;
  return places
    .filter(p => p.resolvedAwards >= minAwards && p.resolvedDollars >= minDollars)
    .sort((a, b) =>
      by === 'dollars'
        ? a.pctDollarsLocal - b.pctDollarsLocal
        : a.pctAwardsLocal - b.pctAwardsLocal,
    )
    .slice(0, opts.limit ?? 20);
}
