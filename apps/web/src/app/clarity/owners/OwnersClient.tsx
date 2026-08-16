'use client';

import { useMemo, useState } from 'react';
import Link from 'next/link';

export interface OwnerRow {
  object_key: string;
  object_name: string;
  object_kind: string;
  row_count: number | null;
  owner_app: 'civicgraph' | 'justicehub' | 'both' | 'neither';
  owner_app_proposed: 'civicgraph' | 'justicehub' | 'both' | null;
  refs_app: number | null;
  refs_script: number | null;
}

const PROPOSALS = ['civicgraph', 'justicehub', 'both'] as const;
const OWNER_LABEL: Record<string, string> = {
  civicgraph: 'CivicGraph',
  justicehub: 'JusticeHub',
  both: 'Both',
  neither: 'Neither',
};

/**
 * Ownership adjudication. The proposal is a measurement (which repos' app/script code references
 * the object — migrations excluded, custody of the schema is not ownership of the thing), and
 * confirm-all is a human confirming the RULE en masse: still recorded who/when, and it never
 * touches an object whose owner was already set singly. Enforcement is the admin-gated API.
 */
export default function OwnersClient({ initial }: { initial: OwnerRow[] }) {
  const [rows, setRows] = useState(initial);
  const [busy, setBusy] = useState(false);
  const [note, setNote] = useState<string | null>(null);

  const groups = useMemo(() => {
    const unconfirmed = rows.filter((r) => r.owner_app === 'neither');
    return {
      confirmed: rows.filter((r) => r.owner_app !== 'neither'),
      byProposal: PROPOSALS.map((p) => ({
        proposal: p,
        list: unconfirmed.filter((r) => r.owner_app_proposed === p),
      })),
      noEvidence: unconfirmed.filter((r) => r.owner_app_proposed === null),
    };
  }, [rows]);

  async function confirmAll(proposal: (typeof PROPOSALS)[number]) {
    setBusy(true);
    setNote(null);
    try {
      const res = await fetch('/api/clarity/owners', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'confirm_all', proposal }),
      });
      const body = (await res.json()) as { confirmed?: number; error?: string };
      if (!res.ok) throw new Error(body.error ?? `HTTP ${res.status}`);
      setRows((rs) =>
        rs.map((r) =>
          r.owner_app === 'neither' && r.owner_app_proposed === proposal
            ? { ...r, owner_app: proposal }
            : r,
        ),
      );
      setNote(`Confirmed ${body.confirmed ?? 0} as ${OWNER_LABEL[proposal]}.`);
    } catch (e) {
      setNote(`Confirm failed: ${e instanceof Error ? e.message : String(e)}`);
    } finally {
      setBusy(false);
    }
  }

  return (
    <>
      <header className="border-4 border-bauhaus-black bg-bauhaus-white p-5">
        <h1 className="font-mono text-2xl font-black">Owners</h1>
        <p className="mt-2 max-w-[75ch] text-[14px] leading-relaxed text-neutral-700">
          Which product owns each object. The proposal is measured — which repos&rsquo; app and
          script code reference it (migrations deliberately excluded: custody of the shared schema
          is not ownership of the thing). Confirming records who and when; objects with no
          reference evidence stay Neither rather than being guessed.
        </p>
        <p className="mt-2 font-mono text-[11px] uppercase tracking-widest text-neutral-500">
          confirmed {groups.confirmed.length} · proposed{' '}
          {groups.byProposal.reduce((n, g) => n + g.list.length, 0)} · no evidence{' '}
          {groups.noEvidence.length}
        </p>
        {note ? (
          <p className="mt-2 border-l-4 border-bauhaus-blue pl-3 font-mono text-[12px]">{note}</p>
        ) : null}
      </header>

      {groups.byProposal.map(({ proposal, list }) =>
        list.length === 0 ? null : (
          <section key={proposal} className="mt-4 border-4 border-bauhaus-black bg-bauhaus-white">
            <h2 className="flex flex-wrap items-center gap-3 border-b-2 border-bauhaus-black px-4 py-2">
              <span className="font-mono text-[11px] font-black uppercase tracking-widest">
                Proposed {OWNER_LABEL[proposal]} · {list.length}
              </span>
              <button
                disabled={busy}
                onClick={() => confirmAll(proposal)}
                className="border-2 border-bauhaus-black px-2 py-0.5 font-mono text-[10px] font-black uppercase tracking-widest hover:bg-bauhaus-black hover:text-bauhaus-canvas disabled:opacity-40"
              >
                Confirm all {list.length}
              </button>
            </h2>
            <ul className="grid gap-x-6 gap-y-0.5 p-4 sm:grid-cols-2 lg:grid-cols-3">
              {list.map((r) => (
                <li key={r.object_key} className="font-mono text-[12px] leading-6">
                  <Link
                    href={`/clarity/o/${encodeURIComponent(r.object_key)}`}
                    className="text-bauhaus-blue underline"
                  >
                    {r.object_name}
                  </Link>
                  <span className="ml-2 text-neutral-400">
                    {(r.refs_app ?? 0) + (r.refs_script ?? 0)} refs
                  </span>
                </li>
              ))}
            </ul>
          </section>
        ),
      )}

      {groups.noEvidence.length > 0 ? (
        <section className="mt-4 border-4 border-bauhaus-black bg-bauhaus-white">
          <h2 className="border-b-2 border-bauhaus-black px-4 py-2 font-mono text-[11px] font-black uppercase tracking-widest">
            No reference evidence · {groups.noEvidence.length} · stays Neither
          </h2>
          <p className="px-4 py-2 text-[13px] text-neutral-600">
            Nothing in either codebase&rsquo;s app or script code references these. Many are also
            orphan findings; the rest are reached only through migrations or db functions.
          </p>
        </section>
      ) : null}
    </>
  );
}
