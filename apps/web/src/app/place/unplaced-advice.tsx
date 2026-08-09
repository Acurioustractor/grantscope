'use client';

import { useState } from 'react';

/**
 * The unplaced list as a question you can answer in a room.
 *
 * Each row is an organisation the registers cannot place. A person who knows
 * the place taps "Belongs here" (or names somewhere else), and the advice
 * lands in the same review queue as the correction form — structured, keyed
 * by gs_id, and read by a person before anything on the map changes. Nothing
 * here writes to the register: local knowledge is evidence for the verdict
 * loop, not a direct edit.
 */

export interface AdviceOrg {
  gsId: string;
  name: string;
  postcode: string;
  communityControlled: boolean;
}

interface UnplacedAdviceListProps {
  orgs: AdviceOrg[];
  /** The council this page is about — the "belongs here" target. */
  lgaName: string;
  pageRoute: string;
}

type RowState =
  | { kind: 'idle' }
  | { kind: 'elsewhere' }
  | { kind: 'sending' }
  | { kind: 'sent'; where: string }
  | { kind: 'failed' };

export function UnplacedAdviceList({ orgs, lgaName, pageRoute }: UnplacedAdviceListProps) {
  const [rows, setRows] = useState<Record<string, RowState>>({});
  const [sessionNote, setSessionNote] = useState('');

  function setRow(gsId: string, state: RowState) {
    setRows(prev => ({ ...prev, [gsId]: state }));
  }

  async function record(org: AdviceOrg, where: string) {
    const place = where.trim();
    if (!place) return;
    setRow(org.gsId, { kind: 'sending' });
    // Structured line for the reviewer: greppable, keyed by gs_id, and turns
    // into a verdict-loop row without re-matching by name.
    const message =
      `ADVICE [${org.gsId}] "${org.name}" (postcode ${org.postcode}) → belongs in: ${place}` +
      (sessionNote.trim() ? ` — context: ${sessionNote.trim()}` : '');
    try {
      const res = await fetch('/api/place/corrections', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ page_route: pageRoute, lga_name: lgaName, message }),
      });
      setRow(org.gsId, res.ok ? { kind: 'sent', where: place } : { kind: 'failed' });
    } catch {
      setRow(org.gsId, { kind: 'failed' });
    }
  }

  if (orgs.length === 0) return null;

  return (
    <div>
      <div className="mt-5 border-2 border-bauhaus-black bg-bauhaus-canvas p-3">
        <label
          htmlFor="advice-session"
          className="block font-mono text-[10px] font-black uppercase tracking-widest"
        >
          Who is advising (optional — travels with every tap)
        </label>
        <input
          id="advice-session"
          type="text"
          value={sessionNote}
          onChange={e => setSessionNote(e.target.value)}
          maxLength={200}
          placeholder="e.g. Yarn at the Ceduna AC office, 12 Aug — Ben with J."
          className="mt-1.5 w-full border-2 border-bauhaus-black bg-white p-2 text-sm outline-none focus:border-bauhaus-red"
        />
      </div>

      <ul className="mt-4 divide-y divide-bauhaus-black/15 border-2 border-bauhaus-black bg-white">
        {orgs.map(org => {
          const state = rows[org.gsId] ?? { kind: 'idle' };
          return (
            <li key={org.gsId} className="p-3">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <div className="min-w-0">
                  <p className="text-sm font-bold leading-snug">{org.name}</p>
                  <p className="mt-0.5 flex items-center gap-1.5 font-mono text-[10px] uppercase tracking-wider text-gray-500">
                    <span>{org.postcode}</span>
                    {org.communityControlled ? (
                      <span className="border border-bauhaus-red bg-bauhaus-red/10 px-1 py-0.5 font-black text-bauhaus-red">
                        CC
                      </span>
                    ) : null}
                  </p>
                </div>

                {state.kind === 'sent' ? (
                  <p className="text-xs font-bold text-green-700">
                    ✓ Recorded → {state.where}. A person reviews it before the map changes.
                  </p>
                ) : state.kind === 'sending' ? (
                  <p className="font-mono text-[10px] uppercase tracking-widest text-gray-400">
                    Recording…
                  </p>
                ) : (
                  <div className="flex shrink-0 items-center gap-2">
                    <button
                      type="button"
                      onClick={() => record(org, lgaName)}
                      className="border-2 border-bauhaus-black bg-bauhaus-black px-2.5 py-1.5 text-[10px] font-black uppercase tracking-widest text-white transition-colors hover:bg-white hover:text-bauhaus-black"
                    >
                      Belongs here
                    </button>
                    <button
                      type="button"
                      onClick={() =>
                        setRow(org.gsId, { kind: state.kind === 'elsewhere' ? 'idle' : 'elsewhere' })
                      }
                      className="border-2 border-bauhaus-black bg-white px-2.5 py-1.5 text-[10px] font-black uppercase tracking-widest transition-colors hover:bg-bauhaus-black hover:text-white"
                    >
                      Elsewhere…
                    </button>
                  </div>
                )}
              </div>

              {state.kind === 'elsewhere' ? (
                <ElsewhereInput onRecord={where => record(org, where)} />
              ) : null}
              {state.kind === 'failed' ? (
                <p className="mt-2 text-xs text-bauhaus-red">
                  That did not go through — try again, or put it in the correction form below.
                </p>
              ) : null}
            </li>
          );
        })}
      </ul>

      <p className="mt-3 max-w-3xl font-mono text-xs text-gray-600">
        Taps land in a review queue a person reads. The map only changes after the evidence is
        checked — local advice is how it gets checked.
      </p>
    </div>
  );
}

function ElsewhereInput({ onRecord }: { onRecord: (where: string) => void }) {
  const [where, setWhere] = useState('');
  return (
    <form
      className="mt-2 flex flex-wrap items-center gap-2"
      onSubmit={e => {
        e.preventDefault();
        onRecord(where);
      }}
    >
      <input
        type="text"
        value={where}
        onChange={e => setWhere(e.target.value)}
        maxLength={120}
        autoFocus
        placeholder="Community, town or council it belongs to"
        className="w-64 max-w-full border-2 border-bauhaus-black p-2 text-sm outline-none focus:border-bauhaus-red"
      />
      <button
        type="submit"
        disabled={where.trim().length < 2}
        className="border-2 border-bauhaus-black bg-white px-2.5 py-2 text-[10px] font-black uppercase tracking-widest transition-colors hover:bg-bauhaus-black hover:text-white disabled:opacity-40"
      >
        Record
      </button>
    </form>
  );
}
