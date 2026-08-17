import type { Metadata } from 'next';
import { unstable_cache } from 'next/cache';
import { getDirectServiceSupabase } from '@/lib/supabase';
import OrgBrowser, { type OrgRow } from '../OrgBrowser';

export const dynamic = 'force-dynamic';
export const metadata: Metadata = { title: 'Charities — CivicGraph' };

const stats = unstable_cache(
  async () => {
    const supabase = getDirectServiceSupabase();
    const { data } = await supabase.rpc('browse_enrichment_stats');
    return data as Record<string, Record<string, number>> | null;
  },
  ['browse-stats'],
  { revalidate: 3600 },
);

export default async function CharityList({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const sp = await searchParams;
  const q = typeof sp.q === 'string' ? sp.q.trim() : '';
  const state = typeof sp.state === 'string' ? sp.state : '';
  const size = typeof sp.size === 'string' ? sp.size : '';
  const sort = typeof sp.sort === 'string' && sp.sort ? sp.sort : 'known';

  const supabase = getDirectServiceSupabase();
  let rows: OrgRow[] = [];
  let statsLine = '';
  let why: string | null = null;
  try {
    const [{ data, error }, s] = await Promise.all([
      supabase.rpc('charity_browse', { p_q: q || null, p_state: state || null, p_size: size || null, p_sort: sort, p_limit: 200 }),
      stats(),
    ]);
    if (error) throw new Error(error.message);
    rows = ((data ?? []) as { abn: string; name: string; charity_size: string | null; state: string | null; is_foundation: boolean | null; gs_id: string | null; system_count: number | null; visible_dollars: number | null; ais_year: number | null; total_assets: number | null; known: number }[]).map((r) => ({
      key: r.abn,
      name: r.name,
      abn: r.abn,
      meta: `${r.charity_size ?? '—'} · ${r.state ?? '—'}${r.is_foundation ? ' · foundation' : ''}${r.ais_year ? ` · AIS ${r.ais_year}` : ''}`,
      gs_id: r.gs_id,
      system_count: r.system_count,
      visible_dollars: r.visible_dollars,
      known: r.known,
    }));
    const c = s?.charity;
    statsLine = c
      ? `${c.total.toLocaleString('en-AU')} on the ACNC register · all matched to the graph · ${c.with_ais.toLocaleString('en-AU')} with financial returns on file`
      : '';
  } catch (e) {
    why = e instanceof Error ? e.message : String(e);
  }

  return (
    <div className="mx-auto max-w-[1180px] px-6 py-6">
      <h1 className="font-display text-[22px] font-extrabold">Charities</h1>
      {why ? (
        <p className="mt-4 text-[13px]" style={{ color: '#D02020' }}>The list could not be read: {why}</p>
      ) : (
        <OrgBrowser
          rows={rows}
          cfg={{
            kind: 'charity',
            basePath: '/dashboard/browse/charities',
            knownMax: 5,
            knownLegend: 'facts held: size, state, graph match, financial return, visible money',
            stateFacets: ['NSW', 'VIC', 'QLD', 'WA', 'SA', 'TAS', 'NT', 'ACT'],
            sizeFacets: ['Small', 'Medium', 'Large'],
            moneyCaveat:
              'Known = facts we hold (size, state, graph match, financial return, visible money) — a short bar is our gap, not theirs.',
          }}
          q={q}
          state={state}
          size={size}
          sort={sort}
          statsLine={statsLine}
        />
      )}
    </div>
  );
}
