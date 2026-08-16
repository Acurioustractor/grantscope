import type { Metadata } from 'next';
import Link from 'next/link';
import { getDirectServiceSupabase } from '@/lib/supabase';

export const dynamic = 'force-dynamic';
export const metadata: Metadata = { title: 'Social enterprises — CivicGraph' };

/**
 * The simple list (Ben, 2026-08-17): every social enterprise, searchable, with its cross-system presence
 * counted — click one for its atlas page holding the money, people and network we know.
 * "Systems" = how many public registers the organisation appears in (contracts, grants,
 * donations, charity register, and so on), from the power index.
 */

function money(n: number | null): string {
  if (!n) return '—';
  if (n >= 1e9) return `$${(n / 1e9).toFixed(1)}bn`;
  if (n >= 1e6) return `$${(n / 1e6).toFixed(1)}m`;
  return `$${Math.round(n / 1e3)}k`;
}

async function load(q: string | null) {
  const supabase = getDirectServiceSupabase();
  let query = supabase.from('social_enterprises').select('id,name,abn,sector,state').order('name').limit(200);
  if (q) query = query.ilike('name', `%${q}%`);
  const { data: rows, error } = await query;
  if (error) throw new Error(error.message);
  const abns = [...new Set((rows ?? []).map((r) => r.abn).filter(Boolean))] as string[];
  const power = new Map<string, { gs_id: string; system_count: number; total_dollar_flow: number }>();
  for (let i = 0; i < abns.length; i += 100) {
    const { data } = await supabase
      .from('mv_entity_power_index')
      .select('abn,gs_id,system_count,total_dollar_flow')
      .in('abn', abns.slice(i, i + 100));
    for (const p of (data ?? []) as { abn: string; gs_id: string; system_count: number; total_dollar_flow: number }[]) {
      if (!power.has(p.abn)) power.set(p.abn, p);
    }
  }
  const { count } = await supabase.from('social_enterprises').select('*', { count: 'exact', head: true });
  return { rows: rows ?? [], power, total: count ?? 0 };
}

export default async function ListPage({
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
      <h1 className="font-display text-[22px] font-extrabold">Social enterprises</h1>
      <p className="mt-1 text-[13.5px]" style={{ color: 'var(--shell-muted)' }}>
        {data ? `${data.total.toLocaleString('en-AU')} on the register. ` : ''}The open registry: businesses built to return value to communities. Click through for the money, people and network each one touches.
      </p>
      <form className="mt-4" action="/dashboard/browse/social-enterprises">
        <input
          name="q"
          defaultValue={q ?? ''}
          placeholder="Search by name…"
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
            <span className="flex-1">Name</span>
            <span className="w-[110px]">Sector · state</span>
            <span className="w-[70px] text-right">Systems</span>
            <span className="w-[100px] text-right">Visible $</span>
          </div>
          {(data?.rows ?? []).map((r, i) => {
            const p = r.abn ? data!.power.get(r.abn) : undefined;
            const inner = (
              <>
                <span className="min-w-0 flex-1 truncate text-[13.5px] font-semibold" style={{ color: p ? '#1040C0' : undefined }}>
                  {r.name}
                </span>
                <span className="w-[110px] shrink-0 font-mono text-[11.5px]" style={{ color: 'var(--shell-muted)' }}>
                  {`${r.sector ?? '—'} · ${r.state ?? '—'}`}
                </span>
                <span className="w-[70px] shrink-0 text-right font-mono text-[12.5px]">{p?.system_count ?? '—'}</span>
                <span className="w-[100px] shrink-0 text-right font-mono text-[12.5px]">
                  {p ? money(Number(p.total_dollar_flow)) : '—'}
                </span>
              </>
            );
            return p ? (
              <Link
                key={i}
                href={`/entity/${p.gs_id}`}
                className="flex items-baseline gap-3 px-4 py-2 hover:bg-[#FAFAF8]"
                style={{ borderBottom: '1px solid var(--shell-line)' }}
              >
                {inner}
              </Link>
            ) : (
              <div key={i} className="flex items-baseline gap-3 px-4 py-2" style={{ borderBottom: '1px solid var(--shell-line)' }}>
                {inner}
              </div>
            );
          })}
        </div>
      )}
      {data && !q ? (
        <p className="mt-2 font-mono text-[11px]" style={{ color: 'var(--shell-muted)' }}>
          showing 200 A–Z — search reaches all {data.total.toLocaleString('en-AU')} · a grey row has no graph match yet
        </p>
      ) : null}
    </div>
  );
}
