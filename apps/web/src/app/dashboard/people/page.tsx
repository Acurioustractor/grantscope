import type { Metadata } from 'next';
import { unstable_cache } from 'next/cache';
import { getDirectServiceSupabase } from '@/lib/supabase';
import PersonBrowser, { type PersonRow } from './PersonBrowser';

export const dynamic = 'force-dynamic';
export const metadata: Metadata = { title: 'People — CivicGraph' };

const stats = unstable_cache(
  async () => {
    const supabase = getDirectServiceSupabase();
    const { data } = await supabase.rpc('person_browse_stats');
    return data as { total: number; listable: number; nominee_blocked: number; over_cap: number } | null;
  },
  ['person-browse-stats'],
  { revalidate: 3600 },
);

/**
 * People browser off the de-collided identity matview. KNOWN LIMIT, stated on screen: names are
 * string-normalised, so a common name can collapse several real people into one row — the
 * identity lane's job, not this page's. The nominee/board-cap exclusions are stated, not silent.
 */
export default async function PeoplePage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const sp = await searchParams;
  const q = typeof sp.q === 'string' ? sp.q.trim() : '';
  const sort = typeof sp.sort === 'string' && sp.sort ? sp.sort : 'influence';

  const supabase = getDirectServiceSupabase();
  let rows: PersonRow[] = [];
  let statsLine = '';
  let exclusionNote = '';
  let why: string | null = null;
  try {
    const [{ data, error }, s] = await Promise.all([
      supabase.rpc('person_browse', { p_q: q || null, p_sort: sort, p_limit: 200 }),
      stats(),
    ]);
    if (error) throw new Error(error.message);
    rows = ((data ?? []) as {
      identity_key: string;
      person_name: string;
      person_name_normalised: string;
      board_count: number;
      acco_boards: number;
      attributed_procurement: number | null;
      attributed_justice: number | null;
      attributed_donations: number | null;
      financial_system_count: number | null;
    }[]).map((r) => ({
      key: r.identity_key,
      name: r.person_name,
      norm: r.person_name_normalised,
      boards: r.board_count,
      accoBoards: r.acco_boards,
      procurement: r.attributed_procurement,
      justice: r.attributed_justice,
      donations: r.attributed_donations,
      systems: r.financial_system_count,
    }));
    if (s) {
      statsLine = `${s.listable.toLocaleString('en-AU')} people on the graph · showing the top 200 for this search and sort`;
      exclusionNote = `${(s.nominee_blocked + s.over_cap).toLocaleString('en-AU')} identities are excluded on purpose: ${s.nominee_blocked.toLocaleString('en-AU')} professional-trustee/nominee blocks and ${s.over_cap.toLocaleString('en-AU')} with more than 10 boards (the standing cap — above it, "one person" is usually a nominee service). Names are matched by string, so a common name can be several real people; treat rows as leads, not facts. Dollars are attributed: money at shared boards is split between the people on them.`;
    }
  } catch (e) {
    why = e instanceof Error ? e.message : String(e);
  }

  return (
    <div className="mx-auto max-w-[1180px] px-6 py-6">
      <h1 className="font-display text-[22px] font-extrabold">People</h1>
      {why ? (
        <p className="mt-4 text-[13px]" style={{ color: '#D02020' }}>The list could not be read: {why}</p>
      ) : (
        <PersonBrowser rows={rows} q={q} sort={sort} statsLine={statsLine} exclusionNote={exclusionNote} />
      )}
    </div>
  );
}
