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
]);

export function isRealRecipient(name: string | null | undefined): boolean {
  if (!name) return false;
  // Trim BEFORE the emptiness check: `'   '` is truthy, and without this a whitespace-only
  // recipient renders as a blank row carrying real dollars.
  const normalised = name.trim().toLowerCase();
  if (normalised === '') return false;
  return !NON_RECIPIENT_NAMES.has(normalised);
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
export async function themeMoney(topics: readonly string[], topN = 15): Promise<ThemeMoney | null> {
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
      const { data, error } = await supabase
        .from('justice_funding')
        .select('id,recipient_name,amount_dollars,financial_year,gs_entity_id')
        .eq('measure_kind', 'grant')
        // `is_aggregate` is NOT implied by measure_kind and cuts both ways: 1,358 rows are
        // measure_kind='grant' AND is_aggregate — $12.06bn of grant-shaped aggregates — while 330
        // expenditure_aggregate rows are is_aggregate=false. Neither column is a superset of the
        // other, so both are required. Nationally this is the difference between $38.01bn and
        // $33.98bn; on the youth-justice theme it moves $1,044.8m to $1,044.2m.
        .not('is_aggregate', 'is', true)
        .contains('topics', [topic])
        .range(from, from + PAGE - 1);
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
  // Resolve internal ids to the public `gs_id` used by /entity/[gsId]. Chunked: a 1,274-org theme
  // would otherwise build a URL longer than PostgREST accepts.
  for (let i = 0; i < entityIds.length; i += 200) {
    const chunk = entityIds.slice(i, i + 200);
    try {
      const { data } = await supabase.from('gs_entities').select('id,gs_id').in('id', chunk);
      for (const e of (data ?? []) as { id: string; gs_id: string }[]) {
        gsIdByEntityId.set(e.id, e.gs_id);
      }
    } catch {
      // A failed chunk costs links, not numbers. The names still render.
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
    top,
  };
}

export function money(n: number): string {
  if (n >= 1e9) return `$${(n / 1e9).toFixed(2)}bn`;
  if (n >= 1e6) return `$${(n / 1e6).toFixed(1)}m`;
  if (n >= 1e3) return `$${Math.round(n / 1e3)}k`;
  return `$${Math.round(n)}`;
}
