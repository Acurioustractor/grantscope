'use client';

import { useMemo, useState } from 'react';
import Link from 'next/link';
import {
  effortLabel,
  formatMetric,
  isImproving,
  movement,
  movementLabel,
  rankWants,
  targetLabel,
  type WantRow,
} from './types';

const nf = new Intl.NumberFormat('en-AU');

const EFFORTS = ['S', 'M', 'L', 'unpriced'] as const;
type EffortFilter = (typeof EFFORTS)[number];

function matchesEffort(w: WantRow, f: EffortFilter): boolean {
  return f === 'unpriced' ? !w.effort_known : w.unlock_effort === f;
}

export default function WantsClient({ wants }: { wants: WantRow[] }) {
  const [effort, setEffort] = useState<EffortFilter | ''>('');
  const [subject, setSubject] = useState('');

  const ranked = useMemo(() => rankWants(wants), [wants]);

  const subjects = useMemo(() => {
    const m = new Map<string, number>();
    for (const w of ranked) m.set(w.subject, (m.get(w.subject) ?? 0) + 1);
    return [...m.entries()].sort((a, b) => b[1] - a[1]);
  }, [ranked]);

  const visible = useMemo(
    () =>
      ranked.filter(
        (w) => (!effort || matchesEffort(w, effort)) && (!subject || w.subject === subject),
      ),
    [ranked, effort, subject],
  );

  const cheap = ranked.filter((w) => w.unlock_effort === 'S').length;
  const unpriced = ranked.filter((w) => !w.effort_known).length;
  const stalled = ranked.filter((w) => movement(w) === 'stalled').length;
  const unwatched = ranked.filter((w) => movement(w) === 'unmeasured').length;

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
              ['/clarity/seams', 'The seams'],
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
            The want list
          </h1>
          <p className="mt-3 max-w-[68ch] text-sm text-bauhaus-muted">
            Every gap with a price and a payoff — the coverage bar, inverted. Ranked by questions
            unlocked × dollars made legible ÷ effort. Every row is derived from a question that
            cannot be answered; nothing here is typed by hand that the registry did not already
            have to hold.
          </p>

          <div className="mt-5 grid grid-cols-2 border-l-2 border-t-2 border-bauhaus-black sm:grid-cols-4">
            {(
              [
                [nf.format(ranked.length), 'Questions we cannot answer', ''],
                [nf.format(cheap), 'Fixes of effort S', cheap ? 'text-bauhaus-blue' : ''],
                [
                  nf.format(stalled),
                  'Measured twice, not moved',
                  stalled ? 'text-bauhaus-red' : '',
                ],
                [nf.format(unpriced), 'Nobody has priced', unpriced ? 'text-bauhaus-red' : ''],
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

          {unwatched === ranked.length && ranked.length > 0 ? (
            <p className="mt-3 max-w-[80ch] border-2 border-bauhaus-blue bg-bauhaus-white p-3 text-[12.5px]">
              <b className="text-bauhaus-blue">No want has been watched twice yet.</b> Every row
              reads <i>no trend yet</i> rather than <i>+0/wk</i>. A gap that has not moved is a
              finding; a gap nobody has measured twice is not, and printing 0 for both would accuse
              the work of being stuck when the truth is that nobody has looked. The second
              measurement lands on the nightly job.
            </p>
          ) : null}
        </header>

        <div className="mt-6 grid border-[3px] border-bauhaus-black bg-bauhaus-white lg:grid-cols-[216px_1fr]">
          <aside className="border-b-[3px] border-bauhaus-black p-3 lg:border-b-0 lg:border-r-[3px]">
            <h2 className="mb-1.5 text-[11px] font-black uppercase tracking-[0.18em] text-bauhaus-muted">
              Effort
            </h2>
            {EFFORTS.map((e) => (
              <button
                key={e}
                type="button"
                aria-pressed={effort === e}
                onClick={() => setEffort(effort === e ? '' : e)}
                className={`flex w-full items-center justify-between gap-2 px-1.5 py-0.5 text-left text-xs ${
                  effort === e
                    ? 'bg-bauhaus-black font-bold text-bauhaus-canvas'
                    : 'hover:bg-bauhaus-canvas'
                }`}
              >
                <span>{e === 'unpriced' ? 'not priced' : `effort ${e}`}</span>
                <i className="not-italic text-[11px] opacity-70">
                  {nf.format(ranked.filter((w) => matchesEffort(w, e)).length)}
                </i>
              </button>
            ))}

            <h2 className="mb-1.5 mt-4 text-[11px] font-black uppercase tracking-[0.18em] text-bauhaus-muted">
              Subject
            </h2>
            {subjects.map(([s, n]) => (
              <button
                key={s}
                type="button"
                aria-pressed={subject === s}
                onClick={() => setSubject(subject === s ? '' : s)}
                className={`flex w-full items-center justify-between gap-2 px-1.5 py-0.5 text-left text-xs ${
                  subject === s
                    ? 'bg-bauhaus-black font-bold text-bauhaus-canvas'
                    : 'hover:bg-bauhaus-canvas'
                }`}
              >
                <span>{s}</span>
                <i className="not-italic text-[11px] opacity-70">{nf.format(n)}</i>
              </button>
            ))}

            <p className="mt-4 border-t-2 border-bauhaus-black/15 pt-2.5 text-[10.5px] leading-snug text-bauhaus-muted">
              <b>Not priced</b> is not a synonym for large. It means nobody has scoped the fix, so
              the row ranks at the bottom band and says so, rather than carrying a guess into the
              ranking.
            </p>
          </aside>

          <section className="min-w-0">
            <div className="border-b-2 border-bauhaus-black/15 p-2.5 text-[11px] font-extrabold uppercase tracking-[0.1em] text-bauhaus-muted">
              {nf.format(visible.length)} shown
            </div>

            {visible.length === 0 ? (
              <p className="p-9 text-center text-sm text-bauhaus-muted">
                Nothing matches. Clear a filter.
              </p>
            ) : (
              <ol>
                {visible.map((w, i) => {
                  const improving = isImproving(w);
                  return (
                    <li
                      key={w.slug}
                      className="grid gap-x-4 gap-y-2 border-b-2 border-bauhaus-black/10 p-3.5 sm:grid-cols-[2.2rem_1fr_7rem]"
                    >
                      <b className="font-mono text-lg font-black leading-none">{i + 1}</b>

                      <div className="min-w-0">
                        <Link
                          href={`/clarity/q/${w.slug}`}
                          className="text-sm font-black uppercase tracking-wide hover:underline"
                        >
                          {w.stub}
                        </Link>
                        <p className="mt-0.5 text-[13px] text-bauhaus-muted">{w.question}</p>

                        {w.unlock_note ? (
                          <p className="mt-2 max-w-[86ch] text-[13px]">{w.unlock_note}</p>
                        ) : (
                          <p className="mt-2 text-[13px] font-semibold text-bauhaus-red">
                            Nobody has written down what closing this would take.
                          </p>
                        )}

                        <div className="mt-2 flex flex-wrap items-center gap-x-4 gap-y-1 text-[11.5px]">
                          <span className="font-extrabold uppercase tracking-[0.1em]">
                            {w.also_blocks > 0
                              ? `Unlocks ${nf.format(w.also_blocks + 1)} questions`
                              : 'Unlocks this question'}
                          </span>
                          {w.blocker_objects.length > 0 ? (
                            <span className="font-mono text-bauhaus-muted">
                              blocked by{' '}
                              {w.blocker_objects.map((b) => b.object_name).join(', ')}
                            </span>
                          ) : null}
                          {w.licence_note ? (
                            <span className="text-bauhaus-muted">{w.licence_note}</span>
                          ) : null}
                        </div>
                      </div>

                      <div className="sm:text-right">
                        <b
                          className={`block text-[10px] font-extrabold uppercase tracking-[0.12em] ${
                            w.effort_known ? '' : 'text-bauhaus-red'
                          }`}
                        >
                          {effortLabel(w)}
                        </b>

                        {w.metric_now !== null ? (
                          <>
                            <b className="mt-1 block font-mono text-xl font-black leading-tight">
                              {formatMetric(w.metric_now, w.metric_unit)}
                            </b>
                            <span className="block text-[10.5px] text-bauhaus-muted">
                              {targetLabel(w)}
                            </span>
                            {w.metric_numerator !== null && w.metric_denominator !== null ? (
                              <span className="block font-mono text-[10.5px] text-bauhaus-muted">
                                {nf.format(Number(w.metric_numerator))} /{' '}
                                {nf.format(Number(w.metric_denominator))}
                              </span>
                            ) : null}
                          </>
                        ) : (
                          <b className="mt-1 block font-mono text-lg font-black leading-tight text-bauhaus-blue">
                            +
                          </b>
                        )}

                        <span
                          className={`mt-1 block text-[11px] font-bold ${
                            movement(w) === 'stalled'
                              ? 'text-bauhaus-red'
                              : improving === false
                                ? 'text-bauhaus-red'
                                : improving === true
                                  ? 'text-bauhaus-blue'
                                  : 'text-bauhaus-muted'
                          }`}
                        >
                          {movementLabel(w)}
                        </span>
                        {w.eta_weeks !== null ? (
                          <span className="block text-[10.5px] text-bauhaus-muted">
                            {nf.format(Number(w.eta_weeks))} wk to target at this rate
                          </span>
                        ) : null}
                      </div>
                    </li>
                  );
                })}
              </ol>
            )}
          </section>
        </div>

        <p className="mt-6 max-w-[80ch] border-2 border-bauhaus-black bg-bauhaus-white p-3 text-[12px]">
          <b>Every row here also renders where it blocks.</b> A separate gaps page is a page nobody
          opens. These same wants appear on the question they stall, so the cost of the gap is read
          by whoever hits it rather than by whoever goes looking for it.
        </p>
      </div>
    </main>
  );
}
