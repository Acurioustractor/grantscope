'use client';

import { useMemo, useState } from 'react';
import Link from 'next/link';
import { NOUN_BLURB, NOUN_LABEL, NOUN_ORDER, UNFILED_NOTE, type Noun } from './nouns';

/**
 * The index, in human language first (Ben's phase-3 directive, 2026-08-17): 812 objects carry a
 * written purpose and the old index showed none of them — a wall of raw database names. Here the
 * plain-English sentence leads and the database name becomes the small print; the search box
 * filters name AND purpose in place; and the lenses turn the index into the worklist — what
 * needs words, what nothing uses, what could link, what is ACT's own rather than civic data.
 * Every lens is a measured field, never a judgement invented at render time.
 */

export interface ExplorerObject {
  key: string;
  name: string;
  kind: string;
  noun: Noun;
  rows: number | null;
  rowsEstimate: boolean;
  degree: number;
  purpose: string | null; // first sentence, pre-trimmed server-side
  sector: string | null; // unfiled-by-sector label
  act: boolean;
  refs: number; // app+script+migration+db_function, three-repo measured
  lastWrite: string | null; // yyyy-mm-dd
  canLink: boolean; // confirmed undiscovered-join finding
  orphan: boolean; // confirmed orphan finding
}

type LensId = 'needsWords' | 'unfiled' | 'unused' | 'canLink' | 'act';
type SortId = 'name' | 'rows' | 'degree';

const LENSES: { id: LensId; label: string; hint: string }[] = [
  { id: 'needsWords', label: 'Needs words', hint: 'no purpose written yet' },
  { id: 'unfiled', label: 'Unfiled', hint: 'no confirmed noun' },
  { id: 'unused', label: 'Nothing uses it', hint: 'confirmed orphan — zero references across three apps' },
  { id: 'canLink', label: 'Could link', hint: 'confirmed join gap — shares a proven key, no edge' },
  { id: 'act', label: "ACT's own", hint: 'flagged act_business — our operations, not civic data' },
];

function terse(n: number | null, estimate: boolean): string {
  if (n === null) return '';
  const s =
    n >= 1_000_000
      ? `${(n / 1_000_000).toFixed(n >= 10_000_000 ? 0 : 1)}M`
      : n >= 1_000
        ? `${Math.round(n / 1000)}K`
        : String(n);
  return estimate ? `~${s}` : s;
}

function matches(o: ExplorerObject, q: string): boolean {
  return o.name.toLowerCase().includes(q) || (o.purpose ?? '').toLowerCase().includes(q);
}

function passesLenses(o: ExplorerObject, active: Set<LensId>): boolean {
  if (active.has('needsWords') && o.purpose) return false;
  if (active.has('unfiled') && o.noun !== 'unfiled') return false;
  if (active.has('unused') && !o.orphan) return false;
  if (active.has('canLink') && !o.canLink) return false;
  if (active.has('act') && !o.act) return false;
  return true;
}

export default function IndexExplorer({ objects }: { objects: ExplorerObject[] }) {
  const [query, setQuery] = useState('');
  const [lenses, setLenses] = useState<Set<LensId>>(new Set());
  const [sort, setSort] = useState<SortId>('name');

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    const cmp: Record<SortId, (a: ExplorerObject, b: ExplorerObject) => number> = {
      name: (a, b) => a.name.localeCompare(b.name),
      rows: (a, b) => (b.rows ?? -1) - (a.rows ?? -1),
      degree: (a, b) => b.degree - a.degree,
    };
    return objects
      .filter((o) => (q ? matches(o, q) : true) && passesLenses(o, lenses))
      .sort(cmp[sort]);
  }, [objects, query, lenses, sort]);

  const byNoun = useMemo(() => {
    const m = new Map<Noun, ExplorerObject[]>();
    for (const n of NOUN_ORDER) m.set(n, []);
    for (const o of filtered) m.get(o.noun)!.push(o);
    return m;
  }, [filtered]);

  function toggleLens(id: LensId) {
    setLenses((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  return (
    <>
      <div className="mt-4 flex flex-wrap items-center gap-2">
        <input
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Filter by name or plain-English purpose…"
          className="w-full max-w-[440px] border-2 border-bauhaus-black bg-bauhaus-white px-3 py-1.5 font-mono text-[13px] placeholder:text-bauhaus-black/40"
        />
        {LENSES.map((l) => (
          <button
            key={l.id}
            onClick={() => toggleLens(l.id)}
            title={l.hint}
            className={`border-2 px-2 py-1 font-mono text-[10px] font-black uppercase tracking-widest ${
              lenses.has(l.id)
                ? 'border-bauhaus-black bg-bauhaus-black text-bauhaus-canvas'
                : 'border-bauhaus-black/30 text-bauhaus-black/60 hover:border-bauhaus-black'
            }`}
          >
            {l.label}
          </button>
        ))}
        <span className="ml-auto flex items-center gap-1.5">
          {(['name', 'rows', 'degree'] as const).map((s) => (
            <button
              key={s}
              onClick={() => setSort(s)}
              className={`border-2 px-2 py-0.5 font-mono text-[10px] font-black uppercase tracking-widest ${
                sort === s
                  ? 'border-bauhaus-black bg-bauhaus-black text-bauhaus-canvas'
                  : 'border-bauhaus-black/25 text-bauhaus-black/60 hover:border-bauhaus-black'
              }`}
            >
              {s === 'name' ? 'A–Z' : s === 'rows' ? 'Rows' : 'Degree'}
            </button>
          ))}
        </span>
      </div>
      {query || lenses.size > 0 ? (
        <p className="mt-2 font-mono text-[11px] uppercase tracking-widest text-bauhaus-black/50">
          {filtered.length.toLocaleString('en-AU')} of {objects.length.toLocaleString('en-AU')}{' '}
          objects match
        </p>
      ) : null}

      <div className="mt-4 grid gap-4">
        {NOUN_ORDER.map((noun) => {
          const list = byNoun.get(noun)!;
          if (list.length === 0) return null;
          const described = list.filter((o) => o.purpose).length;
          const isUnfiled = noun === 'unfiled';
          return (
            <section key={noun} className="border-4 border-bauhaus-black bg-bauhaus-white" id={noun}>
              <h2 className="flex flex-wrap items-baseline gap-x-3 border-b-2 border-bauhaus-black px-4 py-2">
                <span className="font-display text-lg font-black uppercase tracking-widest">
                  {NOUN_LABEL[noun]}
                </span>
                <span className="font-mono text-[12px] font-black">{list.length.toLocaleString('en-AU')}</span>
                <span className="font-mono text-[10px] uppercase tracking-widest text-bauhaus-black/40">
                  {described} described
                </span>
                <span className="text-[12px] text-bauhaus-black/50">{NOUN_BLURB[noun]}</span>
              </h2>

              {isUnfiled ? (
                <p className="border-b border-bauhaus-black/15 bg-bauhaus-canvas px-4 py-2 text-[12px] text-bauhaus-black/70">
                  {UNFILED_NOTE}{' '}
                  <Link href="/clarity/unfiled" className="font-black text-bauhaus-blue underline">
                    File them →
                  </Link>
                </p>
              ) : null}

              <ul className="grid gap-x-8 gap-y-1 p-4 lg:grid-cols-2">
                {list.map((o) => (
                  <li key={o.key} className="flex items-baseline gap-2 leading-6">
                    <Link
                      href={`/clarity/o/${encodeURIComponent(o.key)}`}
                      className="min-w-0 flex-1 truncate"
                      title={o.purpose ?? o.name}
                    >
                      {o.purpose ? (
                        <>
                          <span className="text-[13px] underline decoration-bauhaus-black/20 underline-offset-2 hover:decoration-bauhaus-black">
                            {o.purpose}
                          </span>{' '}
                          <span className="font-mono text-[10.5px] text-bauhaus-black/40">
                            {o.name}
                          </span>
                        </>
                      ) : (
                        <span className="font-mono text-[12.5px] text-bauhaus-black/55 underline decoration-bauhaus-black/20 underline-offset-2 hover:decoration-bauhaus-black">
                          {o.name}
                        </span>
                      )}
                    </Link>
                    {o.sector ? (
                      <span className="shrink-0 border border-bauhaus-black/25 px-1 text-[9px] uppercase tracking-wider text-bauhaus-black/50">
                        {o.sector}
                      </span>
                    ) : null}
                    {o.orphan ? (
                      <span title="confirmed orphan — nothing references it" className="shrink-0 font-mono text-[9px] font-black uppercase tracking-wider text-bauhaus-red">
                        unused
                      </span>
                    ) : null}
                    {o.canLink ? (
                      <span title="confirmed join gap — shares a proven key, no edge" className="shrink-0 font-mono text-[9px] font-black uppercase tracking-wider text-bauhaus-blue">
                        link?
                      </span>
                    ) : null}
                    {o.act ? (
                      <span title="ACT's own operations data" className="shrink-0 font-mono text-[9px] uppercase tracking-wider text-bauhaus-black/40">
                        act
                      </span>
                    ) : null}
                    <span className="ml-auto shrink-0 font-mono text-[11px] text-bauhaus-black/45">
                      {sort === 'degree' ? o.degree : terse(o.rows, o.rowsEstimate)}
                    </span>
                  </li>
                ))}
              </ul>
            </section>
          );
        })}
      </div>
    </>
  );
}
