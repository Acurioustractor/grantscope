'use client';

import { useMemo, useState } from 'react';
import Link from 'next/link';
import {
  AGE_OUT_DAYS,
  bucketOf,
  DETECTOR_LABEL,
  type Bucket,
  type FindingRow,
} from './types';

/**
 * Adjudication happens here but is ENFORCED in /api/clarity/findings (admin-gated). The buttons
 * are conveniences; the API is the guard. Verdicts update optimistically and roll back on error.
 */
export default function FindingsClient({ initial }: { initial: FindingRow[] }) {
  const [findings, setFindings] = useState(initial);
  const [busy, setBusy] = useState<number | null>(null);
  const [note, setNote] = useState<string | null>(null);
  const now = useMemo(() => new Date(), []);

  const buckets = useMemo(() => {
    const b: Record<Bucket, FindingRow[]> = {
      open: [],
      confirmed: [],
      dismissed: [],
      aged_out: [],
    };
    for (const f of findings) b[bucketOf(f, now)].push(f);
    return b;
  }, [findings, now]);

  async function adjudicate(id: number, verdict: 'confirmed' | 'dismissed') {
    const before = findings;
    setBusy(id);
    setFindings((fs) =>
      fs.map((f) =>
        f.id === id ? { ...f, verdict, verdict_at: new Date().toISOString() } : f,
      ),
    );
    try {
      const res = await fetch('/api/clarity/findings', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'verdict', id, verdict }),
      });
      if (!res.ok) throw new Error((await res.json())?.error ?? `HTTP ${res.status}`);
    } catch (e) {
      setFindings(before);
      setNote(`Verdict failed: ${e instanceof Error ? e.message : String(e)}`);
    } finally {
      setBusy(null);
    }
  }

  async function runDetectors() {
    setNote('Running detectors…');
    try {
      const res = await fetch('/api/clarity/findings', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'run' }),
      });
      const body = (await res.json()) as { counts?: Record<string, number>; error?: string };
      if (!res.ok) throw new Error(body.error ?? `HTTP ${res.status}`);
      setNote(
        `Detectors ran: ${Object.entries(body.counts ?? {})
          .map(([k, v]) => `${k} ${v}`)
          .join(' · ')}. Reload to see new findings.`,
      );
    } catch (e) {
      setNote(`Run failed: ${e instanceof Error ? e.message : String(e)}`);
    }
  }

  return (
    <>
      <header className="border-4 border-bauhaus-black bg-bauhaus-white p-5">
        <div className="flex flex-wrap items-baseline justify-between gap-3">
          <h1 className="font-mono text-2xl font-black">Findings</h1>
          <button
            onClick={runDetectors}
            className="border-2 border-bauhaus-black px-3 py-1 font-mono text-[11px] font-black uppercase tracking-widest hover:bg-bauhaus-black hover:text-bauhaus-canvas"
          >
            Run detectors
          </button>
        </div>
        <p className="mt-2 max-w-[75ch] text-[14px] leading-relaxed text-neutral-700">
          The system proposes; you adjudicate. An unconfirmed finding never counts as true, and
          after {AGE_OUT_DAYS} days unadjudicated it ages out of this list rather than piling up.
          Two detectors so far: <strong>undiscovered join</strong> (an identifier column proven as
          a join key elsewhere, on an object with no edge on it) and <strong>orphan</strong> (a
          populated relation nothing references — measured, not assumed, since the 6b scanner).
        </p>
        <p className="mt-2 font-mono text-[11px] uppercase tracking-widest text-neutral-500">
          open {buckets.open.length} · confirmed {buckets.confirmed.length} · dismissed{' '}
          {buckets.dismissed.length} · aged out {buckets.aged_out.length}
        </p>
        {note ? (
          <p className="mt-2 border-l-4 border-bauhaus-blue pl-3 font-mono text-[12px]">{note}</p>
        ) : null}
      </header>

      {(
        [
          ['open', 'Open — awaiting a verdict'],
          ['confirmed', 'Confirmed'],
          ['dismissed', 'Dismissed'],
          ['aged_out', `Aged out — unadjudicated past ${AGE_OUT_DAYS} days`],
        ] as const
      ).map(([bucket, label]) =>
        buckets[bucket].length === 0 ? null : (
          <section key={bucket} className="mt-4 border-4 border-bauhaus-black bg-bauhaus-white">
            <h2 className="border-b-2 border-bauhaus-black px-4 py-2 font-mono text-[11px] font-black uppercase tracking-widest">
              {label} · {buckets[bucket].length}
            </h2>
            <ul>
              {buckets[bucket].map((f) => (
                <li
                  key={f.id}
                  className="flex flex-wrap items-center gap-x-3 gap-y-1 border-b border-neutral-200 px-4 py-2 last:border-b-0"
                >
                  <span
                    className={`border-2 px-1.5 py-0.5 font-mono text-[10px] font-black uppercase tracking-widest ${
                      f.detector === 'orphan'
                        ? 'border-bauhaus-red text-bauhaus-red'
                        : 'border-bauhaus-blue text-bauhaus-blue'
                    }`}
                  >
                    {DETECTOR_LABEL[f.detector]}
                  </span>
                  <Link
                    href={`/clarity/o/${encodeURIComponent(f.subject_object_key)}`}
                    className="font-mono text-[12.5px] font-semibold text-bauhaus-blue underline"
                  >
                    {f.subject_object_key}
                  </Link>
                  <span className="min-w-0 flex-1 text-[13px] text-neutral-700">{f.title}</span>
                  <span className="font-mono text-[10px] uppercase tracking-widest text-neutral-400">
                    {f.proposed_at.slice(0, 10)}
                  </span>
                  {f.verdict === null ? (
                    <span className="flex gap-1.5">
                      <button
                        disabled={busy === f.id}
                        onClick={() => adjudicate(f.id, 'confirmed')}
                        className="border-2 border-bauhaus-black px-2 py-0.5 font-mono text-[10px] font-black uppercase tracking-widest hover:bg-bauhaus-black hover:text-bauhaus-canvas disabled:opacity-40"
                      >
                        Confirm
                      </button>
                      <button
                        disabled={busy === f.id}
                        onClick={() => adjudicate(f.id, 'dismissed')}
                        className="border-2 border-neutral-400 px-2 py-0.5 font-mono text-[10px] font-black uppercase tracking-widest text-neutral-500 hover:border-bauhaus-black hover:text-bauhaus-black disabled:opacity-40"
                      >
                        Dismiss
                      </button>
                    </span>
                  ) : (
                    <span className="font-mono text-[10px] uppercase tracking-widest text-neutral-500">
                      {f.verdict}
                      {f.verdict_by ? ` · ${f.verdict_by}` : ''}
                    </span>
                  )}
                </li>
              ))}
            </ul>
          </section>
        ),
      )}
    </>
  );
}
