'use client';

import Link from 'next/link';
import { money, L, makeQs, useDrawer, Drawer, SortHeader } from './browse-ui';

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
  /** RPC sort key for the counterparty-count column ('buyers' | 'suppliers' | 'recipients'). */
  counterpartySortKey: string;
}

interface SideDetail {
  name: string;
  abn: string | null;
  contract_count: number;
  total_value: number | null;
  counterparties: { name: string; value: number | null; contracts: number }[];
  contracts: { title: string | null; counterparty: string | null; value: number | null; start: string | null; end: string | null }[];
}

const DEFAULT_YEARS = ['2015', '2020', '2023'];

export default function ContractSideBrowser({
  rows,
  cfg,
  q,
  fromYear,
  sort,
  dir = '',
  statsLine,
  caveat,
}: {
  rows: SideRow[];
  cfg: SideConfig;
  q: string;
  fromYear: string;
  sort: string;
  /** 'asc' | 'desc' | '' (natural) */
  dir?: string;
  statsLine: string;
  caveat: string;
}) {
  const drawer = useDrawer<SideDetail>();
  const detail = drawer.detail;
  const open = (key: string) =>
    drawer.open(key, `${cfg.detailApi}?key=${encodeURIComponent(key)}&from=${encodeURIComponent(fromYear || '2020')}`);
  const qs = makeQs(cfg.basePath, { q, from: fromYear, sort, dir });
  /** Name normalisation folds spellings together, but one name can still be several declared
   *  ABNs — three Pratt Holdings Pty Ltd rows, three real ABNs. Where the name alone cannot
   *  tell two rows apart, show the ABN that does. */
  const display = (n: string) => n.replace(/\s+/g, ' ').trim();
  const sharedNames = new Set(
    rows.map((r) => display(r.name)).filter((n, i, all) => all.indexOf(n) !== i),
  );

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
        {dir ? <input type="hidden" name="dir" value={dir} /> : null}
      </form>
      <div className="mt-2 flex flex-wrap items-center gap-1.5">
        <span className="font-mono text-[10px] uppercase tracking-widest" style={{ color: 'var(--shell-muted)' }}>since</span>
        {(cfg.yearOptions ?? DEFAULT_YEARS).map((y) => (
          <Link key={y} href={qs({ from: y })} className="px-2 py-1 font-mono text-[10px] font-black uppercase tracking-widest shell-control" style={(fromYear || (cfg.yearOptions ?? DEFAULT_YEARS)[1]) === y ? { background: '#121212', color: '#F4F4F2' } : { background: '#FFF' }}>
            {y}
          </Link>
        ))}
      </div>

      <div className="mt-4 shell-card">
        <div className="flex items-baseline gap-3 px-4 py-2 font-mono text-[10px] font-black uppercase tracking-widest" style={{ borderBottom: '1px solid var(--shell-line)', color: 'var(--shell-muted)' }}>
          <SortHeader label="Name" sortKey="name" current={sort} dir={dir} qs={qs} />
          <span className="w-[220px] shrink-0">Top {cfg.counterpartyLabel.toLowerCase().replace(/s$/, '')}</span>
          <SortHeader label={cfg.counterpartyLabel} sortKey={cfg.counterpartySortKey} current={sort} dir={dir} qs={qs} width="w-[72px]" align="right" />
          <SortHeader label={(cfg.itemLabel ?? 'contract') === 'donation' ? 'Donations' : 'Contracts'} sortKey="contracts" current={sort} dir={dir} qs={qs} width="w-[76px]" align="right" />
          <SortHeader label="Total $" sortKey="total" current={sort} dir={dir} qs={qs} width="w-[92px]" align="right" />
        </div>
        {rows.map((r) => (
          <button key={r.key} onClick={() => open(r.key)} className="flex w-full items-baseline gap-3 px-4 py-2 text-left hover:bg-[#FAFAF8]" style={{ borderBottom: '1px solid var(--shell-line)' }}>
            <span className="flex min-w-0 flex-1 items-baseline gap-2">
              <span className="min-w-0 truncate text-[13.5px] font-semibold" style={{ color: '#1040C0' }}>{display(r.name)}</span>
              {sharedNames.has(display(r.name)) && r.abn ? (
                <span className="shrink-0 font-mono text-[10.5px]" style={{ color: 'var(--shell-muted)' }}>
                  ABN {r.abn}
                </span>
              ) : null}
            </span>
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

      {drawer.openKey ? (
        <Drawer title={detail?.name ?? 'loading…'} err={drawer.err} onClose={drawer.close}>
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
        </Drawer>
      ) : null}
    </>
  );
}
