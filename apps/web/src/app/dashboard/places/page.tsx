import type { Metadata } from 'next';
import Link from 'next/link';
import { unstable_cache } from 'next/cache';
import { getDirectServiceSupabase } from '@/lib/supabase';

export const metadata: Metadata = { title: 'Places — CivicGraph' };

function money(n: number): string {
  if (n >= 1e9) return `$${(n / 1e9).toFixed(2)}bn`;
  if (n >= 1e6) return `$${(n / 1e6).toFixed(1)}m`;
  return `$${Math.round(n / 1e3)}k`;
}

const load = unstable_cache(
  async () => {
    const supabase = getDirectServiceSupabase();
    const { data, error } = await supabase
      .from('mv_funding_by_postcode')
      .select('postcode,state,remoteness,entity_count,total_funding')
      .order('total_funding', { ascending: false })
      .limit(15);
    if (error) throw new Error(error.message);
    return data ?? [];
  },
  ['dash-places'],
  { revalidate: 3600 },
);

/** Shell-native Places index. The Atlas (public) stays the deep place experience. */
export default async function PlacesIndexPage() {
  let rows: Awaited<ReturnType<typeof load>> = [];
  let why: string | null = null;
  try {
    rows = await load();
  } catch (e) {
    why = e instanceof Error ? e.message : String(e);
  }

  return (
    <div className="mx-auto max-w-[1100px] px-6 py-6">
      <h1 className="font-display text-[22px] font-extrabold">Places</h1>
      <p className="mt-1 text-[13.5px]" style={{ color: 'var(--shell-muted)' }}>
        Where the money lands, by postcode. Place pages and the full Atlas open on the public site.
      </p>
      {why ? (
        <p className="mt-4 text-[13px]" style={{ color: '#D02020' }}>
          Funding by postcode could not be read: {why}
        </p>
      ) : (
        <div
          className="mt-5 bg-white p-4"
          style={{ borderRadius: 'var(--shell-r)', border: '1px solid var(--shell-line)' }}
        >
          <h2 className="font-display text-[14px] font-bold">
            Highest-funded postcodes
            <Link href="/atlas" className="ml-3 text-[12px] font-semibold hover:underline" style={{ color: '#1040C0' }}>
              open the Atlas →
            </Link>
          </h2>
          {rows.map((r, i) => (
            <div
              key={`${r.postcode}-${i}`}
              className="flex items-baseline gap-3 py-2"
              style={{ borderTop: i === 0 ? undefined : '1px solid var(--shell-line)' }}
            >
              <Link
                href={`/places/${r.postcode}`}
                className="shrink-0 font-mono text-[13.5px] font-semibold hover:underline"
                style={{ color: '#1040C0' }}
              >
                {r.postcode}
              </Link>
              <span className="min-w-0 flex-1 truncate text-[12.5px]" style={{ color: 'var(--shell-muted)' }}>
                {r.state ?? '—'} · {r.remoteness ?? 'remoteness unknown'} · {r.entity_count ?? 0} organisations
              </span>
              <span className="shrink-0 font-mono text-[13px]">{money(Number(r.total_funding ?? 0))}</span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
