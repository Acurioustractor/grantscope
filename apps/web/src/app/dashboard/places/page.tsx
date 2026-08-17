import type { Metadata } from 'next';
import { unstable_cache } from 'next/cache';
import { getDirectServiceSupabase } from '@/lib/supabase';
import PlaceBrowser, { type PlaceRow } from './PlaceBrowser';

export const dynamic = 'force-dynamic';
export const metadata: Metadata = { title: 'Places — CivicGraph' };

const stats = unstable_cache(
  async () => {
    const supabase = getDirectServiceSupabase();
    const { data } = await supabase.rpc('place_browse_stats');
    return data as { lgas: number; entities_placed: number; unplaced_with_postcode: number; no_postcode: number } | null;
  },
  ['place-browse-stats'],
  { revalidate: 3600 },
);

/** Places browser at LGA (council area) grain, with placement provenance in the drawer. */
export default async function PlacesPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const sp = await searchParams;
  const q = typeof sp.q === 'string' ? sp.q.trim() : '';
  const state = typeof sp.state === 'string' ? sp.state : '';
  const sort = typeof sp.sort === 'string' && sp.sort ? sp.sort : 'funding';

  const supabase = getDirectServiceSupabase();
  let rows: PlaceRow[] = [];
  let statsLine = '';
  let why: string | null = null;
  try {
    const [{ data, error }, s] = await Promise.all([
      supabase.rpc('place_browse', { p_q: q || null, p_state: state || null, p_sort: sort, p_limit: 200 }),
      stats(),
    ]);
    if (error) throw new Error(error.message);
    rows = ((data ?? []) as {
      lga_name: string;
      state: string;
      entity_count: number;
      community_controlled_count: number;
      total_funding: number | null;
      avg_seifa_decile: number | null;
      remoteness: string | null;
      desert_score: number | null;
    }[]).map((r) => ({
      key: `${r.lga_name}|${r.state}`,
      lga: r.lga_name,
      state: r.state,
      entities: r.entity_count,
      acco: r.community_controlled_count,
      funding: r.total_funding,
      seifa: r.avg_seifa_decile,
      remoteness: r.remoteness,
      desert: r.desert_score,
    }));
    if (s) {
      statsLine = `${s.lgas.toLocaleString('en-AU')} council areas · ${s.entities_placed.toLocaleString('en-AU')} organisations placed · ${s.unplaced_with_postcode.toLocaleString('en-AU')} deliberately unplaced with a reason code · ${s.no_postcode.toLocaleString('en-AU')} with no postcode on record`;
    }
  } catch (e) {
    why = e instanceof Error ? e.message : String(e);
  }

  return (
    <div className="mx-auto max-w-[1180px] px-6 py-6">
      <h1 className="font-display text-[22px] font-extrabold">Places</h1>
      {why ? (
        <p className="mt-4 text-[13px]" style={{ color: '#D02020' }}>The list could not be read: {why}</p>
      ) : (
        <PlaceBrowser
          rows={rows}
          q={q}
          state={state}
          sort={sort}
          statsLine={statsLine}
          caveat="Funding attaches to an organisation's address, so head-office council areas collect their branches' figures. SEIFA decile 1 = most disadvantaged. Desert score compares disadvantage with money reaching the area — higher means more disadvantage and less money; metro councils sit around 50–70, and the extreme tail runs past 150."
        />
      )}
    </div>
  );
}
