import { getDirectServiceSupabase } from '@/lib/supabase';

/**
 * Money from `justice_funding`, filtered honestly.
 *
 * THREE FILTERS, NOT ONE. All three are mandatory and omitting any of them does not produce a
 * slightly-off number — it produces a wrong one by billions.
 *
 * 1. `measure_kind = 'grant'`
 *    Documented in CLAUDE.md. 848 `expenditure_aggregate` rows are WHOLE-OF-STATE BUDGETS
 *    ($66.1bn), not money to any organisation.
 *
 * 2. Aggregate-shaped recipient names — NOT previously documented anywhere, found 2026-08-16.
 *    `measure_kind = 'grant'` does NOT exclude spreadsheet total rows. 44 rows out of 126,673
 *    carry recipient names like `Total`, `Various` and `n/a`, and between them they hold
 *    **$8.09bn — 17.5% of the $46.1bn that CLAUDE.md documents as the grant figure.**
 *    Four of them are `qld-historical-grants` column totals worth $617.9M, sitting in the
 *    youth-justice topic, where they rank as the #1 and #2 recipients of youth justice funding
 *    in Australia. One of them even carries an ABN.
 *
 *      measure_kind='grant'                  126,673 rows   $46.10bn
 *      ...minus aggregate-shaped names       126,629 rows   $38.01bn
 *
 * 3. `amount_dollars IS NOT NULL` for any ORDER BY on money. Postgres sorts NULLs FIRST in a
 *    DESC ordering, so a naive "top recipients" query returns the rows with no amount at all.
 *
 * Topic tags use HYPHENS. `topics @> ARRAY['youth_justice']` returns zero rows silently.
 */

/**
 * Recipient names that are not organisations. Compared lower-cased and trimmed.
 *
 * Kept as an explicit list rather than a pattern: a pattern matching /total/ would also catch a
 * real organisation with "Total" in its name, and the cost of wrongly excluding a real recipient
 * is understating them on a public page.
 */
export const NON_RECIPIENT_NAMES: ReadonlySet<string> = new Set([
  'total',
  'totals',
  'grand total',
  'subtotal',
  'sub-total',
  'various',
  'n/a',
  'na',
  'unknown',
  'tbc',
  'other',
  // Source spreadsheets export empty cells as the literal string "(blank)" — 286 rows carrying
  // $265M ranked #9 on the grants browser before this was caught (UX audit SH-1, 2026-08-18).
  '(blank)',
]);

export function isRealRecipient(name: string | null | undefined): boolean {
  if (!name) return false;
  // Trim BEFORE the emptiness check: `'   '` is truthy, and without this a whitespace-only
  // recipient renders as a blank row carrying real dollars.
  const normalised = name.trim().toLowerCase();
  if (normalised === '') return false;
  return !NON_RECIPIENT_NAMES.has(normalised);
}

/**
 * The two DB-side row filters, as a PostgREST builder step.
 *
 * Use this instead of retyping the predicate. Traced 2026-08-16: six surfaces summed
 * `justice_funding` with none of these, including one that divides by the total.
 *
 *   applyGrantFilters(supabase.from('justice_funding').select('...')).eq('state', 'QLD')
 *
 * WHY ONLY TWO OF THE THREE. The recipient-name exclusion needs `lower(btrim(...))`, and
 * PostgREST's `in` is case-sensitive — a filter listing 'total' would not match 'Total' and would
 * read as protection while doing nothing. So it is deliberately absent here.
 *
 * That is affordable because `is_aggregate` already catches 31 of the 46 aggregate-named rows,
 * carrying $8.03bn of their $8.09bn. The residual is 15 rows worth $60.1m nationally. Where a sum
 * must be exact, filter the fetched rows through `isRealRecipient` as well, or use
 * `GRANT_FILTER_SQL` in a raw query where all three can be expressed properly.
 *
 * Typed loosely on purpose: PostgREST builder generics differ between select shapes, and a precise
 * type here would push callers into casts, which is how a filter gets dropped in the first place.
 */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export function applyGrantFilters<T extends { eq: any; not: any }>(query: T): T {
  return query.eq('measure_kind', 'grant').not('is_aggregate', 'is', true);
}

/**
 * The same three filters as a SQL fragment, for raw `exec_sql` call sites.
 *
 * `alias` must match the table alias in the query (`jf` for `FROM justice_funding jf`). Getting it
 * wrong is a SQL error at query time, not a silently wrong number, which is the point of taking it
 * as an argument rather than leaving callers to hand-edit a template string.
 */
export function grantFilterSql(alias?: string): string {
  const p = alias ? `${alias}.` : '';
  return `${p}measure_kind = 'grant'
    AND ${p}is_aggregate IS NOT TRUE
    AND lower(btrim(${p}recipient_name)) <> ALL (ARRAY[${[...NON_RECIPIENT_NAMES]
      .map((n) => `'${n}'`)
      .join(',')}])`;
}

/** Unaliased form, for `FROM justice_funding` with no alias. */
export const GRANT_FILTER_SQL = grantFilterSql();

/**
 * `political_donations.receipt_type` filter.
 *
 * 'other receipt' is 72% of rows and 85% of dollars and is NOT donations — it is party
 * fundraising income, transfers and levies. Summing the table unfiltered reports $240.8bn of
 * political donations in Australia. The real figure is $25.3bn (measured 2026-08-20).
 */
export function donationFilterSql(alias?: string): string {
  const p = alias ? `${alias}.` : '';
  return `${p}receipt_type = 'donation received'`;
}

export interface ThemeMoney {
  /** Dollars, after all three filters. A FLOOR, never a total — see coverage below. */
  total: number;
  grantCount: number;
  organisationCount: number;
  firstYear: string | null;
  lastYear: string | null;
  /** Rows excluded as aggregate-shaped, and what they were worth. Stated, never silently dropped. */
  excludedRows: number;
  excludedDollars: number;
  /** Share of included rows that resolve to a graph entity, so the links can be honest. */
  linkedPct: number;
  /** Dollars held by recipients that resolve to a graph entity — the classifiable base. */
  linkedDollars: number;
  /** Dollars held by linked recipients flagged `is_community_controlled`. */
  accoDollars: number;
  /**
   * ACCO share **of linked dollars**, one decimal. Unlinked money cannot be classified either
   * way, so the honest denominator is linkedDollars, and the basis must be stated wherever
   * this renders.
   */
  accoPctOfLinked: number;
  top: RecipientRow[];
}

export interface RecipientRow {
  name: string;
  gsId: string | null;
  dollars: number;
  grants: number;
}

interface RawRow {
  /** Selected solely to deduplicate across tags. See the overlap note in themeMoney(). */
  id: string;
  recipient_name: string | null;
  amount_dollars: number | null;
  financial_year: string | null;
  gs_entity_id: string | null;
}

/**
 * Aggregates in memory rather than in SQL.
 *
 * PostgREST cannot GROUP BY, and adding a database function for this would be a migration on a
 * shared production database for a read that runs once an hour behind `revalidate`. The largest
 * topic is `child-protection` at 16,418 rows; at four columns that is a few hundred KB, fetched
 * hourly per theme. If a theme ever needs sub-second freshness this becomes a matview.
 */
export async function themeMoney(
  topics: readonly string[],
  topN = 15,
  opts: { financialYear?: string } = {},
): Promise<ThemeMoney | null> {
  if (topics.length === 0) return null;

  const supabase = getDirectServiceSupabase();
  const PAGE = 1000;

  // DEDUPLICATED BY id, because a theme's tags DO overlap. Measured 2026-08-16:
  //   youth-justice ∩ diversion            98 rows
  //   child-protection ∩ family-services    2 rows
  //   prevention ∩ community-led            0 rows
  // Querying tag by tag and concatenating would count those 98 grants twice and overstate youth
  // justice funding. The `id` column exists in the select for no other reason.
  const byId = new Map<string, RawRow>();

  for (const topic of topics) {
    for (let from = 0; ; from += PAGE) {
      let query = supabase
        .from('justice_funding')
        .select('id,recipient_name,amount_dollars,financial_year,gs_entity_id')
        .eq('measure_kind', 'grant')
        // `is_aggregate` is NOT implied by measure_kind and cuts both ways: 1,358 rows are
        // measure_kind='grant' AND is_aggregate — $12.06bn of grant-shaped aggregates — while 330
        // expenditure_aggregate rows are is_aggregate=false. Neither column is a superset of the
        // other, so both are required. Nationally this is the difference between $38.01bn and
        // $33.98bn; on the youth-justice theme it moves $1,044.8m to $1,044.2m.
        .not('is_aggregate', 'is', true)
        .contains('topics', [topic]);
      // Only ever a value from the v_vocab_financial_years vocabulary — a free-text year here
      // would silently return zero rows and render as "no money", so callers must validate first.
      if (opts.financialYear) query = query.eq('financial_year', opts.financialYear);
      const { data, error } = await query.range(from, from + PAGE - 1);
      if (error) throw new Error(`justice money query failed: ${error.message}`);
      const page = (data ?? []) as unknown as RawRow[];
      for (const r of page) byId.set(r.id, r);
      if (page.length < PAGE) break;
    }
  }

  const rows = [...byId.values()];
  if (rows.length === 0) return null;

  const excluded = rows.filter((r) => !isRealRecipient(r.recipient_name));
  const kept = rows.filter((r) => isRealRecipient(r.recipient_name));

  const byName = new Map<string, { dollars: number; grants: number; gsEntityId: string | null }>();
  let total = 0;
  let linked = 0;
  let firstYear: string | null = null;
  let lastYear: string | null = null;

  for (const r of kept) {
    const amount = r.amount_dollars ?? 0;
    total += amount;
    if (r.gs_entity_id) linked += 1;
    if (r.financial_year) {
      if (!firstYear || r.financial_year < firstYear) firstYear = r.financial_year;
      if (!lastYear || r.financial_year > lastYear) lastYear = r.financial_year;
    }
    const name = (r.recipient_name ?? '').trim();
    const prev = byName.get(name) ?? { dollars: 0, grants: 0, gsEntityId: null };
    byName.set(name, {
      dollars: prev.dollars + amount,
      grants: prev.grants + 1,
      gsEntityId: prev.gsEntityId ?? r.gs_entity_id,
    });
  }

  const entityIds = [
    ...new Set(
      [...byName.values()].map((v) => v.gsEntityId).filter((v): v is string => Boolean(v)),
    ),
  ];
  const gsIdByEntityId = new Map<string, string>();
  const accoByEntityId = new Map<string, boolean>();
  // Resolve internal ids to the public `gs_id` used by /entity/[gsId], and pick up the
  // community-controlled flag in the same pass. Chunked: a 1,274-org theme would otherwise
  // build a URL longer than PostgREST accepts.
  for (let i = 0; i < entityIds.length; i += 200) {
    const chunk = entityIds.slice(i, i + 200);
    try {
      const { data } = await supabase
        .from('gs_entities')
        .select('id,gs_id,is_community_controlled')
        .in('id', chunk);
      for (const e of (data ?? []) as {
        id: string;
        gs_id: string;
        is_community_controlled: boolean | null;
      }[]) {
        gsIdByEntityId.set(e.id, e.gs_id);
        accoByEntityId.set(e.id, e.is_community_controlled === true);
      }
    } catch {
      // A failed chunk costs links, not numbers. The names still render.
    }
  }

  let linkedDollars = 0;
  let accoDollars = 0;
  for (const v of byName.values()) {
    // Classify against the resolved chunk, not the raw stamp: an id whose lookup chunk failed
    // is unclassifiable and must not inflate the denominator.
    if (v.gsEntityId && gsIdByEntityId.has(v.gsEntityId)) {
      linkedDollars += v.dollars;
      if (accoByEntityId.get(v.gsEntityId)) accoDollars += v.dollars;
    }
  }

  const top = [...byName.entries()]
    .map(([name, v]) => ({
      name,
      gsId: v.gsEntityId ? (gsIdByEntityId.get(v.gsEntityId) ?? null) : null,
      dollars: v.dollars,
      grants: v.grants,
    }))
    .filter((r) => r.dollars > 0)
    .sort((a, b) => b.dollars - a.dollars)
    .slice(0, topN);

  return {
    total,
    grantCount: kept.length,
    organisationCount: byName.size,
    firstYear,
    lastYear,
    excludedRows: excluded.length,
    excludedDollars: excluded.reduce((s, r) => s + (r.amount_dollars ?? 0), 0),
    linkedPct: kept.length === 0 ? 0 : Math.round((linked / kept.length) * 1000) / 10,
    linkedDollars,
    accoDollars,
    accoPctOfLinked: linkedDollars === 0 ? 0 : Math.round((accoDollars / linkedDollars) * 1000) / 10,
    top,
  };
}

export function money(n: number): string {
  if (n >= 1e9) return `$${(n / 1e9).toFixed(2)}bn`;
  if (n >= 1e6) return `$${(n / 1e6).toFixed(1)}m`;
  if (n >= 1e3) return `$${Math.round(n / 1e3)}k`;
  return `$${Math.round(n)}`;
}
