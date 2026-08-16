import type { Metadata } from 'next';
import Link from 'next/link';
import { getDirectServiceSupabase } from '@/lib/supabase';

export const dynamic = 'force-dynamic';
export const metadata: Metadata = { title: 'Foundations — CivicGraph' };

/**
 * The simple list Ben asked for (2026-08-17): every foundation, searchable, with its links
 * counted — then click through to one profile holding everything we know. No meta, no lenses,
 * just the thing.
 */

function money(n: number | null): string {
  if (!n) return '—';
  if (n >= 1e9) return `$${(n / 1e9).toFixed(1)}bn`;
  if (n >= 1e6) return `$${(n / 1e6).toFixed(1)}m`;
  return `$${Math.round(n / 1e3)}k`;
}

async function load(q: string | null) {
  const supabase = getDirectServiceSupabase();
  let query = supabase
    .from('foundations')
    .select('id,name,acnc_abn,type,total_giving_annual,thematic_focus')
    .order('total_giving_annual', { ascending: false, nullsFirst: false })
    .limit(200);
  if (q) query = query.ilike('name', `%${q}%`);
  const { data: rows, error } = await query;
  if (error) throw new Error(error.message);
  const ids = (rows ?? []).map((r) => r.id);

  const granteeCounts = new Map<string, number>();
  const boardCounts = new Map<string, number>();
  if (ids.length) {
    const [{ data: g }, { data: b }] = await Promise.all([
      supabase.from('mv_foundation_grantees').select('foundation_id').in('foundation_id', ids).limit(20000),
      supabase.from('funder_board_paths').select('foundation_id').in('foundation_id', ids).limit(20000),
    ]);
    for (const r of (g ?? []) as { foundation_id: string }[])
      granteeCounts.set(r.foundation_id, (granteeCounts.get(r.foundation_id) ?? 0) + 1);
    for (const r of (b ?? []) as { foundation_id: string }[])
      boardCounts.set(r.foundation_id, (boardCounts.get(r.foundation_id) ?? 0) + 1);
  }
  const { count } = await supabase.from('foundations').select('id', { count: 'exact', head: true });
  return { rows: rows ?? [], granteeCounts, boardCounts, total: count ?? 0 };
}

export default async function FoundationsList({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const sp = await searchParams;
  const q = typeof sp.q === 'string' && sp.q.trim() ? sp.q.trim() : null;
  let data: Awaited<ReturnType<typeof load>> | null = null;
  let why: string | null = null;
  try {
    data = await load(q);
  } catch (e) {
    why = e instanceof Error ? e.message : String(e);
  }

  return (
    <div className="mx-auto max-w-[1100px] px-6 py-6">
      <h1 className="font-display text-[22px] font-extrabold">Foundations</h1>
      <p className="mt-1 text-[13.5px]" style={{ color: 'var(--shell-muted)' }}>
        {data ? `${data.total.toLocaleString('en-AU')} giving organisations we can see.` : ''} Type
        to search; click one for everything we know — its giving, who it funds, its people, and
        where it connects. Giving figures come from charity returns and published reports and can
        mix grantmaking with program spend.
      </p>
      <form className="mt-4" action="/dashboard/browse/foundations">
        <input
          name="q"
          defaultValue={q ?? ''}
          placeholder="Search foundations by name…"
          className="w-full max-w-[440px] bg-white px-3 py-2 font-mono text-[13px] shell-control"
        />
      </form>
      {why ? (
        <p className="mt-4 text-[13px]" style={{ color: '#D02020' }}>The list could not be read: {why}</p>
      ) : (
        <div className="mt-4 shell-card">
          <div
            className="flex items-baseline gap-3 px-4 py-2 font-mono text-[10px] font-black uppercase tracking-widest"
            style={{ borderBottom: '1px solid var(--shell-line)', color: 'var(--shell-muted)' }}
          >
            <span className="flex-1">Foundation</span>
            <span className="w-[90px] text-right">Giving / yr</span>
            <span className="w-[90px] text-right">Grantees</span>
            <span className="w-[100px] text-right">Board links</span>
          </div>
          {(data?.rows ?? []).map((f) => (
            <Link
              key={f.id}
              href={`/dashboard/browse/foundations/${f.id}`}
              className="flex items-baseline gap-3 px-4 py-2 hover:bg-[#FAFAF8]"
              style={{ borderBottom: '1px solid var(--shell-line)' }}
            >
              <span className="min-w-0 flex-1 truncate text-[13.5px] font-semibold" style={{ color: '#1040C0' }}>
                {f.name}
              </span>
              <span className="w-[90px] shrink-0 text-right font-mono text-[12.5px]">
                {money(f.total_giving_annual)}
              </span>
              <span className="w-[90px] shrink-0 text-right font-mono text-[12.5px]">
                {data!.granteeCounts.get(f.id) ?? 0}
              </span>
              <span className="w-[100px] shrink-0 text-right font-mono text-[12.5px]">
                {data!.boardCounts.get(f.id) ?? 0}
              </span>
            </Link>
          ))}
          {data && data.rows.length === 0 ? (
            <p className="p-4 font-mono text-[12px]" style={{ color: 'var(--shell-muted)' }}>
              Nothing matches &ldquo;{q}&rdquo;.
            </p>
          ) : null}
        </div>
      )}
      {data && !q ? (
        <p className="mt-2 font-mono text-[11px]" style={{ color: 'var(--shell-muted)' }}>
          showing the 200 largest by recorded giving — search reaches all {data.total.toLocaleString('en-AU')}
        </p>
      ) : null}
    </div>
  );
}
