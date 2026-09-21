import Link from 'next/link';
import { notFound } from 'next/navigation';
import { getServiceSupabase } from '@/lib/supabase';
import { ATLAS_SQL, LINK_LABEL, fmtRows, linkStatus, type AtlasRow } from '@/lib/table-atlas';
import tableReaders from '@/lib/table-readers.generated.json';

export const dynamic = 'force-dynamic';

/**
 * /ops/schema/[object]: one relation, everything known about it in one place.
 * Owner, consumers and evidence from schema_ownership; columns and keys from the catalogue;
 * how it links to the entity register by the CI guard's rule; which app files read it.
 */

const READERS = tableReaders as Record<string, string[]>;
const KIND: Record<string, string> = { r: 'table', p: 'table', m: 'matview', v: 'view' };

type Owner = { owner: string; consumers: string[] | null; evidence: string | null; declared_on: string | null };
type Col = { column_name: string; data_type: string; is_nullable: string; null_frac: number | null };

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="border-4 border-bauhaus-black p-4 space-y-2">
      <h2 className="font-black uppercase tracking-widest text-xs">{title}</h2>
      {children}
    </section>
  );
}

function TableLinks({ names }: { names: string[] | null }) {
  if (!names?.length) return <p className="text-sm">None.</p>;
  return (
    <ul className="text-sm font-mono flex flex-wrap gap-x-4">
      {names.map((n) => (
        <li key={n}><Link className="underline" href={`/ops/schema/${encodeURIComponent(n)}`}>{n}</Link></li>
      ))}
    </ul>
  );
}

export default async function TableAtlasPage({ params }: { params: Promise<{ object: string }> }) {
  const { object: raw } = await params;
  const object = decodeURIComponent(raw);
  if (!/^[a-z_][a-z0-9_]*$/.test(object)) notFound();

  const db = getServiceSupabase();
  const [own, atlasRes, colsRes] = await Promise.all([
    db.rpc('exec_sql', {
      query: `SELECT owner, consumers, evidence, declared_on::text AS declared_on FROM schema_ownership WHERE object = '${object}'`,
    }),
    db.rpc('exec_sql', { query: `SELECT * FROM (${ATLAS_SQL}) a WHERE a.object = '${object}'` }),
    db.rpc('exec_sql', {
      query: `SELECT c.column_name, c.data_type, c.is_nullable, s.null_frac
                FROM information_schema.columns c
                LEFT JOIN pg_stats s ON s.schemaname = 'public' AND s.tablename = c.table_name AND s.attname = c.column_name
               WHERE c.table_schema = 'public' AND c.table_name = '${object}'
               ORDER BY c.ordinal_position`,
    }),
  ]);
  const owner = ((own.data ?? []) as Owner[])[0];
  const atlas = ((atlasRes.data ?? []) as AtlasRow[])[0];
  const cols = (colsRes.data ?? []) as Col[];
  if (!owner && !atlas && cols.length === 0) notFound();

  const link = atlas ? linkStatus(atlas) : null;
  const readers = READERS[object] ?? [];
  const keys = new Set(atlas?.key_columns ?? []);
  const orgs = new Set(atlas?.org_columns ?? []);

  return (
    <div className="space-y-6">
      <header className="space-y-2">
        <Link href="/ops/schema" className="font-black uppercase tracking-widest text-xs underline">Schema register</Link>
        <h1 className="font-black text-3xl font-mono break-all">{object}</h1>
        <p className="text-sm">
          {atlas?.kind ? KIND[atlas.kind] ?? atlas.kind : 'not in the catalogue'}
          {atlas?.est_rows != null && atlas.est_rows >= 0 && <> · about {fmtRows(atlas.est_rows)} rows (planner estimate)</>}
          {owner && <> · owned by <strong>{owner.owner}</strong></>}
        </p>
        {atlas && !owner && (
          <p className="text-sm font-black text-bauhaus-red">Not in the schema register: no owner or consumers declared.</p>
        )}
        {[own.error, atlasRes.error, colsRes.error].filter(Boolean).map((e, i) => (
          <p key={i} className="text-bauhaus-red text-sm">Query failed: {e!.message}</p>
        ))}
      </header>

      <Section title="Link to the entity register">
        {!link || link.kind === 'not_a_table' ? (
          <p className="text-sm">Views and matviews inherit their links from the tables they read.</p>
        ) : (
          <>
            <p className={`font-black uppercase tracking-widest text-sm ${link.kind === 'unlinked_new' ? 'text-bauhaus-red' : ''}`}>
              {LINK_LABEL[link.kind]}
            </p>
            {link.kind === 'keyed' && <p className="text-sm">Join keys: <span className="font-mono">{link.keys.join(', ')}</span></p>}
            {link.kind === 'via_fk' && <p className="text-sm">Through a foreign key to: <span className="font-mono">{link.via.join(', ')}</span></p>}
            {link.kind === 'unlinked_exempt' && <p className="text-sm">Exempt: {link.reason}</p>}
            {link.kind === 'unlinked_accepted' && (
              <p className="text-sm">Names organisations in <span className="font-mono">{(atlas?.org_columns ?? []).join(', ')}</span> with no way to join them. Accepted in data/linkage-baseline.json; not yet fixed.</p>
            )}
            {link.kind === 'unlinked_new' && <p className="text-sm">Names organisations with no join key and is not in the baseline. CI fails on this.</p>}
            {link.kind === 'no_organisations' && <p className="text-sm">No column names an organisation, so there is nothing to join.</p>}
          </>
        )}
      </Section>

      <div className="grid md:grid-cols-2 gap-6">
        <Section title="Points to (foreign keys out)"><TableLinks names={atlas?.fk_out ?? null} /></Section>
        <Section title="Pointed to by (foreign keys in)"><TableLinks names={atlas?.fk_in ?? null} /></Section>
      </div>

      <Section title={`Read by the app (${readers.length} files)`}>
        {readers.length === 0 ? (
          <p className="text-sm">No file in apps/web/src names it. It may still be read by scripts or another repo{owner?.consumers?.length ? ` (consumers: ${owner.consumers.join(', ')})` : ''}.</p>
        ) : (
          <ul className="text-xs font-mono columns-1 md:columns-2">{readers.map((f) => <li key={f}>{f}</li>)}</ul>
        )}
      </Section>

      {owner && (
        <Section title="Ownership">
          <p className="text-sm">Consumers: {(owner.consumers ?? []).join(', ') || 'none recorded'}</p>
          {owner.evidence && <p className="text-sm">Evidence: {owner.evidence}</p>}
          {owner.declared_on && <p className="text-xs">Declared {owner.declared_on}</p>}
        </Section>
      )}

      <Section title={`Columns (${cols.length})`}>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="font-black uppercase tracking-widest text-xs">
              <tr><th className="text-left p-1">column</th><th className="text-left p-1">type</th><th className="text-right p-1">empty</th><th className="text-left p-1">role</th></tr>
            </thead>
            <tbody>
              {cols.map((c) => (
                <tr key={c.column_name} className="border-t border-bauhaus-black/20">
                  <td className="p-1 font-mono">{c.column_name}</td>
                  <td className="p-1">{c.data_type}</td>
                  <td className="p-1 text-right tabular-nums">{c.null_frac == null ? '' : `${Math.round(c.null_frac * 100)}%`}</td>
                  <td className="p-1 text-xs uppercase tracking-widest">{keys.has(c.column_name) ? 'join key' : orgs.has(c.column_name) ? 'names an organisation' : ''}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <p className="text-xs">&ldquo;Empty&rdquo; is pg_stats.null_frac from the last ANALYZE, a sample, and blank where the table has never been analysed.</p>
      </Section>
    </div>
  );
}
