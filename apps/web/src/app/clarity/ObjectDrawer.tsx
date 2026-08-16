'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';

/**
 * The overview drawer (Ben, 2026-08-17: "a sidebar that opens with a very specific overview —
 * what this is, the function, what data is linked, then health and enrichment options").
 * Click a row on the index and interrogate the object without leaving the screen. Edges open
 * in the SAME drawer, so you can walk the graph in place; the full page is one click away.
 */

interface DrawerObject {
  object_key: string;
  object_name: string;
  object_kind: string;
  domain: string | null;
  noun: string | null;
  purpose: string | null;
  caveat: string | null;
  grain: string | null;
  join_keys: string | null;
  row_count: number | null;
  row_count_is_estimate: boolean | null;
  bytes: number | null;
  last_write_at: string | null;
  refs_app: number | null;
  refs_script: number | null;
  refs_migration: number | null;
  refs_db_function: number | null;
  owner_app: string | null;
  project_codes: string[] | null;
  act_business: boolean | null;
  curated_by: string | null;
  curated_at: string | null;
}
interface DrawerEdge {
  src_object: string;
  src_column: string | null;
  tgt_object: string;
  tgt_column: string | null;
  match_rate: number | null;
  declared: boolean | null;
}
interface DrawerFinding {
  detector: string;
  column_name: string;
  title: string;
}
interface Payload {
  object: DrawerObject;
  edges: DrawerEdge[];
  findings: DrawerFinding[];
}

function fmtRows(n: number | null, est: boolean | null): string {
  if (n === null) return 'unmeasured';
  return `${est ? '~' : ''}${n.toLocaleString('en-AU')} rows`;
}

function Label({ children }: { children: React.ReactNode }) {
  return (
    <div className="mt-4 mb-1 font-mono text-[10px] font-black uppercase tracking-widest text-bauhaus-black/45">
      {children}
    </div>
  );
}

export default function ObjectDrawer({
  objectKey,
  onClose,
  onOpen,
}: {
  objectKey: string;
  onClose: () => void;
  onOpen: (key: string) => void;
}) {
  const [data, setData] = useState<Payload | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let live = true;
    setData(null);
    setError(null);
    fetch(`/api/clarity/object?key=${encodeURIComponent(objectKey)}`)
      .then(async (r) => {
        if (!r.ok) throw new Error((await r.json())?.error ?? `HTTP ${r.status}`);
        return r.json() as Promise<Payload>;
      })
      .then((p) => live && setData(p))
      .catch((e) => live && setError(e instanceof Error ? e.message : String(e)));
    return () => {
      live = false;
    };
  }, [objectKey]);

  const o = data?.object;
  const health: { label: string; ok: boolean | null; note: string }[] = o
    ? [
        { label: 'Described', ok: !!o.purpose, note: o.purpose ? 'has plain words' : 'needs words' },
        {
          label: 'Used',
          ok:
            (o.refs_app ?? 0) + (o.refs_script ?? 0) + (o.refs_migration ?? 0) + (o.refs_db_function ?? 0) > 0,
          note: `${o.refs_app ?? 0} app · ${o.refs_script ?? 0} scripts · ${o.refs_migration ?? 0} migrations · ${o.refs_db_function ?? 0} db`,
        },
        {
          label: 'Fresh',
          ok: o.last_write_at
            ? Date.now() - new Date(o.last_write_at).getTime() < 90 * 86400000
            : null,
          note: o.last_write_at ? `last write ${o.last_write_at.slice(0, 10)}` : 'no timestamp column',
        },
        { label: 'Filed', ok: !!o.noun, note: o.noun ?? 'unfiled — no confirmed noun' },
      ]
    : [];

  return (
    <aside className="fixed inset-y-0 right-0 z-40 w-full max-w-[440px] overflow-y-auto border-l border-bauhaus-black/10 bg-white p-5 shadow-[-8px_0_24px_rgba(0,0,0,0.08)]">
      <div className="flex items-start justify-between gap-3">
        <h2 className="font-display text-[18px] font-extrabold break-all">{objectKey.split('(')[0]}</h2>
        <button
          onClick={onClose}
          aria-label="close"
          className="shrink-0 border border-bauhaus-black/20 px-2 py-0.5 font-mono text-[11px] font-black hover:border-bauhaus-black"
        >
          ✕
        </button>
      </div>

      {error ? <p className="mt-3 text-[13px] text-bauhaus-red">Could not load: {error}</p> : null}
      {!data && !error ? <p className="mt-3 font-mono text-[12px] text-bauhaus-black/40">loading…</p> : null}

      {o ? (
        <>
          <Label>What this is</Label>
          <p className="text-[13.5px] leading-relaxed">{o.purpose ?? 'No purpose written yet.'}</p>
          {o.caveat ? (
            <p className="mt-2 border-l-4 border-bauhaus-red pl-2.5 text-[12.5px] leading-relaxed">
              {o.caveat}
            </p>
          ) : null}

          <Label>The function</Label>
          <p className="font-mono text-[12px] leading-6">
            {o.object_kind} · {o.noun ?? 'unfiled'} · owner {o.owner_app ?? 'unknown'}
            {o.act_business ? ' · ACT business' : ''}
            {o.project_codes?.length ? ` · ${o.project_codes.join(' ')}` : ''}
            <br />
            {fmtRows(o.row_count, o.row_count_is_estimate)}
            {o.grain ? ` · grain: ${o.grain}` : ''}
          </p>

          <Label>Health</Label>
          <ul className="grid gap-1">
            {health.map((h) => (
              <li key={h.label} className="flex items-baseline gap-2 text-[12.5px]">
                <span
                  className="inline-block h-2 w-2 shrink-0 rounded-full"
                  style={{
                    background: h.ok === null ? '#B9B9B4' : h.ok ? '#1E8E3E' : '#D02020',
                  }}
                />
                <span className="w-[72px] shrink-0 font-mono text-[11px] font-black uppercase tracking-wider">
                  {h.label}
                </span>
                <span className="text-bauhaus-black/70">{h.note}</span>
              </li>
            ))}
          </ul>

          <Label>Linked data</Label>
          {data!.edges.length === 0 ? (
            <p className="text-[12.5px] text-bauhaus-black/55">
              No declared edges. {data!.findings.some((f) => f.detector === 'undiscovered_join') ? 'But see the join gaps below.' : ''}
            </p>
          ) : (
            <ul className="grid gap-1">
              {data!.edges.map((e, i) => {
                const outbound = e.src_object === o.object_key;
                const other = outbound ? e.tgt_object : e.src_object;
                return (
                  <li key={i} className="flex items-baseline gap-2 font-mono text-[12px]">
                    <span className="text-bauhaus-black/35">{outbound ? '→' : '←'}</span>
                    <button
                      onClick={() => onOpen(other)}
                      className="truncate text-left text-bauhaus-blue hover:underline"
                      title={`${outbound ? e.src_column : e.tgt_column} ↔ ${outbound ? e.tgt_column : e.src_column}`}
                    >
                      {other}
                    </button>
                    {e.match_rate !== null ? (
                      <span
                        className={`ml-auto shrink-0 ${Number(e.match_rate) < 0.9 ? 'font-black text-bauhaus-red' : 'text-bauhaus-black/45'}`}
                      >
                        {(Number(e.match_rate) * 100).toFixed(0)}%
                      </span>
                    ) : null}
                  </li>
                );
              })}
            </ul>
          )}
          {data!.findings.length > 0 ? (
            <ul className="mt-2 grid gap-1">
              {data!.findings.map((f, i) => (
                <li key={i} className="text-[12px] leading-relaxed">
                  <span
                    className={`mr-1.5 font-mono text-[9px] font-black uppercase tracking-wider ${f.detector === 'orphan' ? 'text-bauhaus-red' : 'text-bauhaus-blue'}`}
                  >
                    {f.detector === 'orphan' ? 'unused' : 'join gap'}
                  </span>
                  {f.title}
                </li>
              ))}
            </ul>
          ) : null}

          <Label>Enrich</Label>
          <div className="flex flex-wrap gap-1.5">
            <Link
              href={`/clarity/o/${encodeURIComponent(o.object_key)}`}
              className="border border-bauhaus-black/25 px-2 py-1 font-mono text-[11px] font-black uppercase tracking-wider hover:border-bauhaus-black"
            >
              Full page ↗
            </Link>
            {['table', 'matview', 'view'].includes(o.object_kind) ? (
              <Link
                href={`/clarity/o/${encodeURIComponent(o.object_key)}/rows`}
                className="border border-bauhaus-black/25 px-2 py-1 font-mono text-[11px] font-black uppercase tracking-wider hover:border-bauhaus-black"
              >
                Browse rows
              </Link>
            ) : null}
            {!o.purpose ? (
              <Link
                href={`/clarity/o/${encodeURIComponent(o.object_key)}`}
                className="border border-bauhaus-blue px-2 py-1 font-mono text-[11px] font-black uppercase tracking-wider text-bauhaus-blue hover:bg-bauhaus-blue hover:text-white"
              >
                Write its words
              </Link>
            ) : null}
            {!o.noun ? (
              <Link
                href="/clarity/unfiled"
                className="border border-bauhaus-blue px-2 py-1 font-mono text-[11px] font-black uppercase tracking-wider text-bauhaus-blue hover:bg-bauhaus-blue hover:text-white"
              >
                File it
              </Link>
            ) : null}
          </div>
          {o.curated_at ? (
            <p className="mt-3 font-mono text-[10px] text-bauhaus-black/40">
              words last edited {o.curated_at.slice(0, 10)} · {o.curated_by}
            </p>
          ) : null}
        </>
      ) : null}
    </aside>
  );
}
