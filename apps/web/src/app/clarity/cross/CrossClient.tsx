'use client';

import { useMemo, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import {
  BUCKET_FILL,
  BUCKET_LABEL,
  DIAGONAL_MEANING,
  bucket,
  niceType,
  type FlowCell,
  type JoinCell,
  type SentinelRow,
  type Tab,
} from './types';

const nf = new Intl.NumberFormat('en-AU');

function money(v: number | null): string {
  if (v === null || !Number.isFinite(v)) return '—';
  const abs = Math.abs(v);
  if (abs >= 1e9) return `$${(v / 1e9).toFixed(1)}bn`;
  if (abs >= 1e6) return `$${(v / 1e6).toFixed(1)}m`;
  if (abs >= 1e3) return `$${(v / 1e3).toFixed(0)}k`;
  return `$${v.toFixed(0)}`;
}

export default function CrossClient({
  tab,
  flow,
  join,
  sentinels,
  flowAvailable,
  flowError,
  selectedRel,
  selectedCell,
}: {
  tab: Tab;
  flow: FlowCell[];
  join: JoinCell[];
  sentinels: SentinelRow[];
  flowAvailable: boolean;
  flowError: string | null;
  selectedRel: string;
  selectedCell: string;
}) {
  const router = useRouter();
  const [minting, setMinting] = useState(false);
  const [mintError, setMintError] = useState<string | null>(null);
  const [minted, setMinted] = useState<string | null>(null);

  const rels = useMemo(() => {
    const m = new Map<string, number>();
    for (const c of flow) m.set(c.relationship_type, (m.get(c.relationship_type) ?? 0) + c.edges);
    return [...m.entries()].sort((a, b) => b[1] - a[1]);
  }, [flow]);

  // Types are ordered by total volume so the dense corner sits top-left and the
  // two junk types (trust and unknown, one row each) fall to the edge — rendered
  // as a hairline row and column, labelled, never dropped. Dropping them would
  // be the first small lie.
  const { types, cells, totals } = useMemo(() => {
    const filtered = selectedRel ? flow.filter((c) => c.relationship_type === selectedRel) : flow;
    const agg = new Map<string, FlowCell>();
    const vol = new Map<string, number>();
    let edges = 0;
    let withAmount = 0;
    let withYear = 0;
    let amount = 0;
    for (const c of filtered) {
      const k = `${c.source_type}|${c.target_type}`;
      const prev = agg.get(k);
      agg.set(
        k,
        prev
          ? {
              ...prev,
              edges: prev.edges + c.edges,
              edges_with_amount: prev.edges_with_amount + c.edges_with_amount,
              edges_with_year: prev.edges_with_year + c.edges_with_year,
              amount_recorded: (prev.amount_recorded ?? 0) + (c.amount_recorded ?? 0),
              relationship_type: 'all',
            }
          : { ...c },
      );
      vol.set(c.source_type, (vol.get(c.source_type) ?? 0) + c.edges);
      vol.set(c.target_type, (vol.get(c.target_type) ?? 0) + c.edges);
      edges += c.edges;
      withAmount += c.edges_with_amount;
      withYear += c.edges_with_year;
      amount += Number(c.amount_recorded ?? 0);
    }
    return {
      types: [...vol.entries()].sort((a, b) => b[1] - a[1]).map(([t]) => t),
      cells: agg,
      totals: { edges, withAmount, withYear, amount },
    };
  }, [flow, selectedRel]);

  const selected = selectedCell ? cells.get(selectedCell) : undefined;

  const joinDomains = useMemo(() => {
    const s = new Set<string>();
    for (const j of join) {
      s.add(j.src_domain);
      s.add(j.tgt_domain);
    }
    return [...s].sort();
  }, [join]);
  const joinCells = useMemo(() => {
    const m = new Map<string, JoinCell>();
    for (const j of join) m.set(`${j.src_domain}|${j.tgt_domain}`, j);
    return m;
  }, [join]);

  async function mint(cell: FlowCell) {
    setMinting(true);
    setMintError(null);
    try {
      const res = await fetch('/api/clarity/questions/mint', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          sourceType: cell.source_type,
          targetType: cell.target_type,
          relationshipType: selectedRel || 'all',
        }),
      });
      const body = (await res.json()) as { error?: string; slug?: string };
      if (!res.ok) throw new Error(body.error ?? `HTTP ${res.status}`);
      setMinted(body.slug ?? null);
      router.refresh();
    } catch (e) {
      setMintError(e instanceof Error ? e.message : String(e));
    } finally {
      setMinting(false);
    }
  }

  const href = (patch: Record<string, string>) => {
    const p = new URLSearchParams({ tab, ...(selectedRel ? { rel: selectedRel } : {}) });
    for (const [k, v] of Object.entries(patch)) {
      if (v) p.set(k, v);
      else p.delete(k);
    }
    return `/clarity/cross?${p.toString()}`;
  };

  const amountPct = totals.edges ? Math.round((totals.withAmount / totals.edges) * 100) : 0;
  const yearMissing = totals.edges - totals.withYear;

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
            <Link
              href="/clarity/changes"
              className="border-2 border-bauhaus-black bg-bauhaus-white px-2 py-0.5 text-[10px] font-extrabold uppercase tracking-[0.15em] hover:bg-bauhaus-black hover:text-bauhaus-canvas"
            >
              What changed
            </Link>
          </div>
          <h1 className="text-4xl font-black uppercase leading-none tracking-wide sm:text-5xl">
            Cross-sections
          </h1>
          <p className="mt-3 max-w-[62ch] text-sm text-bauhaus-muted">
            How kinds of Australian organisation move money to each other — and which of those flows
            nobody has looked at. A registry only holds cross-sections somebody already wrote down.
          </p>

          <div className="mt-5 flex flex-wrap border-2 border-bauhaus-black">
            {(
              [
                ['flow', 'Flow: how kinds fund kinds'],
                ['join', 'Join: how domains connect'],
              ] as const
            ).map(([t, label]) => (
              <Link
                key={t}
                href={`/clarity/cross?tab=${t}`}
                aria-current={tab === t ? 'true' : undefined}
                className={`border-r-2 border-bauhaus-black px-3 py-2 text-[11px] font-extrabold uppercase tracking-[0.13em] last:border-r-0 ${
                  tab === t ? 'bg-bauhaus-black text-bauhaus-canvas' : 'bg-bauhaus-white'
                }`}
              >
                {label}
              </Link>
            ))}
          </div>
        </header>

        <div className="mt-6 grid gap-6 lg:grid-cols-[1fr_340px]">
          <section className="min-w-0 border-[3px] border-bauhaus-black bg-bauhaus-white p-4">
            {tab === 'flow' ? (
              !flowAvailable || flow.length === 0 ? (
                <div className="p-6">
                  <h2 className="text-lg font-black uppercase tracking-widest text-bauhaus-yellow">
                    The matrix has never been built
                  </h2>
                  <p className="mt-3 max-w-[70ch] text-sm text-bauhaus-muted">
                    Every cell is <b className="text-bauhaus-yellow">?</b> — unmeasured, not empty.
                    The flow matrix is a materialized view because the live query over 3,429,184
                    edges was measured at 91 seconds, eleven times the request ceiling. Build it and
                    this screen fills in:
                  </p>
                  <pre className="mt-4 overflow-x-auto border-2 border-bauhaus-black bg-bauhaus-canvas p-3 font-mono text-[11.5px]">
                    {`psql -f supabase/migrations/20260815001400_clarity_flow_matrix.sql
-- thereafter, nightly:
REFRESH MATERIALIZED VIEW CONCURRENTLY mv_clarity_flow;`}
                  </pre>
                  {flowError ? (
                    <p className="mt-3 font-mono text-[11px] text-bauhaus-muted">{flowError}</p>
                  ) : null}
                </div>
              ) : (
                <>
                  <div className="mb-3 flex flex-wrap items-center gap-2">
                    <span className="text-[10px] font-extrabold uppercase tracking-[0.14em] text-bauhaus-muted">
                      Relationship
                    </span>
                    <Link
                      href={href({ rel: '', cell: '' })}
                      className={`border-2 border-bauhaus-black px-2 py-0.5 text-[10px] font-extrabold uppercase tracking-[0.1em] ${
                        selectedRel ? 'bg-bauhaus-white' : 'bg-bauhaus-black text-bauhaus-canvas'
                      }`}
                    >
                      All {nf.format(totals.edges)}
                    </Link>
                    {rels.map(([r, n]) => (
                      <Link
                        key={r}
                        href={`/clarity/cross?tab=flow&rel=${encodeURIComponent(r)}`}
                        className={`border-2 border-bauhaus-black px-2 py-0.5 text-[10px] font-extrabold uppercase tracking-[0.1em] ${
                          selectedRel === r
                            ? 'bg-bauhaus-black text-bauhaus-canvas'
                            : 'bg-bauhaus-white'
                        }`}
                      >
                        {niceType(r)} {nf.format(n)}
                      </Link>
                    ))}
                  </div>

                  <div className="overflow-x-auto">
                    <table className="border-collapse">
                      <thead>
                        <tr>
                          <th className="p-1 text-left text-[9px] font-extrabold uppercase tracking-[0.1em] text-bauhaus-muted">
                            source ↓ / target →
                          </th>
                          {types.map((t) => (
                            <th
                              key={t}
                              className="p-1 text-[9px] font-extrabold uppercase tracking-[0.06em]"
                            >
                              <span className="block w-[52px] truncate" title={t}>
                                {niceType(t).slice(0, 7)}
                              </span>
                            </th>
                          ))}
                        </tr>
                      </thead>
                      <tbody>
                        {types.map((s) => (
                          <tr key={s}>
                            <th className="whitespace-nowrap p-1 text-right text-[10px] font-extrabold uppercase tracking-[0.06em]">
                              {niceType(s)}
                            </th>
                            {types.map((t) => {
                              const key = `${s}|${t}`;
                              const c = cells.get(key);
                              const b = c ? bucket(c.edges) : null;
                              const isSel = selectedCell === key;
                              return (
                                <td key={t} className="p-0.5">
                                  {c ? (
                                    <Link
                                      href={href({ cell: key })}
                                      title={`${s} → ${t}: ${nf.format(c.edges)} edges`}
                                      className={`block h-[30px] w-[52px] border-2 ${
                                        isSel ? 'border-bauhaus-blue' : 'border-transparent'
                                      }`}
                                      style={{ background: BUCKET_FILL[b ?? 0] }}
                                    >
                                      <span className="sr-only">
                                        {s} to {t}, {c.edges} edges
                                      </span>
                                    </Link>
                                  ) : (
                                    <span
                                      title="no edges of this kind"
                                      className="block h-[30px] w-[52px] border border-bauhaus-black/10 text-center text-[10px] leading-[30px] text-bauhaus-muted"
                                    >
                                      ·
                                    </span>
                                  )}
                                </td>
                              );
                            })}
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>

                  <div className="mt-3 flex flex-wrap gap-3 text-[10px] font-bold uppercase tracking-[0.08em] text-bauhaus-muted">
                    {BUCKET_LABEL.map((l, i) => (
                      <span key={l} className="flex items-center gap-1.5">
                        <i
                          className="inline-block h-3 w-3"
                          style={{ background: BUCKET_FILL[i] }}
                          aria-hidden
                        />
                        {l}
                      </span>
                    ))}
                    <span>· no edges</span>
                    <span className="text-bauhaus-black">log scale</span>
                  </div>

                  {selected ? (
                    <div className="mt-4 border-4 border-bauhaus-black p-4">
                      <h3 className="text-sm font-black uppercase tracking-[0.14em]">
                        {niceType(selected.source_type)} →{' '}
                        {selectedRel ? `${niceType(selectedRel)} → ` : ''}
                        {niceType(selected.target_type)}
                      </h3>
                      <p className="mt-2 text-sm">
                        <b className="text-lg">{nf.format(selected.edges)}</b> edges ·{' '}
                        {/* Never a bare total. amount is ~77% populated, so a dollar
                            figure here is a floor and has to say so on the same line. */}
                        <b>{money(Number(selected.amount_recorded ?? 0))}</b> recorded, a{' '}
                        <b>floor</b> — amount present on{' '}
                        {selected.edges
                          ? Math.round((selected.edges_with_amount / selected.edges) * 100)
                          : 0}
                        % of these edges
                      </p>
                      {selected.source_type === selected.target_type ? (
                        <p className="mt-1.5 text-[12px] font-semibold text-bauhaus-blue">
                          The diagonal is not self-funding:{' '}
                          {DIAGONAL_MEANING[selected.source_type] ??
                            'flow between two distinct organisations of the same kind'}
                          .
                        </p>
                      ) : null}
                      <p className="mt-1.5 text-[12px] text-bauhaus-muted">
                        {nf.format(selected.distinct_sources)} distinct sources ·{' '}
                        {nf.format(selected.distinct_targets)} distinct targets
                        {selected.year_min && selected.year_max
                          ? ` · ${selected.year_min}–${selected.year_max}`
                          : ''}
                      </p>
                      <div className="mt-3 flex flex-wrap gap-2">
                        <button
                          type="button"
                          disabled={minting}
                          onClick={() => mint(selected)}
                          className="border-2 border-bauhaus-black bg-bauhaus-black px-3 py-1.5 text-[10px] font-extrabold uppercase tracking-[0.12em] text-bauhaus-canvas disabled:opacity-40"
                        >
                          {minting ? 'Minting…' : 'Mint this as a question →'}
                        </button>
                        <Link
                          href="/graph"
                          className="border-2 border-bauhaus-black px-3 py-1.5 text-[10px] font-extrabold uppercase tracking-[0.12em]"
                        >
                          Open these in /graph
                        </Link>
                      </div>
                      {minted ? (
                        <p className="mt-2 text-[12px] font-bold">
                          Drafted as{' '}
                          <Link href={`/clarity/q/${minted}`} className="underline">
                            {minted}
                          </Link>{' '}
                          — it needs its answer SQL and a caveat before it can leave draft.
                        </p>
                      ) : null}
                      {mintError ? (
                        <p className="mt-2 text-[12px] font-bold text-bauhaus-red">{mintError}</p>
                      ) : null}
                    </div>
                  ) : (
                    <p className="mt-4 text-[12px] text-bauhaus-muted">
                      Pick a cell to see what it holds and mint it as a question.
                    </p>
                  )}
                </>
              )
            ) : (
              <>
                <h2 className="mb-3 text-sm font-black uppercase tracking-[0.14em]">
                  How domains connect
                </h2>
                {join.length === 0 ? (
                  <p className="text-sm text-bauhaus-muted">
                    No domain-to-domain edges are catalogued yet.
                  </p>
                ) : (
                  <div className="overflow-x-auto">
                    <table className="border-collapse text-[11px]">
                      <thead>
                        <tr>
                          <th className="p-1 text-left text-[9px] font-extrabold uppercase text-bauhaus-muted">
                            from ↓ / to →
                          </th>
                          {joinDomains.map((d) => (
                            <th key={d} className="p-1 text-[9px] font-extrabold uppercase">
                              <span className="block w-[42px] truncate" title={d}>
                                {d.slice(0, 6)}
                              </span>
                            </th>
                          ))}
                        </tr>
                      </thead>
                      <tbody>
                        {joinDomains.map((s) => (
                          <tr key={s}>
                            <th className="whitespace-nowrap p-1 text-right text-[10px] font-extrabold">
                              {s}
                            </th>
                            {joinDomains.map((t) => {
                              const c = joinCells.get(`${s}|${t}`);
                              return (
                                <td
                                  key={t}
                                  title={
                                    c
                                      ? `${c.edges} edges, ${c.measured_edges} with a measured match rate`
                                      : 'no catalogued join'
                                  }
                                  className={`h-[26px] w-[42px] border border-bauhaus-black/10 text-center font-mono ${
                                    c ? 'bg-bauhaus-canvas font-bold' : 'text-bauhaus-muted'
                                  }`}
                                >
                                  {!c ? (
                                    '·'
                                  ) : c.measured_edges === 0 ? (
                                    <span className="text-bauhaus-blue" title="not measured yet">
                                      +
                                    </span>
                                  ) : (
                                    `${Math.round(Number(c.best_match_rate) * 100)}%`
                                  )}
                                </td>
                              );
                            })}
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
                <p className="mt-4 max-w-[74ch] border-2 border-bauhaus-blue p-3 text-[12px] text-bauhaus-black">
                  <b className="text-bauhaus-blue">+</b> means the join exists in the catalog but its
                  match rate has never been measured — which today is{' '}
                  <b>every single one of them</b>. That is our omission, not an absence of data, and
                  it renders as <b>+</b> rather than 0% because 0% would say these tables do not
                  connect. Measuring them is slice 5.
                </p>
              </>
            )}
          </section>

          <aside className="min-w-0 space-y-4">
            <div className="border-[3px] border-bauhaus-red bg-bauhaus-white p-4">
              <h2 className="text-[11px] font-black uppercase tracking-[0.16em] text-bauhaus-red">
                ⚑ Sentinels
              </h2>
              {sentinels.length === 0 ? (
                <p className="mt-2 text-[12px] text-bauhaus-muted">None registered.</p>
              ) : (
                sentinels.map((s) => (
                  <div key={s.key} className="mt-3 border-t-2 border-bauhaus-black/10 pt-2.5">
                    <h3 className="text-[12px] font-black uppercase tracking-[0.1em]">{s.label}</h3>
                    <p className="mt-1 text-[11.5px] leading-snug text-bauhaus-muted">
                      {s.description}
                    </p>
                    <p className="mt-1 font-mono text-[10px] text-bauhaus-muted">
                      {s.severity} · guards {s.guards_objects.length || 'nothing'}
                    </p>
                  </div>
                ))
              )}
            </div>

            <div className="border-[3px] border-bauhaus-black bg-bauhaus-white p-4">
              <h2 className="text-[11px] font-black uppercase tracking-[0.16em]">
                What this matrix cannot say
              </h2>
              <p className="mt-2 text-[12px] leading-snug">
                Edge counts are complete. <b>Dollars are not.</b> Amount is present on{' '}
                <b>{amountPct}%</b> of edges in view, so every dollar cell is a floor, never a total.
              </p>
              {yearMissing > 0 ? (
                <p className="mt-2 text-[12px] leading-snug text-bauhaus-black">
                  <b className="text-bauhaus-yellow">⚠</b> A year filter would silently drop{' '}
                  <b>{nf.format(yearMissing)}</b> edges that carry no year at all.
                </p>
              ) : null}
              <p className="mt-2 text-[12px] leading-snug text-bauhaus-muted">
                Two of the entity types hold a single row each. They render as a hairline row and
                column and are labelled rather than dropped.
              </p>
            </div>
          </aside>
        </div>
      </div>
    </main>
  );
}
