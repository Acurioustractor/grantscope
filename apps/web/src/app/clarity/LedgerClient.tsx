'use client';

import { Fragment, useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import type { LedgerRow, LedgerStats, FreshnessProbe } from './types';

// QUESTIONS sits FIRST and ALL stays the default. A question is the only row here that answers
// something about the world rather than describing our estate, so it leads the segment list —
// but it must not become a separate page again, which is how three cards ended up hiding 1,455
// objects behind them.
const SEGMENTS = ['ALL', 'QUESTIONS', 'SOURCES', 'DERIVED', 'LENSES', 'ROUTINES'] as const;
const SORTS = [
  ['importance', 'Ranked'],
  ['rows', 'Rows'],
  ['bytes', 'Size'],
  ['name', 'A–Z'],
] as const;
type SortKey = (typeof SORTS)[number][0];

/**
 * The absence alphabet. `+` and `?` are deliberately different glyphs: 294 objects have no
 * timestamp column, which is OUR omission and an afternoon's work, while 58 are genuinely
 * too expensive to probe and need a rebuild. Collapsed into one "unknown", the 294 stop
 * looking like a to-do list. Issue #195.
 */
const FRESH: Record<FreshnessProbe, { glyph: string; cls: string; title: string }> = {
  ok: { glyph: '', cls: '', title: 'Reports a real date' },
  no_column: {
    glyph: '+',
    cls: 'text-bauhaus-blue',
    title: 'No timestamp column — our omission, fixable by adding one',
  },
  deferred_too_large: {
    glyph: '?',
    cls: 'text-bauhaus-yellow',
    title: 'Too large to probe cheaply — unmeasurable without a rebuild',
  },
  not_applicable: { glyph: '—', cls: 'text-bauhaus-muted', title: 'Not applicable' },
  timeout: { glyph: '?', cls: 'text-bauhaus-yellow', title: 'Freshness probe timed out' },
  error: { glyph: '!', cls: 'text-bauhaus-red', title: 'Freshness probe errored' },
};

const DT = 'pt-0.5 text-[9.5px] font-extrabold uppercase tracking-[0.12em] text-bauhaus-muted';
const nf = new Intl.NumberFormat('en-AU');
const nice = (s: string) => (s ? s.replace(/_/g, ' ').replace(/^./, (c) => c.toUpperCase()) : '');

function bytes(b: number): string {
  if (!b) return '—';
  const u = ['B', 'KB', 'MB', 'GB'];
  let i = 0;
  let v = b;
  while (v >= 1024 && i < u.length - 1) {
    v /= 1024;
    i += 1;
  }
  return `${v >= 100 || i === 0 ? Math.round(v) : v.toFixed(1)} ${u[i]}`;
}

export default function LedgerClient({ rows, stats }: { rows: LedgerRow[]; stats: LedgerStats }) {
  const router = useRouter();
  const [seg, setSeg] = useState<string>('ALL');
  const [sort, setSort] = useState<SortKey>('importance');
  const [q, setQ] = useState('');
  const [domain, setDomain] = useState('');
  const [life, setLife] = useState('');
  const [fresh, setFresh] = useState('');
  const [showAct, setShowAct] = useState(false);
  const [open, setOpen] = useState<string | null>(null);

  const facets = useMemo(() => {
    const tally = (pick: (r: LedgerRow) => string) => {
      const m = new Map<string, number>();
      for (const r of rows) {
        const k = pick(r);
        if (k) m.set(k, (m.get(k) ?? 0) + 1);
      }
      return [...m.entries()].sort((a, b) => b[1] - a[1]);
    };
    return {
      domain: tally((r) => r.d).slice(0, 14),
      life: tally((r) => r.l),
      fresh: tally((r) => r.f),
    };
  }, [rows]);

  const visible = useMemo(() => {
    const needle = q.trim().toLowerCase();
    const out = rows.filter((r) => {
      if (seg !== 'ALL' && r.s !== seg) return false;
      if (!showAct && r.a) return false;
      if (domain && r.d !== domain) return false;
      if (life && r.l !== life) return false;
      if (fresh && r.f !== fresh) return false;
      if (needle && !`${r.n} ${r.p} ${r.j} ${r.v}`.toLowerCase().includes(needle)) return false;
      return true;
    });
    const by: Record<SortKey, (a: LedgerRow, b: LedgerRow) => number> = {
      importance: (a, b) => b.i - a.i,
      rows: (a, b) => (b.r ?? -1) - (a.r ?? -1),
      bytes: (a, b) => b.b - a.b,
      name: (a, b) => a.n.localeCompare(b.n),
    };
    return [...out].sort(by[sort]);
  }, [rows, seg, showAct, domain, life, fresh, q, sort]);

  const segCount = (s: string) => (s === 'ALL' ? rows.length : rows.filter((r) => r.s === s).length);

  const cell = 'border-r-2 border-b-2 border-bauhaus-black bg-bauhaus-white px-3 py-2.5';
  const facetBtn = (active: boolean) =>
    `flex w-full items-center justify-between gap-2 px-1.5 py-0.5 text-left text-xs ${
      active ? 'bg-bauhaus-black font-bold text-bauhaus-canvas' : 'hover:bg-bauhaus-canvas'
    }`;

  return (
    <main className="min-h-screen bg-bauhaus-canvas">
      <div className="mx-auto max-w-[1400px] px-4 pb-24">
        <header className="border-b-4 border-bauhaus-black pt-8">
          <div className="mb-4 flex flex-wrap items-center gap-2">
            <span className="border-2 border-bauhaus-black bg-bauhaus-white px-2 py-0.5 text-[10px] font-extrabold uppercase tracking-[0.15em]">
              Admin only
            </span>
            {stats.refreshedAt ? (
              <span className="border-2 border-bauhaus-black bg-bauhaus-white px-2 py-0.5 text-[10px] font-extrabold uppercase tracking-[0.15em]">
                Refreshed {stats.refreshedAt.slice(0, 10)}
              </span>
            ) : null}
          </div>
          <h1 className="text-4xl font-black uppercase leading-none tracking-wide sm:text-5xl">
            Clarity Ledger
          </h1>
          <div className="my-5 flex flex-wrap items-end gap-7">
            <div>
              <b className="block text-5xl font-black leading-none tracking-tight">
                {nf.format(stats.relations)}
              </b>
              <span className="mt-1.5 block text-[11px] font-extrabold uppercase tracking-[0.16em] text-bauhaus-muted">
                Relations
              </span>
            </div>
            <p className="max-w-[46ch] text-sm text-bauhaus-muted">
              Everything that holds rows: tables, materialized views and views.{' '}
              <b className="text-bauhaus-black">{nf.format(stats.routines)}</b> routines are
              catalogued in their own segment and are deliberately <b>not</b> in this number — they
              will never carry a domain.
            </p>
          </div>
          <div className="grid grid-cols-2 border-l-2 border-t-2 border-bauhaus-black sm:grid-cols-3 lg:grid-cols-6">
            {(
              [
                [nf.format(stats.catalogued), 'Catalogued', ''],
                [nf.format(stats.described), 'Described', ''],
                [`${stats.coveragePct}%`, 'Coverage of relations', ''],
                [nf.format(stats.noTimestampCol), 'No timestamp col', 'text-bauhaus-blue'],
                [nf.format(stats.anonReadable), 'Anon-readable', 'text-bauhaus-red'],
                [nf.format(stats.actBusiness), 'ACT-private', ''],
              ] as const
            ).map(([v, label, tone]) => (
              <div key={label} className={cell}>
                <b className={`block text-xl font-black leading-tight ${tone}`}>{v}</b>
                <span className="mt-1 block text-[9.5px] font-extrabold uppercase tracking-[0.13em] text-bauhaus-muted">
                  {label}
                </span>
              </div>
            ))}
          </div>
        </header>

        <div className="mt-6 grid border-[3px] border-bauhaus-black bg-bauhaus-white lg:grid-cols-[216px_1fr]">
          {/* The rail owns every filter. No header chip row — those read as tabs. */}
          <aside className="border-b-[3px] border-bauhaus-black p-3 lg:border-b-0 lg:border-r-[3px]">
            {(
              [
                ['Domain', facets.domain, domain, setDomain] as const,
                ['Lifecycle', facets.life, life, setLife] as const,
                ['Freshness', facets.fresh, fresh, setFresh] as const,
              ]
            ).map(([label, items, value, set]) => (
              <div key={label} className="mb-4 last:mb-0">
                <h2 className="mb-1.5 text-[11px] font-black uppercase tracking-[0.18em] text-bauhaus-muted">
                  {label}
                </h2>
                {items.map(([v, n]) => (
                  <button
                    key={v}
                    type="button"
                    aria-pressed={value === v}
                    onClick={() => set(value === v ? '' : v)}
                    className={facetBtn(value === v)}
                  >
                    <span>{nice(v)}</span>
                    <i className="not-italic text-[11px] opacity-70">{nf.format(n)}</i>
                  </button>
                ))}
              </div>
            ))}
          </aside>

          <section className="min-w-0">
            <div className="flex flex-wrap border-b-[3px] border-bauhaus-black">
              {SEGMENTS.map((s) => (
                <button
                  key={s}
                  type="button"
                  aria-pressed={seg === s}
                  onClick={() => setSeg(s)}
                  className={`border-r-2 border-bauhaus-black px-3 py-2.5 text-[11px] font-extrabold uppercase tracking-[0.13em] ${
                    seg === s ? 'bg-bauhaus-black text-bauhaus-canvas' : 'bg-bauhaus-white'
                  }`}
                >
                  {s}
                  <em className="ml-1.5 not-italic opacity-60">{nf.format(segCount(s))}</em>
                </button>
              ))}
              {/* A scope boundary, not a warning. Neutral, and the count never leaves the screen. */}
              <button
                type="button"
                aria-pressed={showAct}
                onClick={() => setShowAct((v) => !v)}
                className={`ml-auto border-l-2 border-bauhaus-black px-3 py-2.5 text-[10px] font-extrabold uppercase tracking-[0.12em] ${
                  showAct ? 'bg-bauhaus-black text-bauhaus-canvas' : 'bg-bauhaus-white text-bauhaus-muted'
                }`}
              >
                ACT-private {nf.format(stats.actBusiness)} · {showAct ? 'shown' : 'hidden'}
              </button>
            </div>

            <div className="flex flex-wrap items-center gap-2.5 border-b-2 border-bauhaus-black/15 p-2.5">
              <input
                type="search"
                value={q}
                onChange={(e) => setQ(e.target.value)}
                placeholder="Search name, purpose, join key…"
                aria-label="Search the ledger"
                className="min-w-0 flex-1 border-2 border-bauhaus-black bg-bauhaus-canvas px-2.5 py-1.5 text-sm"
              />
              <div className="flex border-2 border-bauhaus-black">
                {SORTS.map(([k, label]) => (
                  <button
                    key={k}
                    type="button"
                    aria-pressed={sort === k}
                    onClick={() => setSort(k)}
                    className={`px-2.5 py-1.5 text-[10px] font-extrabold uppercase tracking-[0.1em] ${
                      sort === k ? 'bg-bauhaus-black text-bauhaus-canvas' : 'text-bauhaus-muted'
                    }`}
                  >
                    {label}
                  </button>
                ))}
              </div>
              <span className="ml-auto text-[11px] font-extrabold uppercase tracking-[0.1em] text-bauhaus-muted">
                {nf.format(visible.length)} shown
              </span>
            </div>

            <div className="overflow-x-auto">
              <table className="w-full min-w-[780px] border-collapse">
                <thead>
                  <tr className="bg-bauhaus-black text-bauhaus-canvas">
                    {['Object', 'Domain', 'Lifecycle', 'Rows', 'Size', 'Fresh'].map((h, i) => (
                      <th
                        key={h}
                        className={`px-2.5 py-2 text-[9.5px] font-extrabold uppercase tracking-[0.13em] ${
                          i === 3 || i === 4 ? 'text-right' : 'text-left'
                        }`}
                      >
                        {h}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {visible.length === 0 ? (
                    <tr>
                      <td colSpan={6} className="p-9 text-center text-sm text-bauhaus-muted">
                        Nothing matches. Clear a filter.
                      </td>
                    </tr>
                  ) : (
                    visible.map((r) => {
                      const f = FRESH[r.f] ?? FRESH.not_applicable;
                      const isOpen = open === r.n;
                      // A question row opens its worked answer. Everything else expands in place —
                      // the caveat, provenance and permitted phrasing do not fit in a table row
                      // and must never be summarised away.
                      const activate = () => {
                        if (r.qs) router.push(`/clarity/q/${r.qs}`);
                        else setOpen(isOpen ? null : r.n);
                      };
                      return (
                        <Fragment key={r.n}>
                          <tr
                            tabIndex={0}
                            aria-expanded={r.qs ? undefined : isOpen}
                            onClick={activate}
                            onKeyDown={(e) => {
                              if (e.key === 'Enter' || e.key === ' ') {
                                e.preventDefault();
                                activate();
                              }
                            }}
                            className="cursor-pointer border-t border-bauhaus-black/10 hover:bg-bauhaus-canvas"
                          >
                            <td className="break-all px-2.5 py-1.5 text-[13px] font-semibold">
                              <span className="font-mono">{r.n}</span>
                              {r.qs ? (
                                <span className="ml-1.5 border border-bauhaus-blue px-1 text-[9px] font-extrabold uppercase tracking-wider text-bauhaus-blue">
                                  question
                                </span>
                              ) : r.k !== 'table' ? (
                                <span className="ml-1.5 border border-bauhaus-muted px-1 text-[9px] font-extrabold uppercase tracking-wider text-bauhaus-muted">
                                  {r.k}
                                </span>
                              ) : null}
                              {r.qsub ? (
                                <span className="mt-0.5 block text-[11px] font-normal text-bauhaus-muted">
                                  {r.qsub}
                                </span>
                              ) : null}
                            </td>
                            <td className="px-2.5 py-1.5 text-[11.5px]">
                              {r.d ? (
                                nice(r.d)
                              ) : (
                                <span className="text-[11px] font-bold text-bauhaus-blue">unclassified</span>
                              )}
                            </td>
                            <td className="px-2.5 py-1.5 text-[11.5px]">{nice(r.l) || '\u2014'}</td>
                            <td className="px-2.5 py-1.5 text-right font-mono text-[13px]">
                              {/* A question's answer sits where an object's row count sits. Same
                                  column, same scan \u2014 the number is what you came for. */}
                              {r.qh ? (
                                <b className="text-[15px] font-black text-bauhaus-blue">{r.qh}</b>
                              ) : r.r === null ? (
                                '\u2014'
                              ) : (
                                <>
                                  {nf.format(r.r)}
                                  {r.e ? <span className="text-bauhaus-muted"> \u2248</span> : null}
                                </>
                              )}
                            </td>
                            <td className="px-2.5 py-1.5 text-right font-mono text-[13px]">{bytes(r.b)}</td>
                            <td className="px-2.5 py-1.5">
                              {r.f === 'ok' && r.w ? (
                                <span className="text-[12.5px]">{r.w}</span>
                              ) : (
                                <span
                                  title={f.title}
                                  className={`inline-block min-w-[20px] text-center text-lg font-black leading-none ${f.cls}`}
                                >
                                  {f.glyph}
                                </span>
                              )}
                            </td>
                          </tr>
                          {isOpen ? (
                            <tr className="border-t-2 border-bauhaus-black bg-bauhaus-canvas">
                              <td colSpan={6} className="px-4 py-3.5">
                                <dl className="grid max-w-[100ch] grid-cols-[104px_1fr] gap-x-3.5 gap-y-1 text-[13px]">
                                  <dt className={DT}>Purpose</dt>
                                  <dd>
                                    {r.p || (
                                      <span className="font-bold text-bauhaus-blue">
                                        Not described \u2014 never covered by the inventory shards.
                                      </span>
                                    )}
                                  </dd>
                                  <dt className={DT}>Join keys</dt>
                                  <dd className="font-mono">{r.j || '\u2014'}</dd>
                                  <dt className={DT}>Flags</dt>
                                  <dd className={r.v ? 'font-semibold text-bauhaus-red' : ''}>
                                    {r.v || 'None recorded'}
                                  </dd>
                                  <dt className={DT}>Access</dt>
                                  <dd>
                                    RLS {r.rls ? 'on' : <b className="text-bauhaus-red">off</b>}
                                    {' \u00b7 '}
                                    {r.an ? (
                                      <b className="text-bauhaus-red">anon-readable</b>
                                    ) : (
                                      'not anon-readable'
                                    )}
                                    {' \u00b7 '}
                                    {r.c} columns \u00b7 degree {r.g}
                                  </dd>
                                </dl>
                              </td>
                            </tr>
                          ) : null}
                        </Fragment>
                      );
                    })
                  )}
                </tbody>
              </table>
            </div>

            <div className="flex flex-wrap gap-4 border-t-2 border-bauhaus-black/15 p-2.5 text-[11px] font-semibold text-bauhaus-muted">
              <span>
                <b className="text-bauhaus-black">2026-08-15</b> reports a real date
              </span>
              <span>
                <b className="text-lg leading-none text-bauhaus-blue">+</b> no timestamp column —{' '}
                <b>our</b> gap, fixable
              </span>
              <span>
                <b className="text-lg leading-none text-bauhaus-yellow">?</b> too large to probe —
                unmeasurable
              </span>
              <span>
                <b className="text-lg leading-none">—</b> not applicable
              </span>
            </div>
          </section>
        </div>
      </div>
    </main>
  );
}
