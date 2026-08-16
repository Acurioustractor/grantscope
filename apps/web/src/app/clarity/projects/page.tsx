import type { Metadata } from 'next';
import Link from 'next/link';
import { getDirectServiceSupabase } from '@/lib/supabase';

export const dynamic = 'force-dynamic';

export const metadata: Metadata = {
  title: 'Projects · Clarity',
  description: 'Of 74 project codes, how many can the data not speak about at all?',
};

interface CodeRow {
  code: string;
  name: string;
  category: string | null;
  tier: string | null;
  status: string | null;
  evidence_object_keys: string[];
  summary: string | null;
  repo: string | null;
  repo_last_commit: string | null;
  synced_at: string;
}

/** A repo commit in the last ~6 months means the project is alive in code even if the data
 *  cannot speak about it — that is a DECLARATION gap, not a dormant project. */
function repoActive(r: CodeRow): boolean {
  if (!r.repo_last_commit) return false;
  return Date.now() - new Date(r.repo_last_commit).getTime() < 183 * 24 * 60 * 60 * 1000;
}

async function load(): Promise<CodeRow[]> {
  const supabase = getDirectServiceSupabase();
  const { data, error } = await supabase
    .from('clarity_project_code')
    .select('*')
    .order('code')
    .limit(200);
  if (error) throw new Error(`clarity_project_code query failed: ${error.message}`);
  return (data ?? []) as unknown as CodeRow[];
}

/**
 * The zero-evidence report — the single most useful number in the clarity design: the list of
 * projects the data cannot currently speak about at all. This page is READ-ONLY on purpose.
 * Declarations are made from the project side (act-global-infrastructure/config/
 * project-evidence.json, versioned next to the codes themselves) and mirrored by
 * scripts/sync-project-evidence.mjs — the claim "these tables evidence Goods" belongs to the
 * work, not to a button here.
 */
export default async function ProjectsPage() {
  let rows: CodeRow[] = [];
  let error: string | null = null;
  try {
    rows = await load();
  } catch (e) {
    error = e instanceof Error ? e.message : String(e);
  }

  const withEvidence = rows.filter((r) => r.evidence_object_keys.length > 0);
  const zero = rows.filter((r) => r.evidence_object_keys.length === 0);
  const zeroActive = zero.filter((r) => r.status === 'active');
  const gapAlive = zero.filter(repoActive);
  const zeroRest = zero.filter((r) => !repoActive(r));
  const syncedAt = rows[0]?.synced_at ?? null;

  return (
    <main className="mx-auto max-w-[1180px] px-4 py-8">
      <header className="border-4 border-bauhaus-black bg-bauhaus-white p-5">
        <h1 className="font-mono text-2xl font-black">Projects</h1>
        {error ? (
          <p className="mt-2 font-mono text-[13px] text-bauhaus-red">Failed to load: {error}</p>
        ) : (
          <>
            <p className="mt-2 max-w-[75ch] text-[15px] leading-relaxed">
              Of <strong>{rows.length}</strong> project codes,{' '}
              <strong className="text-bauhaus-red">{zero.length}</strong> have zero declared
              evidence — the data cannot currently speak about them at all.{' '}
              <strong>{zeroActive.length}</strong> of those are active projects, and{' '}
              <strong>{gapAlive.length}</strong> have a codebase with commits in the last six
              months — a declaration gap on a living project, not a dead one.
            </p>
            <p className="mt-2 max-w-[75ch] text-[13px] text-neutral-600">
              Declarations are made from the project side —{' '}
              <code className="bg-bauhaus-canvas px-1 font-mono text-[0.92em]">
                act-global-infrastructure/config/project-evidence.json
              </code>{' '}
              — and mirrored by{' '}
              <code className="bg-bauhaus-canvas px-1 font-mono text-[0.92em]">
                scripts/sync-project-evidence.mjs
              </code>
              . This page has no buttons on purpose: the claim belongs to the work.
              {syncedAt ? ` Last synced ${syncedAt.slice(0, 10)}.` : ''}
            </p>
          </>
        )}
      </header>

      {withEvidence.length > 0 ? (
        <section className="mt-4 border-4 border-bauhaus-black bg-bauhaus-white">
          <h2 className="border-b-2 border-bauhaus-black px-4 py-2 font-mono text-[11px] font-black uppercase tracking-widest">
            Evidenced · {withEvidence.length}
          </h2>
          <ul>
            {withEvidence.map((r) => (
              <li key={r.code} className="border-b border-neutral-200 px-4 py-2.5 last:border-b-0">
                <div className="flex flex-wrap items-baseline gap-x-3">
                  <span className="font-mono text-[12px] font-black uppercase tracking-widest">
                    {r.code}
                  </span>
                  <span className="text-[14px] font-semibold">{r.name}</span>
                  <span className="font-mono text-[10px] uppercase tracking-widest text-neutral-400">
                    {r.status}
                    {r.tier ? ` · ${r.tier}` : ''}
                  </span>
                </div>
                {r.summary ? (
                  <p className="mt-0.5 max-w-[85ch] text-[13px] text-neutral-600">{r.summary}</p>
                ) : null}
                <div className="mt-1 flex flex-wrap gap-x-3 gap-y-0.5">
                  {r.evidence_object_keys.map((k) => (
                    <Link
                      key={k}
                      href={`/clarity/o/${encodeURIComponent(k)}`}
                      className="font-mono text-[12px] text-bauhaus-blue underline"
                    >
                      {k}
                    </Link>
                  ))}
                </div>
              </li>
            ))}
          </ul>
        </section>
      ) : null}

      {gapAlive.length > 0 ? (
        <section className="mt-4 border-4 border-bauhaus-red bg-bauhaus-white">
          <h2 className="border-b-2 border-bauhaus-red px-4 py-2 font-mono text-[11px] font-black uppercase tracking-widest text-bauhaus-red">
            Declaration gap — living codebase, no declared evidence · {gapAlive.length}
          </h2>
          <p className="border-b border-neutral-200 px-4 py-2 text-[13px] text-neutral-600">
            Fix by declaring in{' '}
            <code className="bg-bauhaus-canvas px-1 font-mono text-[0.92em]">
              act-global-infrastructure/config/project-evidence.json
            </code>{' '}
            and re-running the sync.
          </p>
          <ul>
            {gapAlive.map((r) => (
              <li key={r.code} className="border-b border-neutral-200 px-4 py-2 last:border-b-0">
                <span className="font-mono text-[12px] font-black">{r.code}</span>{' '}
                <span className="text-[14px] font-semibold">{r.name}</span>
                <span className="ml-2 font-mono text-[10px] uppercase tracking-widest text-neutral-500">
                  {r.repo} · last commit {r.repo_last_commit}
                </span>
                {r.summary ? (
                  <p className="mt-0.5 max-w-[85ch] text-[13px] text-neutral-600">{r.summary}</p>
                ) : null}
              </li>
            ))}
          </ul>
        </section>
      ) : null}

      {zeroRest.length > 0 ? (
        <section className="mt-4 border-4 border-bauhaus-black bg-bauhaus-white">
          <h2 className="border-b-2 border-bauhaus-black px-4 py-2 font-mono text-[11px] font-black uppercase tracking-widest">
            Zero evidence · {zeroRest.length} · no recent codebase activity known
          </h2>
          <ul className="grid gap-x-6 gap-y-1 p-4 sm:grid-cols-2 lg:grid-cols-3">
            {zeroRest.map((r) => (
              <li key={r.code} className="font-mono text-[12px] leading-6">
                <span className="font-black">{r.code}</span>{' '}
                <span className="font-sans text-[13px]" title={r.summary ?? undefined}>
                  {r.name}
                </span>
                <span
                  className={`ml-2 text-[10px] uppercase tracking-widest ${
                    r.status === 'active' ? 'text-bauhaus-red' : 'text-neutral-400'
                  }`}
                >
                  {r.status}
                </span>
              </li>
            ))}
          </ul>
        </section>
      ) : null}
    </main>
  );
}
