'use client';

import { useState } from 'react';
import Link from 'next/link';

/**
 * Places browser at LGA grain. The drawer's provenance block shows HOW each entity was placed
 * (lga_source stamps from the attribution rebuild) — a null LGA elsewhere is deliberate
 * unplacement with a reason code, not missing data.
 */

export interface PlaceRow {
  key: string;
  lga: string;
  state: string;
  entities: number;
  acco: number;
  funding: number | null;
  seifa: number | null;
  remoteness: string | null;
  desert: number | null;
}

interface PlaceDetail {
  lga_name: string;
  state: string;
  funding: {
    entity_count: number | null;
    community_controlled_count: number | null;
    total_funding: number | null;
    avg_seifa_decile: number | null;
  } | null;
  desert: { desert_score: number | null; remoteness: string | null } | null;
  postcodes: { postcode: string; entity_count: number | null; total_funding: number | null; remoteness: string | null }[];
  placement: Record<string, number>;
}

function money(n: number | null | undefined): string {
  if (!n || n <= 0) return '—';
  if (n >= 1e9) return `$${(n / 1e9).toFixed(1)}bn`;
  if (n >= 1e6) return `$${(n / 1e6).toFixed(1)}m`;
  return `$${Math.round(n / 1e3)}k`;
}

const SORTS: [string, string][] = [
  ['funding', 'Funding $'],
  ['desert', 'Desert score'],
  ['entities', 'Entities'],
  ['disadvantage', 'Most disadvantaged'],
  ['name', 'A–Z'],
];

const STATES = ['NSW', 'VIC', 'QLD', 'WA', 'SA', 'TAS', 'NT', 'ACT'];

/** Plain-word labels for lga_source stamps; unknown stamps fall through as-is. */
const PLACEMENT_LABEL: Record<string, string> = {
  registry_address: 'registered address',
  single_lga_postcode: 'postcode sits in one council area',
  poa_ratio_dominant: 'postcode is ≥90% in this council area',
  poa_ratio_nolocality: 'postcode is ≥90% in this council area (no suburb on file — less sure)',
  straddler_ratio_dominant: 'straddling postcode, dominant council area',
  'acnc_town_city+abs_asgs': 'charity register town',
  'own_name_town+abs_asgs': 'the organisation is named after its town',
  'oric_register_address+abs_asgs': 'ORIC register address',
  'community_name+abs_asgs': 'community name',
  'acnc_street_line+sal_ratio_dominant': 'charity register street address',
};

function L({ children }: { children: React.ReactNode }) {
  return (
    <div className="mt-4 mb-1 font-mono text-[10px] font-black uppercase tracking-widest" style={{ color: 'var(--shell-muted)' }}>
      {children}
    </div>
  );
}

export default function PlaceBrowser({
  rows,
  q,
  state,
  sort,
  statsLine,
  caveat,
}: {
  rows: PlaceRow[];
  q: string;
  state: string;
  sort: string;
  statsLine: string;
  caveat: string;
}) {
  const [openKey, setOpenKey] = useState<string | null>(null);
  const [detail, setDetail] = useState<PlaceDetail | null>(null);
  const [err, setErr] = useState<string | null>(null);

  function open(row: PlaceRow) {
    setOpenKey(row.key);
    setDetail(null);
    setErr(null);
    fetch(`/api/browse/place?lga=${encodeURIComponent(row.lga)}&state=${encodeURIComponent(row.state)}`)
      .then(async (r) => {
        if (!r.ok) throw new Error((await r.json())?.error ?? `HTTP ${r.status}`);
        return r.json() as Promise<PlaceDetail>;
      })
      .then(setDetail)
      .catch((e) => setErr(e instanceof Error ? e.message : String(e)));
  }

  const qs = (over: Record<string, string>) => {
    const p = new URLSearchParams();
    for (const [k, v] of Object.entries({ q, state, sort, ...over })) if (v) p.set(k, v);
    const s = p.toString();
    return `/dashboard/places${s ? `?${s}` : ''}`;
  };

  return (
    <>
      <p className="mt-1 font-mono text-[11.5px]" style={{ color: 'var(--shell-muted)' }}>
        {statsLine}
      </p>
      <form className="mt-3" action="/dashboard/places">
        <input
          name="q"
          defaultValue={q}
          placeholder="Search by council area…"
          className="w-full max-w-[360px] bg-white px-3 py-2 font-mono text-[13px] shell-control"
        />
        {state ? <input type="hidden" name="state" value={state} /> : null}
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
        <span className="ml-auto flex items-center gap-1.5">
          {SORTS.map(([v, label]) => (
            <Link key={v} href={qs({ sort: v })} className="px-2 py-1 font-mono text-[10px] font-black uppercase tracking-widest shell-control" style={(sort || 'funding') === v ? { background: '#121212', color: '#F4F4F2' } : { background: '#FFF' }}>
              {label}
            </Link>
          ))}
        </span>
      </div>

      <div className="mt-4 shell-card">
        <div className="flex items-baseline gap-3 px-4 py-2 font-mono text-[10px] font-black uppercase tracking-widest" style={{ borderBottom: '1px solid var(--shell-line)', color: 'var(--shell-muted)' }}>
          <span className="flex-1">Council area</span>
          <span className="w-[52px]">State</span>
          <span className="w-[72px] text-right">Entities</span>
          <span className="w-[64px] text-right" title="community-controlled organisations">ACCO</span>
          <span className="w-[92px] text-right">Funding $</span>
          <span className="w-[56px] text-right" title="average SEIFA disadvantage decile, 1 = most disadvantaged">SEIFA</span>
          <span className="w-[64px] text-right" title="funding-desert score: disadvantage vs money reaching the area">Desert</span>
        </div>
        {rows.map((r) => (
          <button key={r.key} onClick={() => open(r)} className="flex w-full items-baseline gap-3 px-4 py-2 text-left hover:bg-[#FAFAF8]" style={{ borderBottom: '1px solid var(--shell-line)' }}>
            <span className="min-w-0 flex-1 truncate text-[13.5px] font-semibold" style={{ color: '#1040C0' }}>{r.lga}</span>
            <span className="w-[52px] shrink-0 font-mono text-[11px]" style={{ color: 'var(--shell-muted)' }}>{r.state}</span>
            <span className="w-[72px] shrink-0 text-right font-mono text-[12.5px]">{r.entities.toLocaleString('en-AU')}</span>
            <span className="w-[64px] shrink-0 text-right font-mono text-[12.5px]">{r.acco || '—'}</span>
            <span className="w-[92px] shrink-0 text-right font-mono text-[12.5px]">{money(r.funding)}</span>
            <span className="w-[56px] shrink-0 text-right font-mono text-[12.5px]">{r.seifa ?? '—'}</span>
            <span className="w-[64px] shrink-0 text-right font-mono text-[12.5px]">{r.desert ?? '—'}</span>
          </button>
        ))}
      </div>
      <p className="mt-2 font-mono text-[11px]" style={{ color: 'var(--shell-muted)' }}>
        {caveat}
      </p>

      {openKey ? (
        <aside className="fixed inset-y-0 right-0 z-40 w-full max-w-[460px] overflow-y-auto border-l bg-white p-5" style={{ borderColor: 'var(--shell-line)', boxShadow: '-8px 0 24px rgba(0,0,0,0.08)' }}>
          <div className="flex items-start justify-between gap-3">
            <h2 className="font-display text-[17px] font-extrabold">{detail ? `${detail.lga_name} (${detail.state})` : 'loading…'}</h2>
            <button onClick={() => setOpenKey(null)} aria-label="close" className="shrink-0 px-2 py-0.5 font-mono text-[11px] font-black shell-control">✕</button>
          </div>
          {err ? <p className="mt-3 text-[13px]" style={{ color: '#D02020' }}>Could not load: {err}</p> : null}
          {detail ? (
            <>
              <p className="mt-1 text-[12.5px]" style={{ color: 'var(--shell-muted)' }}>
                {detail.desert?.remoteness ?? ''}
                {detail.desert?.desert_score != null ? ` · desert score ${detail.desert.desert_score}` : ''}
              </p>

              {detail.funding ? (
                <>
                  <L>What the record holds here</L>
                  <p className="text-[13px]">
                    {(detail.funding.entity_count ?? 0).toLocaleString('en-AU')} organisations
                    {detail.funding.community_controlled_count ? ` · ${detail.funding.community_controlled_count} community-controlled` : ''}
                    {' · '}funding visible {money(detail.funding.total_funding)}
                    {detail.funding.avg_seifa_decile != null ? ` · SEIFA decile ${detail.funding.avg_seifa_decile}` : ''}
                  </p>
                  <p className="font-mono text-[10.5px]" style={{ color: 'var(--shell-muted)' }}>
                    money attaches to an organisation&rsquo;s address — head-office areas collect their branches&rsquo; figures
                  </p>
                </>
              ) : null}

              {detail.postcodes.length > 0 ? (
                <>
                  <L>By postcode</L>
                  <table className="w-full text-right font-mono text-[11.5px]">
                    <thead>
                      <tr style={{ color: 'var(--shell-muted)' }}>
                        <th className="py-0.5 text-left font-normal">postcode</th>
                        <th className="font-normal">orgs</th>
                        <th className="font-normal">funding</th>
                      </tr>
                    </thead>
                    <tbody>
                      {detail.postcodes.slice(0, 12).map((p) => (
                        <tr key={p.postcode} style={{ borderTop: '1px solid var(--shell-line)' }}>
                          <td className="py-0.5 text-left">{p.postcode}</td>
                          <td>{p.entity_count ?? '—'}</td>
                          <td>{money(p.total_funding)}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </>
              ) : null}

              {Object.keys(detail.placement).length > 0 ? (
                <>
                  <L>How organisations were placed here</L>
                  <div className="flex flex-col gap-0.5">
                    {Object.entries(detail.placement)
                      .sort(([, a], [, b]) => b - a)
                      .map(([src, n]) => (
                        <div key={src} className="flex items-baseline justify-between gap-3 text-[12px]">
                          <span>{PLACEMENT_LABEL[src] ?? src}</span>
                          <span className="font-mono text-[11.5px]" style={{ color: 'var(--shell-muted)' }}>{n.toLocaleString('en-AU')}</span>
                        </div>
                      ))}
                  </div>
                  <p className="mt-1 font-mono text-[10.5px]" style={{ color: 'var(--shell-muted)' }}>
                    every placement carries its method; organisations we could not place confidently are left unplaced with a reason, not guessed
                  </p>
                </>
              ) : null}
            </>
          ) : null}
        </aside>
      ) : null}
    </>
  );
}
