'use client';

import { useState } from 'react';
import Link from 'next/link';

/**
 * The foundations browser (Ben, 2026-08-17: filter, sort, side drawer with everything — how much
 * money they have, not just give). Rows come from the foundation_browse RPC server-side; the
 * drawer fetches one foundation's full picture on click. Sort and filter are URL state so any
 * view is shareable.
 */

export interface BrowseRow {
  id: string;
  name: string;
  abn: string | null;
  type: string | null;
  giving: number | null;
  grantees: number;
  board_links: number;
  ais_year: number | null;
  granted: number | null;
  total_assets: number | null;
}

const TYPES: [string, string][] = [
  ['grantmaker', 'Grantmakers'],
  ['private_ancillary_fund', 'Private ancillary funds'],
  ['public_ancillary_fund', 'Public ancillary funds'],
  ['trust', 'Trusts'],
  ['corporate_foundation', 'Corporate foundations'],
  ['philanthropic_foundation', 'Philanthropic foundations'],
];
const SORTS: [string, string][] = [
  ['giving', 'Giving'],
  ['granted', 'Granted (ACNC)'],
  ['assets', 'Assets'],
  ['grantees', 'Grantees'],
  ['board', 'Board links'],
];

function money(n: number | null): string {
  if (!n) return '—';
  if (n >= 1e9) return `$${(n / 1e9).toFixed(1)}bn`;
  if (n >= 1e6) return `$${(n / 1e6).toFixed(1)}m`;
  return `$${Math.round(n / 1e3)}k`;
}

interface DrawerData {
  foundation: {
    name: string;
    acnc_abn: string | null;
    type: string | null;
    total_giving_annual: number | null;
    avg_grant_size: number | null;
    thematic_focus: string[] | null;
    website: string | null;
  };
  ais: { ais_year: number; total_revenue: number | null; grants_donations_au: number | null; total_assets: number | null; net_assets_liabilities: number | null }[];
  grantees: { grantee_gs_id: string | null; grantee_name: string; grantee_type: string | null; grantee_state: string | null; grantee_community_controlled: boolean | null; grant_year: number | null }[];
  granteeCount: number;
  board: { person_name: string; role_at_funder: string | null; connected_entity_name: string; identity_confidence: string | null; collision_risk: string | null }[];
  regrant: { regranter_name: string; ultimate_grantee: string; downstream_amount: number | null; downstream_year: number | null }[];
  gsId: string | null;
}

function DrawerLabel({ children }: { children: React.ReactNode }) {
  return (
    <div className="mt-4 mb-1 font-mono text-[10px] font-black uppercase tracking-widest" style={{ color: 'var(--shell-muted)' }}>
      {children}
    </div>
  );
}

export default function FoundationsBrowser({
  rows,
  q,
  type,
  sort,
  total,
}: {
  rows: BrowseRow[];
  q: string;
  type: string;
  sort: string;
  total: number;
}) {
  const [openId, setOpenId] = useState<string | null>(null);
  const [drawer, setDrawer] = useState<DrawerData | null>(null);
  const [drawerErr, setDrawerErr] = useState<string | null>(null);

  function open(id: string) {
    setOpenId(id);
    setDrawer(null);
    setDrawerErr(null);
    fetch(`/api/browse/foundation?id=${id}`)
      .then(async (r) => {
        if (!r.ok) throw new Error((await r.json())?.error ?? `HTTP ${r.status}`);
        return r.json() as Promise<DrawerData>;
      })
      .then(setDrawer)
      .catch((e) => setDrawerErr(e instanceof Error ? e.message : String(e)));
  }

  const qs = (over: Record<string, string>) => {
    const p = new URLSearchParams();
    if (q) p.set('q', q);
    if (type) p.set('type', type);
    if (sort) p.set('sort', sort);
    for (const [k, v] of Object.entries(over)) {
      if (v) p.set(k, v);
      else p.delete(k);
    }
    const s = p.toString();
    return `/dashboard/browse/foundations${s ? `?${s}` : ''}`;
  };

  return (
    <>
      <form className="mt-4 flex flex-wrap items-center gap-2" action="/dashboard/browse/foundations">
        <input
          name="q"
          defaultValue={q}
          placeholder="Search foundations by name…"
          className="w-full max-w-[360px] bg-white px-3 py-2 font-mono text-[13px] shell-control"
        />
        {type ? <input type="hidden" name="type" value={type} /> : null}
        {sort ? <input type="hidden" name="sort" value={sort} /> : null}
      </form>
      <div className="mt-2 flex flex-wrap items-center gap-1.5">
        <Link
          href={qs({ type: '' })}
          className="px-2 py-1 font-mono text-[10px] font-black uppercase tracking-widest shell-control"
          style={type === '' ? { background: '#121212', color: '#F4F4F2' } : { background: '#FFF' }}
        >
          All types
        </Link>
        {TYPES.map(([v, label]) => (
          <Link
            key={v}
            href={qs({ type: v })}
            className="px-2 py-1 font-mono text-[10px] font-black uppercase tracking-widest shell-control"
            style={type === v ? { background: '#121212', color: '#F4F4F2' } : { background: '#FFF' }}
          >
            {label}
          </Link>
        ))}
        <span className="ml-auto flex items-center gap-1.5">
          <span className="font-mono text-[10px] uppercase tracking-widest" style={{ color: 'var(--shell-muted)' }}>
            sort
          </span>
          {SORTS.map(([v, label]) => (
            <Link
              key={v}
              href={qs({ sort: v })}
              className="px-2 py-1 font-mono text-[10px] font-black uppercase tracking-widest shell-control"
              style={sort === v ? { background: '#121212', color: '#F4F4F2' } : { background: '#FFF' }}
            >
              {label}
            </Link>
          ))}
        </span>
      </div>

      <div className="mt-4 shell-card">
        <div
          className="flex items-baseline gap-3 px-4 py-2 font-mono text-[10px] font-black uppercase tracking-widest"
          style={{ borderBottom: '1px solid var(--shell-line)', color: 'var(--shell-muted)' }}
        >
          <span className="flex-1">Foundation</span>
          <span className="w-[92px] text-right">Giving / yr</span>
          <span className="w-[100px] text-right" title="grants + donations made, latest ACNC return">Granted</span>
          <span className="w-[92px] text-right" title="total assets, latest ACNC return">Assets</span>
          <span className="w-[74px] text-right">Grantees</span>
          <span className="w-[70px] text-right">Board</span>
        </div>
        {rows.map((r) => (
          <button
            key={r.id}
            onClick={() => open(r.id)}
            className="flex w-full items-baseline gap-3 px-4 py-2 text-left hover:bg-[#FAFAF8]"
            style={{ borderBottom: '1px solid var(--shell-line)' }}
          >
            <span className="min-w-0 flex-1 truncate text-[13.5px] font-semibold" style={{ color: '#1040C0' }}>
              {r.name}
            </span>
            <span className="w-[92px] shrink-0 text-right font-mono text-[12.5px]">{money(r.giving)}</span>
            <span className="w-[100px] shrink-0 text-right font-mono text-[12.5px]">{money(r.granted)}</span>
            <span className="w-[92px] shrink-0 text-right font-mono text-[12.5px]">{money(r.total_assets)}</span>
            <span className="w-[74px] shrink-0 text-right font-mono text-[12.5px]">{r.grantees || '—'}</span>
            <span className="w-[70px] shrink-0 text-right font-mono text-[12.5px]">{r.board_links || '—'}</span>
          </button>
        ))}
        {rows.length === 0 ? (
          <p className="p-4 font-mono text-[12px]" style={{ color: 'var(--shell-muted)' }}>
            Nothing matches.
          </p>
        ) : null}
      </div>
      <p className="mt-2 font-mono text-[11px]" style={{ color: 'var(--shell-muted)' }}>
        {rows.length} shown of {total.toLocaleString('en-AU')} · &ldquo;Granted&rdquo; and
        &ldquo;Assets&rdquo; are the latest ACNC return; &ldquo;Giving&rdquo; can mix grantmaking
        with program spend
      </p>

      {openId ? (
        <aside className="fixed inset-y-0 right-0 z-40 w-full max-w-[460px] overflow-y-auto border-l bg-white p-5" style={{ borderColor: 'var(--shell-line)', boxShadow: '-8px 0 24px rgba(0,0,0,0.08)' }}>
          <div className="flex items-start justify-between gap-3">
            <h2 className="font-display text-[17px] font-extrabold">{drawer?.foundation.name ?? 'loading…'}</h2>
            <button onClick={() => setOpenId(null)} aria-label="close" className="shrink-0 px-2 py-0.5 font-mono text-[11px] font-black shell-control">
              ✕
            </button>
          </div>
          {drawerErr ? <p className="mt-3 text-[13px]" style={{ color: '#D02020' }}>Could not load: {drawerErr}</p> : null}
          {drawer ? (
            <>
              <p className="mt-1 text-[12.5px]" style={{ color: 'var(--shell-muted)' }}>
                {drawer.foundation.type ? `${drawer.foundation.type.replace(/_/g, ' ')} · ` : ''}
                {drawer.foundation.acnc_abn ? `ABN ${drawer.foundation.acnc_abn}` : 'no ABN recorded'}
                {Array.isArray(drawer.foundation.thematic_focus) && drawer.foundation.thematic_focus.length
                  ? ` · ${drawer.foundation.thematic_focus.slice(0, 4).join(', ')}`
                  : ''}
              </p>

              <DrawerLabel>The money</DrawerLabel>
              <p className="text-[13px]">
                Giving {money(drawer.foundation.total_giving_annual)} / yr
                {drawer.foundation.avg_grant_size ? ` · average grant ${money(drawer.foundation.avg_grant_size)}` : ''}
              </p>
              {drawer.ais.length > 0 ? (
                <table className="mt-1.5 w-full text-right font-mono text-[11.5px]">
                  <thead>
                    <tr style={{ color: 'var(--shell-muted)' }}>
                      <th className="py-0.5 text-left font-normal">ACNC year</th>
                      <th className="font-normal">revenue</th>
                      <th className="font-normal">granted</th>
                      <th className="font-normal">assets</th>
                    </tr>
                  </thead>
                  <tbody>
                    {drawer.ais.map((y) => (
                      <tr key={y.ais_year} style={{ borderTop: '1px solid var(--shell-line)' }}>
                        <td className="py-0.5 text-left">{y.ais_year}</td>
                        <td>{money(y.total_revenue)}</td>
                        <td>{money(y.grants_donations_au)}</td>
                        <td>{money(y.total_assets)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              ) : (
                <p className="text-[12px]" style={{ color: 'var(--shell-muted)' }}>
                  No ACNC returns on file (not all giving vehicles report).
                </p>
              )}

              <DrawerLabel>Who it funds · {drawer.granteeCount} linked</DrawerLabel>
              {drawer.grantees.length === 0 ? (
                <p className="text-[12.5px]" style={{ color: 'var(--shell-muted)' }}>
                  No grantee links recorded — a statement about our data, not the foundation.
                </p>
              ) : (
                <ul className="grid gap-0.5">
                  {drawer.grantees.map((g, i) => (
                    <li key={i} className="flex items-baseline gap-2 text-[12.5px]">
                      {g.grantee_gs_id ? (
                        <Link href={`/entity/${g.grantee_gs_id}`} className="min-w-0 flex-1 truncate font-semibold hover:underline" style={{ color: '#1040C0' }}>
                          {g.grantee_name}
                        </Link>
                      ) : (
                        <span className="min-w-0 flex-1 truncate font-semibold">{g.grantee_name}</span>
                      )}
                      {g.grantee_community_controlled ? (
                        <span className="font-mono text-[9px] font-black uppercase" style={{ color: '#1E8E3E' }}>cc</span>
                      ) : null}
                      <span className="shrink-0 font-mono text-[10.5px]" style={{ color: 'var(--shell-muted)' }}>
                        {g.grantee_state ?? '—'} {g.grant_year ?? ''}
                      </span>
                    </li>
                  ))}
                </ul>
              )}

              {drawer.board.length > 0 ? (
                <>
                  <DrawerLabel>Its people, elsewhere</DrawerLabel>
                  <ul className="grid gap-0.5">
                    {drawer.board.map((b, i) => (
                      <li key={i} className="text-[12.5px]">
                        <span className="font-semibold">{b.person_name}</span>
                        <span style={{ color: 'var(--shell-muted)' }}> also at </span>
                        {b.connected_entity_name}
                        <span className="ml-1.5 font-mono text-[9.5px] uppercase" style={{ color: 'var(--shell-muted)' }}>
                          {b.identity_confidence}
                        </span>
                      </li>
                    ))}
                  </ul>
                </>
              ) : null}

              {drawer.regrant.length > 0 ? (
                <>
                  <DrawerLabel>Through intermediaries</DrawerLabel>
                  <ul className="grid gap-1">
                    {drawer.regrant.map((c, i) => (
                      <li key={i} className="text-[12.5px]" style={{ borderLeft: '3px solid var(--shell-line)', paddingLeft: 8 }}>
                        → {c.regranter_name} → <span className="font-semibold">{c.ultimate_grantee}</span>
                      </li>
                    ))}
                  </ul>
                </>
              ) : null}

              <DrawerLabel>Open</DrawerLabel>
              <div className="flex flex-wrap gap-1.5">
                <Link href={`/dashboard/browse/foundations/${openId}`} className="px-2 py-1 font-mono text-[11px] font-black uppercase tracking-wider shell-control">
                  Full profile
                </Link>
                {drawer.gsId ? (
                  <Link href={`/entity/${drawer.gsId}`} className="px-2 py-1 font-mono text-[11px] font-black uppercase tracking-wider shell-control">
                    Atlas page ↗
                  </Link>
                ) : null}
                {drawer.foundation.website ? (
                  <a href={drawer.foundation.website} target="_blank" rel="noreferrer" className="px-2 py-1 font-mono text-[11px] font-black uppercase tracking-wider shell-control">
                    Website / reports ↗
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
