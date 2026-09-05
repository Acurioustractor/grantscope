import Link from 'next/link';
import { getServiceSupabase } from '@/lib/supabase';

export const dynamic = 'force-dynamic';

/**
 * /ops/schema — the schema register, live.
 *
 * One page that answers "what is this table, whose is it, who reads it, is it private, can the public key
 * see it". Reads `schema_ownership` (seeded 2026-09-05, one row per public relation) joined to the catalog.
 * The rule this page exists to make visible: an object owned by `act` that the anon role can read is a
 * leak, and it should never be green here. Migrations that add objects add a row here in the same file
 * (supabase/migrations/README.md).
 */

type Row = {
  object: string;
  kind: string;
  owner: string;
  consumers: string[] | null;
  evidence: string | null;
  declared_on: string | null;
  bytes: number | null;
  anon_state: string | null; // 'no grant' | 'grant, RLS blocks' | 'open (policy)' | 'open (no RLS)' | 'open (matview)' | 'open (definer view)' | 'via base RLS'
  invoker: boolean | null;
};

const OPEN = (state: string | null) => !!state && state.startsWith('open');

const OWNERS = ['grantscope', 'justicehub', 'act', 'shared', 'empathy-ledger', 'harvest', 'studio', 'unknown'] as const;
const PRIVATE_OWNERS = new Set(['act', 'empathy-ledger', 'harvest', 'studio']);

function fmtBytes(n: number | null): string {
  if (!n) return '';
  if (n >= 1_073_741_824) return `${(n / 1_073_741_824).toFixed(1)} GB`;
  if (n >= 1_048_576) return `${Math.round(n / 1_048_576)} MB`;
  if (n >= 1024) return `${Math.round(n / 1024)} kB`;
  return `${n} B`;
}

const KIND: Record<string, string> = { r: 'table', p: 'table', m: 'matview', v: 'view' };

export default async function SchemaRegisterPage({
  searchParams,
}: {
  searchParams: Promise<{ owner?: string; q?: string }>;
}) {
  const { owner, q } = await searchParams;
  const db = getServiceSupabase();
  const { data, error } = await db.rpc('exec_sql', {
    query: `
      WITH x AS (
        SELECT s.object, s.owner, s.consumers, s.evidence, s.declared_on::text AS declared_on, c.relkind, c.relrowsecurity AS rls,
               pg_total_relation_size(c.oid) AS bytes,
               has_table_privilege('anon', c.oid, 'SELECT') AS grant_anon,
               EXISTS (SELECT 1 FROM pg_policy p WHERE p.polrelid = c.oid AND p.polpermissive AND p.polcmd IN ('r','*')
                       AND (p.polroles = '{0}' OR EXISTS (SELECT 1 FROM pg_roles r WHERE r.oid = ANY(p.polroles) AND r.rolname = 'anon'))) AS anon_policy,
               CASE WHEN c.relkind = 'v'
                    THEN coalesce((SELECT option_value FROM pg_options_to_table(c.reloptions) WHERE option_name = 'security_invoker'), 'false') = 'true'
                    END AS invoker
        FROM schema_ownership s
        LEFT JOIN pg_class c ON c.relname = s.object
        LEFT JOIN pg_namespace n ON n.oid = c.relnamespace AND n.nspname = 'public')
      SELECT object, relkind AS kind, owner, consumers, evidence, declared_on, bytes, invoker,
             CASE WHEN relkind IS NULL THEN 'missing'
                  WHEN NOT grant_anon THEN 'no grant'
                  WHEN relkind IN ('r','p') AND rls AND NOT anon_policy THEN 'grant, RLS blocks'
                  WHEN relkind IN ('r','p') AND rls AND anon_policy THEN 'open (policy)'
                  WHEN relkind IN ('r','p') AND NOT rls THEN 'open (no RLS)'
                  WHEN relkind = 'm' THEN 'open (matview)'
                  WHEN relkind = 'v' AND NOT invoker THEN 'open (definer view)'
                  WHEN relkind = 'v' AND invoker THEN 'via base RLS' END AS anon_state
      FROM x ORDER BY owner, object`,
  });
  const rows = ((data ?? []) as Row[]).filter((r) => (!owner || r.owner === owner) && (!q || r.object.includes(q)));
  const all = (data ?? []) as Row[];
  const byOwner = OWNERS.map((o) => ({ owner: o, n: all.filter((r) => r.owner === o).length }));
  const leaks = all.filter((r) => PRIVATE_OWNERS.has(r.owner) && OPEN(r.anon_state));

  return (
    <div className="space-y-8">
      <header className="space-y-2">
        <p className="font-black uppercase tracking-widest text-xs">Schema register</p>
        <h1 className="font-black uppercase text-3xl">What this data is and whose it is</h1>
        <p className="max-w-3xl text-sm">
          One row per public relation in the shared Supabase project. Owner says which product changes it; consumers
          are the repos whose code reads it. &ldquo;Public key&rdquo; is what the anon role can actually read: a SELECT
          grant alone means nothing while RLS has no anon policy, so that reads as &ldquo;grant, RLS blocks&rdquo;.
          Private owners (act, empathy-ledger, harvest, studio) must never be open. Changes go through <code>scripts/db-apply.sh</code>; the rule is in{' '}
          <code>supabase/migrations/README.md</code>.
        </p>
        {error && <p className="text-bauhaus-red text-sm">Register query failed: {error.message}</p>}
      </header>

      <section className="grid grid-cols-2 md:grid-cols-4 gap-0 border-4 border-bauhaus-black">
        {byOwner.map(({ owner: o, n }) => (
          <Link
            key={o}
            href={o === owner ? '/ops/schema' : `/ops/schema?owner=${o}`}
            className={`block p-4 border-2 border-bauhaus-black ${o === owner ? 'bg-bauhaus-black text-bauhaus-canvas' : ''}`}
          >
            <span className="block font-black uppercase tracking-widest text-xs">{o}</span>
            <span className="block font-black text-3xl tabular-nums">{n}</span>
          </Link>
        ))}
      </section>

      <section className={`border-4 p-4 ${leaks.length ? 'border-bauhaus-red' : 'border-bauhaus-black'}`}>
        <p className="font-black uppercase tracking-widest text-xs">Private objects readable by the public key</p>
        <p className="font-black text-3xl tabular-nums">{leaks.length}</p>
        {leaks.length > 0 && (
          <ul className="mt-2 text-sm font-mono">
            {leaks.map((r) => (
              <li key={r.object}>
                {r.object} <span className="opacity-70">({r.owner})</span>
              </li>
            ))}
          </ul>
        )}
        {leaks.length === 0 && <p className="text-sm">None. Keep it that way: new views are security_invoker, nothing private gets an anon policy or a definer view.</p>}
      </section>

      <form className="flex gap-2 items-center" action="/ops/schema" method="get">
        {owner && <input type="hidden" name="owner" value={owner} />}
        <input name="q" defaultValue={q ?? ''} placeholder="filter by name" className="border-2 border-bauhaus-black px-2 py-1 text-sm" />
        <button className="border-2 border-bauhaus-black px-3 py-1 font-black uppercase tracking-widest text-xs">Filter</button>
        <span className="text-xs">{rows.length} of {all.length}</span>
      </form>

      <div className="overflow-x-auto border-4 border-bauhaus-black">
        <table className="w-full text-sm">
          <thead className="bg-bauhaus-black text-bauhaus-canvas font-black uppercase tracking-widest text-xs">
            <tr>
              <th className="text-left p-2">object</th>
              <th className="text-left p-2">kind</th>
              <th className="text-left p-2">owner</th>
              <th className="text-left p-2">consumers</th>
              <th className="text-right p-2">size</th>
              <th className="text-left p-2">public key</th>
              <th className="text-left p-2">evidence</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((r) => {
              const leak = PRIVATE_OWNERS.has(r.owner) && OPEN(r.anon_state);
              return (
                <tr key={r.object} className={`border-t-2 border-bauhaus-black/20 ${leak ? 'bg-bauhaus-red/10' : ''}`}>
                  <td className="p-2 font-mono">{r.object}</td>
                  <td className="p-2">
                    {KIND[r.kind] ?? r.kind}
                    {r.kind === 'v' && r.invoker === false && <span className="ml-1 text-xs uppercase tracking-widest">definer</span>}
                  </td>
                  <td className="p-2">{r.owner}</td>
                  <td className="p-2">{(r.consumers ?? []).join(', ')}</td>
                  <td className="p-2 text-right tabular-nums">{fmtBytes(r.bytes)}</td>
                  <td className={`p-2 ${leak ? 'font-black text-bauhaus-red' : ''}`}>{r.anon_state}</td>
                  <td className="p-2 text-xs max-w-md truncate" title={r.evidence ?? ''}>{r.evidence}</td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}
