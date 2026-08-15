'use client';

import { Fragment, useMemo, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import {
  BASELINES,
  BASELINE_LABEL,
  type Baseline,
  type BaselineAvailability,
  type ChangeEvent,
  type ChangesStats,
} from './types';

const nf = new Intl.NumberFormat('en-AU');

/**
 * Six event types, each with the sentence it means. `refresh_skipped` and
 * `probe_degraded` exist in the enum and are deliberately NOT emitted yet: the
 * catalog does not keep a per-run probe history to compare against, and a type
 * that silently never fires is worse than one that is absent.
 */
const TYPE: Record<string, { label: string; glyph: string }> = {
  row_moved: { label: 'Row move', glyph: '▲' },
  object_new: { label: 'New', glyph: '+' },
  object_missing: { label: 'Gone', glyph: '×' },
  state_change: { label: 'State', glyph: '·' },
  scope_change: { label: 'Scope', glyph: '·' },
  refresh_skipped: { label: 'Refresh', glyph: '·' },
  sentinel_fired: { label: 'Sentinel', glyph: '!' },
  metric_crossed: { label: 'Metric', glyph: '·' },
  probe_degraded: { label: 'Probe', glyph: '?' },
  answer_drift: { label: 'Answer drift', glyph: '≠' },
};

const SEVERITY: Record<string, string> = {
  critical: 'text-bauhaus-red',
  warn: 'text-bauhaus-yellow',
  info: 'text-bauhaus-muted',
};

function when(iso: string): string {
  return new Date(iso)
    .toLocaleDateString('en-AU', { day: '2-digit', month: 'short' })
    .toUpperCase();
}

function pct(v: number | null): string {
  if (v === null) return '?';
  return `${v > 0 ? '+' : ''}${v.toFixed(1)}%`;
}

export default function ChangesClient({
  events,
  availability,
  stats,
  baseline,
}: {
  events: ChangeEvent[];
  availability: BaselineAvailability[];
  stats: ChangesStats;
  baseline: Baseline;
}) {
  const router = useRouter();
  const [type, setType] = useState('');
  const [sev, setSev] = useState('');
  const [q, setQ] = useState('');
  const [open, setOpen] = useState<number | null>(null);
  const [draft, setDraft] = useState('');
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);
  const [saved, setSaved] = useState<Record<number, string>>({});

  const facets = useMemo(() => {
    const tally = (pick: (e: ChangeEvent) => string) => {
      const m = new Map<string, number>();
      for (const e of events) {
        const k = pick(e);
        if (k) m.set(k, (m.get(k) ?? 0) + 1);
      }
      return [...m.entries()].sort((a, b) => b[1] - a[1]);
    };
    return { type: tally((e) => e.event_type), sev: tally((e) => e.severity) };
  }, [events]);

  const visible = useMemo(() => {
    const needle = q.trim().toLowerCase();
    return events.filter((e) => {
      if (type && e.event_type !== type) return false;
      if (sev && e.severity !== sev) return false;
      if (
        needle &&
        !`${e.object_key ?? ''} ${e.question_slug ?? ''} ${e.note ?? ''} ${e.reason ?? ''}`
          .toLowerCase()
          .includes(needle)
      )
        return false;
      return true;
    });
  }, [events, type, sev, q]);

  async function recordReason(id: number) {
    setSaving(true);
    setSaveError(null);
    try {
      const res = await fetch(`/api/clarity/events/${id}/reason`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ reason: draft }),
      });
      const body = (await res.json()) as { error?: string; reason?: string };
      if (!res.ok) throw new Error(body.error ?? `HTTP ${res.status}`);
      setSaved((s) => ({ ...s, [id]: body.reason ?? draft.trim() }));
      setDraft('');
      setOpen(null);
      // The strip counts unexplained events server-side, so it has to re-read.
      router.refresh();
    } catch (e) {
      setSaveError(e instanceof Error ? e.message : String(e));
    } finally {
      setSaving(false);
    }
  }

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
            <Link
              href="/clarity"
              className="border-2 border-bauhaus-black bg-bauhaus-white px-2 py-0.5 text-[10px] font-extrabold uppercase tracking-[0.15em] hover:bg-bauhaus-black hover:text-bauhaus-canvas"
            >
              ◀ The ledger
            </Link>
            {stats.computedAt ? (
              <span className="border-2 border-bauhaus-black bg-bauhaus-white px-2 py-0.5 text-[10px] font-extrabold uppercase tracking-[0.15em]">
                Deltas computed {stats.computedAt.slice(0, 10)}
              </span>
            ) : (
              <span className="border-2 border-bauhaus-blue bg-bauhaus-white px-2 py-0.5 text-[10px] font-extrabold uppercase tracking-[0.15em] text-bauhaus-blue">
                Deltas never computed
              </span>
            )}
          </div>
          <h1 className="text-4xl font-black uppercase leading-none tracking-wide sm:text-5xl">
            What changed
          </h1>

          {/* The baseline is one searchParam and it drives every delta on every
              screen. Options we cannot serve are greyed WITH their reason —
              never silently missing, never rendered as a zero. */}
          <div className="my-5 flex flex-wrap items-center gap-2">
            <span className="text-[11px] font-extrabold uppercase tracking-[0.16em] text-bauhaus-muted">
              Baseline
            </span>
            <div className="flex flex-wrap border-2 border-bauhaus-black">
              {BASELINES.map((b) => {
                const a = availability.find((x) => x.baseline === b);
                const usable = (a?.covered ?? 0) > 0;
                const label = `${BASELINE_LABEL[b]}${
                  usable ? ` · ${nf.format(a?.covered ?? 0)}` : ' · none'
                }`;
                return usable ? (
                  <Link
                    key={b}
                    href={`/clarity/changes?b=${b}`}
                    aria-current={baseline === b ? 'true' : undefined}
                    className={`border-r-2 border-bauhaus-black px-3 py-1.5 text-[10px] font-extrabold uppercase tracking-[0.12em] last:border-r-0 ${
                      baseline === b ? 'bg-bauhaus-black text-bauhaus-canvas' : 'bg-bauhaus-white'
                    }`}
                  >
                    {label}
                  </Link>
                ) : (
                  <span
                    key={b}
                    title={a?.reason ?? 'unavailable'}
                    className="border-r-2 border-bauhaus-black bg-bauhaus-white px-3 py-1.5 text-[10px] font-extrabold uppercase tracking-[0.12em] text-bauhaus-muted opacity-60 last:border-r-0"
                  >
                    {BASELINE_LABEL[b]} — {a?.reason ?? 'unavailable'}
                  </span>
                );
              })}
            </div>
          </div>

          <div className="grid grid-cols-2 border-l-2 border-t-2 border-bauhaus-black sm:grid-cols-4">
            {(
              [
                [nf.format(stats.inWindow), 'Events in window', ''],
                [
                  nf.format(stats.unexplained),
                  'No reason recorded',
                  stats.unexplained ? 'text-bauhaus-red' : '',
                ],
                [nf.format(stats.moved), 'Moved more than 10%', ''],
                [
                  `${nf.format(stats.measurable)} / ${nf.format(stats.objects)}`,
                  'Objects with this baseline',
                  '',
                ],
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
          {stats.measurable < stats.objects ? (
            <p className="mt-2.5 max-w-[70ch] text-[11.5px] text-bauhaus-muted">
              The other {nf.format(stats.objects - stats.measurable)} objects have no baseline this
              far back and render <b className="text-bauhaus-yellow">?</b>, not 0.
              {stats.historyBegins ? (
                <> History begins {stats.historyBegins.slice(0, 10)}.</>
              ) : null}
            </p>
          ) : null}
        </header>

        <div className="mt-6 grid border-[3px] border-bauhaus-black bg-bauhaus-white lg:grid-cols-[216px_1fr]">
          <aside className="border-b-[3px] border-bauhaus-black p-3 lg:border-b-0 lg:border-r-[3px]">
            {(
              [
                ['Type', facets.type, type, setType, (v: string) => TYPE[v]?.label ?? v] as const,
                ['Severity', facets.sev, sev, setSev, (v: string) => v] as const,
              ]
            ).map(([label, items, value, set, render]) => (
              <div key={label} className="mb-4 last:mb-0">
                <h2 className="mb-1.5 text-[11px] font-black uppercase tracking-[0.18em] text-bauhaus-muted">
                  {label}
                </h2>
                {items.length === 0 ? (
                  <p className="px-1.5 text-xs text-bauhaus-muted">Nothing recorded yet.</p>
                ) : (
                  items.map(([v, n]) => (
                    <button
                      key={v}
                      type="button"
                      aria-pressed={value === v}
                      onClick={() => set(value === v ? '' : v)}
                      className={facetBtn(value === v)}
                    >
                      <span>{render(v)}</span>
                      <i className="not-italic text-[11px] opacity-70">{nf.format(n)}</i>
                    </button>
                  ))
                )}
              </div>
            ))}
            <p className="mt-4 border-t-2 border-bauhaus-black/15 pt-2.5 text-[10.5px] leading-snug text-bauhaus-muted">
              An event fires when a row count moves more than 10%, crosses zero, an object appears
              or disappears, its state changes, or an answer&apos;s headline moves more than 10%
              while none of its ingredients moved a row.
            </p>
          </aside>

          <section className="min-w-0">
            <div className="flex flex-wrap items-center gap-2.5 border-b-2 border-bauhaus-black/15 p-2.5">
              <input
                type="search"
                value={q}
                onChange={(e) => setQ(e.target.value)}
                placeholder="Search object, question, note, reason…"
                aria-label="Search the change log"
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
                    {['When', 'Type', 'Object', 'Before', 'After', 'Δ', 'Reason'].map((h, i) => (
                      <th
                        key={h}
                        className={`px-2.5 py-2 text-[9.5px] font-extrabold uppercase tracking-[0.13em] ${
                          i >= 3 && i <= 5 ? 'text-right' : 'text-left'
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
                      <td colSpan={7} className="p-9 text-center text-sm text-bauhaus-muted">
                        {events.length
                          ? 'Nothing matches. Clear a filter.'
                          : 'Nothing has changed since the log started — or the nightly job has not run yet.'}
                      </td>
                    </tr>
                  ) : (
                    visible.map((e) => {
                      const t = TYPE[e.event_type] ?? { label: e.event_type, glyph: '·' };
                      const isOpen = open === e.id;
                      const reason = saved[e.id] ?? e.reason;
                      return (
                        <Fragment key={e.id}>
                          <tr
                            className={`border-t border-bauhaus-black/10 ${
                              !reason && e.severity === 'critical' ? 'bg-bauhaus-red/5' : ''
                            }`}
                          >
                            <td className="whitespace-nowrap px-2.5 py-1.5 font-mono text-[12px]">
                              {when(e.at)}
                            </td>
                            <td className="px-2.5 py-1.5 text-[11.5px]">
                              <span className={`mr-1 font-black ${SEVERITY[e.severity] ?? ''}`}>
                                {t.glyph}
                              </span>
                              {t.label}
                            </td>
                            <td className="break-all px-2.5 py-1.5 text-[13px] font-semibold">
                              {e.question_slug ? (
                                <Link
                                  href={`/clarity/q/${e.question_slug}`}
                                  className="font-mono underline"
                                >
                                  {e.question_slug}
                                </Link>
                              ) : (
                                <span className="font-mono">{e.object_key ?? '—'}</span>
                              )}
                              {e.note ? (
                                <span className="mt-0.5 block text-[11px] font-normal text-bauhaus-muted">
                                  {e.note}
                                </span>
                              ) : null}
                            </td>
                            <td className="px-2.5 py-1.5 text-right font-mono text-[13px]">
                              {e.before_value === null ? '—' : nf.format(Number(e.before_value))}
                            </td>
                            <td className="px-2.5 py-1.5 text-right font-mono text-[13px]">
                              {e.after_value === null ? '—' : nf.format(Number(e.after_value))}
                            </td>
                            <td
                              className={`px-2.5 py-1.5 text-right font-mono text-[13px] font-bold ${
                                e.delta_pct === null
                                  ? 'text-bauhaus-yellow'
                                  : Number(e.delta_pct) < 0
                                    ? 'text-bauhaus-red'
                                    : ''
                              }`}
                            >
                              {pct(e.delta_pct === null ? null : Number(e.delta_pct))}
                            </td>
                            <td className="px-2.5 py-1.5 text-[11.5px]">
                              {reason ? (
                                <span>
                                  {reason}
                                  {e.reason_by ? (
                                    <em className="ml-1 not-italic text-bauhaus-muted">
                                      — {e.reason_by}
                                    </em>
                                  ) : null}
                                </span>
                              ) : e.severity === 'critical' ? (
                                <button
                                  type="button"
                                  onClick={() => {
                                    setOpen(isOpen ? null : e.id);
                                    setDraft('');
                                    setSaveError(null);
                                  }}
                                  className="border-2 border-bauhaus-red px-2 py-0.5 text-[10px] font-extrabold uppercase tracking-[0.12em] text-bauhaus-red hover:bg-bauhaus-red hover:text-bauhaus-canvas"
                                >
                                  No reason recorded →
                                </button>
                              ) : (
                                <span className="text-bauhaus-muted">—</span>
                              )}
                            </td>
                          </tr>
                          {isOpen ? (
                            <tr className="border-t-2 border-bauhaus-black bg-bauhaus-canvas">
                              <td colSpan={7} className="px-4 py-3.5">
                                <label
                                  htmlFor={`reason-${e.id}`}
                                  className="block text-[9.5px] font-extrabold uppercase tracking-[0.12em] text-bauhaus-muted"
                                >
                                  Why did this happen?
                                </label>
                                <div className="mt-1.5 flex flex-wrap gap-2">
                                  <input
                                    id={`reason-${e.id}`}
                                    value={draft}
                                    autoFocus
                                    onChange={(ev) => setDraft(ev.target.value)}
                                    onKeyDown={(ev) => {
                                      if (ev.key === 'Enter' && draft.trim() && !saving)
                                        recordReason(e.id);
                                    }}
                                    placeholder="e.g. staging table truncated after the LGA rebuild — expected"
                                    className="min-w-[280px] flex-1 border-2 border-bauhaus-black bg-bauhaus-white px-2.5 py-1.5 text-sm"
                                  />
                                  <button
                                    type="button"
                                    disabled={!draft.trim() || saving}
                                    onClick={() => recordReason(e.id)}
                                    className="border-2 border-bauhaus-black bg-bauhaus-black px-3 py-1.5 text-[10px] font-extrabold uppercase tracking-[0.12em] text-bauhaus-canvas disabled:opacity-40"
                                  >
                                    {saving ? 'Recording…' : 'Record the reason'}
                                  </button>
                                </div>
                                {saveError ? (
                                  <p className="mt-2 text-[12px] font-bold text-bauhaus-red">
                                    {saveError}
                                  </p>
                                ) : null}
                                <p className="mt-2 max-w-[80ch] text-[11px] text-bauhaus-muted">
                                  A reason is not an approval. It is the sentence the next person
                                  reads instead of re-deriving what happened, and it is what takes
                                  this event off the red strip.
                                </p>
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
                <b className="text-bauhaus-red">Red</b> critical and unexplained
              </span>
              <span>
                <b className="text-bauhaus-yellow">?</b> no baseline — unmeasurable, not zero
              </span>
              <span>
                Unexplained criticals are carried in from outside the window, always.
              </span>
            </div>
          </section>
        </div>
      </div>
    </main>
  );
}
