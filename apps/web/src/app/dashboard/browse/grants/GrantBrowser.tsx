'use client';

import { useState } from 'react';
import Link from 'next/link';

/**
 * Grants browser: recipients of justice_funding as entity-shaped rollups, the individual grants
 * inside the drawer. The mandatory money filters live in the RPC SQL — this component never
 * computes a total itself.
 */

export interface RecipientRow {
  key: string;
  name: string;
  abn: string | null;
  grants: number;
  dollars: number | null;
  states: string[] | null;
  span: string;
}

interface RecipientDetail {
  recipient_name: string;
  recipient_abn: string | null;
  grant_count: number;
  total_dollars: number | null;
  by_year: { year: string; dollars: number | null; grants: number }[];
  grants: { program: string | null; year: string | null; amount: number | null; state: string | null; topics: string[] | null }[];
}

function money(n: number | null | undefined): string {
  if (!n || n <= 0) return '—';
  if (n >= 1e9) return `$${(n / 1e9).toFixed(1)}bn`;
  if (n >= 1e6) return `$${(n / 1e6).toFixed(1)}m`;
  return `$${Math.round(n / 1e3)}k`;
}

const SORTS: [string, string][] = [
  ['total', 'Total $'],
  ['grants', 'Grant count'],
  ['name', 'A–Z'],
];
const STATES = ['NSW', 'VIC', 'QLD', 'WA', 'SA', 'TAS', 'NT', 'ACT', 'FED'];
const TOPICS = ['child-protection', 'family-services', 'youth-justice', 'indigenous', 'community-led', 'diversion'];

function L({ children }: { children: React.ReactNode }) {
  return (
    <div className="mt-4 mb-1 font-mono text-[10px] font-black uppercase tracking-widest" style={{ color: 'var(--shell-muted)' }}>
      {children}
    </div>
  );
}

export default function GrantBrowser({
  rows,
  q,
  state,
  topic,
  sort,
  statsLine,
  caveat,
}: {
  rows: RecipientRow[];
  q: string;
  state: string;
  topic: string;
  sort: string;
  statsLine: string;
  caveat: string;
}) {
  const [openKey, setOpenKey] = useState<string | null>(null);
  const [detail, setDetail] = useState<RecipientDetail | null>(null);
  const [err, setErr] = useState<string | null>(null);

  function open(key: string) {
    setOpenKey(key);
    setDetail(null);
    setErr(null);
    fetch(`/api/browse/grant-recipient?key=${encodeURIComponent(key)}`)
      .then(async (r) => {
        if (!r.ok) throw new Error((await r.json())?.error ?? `HTTP ${r.status}`);
        return r.json() as Promise<RecipientDetail>;
      })
      .then(setDetail)
      .catch((e) => setErr(e instanceof Error ? e.message : String(e)));
  }

  const qs = (over: Record<string, string>) => {
    const p = new URLSearchParams();
    for (const [k, v] of Object.entries({ q, state, topic, sort, ...over })) if (v) p.set(k, v);
    const s = p.toString();
    return `/dashboard/browse/grants${s ? `?${s}` : ''}`;
  };

  return (
    <>
      <p className="mt-1 font-mono text-[11.5px]" style={{ color: 'var(--shell-muted)' }}>
        {statsLine}
      </p>
      <form className="mt-3" action="/dashboard/browse/grants">
        <input
          name="q"
          defaultValue={q}
          placeholder="Search recipients…"
          className="w-full max-w-[360px] bg-white px-3 py-2 font-mono text-[13px] shell-control"
        />
        {state ? <input type="hidden" name="state" value={state} /> : null}
        {topic ? <input type="hidden" name="topic" value={topic} /> : null}
        {sort ? <input type="hidden" name="sort" value={sort} /> : null}
      </form>
      <div className="mt-2 flex flex-wrap items-center gap-1.5">
        <Link href={qs({ state: '' })} className="px-2 py-1 font-mono text-[10px] font-black uppercase tracking-widest shell-control" style={state === '' ? { background: '#121212', color: '#F4F4F2' } : { background: '#FFF' }}>
          All states
        </Link>
        {STATES.map((s) => (
          <Link key={s} href={qs({ state: s })} className="px-2 py-1 font-mono text-[10px] font-black uppercase tracking-widest shell-control" style={state === s ? { background: '#121212', color: '#F4F4F2' } : { background: '#FFF' }}>
            {s}
          </Link>
        ))}
      </div>
      <div className="mt-1.5 flex flex-wrap items-center gap-1.5">
        {TOPICS.map((t) => (
          <Link key={t} href={qs({ topic: topic === t ? '' : t })} className="px-2 py-1 font-mono text-[10px] font-black uppercase tracking-widest shell-control" style={topic === t ? { background: '#121212', color: '#F4F4F2' } : { background: '#FFF' }}>
            {t.replace(/-/g, ' ')}
          </Link>
        ))}
        <span className="ml-auto flex items-center gap-1.5">
          {SORTS.map(([v, label]) => (
            <Link key={v} href={qs({ sort: v })} className="px-2 py-1 font-mono text-[10px] font-black uppercase tracking-widest shell-control" style={(sort || 'total') === v ? { background: '#121212', color: '#F4F4F2' } : { background: '#FFF' }}>
              {label}
            </Link>
          ))}
        </span>
      </div>

      <div className="mt-4 shell-card">
        <div className="flex items-baseline gap-3 px-4 py-2 font-mono text-[10px] font-black uppercase tracking-widest" style={{ borderBottom: '1px solid var(--shell-line)', color: 'var(--shell-muted)' }}>
          <span className="flex-1">Recipient</span>
          <span className="w-[110px]">States</span>
          <span className="w-[120px]">Years</span>
          <span className="w-[64px] text-right">Grants</span>
          <span className="w-[92px] text-right">Total $</span>
        </div>
        {rows.map((r) => (
          <button key={r.key} onClick={() => open(r.key)} className="flex w-full items-baseline gap-3 px-4 py-2 text-left hover:bg-[#FAFAF8]" style={{ borderBottom: '1px solid var(--shell-line)' }}>
            <span className="min-w-0 flex-1 truncate text-[13.5px] font-semibold" style={{ color: '#1040C0' }}>{r.name}</span>
            <span className="w-[110px] shrink-0 truncate font-mono text-[11px]" style={{ color: 'var(--shell-muted)' }}>{(r.states ?? []).join(' ')}</span>
            <span className="w-[120px] shrink-0 font-mono text-[11px]" style={{ color: 'var(--shell-muted)' }}>{r.span}</span>
            <span className="w-[64px] shrink-0 text-right font-mono text-[12.5px]">{r.grants}</span>
            <span className="w-[92px] shrink-0 text-right font-mono text-[12.5px]">{money(r.dollars)}</span>
          </button>
        ))}
      </div>
      <p className="mt-2 font-mono text-[11px]" style={{ color: 'var(--shell-muted)' }}>
        {caveat}
      </p>

      {openKey ? (
        <aside className="fixed inset-y-0 right-0 z-40 w-full max-w-[460px] overflow-y-auto border-l bg-white p-5" style={{ borderColor: 'var(--shell-line)', boxShadow: '-8px 0 24px rgba(0,0,0,0.08)' }}>
          <div className="flex items-start justify-between gap-3">
            <h2 className="font-display text-[17px] font-extrabold">{detail?.recipient_name ?? 'loading…'}</h2>
            <button onClick={() => setOpenKey(null)} aria-label="close" className="shrink-0 px-2 py-0.5 font-mono text-[11px] font-black shell-control">✕</button>
          </div>
          {err ? <p className="mt-3 text-[13px]" style={{ color: '#D02020' }}>Could not load: {err}</p> : null}
          {detail ? (
            <>
              <p className="mt-1 text-[12.5px]" style={{ color: 'var(--shell-muted)' }}>
                {detail.recipient_abn ? `ABN ${detail.recipient_abn} · ` : ''}
                {detail.grant_count} grants · {money(detail.total_dollars)}
              </p>

              {detail.by_year.length > 0 ? (
                <>
                  <L>By year</L>
                  <table className="w-full text-right font-mono text-[11.5px]">
                    <tbody>
                      {detail.by_year.map((y) => (
                        <tr key={y.year ?? 'unknown'} style={{ borderTop: '1px solid var(--shell-line)' }}>
                          <td className="py-0.5 text-left">{y.year ?? 'year not recorded'}</td>
                          <td>{y.grants} grants</td>
                          <td>{money(y.dollars)}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </>
              ) : null}

              {detail.grants.length > 0 ? (
                <>
                  <L>Grants{detail.grant_count > detail.grants.length ? ` · largest ${detail.grants.length} of ${detail.grant_count}` : ''}</L>
                  <div className="flex flex-col gap-1.5">
                    {detail.grants.map((g, i) => (
                      <div key={i} className="text-[12px]" style={{ borderTop: i ? '1px solid var(--shell-line)' : undefined, paddingTop: i ? 6 : 0 }}>
                        <div className="flex items-baseline justify-between gap-3">
                          <span className="min-w-0 truncate font-semibold">{g.program ?? 'program not recorded'}</span>
                          <span className="shrink-0 font-mono text-[11.5px]">{money(g.amount)}</span>
                        </div>
                        <div className="font-mono text-[10.5px]" style={{ color: 'var(--shell-muted)' }}>
                          {[g.year, g.state, ...(g.topics ?? [])].filter(Boolean).join(' · ')}
                        </div>
                      </div>
                    ))}
                  </div>
                </>
              ) : null}
            </>
          ) : null}
        </aside>
      ) : null}
    </>
  );
}
