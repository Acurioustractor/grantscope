'use client';

import { useMemo, useState } from 'react';
import Link from 'next/link';
import { NOUN_LABEL, unfiledReason, type Noun } from '../nouns';

export interface UnfiledRow {
  object_key: string;
  object_name: string;
  object_kind: string;
  domain: string | null;
  row_count: number | null;
  purpose: string | null;
  noun_proposed: Exclude<Noun, 'unfiled'> | null;
}

const FILEABLE: Exclude<Noun, 'unfiled'>[] = [
  'money',
  'organisations',
  'people',
  'places',
  'evidence',
  'machine',
];

/**
 * The adjudication surface for nouns. A proposal (from the name heuristics in the noun migration)
 * is a HIGHLIGHTED BUTTON, never a filing — clicking is the confirmation, and the API records who
 * and when through the verdict columns. Filed rows leave the list; the counter is the progress bar.
 */
export default function UnfiledClient({ initial, total }: { initial: UnfiledRow[]; total: number }) {
  const [rows, setRows] = useState(initial);
  const [busy, setBusy] = useState<string | null>(null);
  const [note, setNote] = useState<string | null>(null);
  const filedThisSession = initial.length - rows.length;

  const proposedCount = useMemo(() => rows.filter((r) => r.noun_proposed).length, [rows]);

  async function file(objectKey: string, noun: Exclude<Noun, 'unfiled'>) {
    const before = rows;
    setBusy(objectKey);
    setRows((rs) => rs.filter((r) => r.object_key !== objectKey));
    try {
      const res = await fetch('/api/clarity/nouns', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ object_key: objectKey, noun }),
      });
      if (!res.ok) throw new Error((await res.json())?.error ?? `HTTP ${res.status}`);
    } catch (e) {
      setRows(before);
      setNote(`Filing failed: ${e instanceof Error ? e.message : String(e)}`);
    } finally {
      setBusy(null);
    }
  }

  return (
    <>
      <header className="border-4 border-bauhaus-black bg-bauhaus-white p-5">
        <h1 className="font-mono text-2xl font-black">The unfiled</h1>
        <p className="mt-2 max-w-[75ch] text-[14px] leading-relaxed text-neutral-700">
          {rows.length.toLocaleString('en-AU')} of {total.toLocaleString('en-AU')} objects have no
          confirmed noun. Rules propose ({proposedCount} carry a highlighted guess from the name
          heuristics); clicking a noun is the confirmation, recorded with who and when. An object
          filed wrongly is worse than an object left here — skip anything you are not sure of.
        </p>
        {filedThisSession > 0 ? (
          <p className="mt-2 font-mono text-[11px] uppercase tracking-widest text-neutral-500">
            {filedThisSession} filed this session
          </p>
        ) : null}
        {note ? (
          <p className="mt-2 border-l-4 border-bauhaus-red pl-3 font-mono text-[12px]">{note}</p>
        ) : null}
      </header>

      <section className="mt-4 border-4 border-bauhaus-black bg-bauhaus-white">
        <ul>
          {rows.map((r) => (
            <li
              key={r.object_key}
              className="flex flex-wrap items-center gap-x-3 gap-y-1.5 border-b border-neutral-200 px-4 py-2 last:border-b-0"
            >
              <Link
                href={`/clarity/o/${encodeURIComponent(r.object_key)}`}
                className="font-mono text-[12.5px] font-semibold text-bauhaus-blue underline"
              >
                {r.object_name}
              </Link>
              <span className="font-mono text-[10px] uppercase tracking-widest text-neutral-400">
                {r.object_kind}
                {r.row_count != null ? ` · ${r.row_count.toLocaleString('en-AU')} rows` : ''}
              </span>
              {unfiledReason(r.domain) ? (
                <span className="font-mono text-[10px] uppercase tracking-widest text-neutral-500">
                  {unfiledReason(r.domain)}
                </span>
              ) : null}
              <span className="ml-auto flex flex-wrap gap-1">
                {FILEABLE.map((n) => (
                  <button
                    key={n}
                    disabled={busy === r.object_key}
                    onClick={() => file(r.object_key, n)}
                    className={`border-2 px-1.5 py-0.5 font-mono text-[10px] font-black uppercase tracking-widest disabled:opacity-40 ${
                      r.noun_proposed === n
                        ? 'border-bauhaus-blue bg-bauhaus-blue text-white hover:bg-bauhaus-black hover:border-bauhaus-black'
                        : 'border-neutral-300 text-neutral-500 hover:border-bauhaus-black hover:text-bauhaus-black'
                    }`}
                    title={r.noun_proposed === n ? 'proposed by the name heuristic' : undefined}
                  >
                    {NOUN_LABEL[n]}
                  </button>
                ))}
              </span>
            </li>
          ))}
        </ul>
        {rows.length === 0 ? (
          <p className="p-4 font-mono text-[12px] text-neutral-500">
            Nothing unfiled. The progress bar is full.
          </p>
        ) : null}
      </section>
    </>
  );
}
