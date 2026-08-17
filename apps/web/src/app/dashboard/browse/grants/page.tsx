import type { Metadata } from 'next';
import { unstable_cache } from 'next/cache';
import { getDirectServiceSupabase } from '@/lib/supabase';
import { retryRpc } from '@/lib/rpc-retry';
import GrantBrowser, { type RecipientRow } from './GrantBrowser';

export const dynamic = 'force-dynamic';
export const metadata: Metadata = { title: 'Grant recipients — CivicGraph' };

const stats = unstable_cache(
  async () => {
    const supabase = getDirectServiceSupabase();
    const { data } = await supabase.rpc('grant_browse_stats');
    return data as {
      kept_rows: number;
      kept_dollars: number;
      excluded_rows: number;
      untagged_rows: number;
      untagged_dollars: number;
      states: { state: string; rows: number; dollars: number }[];
    } | null;
  },
  // Key is versioned: the cached VALUE's shape changed when coverage fields were added, and the
  // old entry has no `states`, so the disclosure would silently not render until it expired.
  ['grant-browse-stats-v2'],
  { revalidate: 3600 },
);

/** Grant recipients browser over justice_funding, mandatory filters baked into the RPC. */
export default async function GrantsBrowsePage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const sp = await searchParams;
  const q = typeof sp.q === 'string' ? sp.q.trim() : '';
  const state = typeof sp.state === 'string' ? sp.state : '';
  const topic = typeof sp.topic === 'string' ? sp.topic : '';
  const sort = typeof sp.sort === 'string' && sp.sort ? sp.sort : 'total';

  const supabase = getDirectServiceSupabase();
  let rows: RecipientRow[] = [];
  let statsLine = '';
  let coverageLine = '';
  let topicLine = '';
  let why: string | null = null;
  try {
    const [{ data, error }, s] = await Promise.all([
      retryRpc(() =>
        supabase.rpc('grant_recipient_browse', {
          p_q: q || null,
          p_state: state || null,
          p_topic: topic || null,
          p_sort: sort,
          p_limit: 200,
        }),
      ),
      stats(),
    ]);
    if (error) throw new Error(error.message);
    rows = ((data ?? []) as {
      recipient_key: string;
      recipient_name: string;
      recipient_abn: string | null;
      grant_count: number;
      total_dollars: number | null;
      states: string[] | null;
      first_year: string | null;
      last_year: string | null;
    }[]).map((r) => ({
      key: r.recipient_key,
      name: r.recipient_name,
      abn: r.recipient_abn,
      grants: r.grant_count,
      dollars: r.total_dollars,
      states: r.states,
      // UX audit pass 2, F9: financial years already contain a dash ("2008-09"), so joining them
      // with another one produced "2008-09-2024-25", which reads as one long number. An arrow
      // separates the two years unambiguously.
      span:
        r.first_year && r.last_year
          ? r.first_year === r.last_year
            ? r.first_year
            : `${r.first_year} → ${r.last_year}`
          : '—',
    }));
    if (s) {
      statsLine = `${s.kept_rows.toLocaleString('en-AU')} grants worth $${(s.kept_dollars / 1e9).toFixed(1)}bn after the filters · ${s.excluded_rows.toLocaleString('en-AU')} rows excluded (budget aggregates, spreadsheet totals, non-organisation names)`;

      // F1 + F2 (UX audit pass 2). Both numbers come from the RPC so they cannot rot into stale
      // prose. The skew is the single most misleading thing on this screen: a reader comparing
      // states here would conclude Victoria barely funds justice, when what is actually thin is
      // our Victorian coverage.
      const top = s.states?.[0];
      if (top && s.kept_dollars > 0) {
        const topRowPct = Math.round((top.rows / s.kept_rows) * 100);
        const vic = s.states.find((x) => x.state === 'VIC');
        coverageLine =
          `Coverage is uneven, and this is about our sources rather than about the states: ` +
          `${topRowPct}% of these rows are ${top.state} ($${(top.dollars / 1e9).toFixed(1)}bn of ` +
          `$${(s.kept_dollars / 1e9).toFixed(1)}bn)` +
          (vic ? `, while Victoria shows $${(vic.dollars / 1e6).toFixed(0)}m` : '') +
          `. Do not read this screen as a comparison between states.`;
      }
      if (s.untagged_dollars > 0 && s.kept_dollars > 0) {
        const untaggedPct = Math.round((s.untagged_dollars / s.kept_dollars) * 100);
        topicLine =
          `${untaggedPct}% of this money ($${(s.untagged_dollars / 1e9).toFixed(1)}bn across ` +
          `${s.untagged_rows.toLocaleString('en-AU')} grants) carries no topic tag. The list is ` +
          `everything in the source registers, which includes programs that are not justice ` +
          `funding — the largest single recipient is a state rail operator. Use the topic chips ` +
          `to narrow to tagged money.`;
      }
    }
  } catch (e) {
    why = e instanceof Error ? e.message : String(e);
  }

  return (
    <div className="mx-auto max-w-[1180px] px-6 py-6">
      <h1 className="font-display text-[22px] font-extrabold">Grant recipients</h1>
      {why ? (
        <p className="mt-4 text-[13px]" style={{ color: '#D02020' }}>The list could not be read: {why}</p>
      ) : (
        <GrantBrowser
          rows={rows}
          q={q}
          state={state}
          topic={topic}
          sort={sort}
          statsLine={statsLine}
          coverageLine={coverageLine}
          topicLine={topicLine}
          caveat="Grants only: state budget aggregates and source-spreadsheet total rows are excluded in the query itself. Recipients are grouped by name — the same organisation under two spellings appears twice."
        />
      )}
    </div>
  );
}
