import type { Metadata } from 'next';
import { Shell } from '@/components/shell/shell';
import { getDirectServiceSupabase } from '@/lib/supabase';
import FoundationsBrowser, { type BrowseRow } from '@/components/browse/FoundationsBrowser';

export const dynamic = 'force-dynamic';
export const metadata: Metadata = { title: 'Foundations — CivicGraph' };

/**
 * The foundations list, served by the foundation_browse RPC: search + type filter + sort with
 * grantee/board counts and latest ACNC financials computed in the database (the client-side
 * count join failed silently on long IN batches — never again). The browser component owns the
 * drawer; every filter/sort state is a shareable URL.
 */
export default async function FoundationsList({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const sp = await searchParams;
  const q = typeof sp.q === 'string' ? sp.q.trim() : '';
  const type = typeof sp.type === 'string' ? sp.type : '';
  const sort = typeof sp.sort === 'string' && sp.sort ? sp.sort : 'giving';

  const supabase = getDirectServiceSupabase();
  let rows: BrowseRow[] = [];
  let total = 0;
  let why: string | null = null;
  try {
    const [{ data, error }, { count }] = await Promise.all([
      supabase.rpc('foundation_browse', {
        p_q: q || null,
        p_type: type || null,
        p_sort: sort,
        p_limit: 200,
      }),
      supabase.from('foundations').select('id', { count: 'exact', head: true }),
    ]);
    if (error) throw new Error(error.message);
    rows = (data ?? []) as BrowseRow[];
    total = count ?? 0;
  } catch (e) {
    why = e instanceof Error ? e.message : String(e);
  }

  return (
    <Shell title="Foundations" activeHref="/foundations">
      <div className="mx-auto max-w-[1180px] px-6 py-6">
        <h1 className="font-display text-[22px] font-extrabold">Foundations</h1>
        <p className="mt-1 max-w-[90ch] text-[13.5px]" style={{ color: 'var(--shell-muted)' }}>
          Every giving organisation we can see. Click a row for the full picture in place — what it
          holds, what it actually granted (ACNC returns), who it funds, its people and where money
          travels through intermediaries.
        </p>
        {why ? (
          <p className="mt-4 text-[13px]" style={{ color: '#D02020' }}>
            The list could not be read: {why}. Nothing is estimated in its place.
          </p>
        ) : (
          <FoundationsBrowser rows={rows} q={q} type={type} sort={sort} total={total} />
        )}
      </div>
    </Shell>
  );
}
