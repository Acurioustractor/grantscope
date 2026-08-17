'use client';

import { useState } from 'react';
import Link from 'next/link';

/**
 * People browser: board interlocks + de-collided money footprint. The list excludes nominee
 * blocks and >10-board identities BY DESIGN — the exclusion is stated under the list, never
 * silent. Dollars are attributed_* figures (shared-board money split, not double-counted).
 */

export interface PersonRow {
  key: string;
  name: string;
  norm: string;
  boards: number;
  accoBoards: number;
  procurement: number | null;
  justice: number | null;
  donations: number | null;
  systems: number | null;
}

interface PersonDetail {
  person_name: string;
  board_count: number;
  organisations: string[] | null;
  organisation_abns: (string | null)[] | null;
  role_types: string[] | null;
  connects_community_controlled: boolean | null;
  attributed: {
    procurement: number | null;
    justice: number | null;
    donations: number | null;
    systems: number | null;
  } | null;
}

function money(n: number | null | undefined): string {
  if (!n || n <= 0) return '—';
  if (n >= 1e9) return `$${(n / 1e9).toFixed(1)}bn`;
  if (n >= 1e6) return `$${(n / 1e6).toFixed(1)}m`;
  return `$${Math.round(n / 1e3)}k`;
}

const SORTS: [string, string][] = [
  ['influence', 'Influence'],
  ['boards', 'Boards'],
  ['procurement', 'Contracts $'],
  ['justice', 'Grants $'],
  ['donations', 'Donations $'],
  ['name', 'A–Z'],
];

function L({ children }: { children: React.ReactNode }) {
  return (
    <div className="mt-4 mb-1 font-mono text-[10px] font-black uppercase tracking-widest" style={{ color: 'var(--shell-muted)' }}>
      {children}
    </div>
  );
}

export default function PersonBrowser({
  rows,
  q,
  sort,
  statsLine,
  exclusionNote,
}: {
  rows: PersonRow[];
  q: string;
  sort: string;
  statsLine: string;
  exclusionNote: string;
}) {
  const [openNorm, setOpenNorm] = useState<string | null>(null);
  const [detail, setDetail] = useState<PersonDetail | null>(null);
  const [err, setErr] = useState<string | null>(null);

  function open(norm: string) {
    setOpenNorm(norm);
    setDetail(null);
    setErr(null);
    fetch(`/api/browse/person?norm=${encodeURIComponent(norm)}`)
      .then(async (r) => {
        if (!r.ok) throw new Error((await r.json())?.error ?? `HTTP ${r.status}`);
        return r.json() as Promise<PersonDetail>;
      })
      .then(setDetail)
      .catch((e) => setErr(e instanceof Error ? e.message : String(e)));
  }

  const qs = (over: Record<string, string>) => {
    const p = new URLSearchParams();
    for (const [k, v] of Object.entries({ q, sort, ...over })) if (v) p.set(k, v);
    const s = p.toString();
    return `/dashboard/people${s ? `?${s}` : ''}`;
  };

  return (
    <>
      <p className="mt-1 font-mono text-[11.5px]" style={{ color: 'var(--shell-muted)' }}>
        {statsLine}
      </p>
      <form className="mt-3" action="/dashboard/people">
        <input
          name="q"
          defaultValue={q}
          placeholder="Search by name…"
          className="w-full max-w-[360px] bg-white px-3 py-2 font-mono text-[13px] shell-control"
        />
        {sort ? <input type="hidden" name="sort" value={sort} /> : null}
      </form>
      <div className="mt-2 flex flex-wrap items-center gap-1.5">
        <span className="ml-auto flex items-center gap-1.5">
          {SORTS.map(([v, label]) => (
            <Link key={v} href={qs({ sort: v })} className="px-2 py-1 font-mono text-[10px] font-black uppercase tracking-widest shell-control" style={(sort || 'influence') === v ? { background: '#121212', color: '#F4F4F2' } : { background: '#FFF' }}>
              {label}
            </Link>
          ))}
        </span>
      </div>

      <div className="mt-4 shell-card">
        <div className="flex items-baseline gap-3 px-4 py-2 font-mono text-[10px] font-black uppercase tracking-widest" style={{ borderBottom: '1px solid var(--shell-line)', color: 'var(--shell-muted)' }}>
          <span className="flex-1">Name</span>
          <span className="w-[64px] text-right">Boards</span>
          <span className="w-[64px] text-right">Systems</span>
          <span className="w-[92px] text-right">Contracts $</span>
          <span className="w-[92px] text-right">Grants $</span>
          <span className="w-[92px] text-right">Donations $</span>
        </div>
        {rows.map((r) => (
          <button key={r.key} onClick={() => open(r.norm)} className="flex w-full items-baseline gap-3 px-4 py-2 text-left hover:bg-[#FAFAF8]" style={{ borderBottom: '1px solid var(--shell-line)' }}>
            <span className="min-w-0 flex-1 truncate text-[13.5px] font-semibold" style={{ color: '#1040C0' }}>
              {r.name}
              {r.accoBoards > 0 ? (
                <span className="ml-2 font-mono text-[10px] uppercase tracking-wider" style={{ color: '#059669' }} title="sits on at least one community-controlled board">
                  acco
                </span>
              ) : null}
            </span>
            <span className="w-[64px] shrink-0 text-right font-mono text-[12.5px]">{r.boards}</span>
            <span className="w-[64px] shrink-0 text-right font-mono text-[12.5px]">{r.systems ?? '—'}</span>
            <span className="w-[92px] shrink-0 text-right font-mono text-[12.5px]">{money(r.procurement)}</span>
            <span className="w-[92px] shrink-0 text-right font-mono text-[12.5px]">{money(r.justice)}</span>
            <span className="w-[92px] shrink-0 text-right font-mono text-[12.5px]">{money(r.donations)}</span>
          </button>
        ))}
      </div>
      <p className="mt-2 font-mono text-[11px]" style={{ color: 'var(--shell-muted)' }}>
        {exclusionNote}
      </p>

      {openNorm ? (
        <aside className="fixed inset-y-0 right-0 z-40 w-full max-w-[460px] overflow-y-auto border-l bg-white p-5" style={{ borderColor: 'var(--shell-line)', boxShadow: '-8px 0 24px rgba(0,0,0,0.08)' }}>
          <div className="flex items-start justify-between gap-3">
            <h2 className="font-display text-[17px] font-extrabold">{detail?.person_name ?? 'loading…'}</h2>
            <button onClick={() => setOpenNorm(null)} aria-label="close" className="shrink-0 px-2 py-0.5 font-mono text-[11px] font-black shell-control">✕</button>
          </div>
          {err ? <p className="mt-3 text-[13px]" style={{ color: '#D02020' }}>Could not load: {err}</p> : null}
          {detail ? (
            <>
              <p className="mt-1 text-[12.5px]" style={{ color: 'var(--shell-muted)' }}>
                {detail.board_count} boards on record
                {detail.role_types?.length ? ` · ${detail.role_types.join(', ')}` : ''}
                {detail.connects_community_controlled ? ' · connects community-controlled orgs' : ''}
              </p>

              {detail.attributed ? (
                <>
                  <L>Money moving past these boards</L>
                  <p className="text-[13px]">
                    contracts {money(detail.attributed.procurement)} · grants {money(detail.attributed.justice)} · donations {money(detail.attributed.donations)}
                    {detail.attributed.systems ? ` · across ${detail.attributed.systems} systems` : ''}
                  </p>
                  <p className="font-mono text-[10.5px]" style={{ color: 'var(--shell-muted)' }}>
                    attributed figures: money at shared boards is split between the people on them, not counted once each
                  </p>
                </>
              ) : null}

              {detail.organisations?.length ? (
                <>
                  <L>Boards held</L>
                  <div className="flex flex-col gap-1">
                    {detail.organisations.map((org, i) => {
                      const abn = detail.organisation_abns?.[i] ?? null;
                      return abn ? (
                        <Link key={`${org}-${i}`} href={`/dashboard/browse/charities?q=${encodeURIComponent(org)}`} className="text-[12.5px]" style={{ color: '#1040C0' }}>
                          {org}
                        </Link>
                      ) : (
                        <span key={`${org}-${i}`} className="text-[12.5px]">{org}</span>
                      );
                    })}
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
