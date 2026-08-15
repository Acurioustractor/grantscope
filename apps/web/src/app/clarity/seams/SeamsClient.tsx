'use client';

import { Fragment, useMemo, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { STATE_GLYPH, isFrayed, seamState, type SeamRow, type SeamState } from './types';

const nf = new Intl.NumberFormat('en-AU');

const STATES: SeamState[] = [
  'dead',
  'never_populated',
  'poor',
  'fair',
  'good',
  'refused',
  'unmeasured',
];

export default function SeamsClient({ seams }: { seams: SeamRow[] }) {
  const router = useRouter();
  const [state, setState] = useState<SeamState | ''>('');
  const [mech, setMech] = useState('');
  const [q, setQ] = useState('');
  const [open, setOpen] = useState<number | null>(null);
  const [measuring, setMeasuring] = useState(false);
  const [measureNote, setMeasureNote] = useState<string | null>(null);

  const withState = useMemo(
    () => seams.map((s) => ({ ...s, st: seamState(s) })),
    [seams],
  );

  const counts = useMemo(() => {
    const m = new Map<SeamState, number>();
    const mm = new Map<string, number>();
    for (const s of withState) {
      m.set(s.st, (m.get(s.st) ?? 0) + 1);
      mm.set(s.mechanism, (mm.get(s.mechanism) ?? 0) + 1);
    }
    return { state: m, mech: [...mm.entries()].sort((a, b) => b[1] - a[1]) };
  }, [withState]);

  const visible = useMemo(() => {
    const needle = q.trim().toLowerCase();
    return withState.filter((s) => {
      if (state && s.st !== state) return false;
      if (mech && s.mechanism !== mech) return false;
      if (
        needle &&
        !`${s.src_object}.${s.src_column} ${s.tgt_object}.${s.tgt_column}`
          .toLowerCase()
          .includes(needle)
      )
        return false;
      return true;
    });
  }, [withState, state, mech, q]);

  const measured = withState.filter((s) => s.st !== 'unmeasured').length;
  const losing = withState.reduce((n, s) => n + Number(s.rows_losing ?? 0), 0);

  async function measureBatch() {
    setMeasuring(true);
    setMeasureNote(null);
    try {
      const res = await fetch('/api/clarity/seams/measure', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ limit: 25 }),
      });
      const body = (await res.json()) as { error?: string; measured?: number; refused?: number };
      if (!res.ok) throw new Error(body.error ?? `HTTP ${res.status}`);
      setMeasureNote(
        `Measured ${body.measured ?? 0} seams, ${body.refused ?? 0} refused as too slow.`,
      );
      router.refresh();
    } catch (e) {
      setMeasureNote(e instanceof Error ? e.message : String(e));
    } finally {
      setMeasuring(false);
    }
  }

  const cell = 'border-r-2 border-b-2 border-bauhaus-black bg-bauhaus-white px-3 py-2.5';

  return (
    <main className="min-h-screen bg-bauhaus-canvas">
      <div className="mx-auto max-w-[1400px] px-4 pb-24">
        <header className="border-b-4 border-bauhaus-black pt-8">
          <div className="mb-4 flex flex-wrap items-center gap-2">
            {[
              ['/clarity', '◀ The ledger'],
              ['/clarity/changes', 'What changed'],
              ['/clarity/cross', 'Cross-sections'],
              ['/clarity/wants', 'The want list'],
            ].map(([href, label]) => (
              <Link
                key={href}
                href={href}
                className="border-2 border-bauhaus-black bg-bauhaus-white px-2 py-0.5 text-[10px] font-extrabold uppercase tracking-[0.15em] hover:bg-bauhaus-black hover:text-bauhaus-canvas"
              >
                {label}
              </Link>
            ))}
          </div>
          <h1 className="text-4xl font-black uppercase leading-none tracking-wide sm:text-5xl">
            The seams
          </h1>
          <p className="mt-3 max-w-[64ch] text-sm text-bauhaus-muted">
            Every connection, ranked by how much data it is losing right now. Not{' '}
            <i>is it connected</i> — with {nf.format(seams.length)} declared joins the answer is
            almost always yes and almost never interesting.
          </p>

          <div className="mt-5 grid grid-cols-2 border-l-2 border-t-2 border-bauhaus-black sm:grid-cols-4">
            {(
              [
                [nf.format(seams.length), 'Seams catalogued', ''],
                [
                  `${nf.format(measured)} / ${nf.format(seams.length)}`,
                  'Ever measured',
                  measured === 0 ? 'text-bauhaus-blue' : '',
                ],
                [
                  nf.format(
                    (counts.state.get('dead') ?? 0) + (counts.state.get('never_populated') ?? 0),
                  ),
                  'Dead or never filled',
                  'text-bauhaus-red',
                ],
                [nf.format(losing), 'Rows losing', losing ? 'text-bauhaus-red' : ''],
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

          {measured === 0 ? (
            <div className="mt-3 border-2 border-bauhaus-blue bg-bauhaus-white p-3">
              <p className="max-w-[76ch] text-[12.5px]">
                <b className="text-bauhaus-blue">Not one seam has ever been measured.</b> Every rate
                below reads <b className="text-bauhaus-blue">+</b>, never 0% — we have not looked,
                which is a different fact from a join that carries nothing. Measuring runs in
                batches of 25 under an 8-second cap per probe, because an unbounded sweep over
                every seam on a shared pooler is how you take the database down.
              </p>
              <button
                type="button"
                onClick={measureBatch}
                disabled={measuring}
                className="mt-2.5 border-2 border-bauhaus-black bg-bauhaus-black px-3 py-1.5 text-[10px] font-extrabold uppercase tracking-[0.12em] text-bauhaus-canvas disabled:opacity-40"
              >
                {measuring ? 'Measuring…' : 'Measure the next 25 →'}
              </button>
              {measureNote ? (
                <p className="mt-2 text-[12px] font-bold">{measureNote}</p>
              ) : null}
            </div>
          ) : null}
        </header>

        <div className="mt-6 grid border-[3px] border-bauhaus-black bg-bauhaus-white lg:grid-cols-[216px_1fr]">
          <aside className="border-b-[3px] border-bauhaus-black p-3 lg:border-b-0 lg:border-r-[3px]">
            <h2 className="mb-1.5 text-[11px] font-black uppercase tracking-[0.18em] text-bauhaus-muted">
              State
            </h2>
            {STATES.map((s) => (
              <button
                key={s}
                type="button"
                aria-pressed={state === s}
                onClick={() => setState(state === s ? '' : s)}
                className={`flex w-full items-center justify-between gap-2 px-1.5 py-0.5 text-left text-xs ${
                  state === s ? 'bg-bauhaus-black font-bold text-bauhaus-canvas' : 'hover:bg-bauhaus-canvas'
                }`}
              >
                <span>
                  <b className={state === s ? '' : STATE_GLYPH[s].cls}>{STATE_GLYPH[s].glyph}</b>{' '}
                  {s}
                </span>
                <i className="not-italic text-[11px] opacity-70">
                  {nf.format(counts.state.get(s) ?? 0)}
                </i>
              </button>
            ))}

            <h2 className="mb-1.5 mt-4 text-[11px] font-black uppercase tracking-[0.18em] text-bauhaus-muted">
              Mechanism
            </h2>
            {counts.mech.map(([m, n]) => (
              <button
                key={m}
                type="button"
                aria-pressed={mech === m}
                onClick={() => setMech(mech === m ? '' : m)}
                className={`flex w-full items-center justify-between gap-2 px-1.5 py-0.5 text-left text-xs ${
                  mech === m ? 'bg-bauhaus-black font-bold text-bauhaus-canvas' : 'hover:bg-bauhaus-canvas'
                }`}
              >
                <span>{m}</span>
                <i className="not-italic text-[11px] opacity-70">{nf.format(n)}</i>
              </button>
            ))}

            <p className="mt-4 border-t-2 border-bauhaus-black/15 pt-2.5 text-[10.5px] leading-snug text-bauhaus-muted">
              View lineage is excluded on purpose: a view reading a table is not a join and has no
              match rate to measure.
            </p>
          </aside>

          <section className="min-w-0">
            <div className="flex flex-wrap items-center gap-2.5 border-b-2 border-bauhaus-black/15 p-2.5">
              <input
                type="search"
                value={q}
                onChange={(e) => setQ(e.target.value)}
                placeholder="Search either side of the join…"
                aria-label="Search the seams"
                className="min-w-0 flex-1 border-2 border-bauhaus-black bg-bauhaus-canvas px-2.5 py-1.5 text-sm"
              />
              <span className="text-[11px] font-extrabold uppercase tracking-[0.1em] text-bauhaus-muted">
                {nf.format(visible.length)} shown
              </span>
            </div>

            <div className="overflow-x-auto">
              <table className="w-full min-w-[820px] border-collapse">
                <thead>
                  <tr className="bg-bauhaus-black text-bauhaus-canvas">
                    {['From', 'To', 'Match', 'Losing', 'Grain'].map((h, i) => (
                      <th
                        key={h}
                        className={`px-2.5 py-2 text-[9.5px] font-extrabold uppercase tracking-[0.13em] ${
                          i >= 2 && i <= 3 ? 'text-right' : 'text-left'
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
                      <td colSpan={5} className="p-9 text-center text-sm text-bauhaus-muted">
                        Nothing matches. Clear a filter.
                      </td>
                    </tr>
                  ) : (
                    visible.map((s) => {
                      const g = STATE_GLYPH[s.st];
                      const isOpen = open === s.id;
                      const frayed = isFrayed(s.grain);
                      return (
                        <Fragment key={s.id}>
                          <tr
                            tabIndex={0}
                            onClick={() => setOpen(isOpen ? null : s.id)}
                            onKeyDown={(e) => {
                              if (e.key === 'Enter' || e.key === ' ') {
                                e.preventDefault();
                                setOpen(isOpen ? null : s.id);
                              }
                            }}
                            className="cursor-pointer border-t border-bauhaus-black/10 hover:bg-bauhaus-canvas"
                          >
                            <td className="break-all px-2.5 py-1.5 font-mono text-[12.5px]">
                              {s.src_object}.<b>{s.src_column}</b>
                            </td>
                            <td className="break-all px-2.5 py-1.5 font-mono text-[12.5px]">
                              {s.tgt_object}.<b>{s.tgt_column}</b>
                            </td>
                            <td className="px-2.5 py-1.5 text-right font-mono text-[12.5px]">
                              <span title={g.label} className={`mr-1 font-black ${g.cls}`}>
                                {g.glyph}
                              </span>
                              {s.match_rate === null
                                ? ''
                                : `${(Number(s.match_rate) * 100).toFixed(1)}%`}
                            </td>
                            <td className="px-2.5 py-1.5 text-right font-mono text-[12.5px] font-bold">
                              {s.rows_losing ? nf.format(Number(s.rows_losing)) : '—'}
                            </td>
                            <td className="px-2.5 py-1.5 text-[11.5px]">
                              {frayed ? (
                                <b className="text-bauhaus-red">{s.grain}</b>
                              ) : (
                                (s.grain ?? '—')
                              )}
                            </td>
                          </tr>
                          {isOpen ? (
                            <tr className="border-t-2 border-bauhaus-black bg-bauhaus-canvas">
                              <td colSpan={5} className="px-4 py-3.5 text-[13px]">
                                {s.st === 'never_populated' ? (
                                  <p>
                                    <b className="text-bauhaus-red">
                                      Declared, and never populated.
                                    </b>{' '}
                                    The key column holds no values at all across{' '}
                                    {nf.format(Number(s.rows_at_stake ?? 0))} rows, so there is
                                    nothing to resolve. This is not a broken join — it is a bridge
                                    nobody has ever driven across.
                                  </p>
                                ) : s.st === 'unmeasured' ? (
                                  <p>
                                    <b className="text-bauhaus-blue">Never measured.</b> This reads{' '}
                                    <b>+</b> and not 0% because we have not looked. Run a measuring
                                    batch to give it a number.
                                  </p>
                                ) : (
                                  <p>
                                    {nf.format(Number(s.match_numerator ?? 0))} of{' '}
                                    {nf.format(Number(s.match_denominator ?? 0))} non-null keys
                                    resolve
                                    {s.rows_at_stake
                                      ? `, out of ${nf.format(Number(s.rows_at_stake))} rows on the fact side`
                                      : ''}
                                    . Method{' '}
                                    <code className="font-mono">{s.match_method ?? 'unknown'}</code>
                                    {s.match_measured_at
                                      ? `, measured ${s.match_measured_at.slice(0, 10)}`
                                      : ''}
                                    .
                                  </p>
                                )}
                                {frayed ? (
                                  <p className="mt-1.5 font-semibold text-bauhaus-red">
                                    Grain defect: {s.grain}. Every key resolves and each resolves to
                                    several rows, so anything aggregating across this join
                                    multiplies its own numbers. A match rate would never show this.
                                  </p>
                                ) : null}
                                {s.note ? (
                                  <p className="mt-1.5 text-bauhaus-muted">{s.note}</p>
                                ) : null}
                                {s.match_delta !== null ? (
                                  <p className="mt-1.5">
                                    Moved {(Number(s.match_delta) * 100).toFixed(1)}pp since the
                                    previous measurement.
                                  </p>
                                ) : null}
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
              {STATES.map((s) => (
                <span key={s}>
                  <b className={STATE_GLYPH[s].cls}>{STATE_GLYPH[s].glyph}</b> {STATE_GLYPH[s].label}
                </span>
              ))}
            </div>
          </section>
        </div>

        <p className="mt-6 max-w-[80ch] border-2 border-bauhaus-black bg-bauhaus-white p-3 text-[12px]">
          <b>No graph here.</b> The schema graph is small enough to draw honestly, but every defect
          worth finding — a dead key namespace, a bridge declared and never populated, a frayed
          grain — is a number in this table and is invisible as a line between two boxes. If the
          drawing earns its place later it goes behind a button, with a refusal above 200 nodes.
        </p>
      </div>
    </main>
  );
}
