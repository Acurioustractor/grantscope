import type { Metadata } from 'next';
import { Shell } from '@/components/shell/shell';
import { unstable_cache } from 'next/cache';
import { getDirectServiceSupabase } from '@/lib/supabase';
import { retryRpc } from '@/lib/rpc-retry';
import OrgBrowser, { type OrgRow } from '@/components/browse/OrgBrowser';

export const dynamic = 'force-dynamic';
export const metadata: Metadata = { title: 'Social enterprises — CivicGraph' };

const stats = unstable_cache(
  async () => {
    const supabase = getDirectServiceSupabase();
    const { data } = await supabase.rpc('browse_enrichment_stats');
    return data as Record<string, Record<string, number>> | null;
  },
  ['browse-stats'],
  { revalidate: 3600 },
);

export default async function SEList({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const sp = await searchParams;
  const q = typeof sp.q === 'string' ? sp.q.trim() : '';
  const state = typeof sp.state === 'string' ? sp.state : '';
  const sort = typeof sp.sort === 'string' && sp.sort ? sp.sort : 'known';
  const dir = sp.dir === 'asc' || sp.dir === 'desc' ? sp.dir : '';

  const supabase = getDirectServiceSupabase();
  let rows: OrgRow[] = [];
  let statsLine = '';
  let why: string | null = null;
  try {
    const [{ data, error }, s] = await Promise.all([
      retryRpc(() => supabase.rpc('se_browse', { p_q: q || null, p_state: state || null, p_sort: sort, p_dir: dir || null, p_limit: 200 })),
      stats(),
    ]);
    if (error) throw new Error(error.message);
    rows = ((data ?? []) as { id: string; name: string; abn: string | null; sector: string | null; state: string | null; gs_id: string | null; system_count: number | null; visible_dollars: number | null; known: number; entries: number | null }[]).map((r) => ({
      key: r.id,
      name: r.name,
      abn: r.abn,
      meta: `${(r.sector ?? '—').split(',').slice(0, 2).join(', ')} · ${r.state ?? 'multiple'}`,
      // `entries` > 1 means several register listings share this ABN and were collapsed into one
      // row. Shown beside the name, not in meta, because meta truncates at 190px.
      badge: (r.entries ?? 1) > 1 ? `${r.entries} listings` : undefined,
      gs_id: r.gs_id,
      system_count: r.system_count,
      visible_dollars: r.visible_dollars,
      known: r.known,
    }));
    const se = s?.se;
    statsLine = se
      ? `${se.total.toLocaleString('en-AU')} on the register · ${se.with_abn.toLocaleString('en-AU')} with an ABN we can join on · ${se.on_graph.toLocaleString('en-AU')} matched to the graph · the rest are the finding queue (sort by Least known) · listings sharing one ABN are shown as a single organisation, so the dollars are counted once rather than repeated per branch`
      : '';
  } catch (e) {
    why = e instanceof Error ? e.message : String(e);
  }

  return (
    <Shell title="Social enterprises" activeHref="/social-enterprises">
      <div className="mx-auto max-w-[1180px] px-6 py-6">
        <h1 className="font-display text-[22px] font-extrabold">Social enterprises</h1>
        {why ? (
          <p className="mt-4 text-[13px]" style={{ color: '#D02020' }}>The list could not be read: {why}</p>
        ) : (
          <OrgBrowser
            rows={rows}
            cfg={{
              kind: 'se',
              basePath: '/social-enterprises',
              knownMax: 5,
              knownLegend: 'facts held: ABN, sector, place, web/description, graph match',
              stateFacets: ['NSW', 'VIC', 'QLD', 'WA', 'SA', 'TAS', 'NT', 'ACT'],
              moneyCaveat:
                'Known = facts we hold (ABN, sector, place, web presence, graph match) — a short bar is our gap, not theirs. Dollars attach to the ABN; branches share their parent\u2019s figures.',
            }}
            q={q}
            state={state}
            size=""
            sort={sort} dir={dir}
            statsLine={statsLine}
          />
        )}
      </div>
    </Shell>
  );
}
