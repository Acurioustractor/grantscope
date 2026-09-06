'use client';

import { useState } from 'react';
import Link from 'next/link';
import { SortHeader } from './browse-ui';

/**
 * Shared browser for SE and charity lists: known-ness dots per row (facts we hold — a low score
 * is a finding queue, not a judgement), filters and five sorts as shareable URLs, and a drawer
 * with the record, six years of ACNC financials, cross-system money and the people on record.
 */

export interface OrgRow {
  key: string; // abn or id
  name: string;
  abn: string | null;
  meta: string; // sector·state or size·state
  /** Small qualifier shown beside the name, e.g. "5 listings" when rows were collapsed by ABN.
   *  Kept out of `meta` because that column truncates and this must stay readable. */
  badge?: string;
  gs_id: string | null;
  system_count: number | null;
  visible_dollars: number | null;
  known: number;
}
export interface BrowserConfig {
  kind: 'se' | 'charity';
  basePath: string;
  knownMax: number;
  knownLegend: string;
  stateFacets: string[];
  sizeFacets?: string[];
  moneyCaveat: string;
}

function money(n: number | null): string {
  if (!n || n <= 0) return '—';
  if (n >= 1e9) return `$${(n / 1e9).toFixed(1)}bn`;
  if (n >= 1e6) return `$${(n / 1e6).toFixed(1)}m`;
  return `$${Math.round(n / 1e3)}k`;
}


function Dots({ n, max }: { n: number; max: number }) {
  return (
    <span className="inline-flex gap-0.5" title={`${n} of ${max} facts held`}>
      {Array.from({ length: max }, (_, i) => (
        <span
          key={i}
          className="inline-block h-1.5 w-1.5 rounded-full"
          style={{ background: i < n ? '#1E8E3E' : '#DDDDD8' }}
        />
      ))}
    </span>
  );
}

interface DrawerData {
  detail: Record<string, unknown> & { name: string };
  ais: { ais_year: number; total_revenue: number | null; grants_donations_au: number | null; total_assets: number | null; staff_fte: number | null; staff_volunteers: number | null }[];
  power: { gs_id: string; system_count: number; total_dollar_flow: number; procurement_dollars: number | null; recorded_grants_dollars: number | null; donation_dollars: number | null } | null;
  people: { person_name: string; role_type: string | null }[];
  peopleCount: number;
}

function L({ children }: { children: React.ReactNode }) {
  return (
    <div className="mt-4 mb-1 font-mono text-[10px] font-black uppercase tracking-widest" style={{ color: 'var(--shell-muted)' }}>
      {children}
    </div>
  );
}

export default function OrgBrowser({
  rows,
  cfg,
  q,
  state,
  size,
  sort,
  dir = '',
  statsLine,
}: {
  rows: OrgRow[];
  cfg: BrowserConfig;
  q: string;
  state: string;
  size: string;
  sort: string;
  /** 'asc' | 'desc' | '' (natural) */
  dir?: string;
  statsLine: string;
}) {
  const [openAbn, setOpenAbn] = useState<string | null>(null);
  const [drawer, setDrawer] = useState<DrawerData | null>(null);
  const [err, setErr] = useState<string | null>(null);

  function open(abn: string) {
    setOpenAbn(abn);
    setDrawer(null);
    setErr(null);
    fetch(`/api/browse/org?abn=${encodeURIComponent(abn)}&kind=${cfg.kind}`)
      .then(async (r) => {
        if (!r.ok) throw new Error((await r.json())?.error ?? `HTTP ${r.status}`);
        return r.json() as Promise<DrawerData>;
      })
      .then(setDrawer)
      .catch((e) => setErr(e instanceof Error ? e.message : String(e)));
  }

  const qs = (over: Record<string, string>) => {
    const p = new URLSearchParams();
    for (const [k, v] of Object.entries({ q, state, size, sort, dir, ...over })) if (v) p.set(k, v);
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
        {state ? <input type="hidden" name="state" value={state} /> : null}
        {size ? <input type="hidden" name="size" value={size} /> : null}
        {sort ? <input type="hidden" name="sort" value={sort} /> : null}
        {dir ? <input type="hidden" name="dir" value={dir} /> : null}
      </form>
      <div className="mt-2 flex flex-wrap items-center gap-1.5">
        <Link href={qs({ state: '' })} className="px-2 py-1 font-mono text-[10px] font-black uppercase tracking-widest shell-control" style={state === '' ? { background: '#121212', color: '#F4F4F2' } : { background: '#FFF' }}>
          All states
        </Link>
        {cfg.stateFacets.map((s) => (
          <Link key={s} href={qs({ state: s })} className="px-2 py-1 font-mono text-[10px] font-black uppercase tracking-widest shell-control" style={state === s ? { background: '#121212', color: '#F4F4F2' } : { background: '#FFF' }}>
            {s}
          </Link>
        ))}
        {cfg.sizeFacets?.length ? (
          <>
            <span className="ml-2 font-mono text-[10px] uppercase tracking-widest" style={{ color: 'var(--shell-muted)' }}>size</span>
            {cfg.sizeFacets.map((s) => (
              <Link key={s} href={qs({ size: size === s ? '' : s })} className="px-2 py-1 font-mono text-[10px] font-black uppercase tracking-widest shell-control" style={size === s ? { background: '#121212', color: '#F4F4F2' } : { background: '#FFF' }}>
                {s}
              </Link>
            ))}
          </>
        ) : null}
      </div>

      <div className="mt-4 shell-card">
        <div className="flex items-baseline gap-3 px-4 py-2 font-mono text-[10px] font-black uppercase tracking-widest" style={{ borderBottom: '1px solid var(--shell-line)', color: 'var(--shell-muted)' }}>
          <SortHeader label="Name" sortKey="name" current={sort} dir={dir} qs={qs} />
          <span className="w-[190px] shrink-0">Detail</span>
          <Link
            href={qs({ sort: (sort || 'known') === 'known' ? 'least' : 'known' })}
            title={`${cfg.knownLegend} — click to flip most/least known`}
            className="w-[70px] shrink-0 truncate hover:underline"
            style={{ color: sort === 'least' || (sort || 'known') === 'known' ? '#121212' : undefined }}
          >
            {sort === 'least' ? 'Least known ▾' : 'Known ▾'}
          </Link>
          <SortHeader label="Systems" sortKey="systems" current={sort} dir={dir} qs={qs} width="w-[64px]" align="right" />
          <SortHeader label="Visible $" sortKey="dollars" current={sort} dir={dir} qs={qs} width="w-[92px]" align="right" />
        </div>
        {rows.map((r) => {
          const inner = (
            <>
              <span className="flex min-w-0 flex-1 items-baseline gap-2">
                <span className="min-w-0 truncate text-[13.5px] font-semibold" style={{ color: r.abn ? '#1040C0' : undefined }}>
                  {r.name}
                </span>
                {r.badge ? (
                  <span className="shrink-0 font-mono text-[10.5px]" style={{ color: 'var(--shell-muted)' }}>
                    {r.badge}
                  </span>
                ) : null}
              </span>
              <span className="w-[190px] shrink-0 truncate font-mono text-[11px]" style={{ color: 'var(--shell-muted)' }}>
                {r.meta}
              </span>
              <span className="w-[70px] shrink-0">
                <Dots n={r.known} max={cfg.knownMax} />
              </span>
              <span className="w-[64px] shrink-0 text-right font-mono text-[12.5px]">{r.system_count ?? '—'}</span>
              <span className="w-[92px] shrink-0 text-right font-mono text-[12.5px]">{money(r.visible_dollars)}</span>
            </>
          );
          return r.abn ? (
            <button key={r.key} onClick={() => open(r.abn!)} className="flex w-full items-baseline gap-3 px-4 py-2 text-left hover:bg-[#FAFAF8]" style={{ borderBottom: '1px solid var(--shell-line)' }}>
              {inner}
            </button>
          ) : (
            <div key={r.key} className="flex items-baseline gap-3 px-4 py-2" style={{ borderBottom: '1px solid var(--shell-line)' }} title="no ABN recorded — nothing to join on yet">
              {inner}
            </div>
          );
        })}
      </div>
      <p className="mt-2 font-mono text-[11px]" style={{ color: 'var(--shell-muted)' }}>
        {cfg.moneyCaveat}
      </p>

      {openAbn ? (
        <aside className="fixed inset-y-0 right-0 z-40 w-full max-w-[460px] overflow-y-auto border-l bg-white p-5" style={{ borderColor: 'var(--shell-line)', boxShadow: '-8px 0 24px rgba(0,0,0,0.08)' }}>
          <div className="flex items-start justify-between gap-3">
            <h2 className="font-display text-[17px] font-extrabold">{drawer?.detail.name ?? 'loading…'}</h2>
            <button onClick={() => setOpenAbn(null)} aria-label="close" className="shrink-0 px-2 py-0.5 font-mono text-[11px] font-black shell-control">✕</button>
          </div>
          {err ? <p className="mt-3 text-[13px]" style={{ color: '#D02020' }}>Could not load: {err}</p> : null}
          {drawer ? (
            <>
              <p className="mt-1 text-[12.5px]" style={{ color: 'var(--shell-muted)' }}>
                ABN {openAbn}
                {typeof drawer.detail.sector === 'string' ? ` · ${drawer.detail.sector}` : ''}
                {typeof drawer.detail.charity_size === 'string' ? ` · ${drawer.detail.charity_size}` : ''}
                {typeof drawer.detail.state === 'string' ? ` · ${drawer.detail.state}` : ''}
              </p>
              {typeof drawer.detail.description === 'string' && drawer.detail.description ? (
                <p className="mt-2 text-[13px] leading-relaxed">{String(drawer.detail.description).slice(0, 380)}</p>
              ) : null}

              {drawer.power ? (
                <>
                  <L>Money the public record can see</L>
                  <p className="text-[13px]">
                    {money(drawer.power.total_dollar_flow)} across {drawer.power.system_count} systems
                    {drawer.power.procurement_dollars ? ` · contracts ${money(drawer.power.procurement_dollars)}` : ''}
                    {drawer.power.recorded_grants_dollars ? ` · grants ${money(drawer.power.recorded_grants_dollars)}` : ''}
                    {drawer.power.donation_dollars ? ` · donated ${money(drawer.power.donation_dollars)}` : ''}
                  </p>
                  <p className="font-mono text-[10.5px]" style={{ color: 'var(--shell-muted)' }}>
                    dollars attach to the ABN — related branches share their parent&rsquo;s figures
                  </p>
                </>
              ) : null}

              {drawer.ais.length > 0 ? (
                <>
                  <L>ACNC returns</L>
                  <table className="w-full text-right font-mono text-[11.5px]">
                    <thead>
                      <tr style={{ color: 'var(--shell-muted)' }}>
                        <th className="py-0.5 text-left font-normal">year</th>
                        <th className="font-normal">revenue</th>
                        <th className="font-normal">granted</th>
                        <th className="font-normal">assets</th>
                        <th className="font-normal">staff</th>
                      </tr>
                    </thead>
                    <tbody>
                      {drawer.ais.map((y) => (
                        <tr key={y.ais_year} style={{ borderTop: '1px solid var(--shell-line)' }}>
                          <td className="py-0.5 text-left">{y.ais_year}</td>
                          <td>{money(y.total_revenue)}</td>
                          <td>{money(y.grants_donations_au)}</td>
                          <td>{money(y.total_assets)}</td>
                          <td>{y.staff_fte ?? '—'}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </>
              ) : null}

              {drawer.people.length > 0 ? (
                <>
                  <L>People on record · {drawer.peopleCount}</L>
                  <p className="text-[12.5px] leading-relaxed">
                    {drawer.people.map((p) => p.person_name).join(' · ')}
                    {drawer.peopleCount > drawer.people.length ? ` · +${drawer.peopleCount - drawer.people.length} more` : ''}
                  </p>
                </>
              ) : null}

              <L>Open</L>
              <div className="flex flex-wrap gap-1.5">
                {drawer.power?.gs_id ? (
                  <Link href={`/entity/${drawer.power.gs_id}`} className="px-2 py-1 font-mono text-[11px] font-black uppercase tracking-wider shell-control">
                    Atlas page ↗
                  </Link>
                ) : null}
                {typeof drawer.detail.website === 'string' && drawer.detail.website ? (
                  <a href={String(drawer.detail.website)} target="_blank" rel="noreferrer" className="px-2 py-1 font-mono text-[11px] font-black uppercase tracking-wider shell-control">
                    Website ↗
                  </a>
                ) : null}
              </div>
            </>
          ) : null}
        </aside>
      ) : null}
    </>
  );
}
