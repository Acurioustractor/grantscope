import type { Metadata } from 'next';
import Link from 'next/link';
import { unstable_cache } from 'next/cache';
import { getDirectServiceSupabase } from '@/lib/supabase';

export const metadata: Metadata = { title: 'Entities — CivicGraph' };

function money(n: number): string {
  if (n >= 1e9) return `$${(n / 1e9).toFixed(2)}bn`;
  if (n >= 1e6) return `$${(n / 1e6).toFixed(1)}m`;
  return `$${Math.round(n / 1e3)}k`;
}

const load = unstable_cache(
  async () => {
    const supabase = getDirectServiceSupabase();
    const [{ count }, { data: top, error }] = await Promise.all([
      supabase.from('gs_entities').select('id', { count: 'estimated', head: true }),
      supabase
        .from('mv_entity_power_index')
        .select('gs_id,canonical_name,entity_type,system_count,total_dollar_flow,power_score')
        .order('power_score', { ascending: false })
        .limit(15),
    ]);
    if (error) throw new Error(error.message);
    return { count: count ?? null, top: top ?? [] };
  },
  ['dash-entities'],
  { revalidate: 3600 },
);

/** Shell-native Entities index. Entity detail pages remain the public atlas for now. */
export default async function EntitiesPage() {
  let data: Awaited<ReturnType<typeof load>> | null = null;
  let why: string | null = null;
  try {
    data = await load();
  } catch (e) {
    why = e instanceof Error ? e.message : String(e);
  }

  return (
    <div className="mx-auto max-w-[1100px] px-6 py-6">
      <h1 className="font-display text-[22px] font-extrabold">Entities</h1>
      <p className="mt-1 text-[13.5px]" style={{ color: 'var(--shell-muted)' }}>
        {data?.count ? `~${data.count.toLocaleString('en-AU')} organisations and people on the graph. ` : ''}
        Search with ⌘K, or start from the most cross-system-present entities below. Entity pages
        open on the public atlas.
      </p>
      {why ? (
        <p className="mt-4 text-[13px]" style={{ color: '#D02020' }}>
          The power index could not be read: {why}
        </p>
      ) : (
        <div
          className="mt-5 bg-white p-4"
          style={{ borderRadius: 'var(--shell-r)', border: '1px solid var(--shell-line)' }}
        >
          <h2 className="font-display text-[14px] font-bold">
            Most present across systems
            <span className="ml-2 font-mono text-[10px] font-normal uppercase" style={{ color: 'var(--shell-muted)' }}>
              power index · grants filtered clean
            </span>
          </h2>
          {(data?.top ?? []).map((e, i) => (
            <div
              key={e.gs_id ?? i}
              className="flex items-baseline gap-3 py-2"
              style={{ borderTop: i === 0 ? undefined : '1px solid var(--shell-line)' }}
            >
              <Link
                href={`/entity/${e.gs_id}`}
                className="min-w-0 flex-1 truncate text-[13.5px] font-semibold hover:underline"
                style={{ color: '#1040C0' }}
              >
                {e.canonical_name}
              </Link>
              <span className="shrink-0 text-[11.5px]" style={{ color: 'var(--shell-muted)' }}>
                {e.entity_type ?? '—'} · {e.system_count} systems
              </span>
              <span className="shrink-0 font-mono text-[13px]">{money(Number(e.total_dollar_flow ?? 0))}</span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
