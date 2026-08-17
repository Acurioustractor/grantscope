'use client';

import Link from 'next/link';
import { money, L, makeQs, useDrawer, Drawer } from '../browse/browse-ui';

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

/** Source data carries some names fully lowercase ("catherine taylor") — title-case ONLY those
 *  (SH-11, Ben's call): mixed-case names are left exactly as recorded. */
function displayName(n: string): string {
  if (n !== n.toLowerCase()) return n;
  return n.replace(/\b\p{L}/gu, (c) => c.toUpperCase());
}

const SORTS: [string, string][] = [
  ['influence', 'Influence'],
  ['boards', 'Boards'],
  ['procurement', 'Contracts $'],
  ['justice', 'Grants $'],
  ['donations', 'Donations $'],
  ['name', 'A–Z'],
];

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
  const drawer = useDrawer<PersonDetail>();
  const detail = drawer.detail;
  const open = (norm: string) => drawer.open(norm, `/api/browse/person?norm=${encodeURIComponent(norm)}`);
  const qs = makeQs('/dashboard/people', { q, sort });

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
              {displayName(r.name)}
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

      {drawer.openKey ? (
        <Drawer title={drawer.detail?.person_name ?? 'loading…'} err={drawer.err} onClose={drawer.close}>
          {detail ? (
            <>
              <p className="mt-1 text-[12.5px]" style={{ color: 'var(--shell-muted)' }}>
                {detail.board_count} boards on record
                {detail.role_types?.length ? ` · ${detail.role_types.map((t) => t.replace(/_/g, ' ')).join(', ')}` : ''}
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
        </Drawer>
      ) : null}
    </>
  );
}
