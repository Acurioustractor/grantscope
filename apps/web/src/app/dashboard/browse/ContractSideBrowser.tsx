'use client';

import { useState } from 'react';
import Link from 'next/link';

/**
 * Shared browser for the two sides of AusTender: suppliers (who wins contracts) and buyers
 * (which agencies let them). Rollups and the from-year floor are computed in the RPC — the
 * 824K-row table is never paginated raw into the UI.
 */

export interface SideRow {
  key: string;
  name: string;
  abn: string | null;
  contracts: number;
  value: number | null;
  counterparties: number;
  topCounterparty: string | null;
}

export interface SideConfig {
  side: 'supplier' | 'buyer' | 'donor';
  basePath: string;
  counterpartyLabel: string; // 'Buyers' | 'Suppliers' | 'Recipients'
  detailApi: string;
  /** What one row in the drawer's list is: 'contract' (default) or 'donation'. */
  itemLabel?: string;
  /** Since-floor chips; calendar years for contracts, financial years for donations. */
  yearOptions?: string[];
}

interface SideDetail {
  name: string;
  abn: string | null;
  contract_count: number;
  total_value: number | null;
  counterparties: { name: string; value: number | null; contracts: number }[];
  contracts: { title: string | null; counterparty: string | null; value: number | null; start: string | null; end: string | null }[];
}

function money(n: number | null | undefined): string {
  if (!n || n <= 0) return '—';
  if (n >= 1e9) return `$${(n / 1e9).toFixed(1)}bn`;
  if (n >= 1e6) return `$${(n / 1e6).toFixed(1)}m`;
  return `$${Math.round(n / 1e3)}k`;
}

const SORTS: [string, string][] = [
  ['total', 'Total $'],
  ['contracts', 'Contracts'],
  ['name', 'A–Z'],
];
const DEFAULT_YEARS = ['2015', '2020', '2023'];

function L({ children }: { children: React.ReactNode }) {
  return (
    <div className="mt-4 mb-1 font-mono text-[10px] font-black uppercase tracking-widest" style={{ color: 'var(--shell-muted)' }}>
      {children}
    </div>
  );
}

export default function ContractSideBrowser({
  rows,
  cfg,
  q,
  fromYear,
  sort,
  statsLine,
  caveat,
}: {
  rows: SideRow[];
  cfg: SideConfig;
  q: string;
  fromYear: string;
  sort: string;
  statsLine: string;
  caveat: string;
}) {
  const [openKey, setOpenKey] = useState<string | null>(null);
  const [detail, setDetail] = useState<SideDetail | null>(null);
  const [err, setErr] = useState<string | null>(null);

  function open(key: string) {
    setOpenKey(key);
    setDetail(null);
    setErr(null);
    fetch(`${cfg.detailApi}?key=${encodeURIComponent(key)}&from=${encodeURIComponent(fromYear || '2020')}`)
      .then(async (r) => {
        if (!r.ok) throw new Error((await r.json())?.error ?? `HTTP ${r.status}`);
        return r.json() as Promise<SideDetail>;
      })
      .then(setDetail)
      .catch((e) => setErr(e instanceof Error ? e.message : String(e)));
  }

  const qs = (over: Record<string, string>) => {
    const p = new URLSearchParams();
    for (const [k, v] of Object.entries({ q, from: fromYear, sort, ...over })) if (v) p.set(k, v);
    const s = p.toString();
    return `${cfg.basePath}${s ? `?${s}` : ''}`;
  };

  return (
    <>
      <p className="mt-1 font-mono text-[11.5px]" style={{ color: 'var(--shell-muted)' }}>
        {statsLine}
      </p>
      <form className="mt-3" action={cfg.basePath}>
        <input
          name="q"
          defaultValue={q}
          placeholder="Search by name…"
          className="w-full max-w-[360px] bg-white px-3 py-2 font-mono text-[13px] shell-control"
        />
        {fromYear ? <input type="hidden" name="from" value={fromYear} /> : null}
        {sort ? <input type="hidden" name="sort" value={sort} /> : null}
      </form>
      <div className="mt-2 flex flex-wrap items-center gap-1.5">
        <span className="font-mono text-[10px] uppercase tracking-widest" style={{ color: 'var(--shell-muted)' }}>since</span>
        {(cfg.yearOptions ?? DEFAULT_YEARS).map((y) => (
          <Link key={y} href={qs({ from: y })} className="px-2 py-1 font-mono text-[10px] font-black uppercase tracking-widest shell-control" style={(fromYear || (cfg.yearOptions ?? DEFAULT_YEARS)[1]) === y ? { background: '#121212', color: '#F4F4F2' } : { background: '#FFF' }}>
            {y}
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
          <span className="flex-1">Name</span>
          <span className="w-[220px]">Top {cfg.counterpartyLabel.toLowerCase().replace(/s$/, '')}</span>
          <span className="w-[72px] text-right">{cfg.counterpartyLabel}</span>
          <span className="w-[76px] text-right">{(cfg.itemLabel ?? 'contract') === 'donation' ? 'Donations' : 'Contracts'}</span>
          <span className="w-[92px] text-right">Total $</span>
        </div>
        {rows.map((r) => (
          <button key={r.key} onClick={() => open(r.key)} className="flex w-full items-baseline gap-3 px-4 py-2 text-left hover:bg-[#FAFAF8]" style={{ borderBottom: '1px solid var(--shell-line)' }}>
            <span className="min-w-0 flex-1 truncate text-[13.5px] font-semibold" style={{ color: '#1040C0' }}>{r.name}</span>
            <span className="w-[220px] shrink-0 truncate font-mono text-[11px]" style={{ color: 'var(--shell-muted)' }}>{r.topCounterparty ?? '—'}</span>
            <span className="w-[72px] shrink-0 text-right font-mono text-[12.5px]">{r.counterparties}</span>
            <span className="w-[76px] shrink-0 text-right font-mono text-[12.5px]">{r.contracts.toLocaleString('en-AU')}</span>
            <span className="w-[92px] shrink-0 text-right font-mono text-[12.5px]">{money(r.value)}</span>
          </button>
        ))}
      </div>
      <p className="mt-2 font-mono text-[11px]" style={{ color: 'var(--shell-muted)' }}>
        {caveat}
      </p>

      {openKey ? (
        <aside className="fixed inset-y-0 right-0 z-40 w-full max-w-[460px] overflow-y-auto border-l bg-white p-5" style={{ borderColor: 'var(--shell-line)', boxShadow: '-8px 0 24px rgba(0,0,0,0.08)' }}>
          <div className="flex items-start justify-between gap-3">
            <h2 className="font-display text-[17px] font-extrabold">{detail?.name ?? 'loading…'}</h2>
            <button onClick={() => setOpenKey(null)} aria-label="close" className="shrink-0 px-2 py-0.5 font-mono text-[11px] font-black shell-control">✕</button>
          </div>
          {err ? <p className="mt-3 text-[13px]" style={{ color: '#D02020' }}>Could not load: {err}</p> : null}
          {detail ? (
            <>
              <p className="mt-1 text-[12.5px]" style={{ color: 'var(--shell-muted)' }}>
                {detail.abn ? `ABN ${detail.abn} · ` : ''}
                {detail.contract_count.toLocaleString('en-AU')} {(cfg.itemLabel ?? 'contract')}s since {fromYear || (cfg.yearOptions ?? DEFAULT_YEARS)[1]} · {money(detail.total_value)}
              </p>

              {detail.counterparties.length > 0 ? (
                <>
                  <L>{cfg.counterpartyLabel}</L>
                  <table className="w-full text-right font-mono text-[11.5px]">
                    <tbody>
                      {detail.counterparties.map((c, i) => (
                        <tr key={i} style={{ borderTop: '1px solid var(--shell-line)' }}>
                          <td className="max-w-[220px] truncate py-0.5 text-left">{c.name}</td>
                          <td>{c.contracts}</td>
                          <td>{money(c.value)}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </>
              ) : null}

              {detail.contracts.length > 0 ? (
                <>
                  <L>Largest {(cfg.itemLabel ?? 'contract') + 's'}</L>
                  <div className="flex flex-col gap-1.5">
                    {detail.contracts.slice(0, 25).map((g, i) => (
                      <div key={i} className="text-[12px]" style={{ borderTop: i ? '1px solid var(--shell-line)' : undefined, paddingTop: i ? 6 : 0 }}>
                        <div className="flex items-baseline justify-between gap-3">
                          <span className="min-w-0 truncate font-semibold">{g.title ?? 'untitled contract'}</span>
                          <span className="shrink-0 font-mono text-[11.5px]">{money(g.value)}</span>
                        </div>
                        <div className="font-mono text-[10.5px]" style={{ color: 'var(--shell-muted)' }}>
                          {[g.counterparty, g.start?.slice(0, 10), g.end ? `to ${g.end.slice(0, 10)}` : null].filter(Boolean).join(' · ')}
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
