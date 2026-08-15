import type { Metadata } from 'next';
import { getDirectServiceSupabase } from '@/lib/supabase';
import LedgerClient from './LedgerClient';
import type { LedgerRow, LedgerStats, ObjectKind, FreshnessProbe } from './types';

export const dynamic = 'force-dynamic';

export const metadata: Metadata = {
  title: 'Clarity Ledger',
  description: 'Every object in the CivicGraph database, classified and counted.',
};

const SEGMENT: Record<ObjectKind, string> = {
  table: 'SOURCES',
  matview: 'DERIVED',
  view: 'LENSES',
  function: 'ROUTINES',
};

interface CatalogRow {
  object_name: string;
  object_kind: ObjectKind;
  row_count: number | null;
  row_count_is_estimate: boolean | null;
  bytes: number | null;
  domain: string | null;
  lifecycle: string | null;
  freshness_probe: FreshnessProbe | null;
  last_write_at: string | null;
  act_business: boolean | null;
  degree: number | null;
  column_count: number | null;
  importance: number | null;
  purpose: string | null;
  join_keys: string | null;
  caveat: string | null;
  rls_enabled: boolean | null;
  anon_readable: boolean | null;
  refreshed_at: string | null;
}

async function loadCatalog(): Promise<{ rows: LedgerRow[]; stats: LedgerStats }> {
  // getDirectServiceSupabase, NOT getServiceSupabase — the latter sniffs the call stack for
  // '/app/reports/' and returns a stub that resolves every query to { data: null }. This page
  // is safe today but a future route move would silently blank it.
  const supabase = getDirectServiceSupabase();

  // PostgREST caps a page at 1,000 rows and the catalog is ~1,455, so paginate explicitly
  // rather than silently receiving a truncated ledger.
  const PAGE = 1000;
  const all: CatalogRow[] = [];
  for (let from = 0; ; from += PAGE) {
    const { data, error } = await supabase
      .from('clarity_object')
      .select(
        'object_name,object_kind,row_count,row_count_is_estimate,bytes,domain,lifecycle,' +
          'freshness_probe,last_write_at,act_business,degree,column_count,importance,' +
          'purpose,join_keys,caveat,rls_enabled,anon_readable,refreshed_at',
      )
      .order('importance', { ascending: false, nullsFirst: false })
      .range(from, from + PAGE - 1);

    if (error) throw new Error(`clarity_object query failed: ${error.message}`);
    if (!data?.length) break;
    // PostgREST's generated types widen an un-typed select to GenericStringError[]; the runtime
    // shape is the row. Cast through unknown rather than loosening CatalogRow.
    all.push(...(data as unknown as CatalogRow[]));
    if (data.length < PAGE) break;
  }

  const rows: LedgerRow[] = all.map((o) => ({
    n: o.object_name,
    k: o.object_kind,
    s: SEGMENT[o.object_kind] ?? 'SOURCES',
    r: o.row_count,
    e: Boolean(o.row_count_is_estimate),
    b: o.bytes ?? 0,
    d: o.domain ?? '',
    l: o.lifecycle ?? '',
    f: o.freshness_probe ?? 'not_applicable',
    w: o.last_write_at ? o.last_write_at.slice(0, 10) : '',
    a: Boolean(o.act_business),
    g: o.degree ?? 0,
    c: o.column_count ?? 0,
    i: Number(o.importance ?? 0),
    p: o.purpose ?? '',
    j: o.join_keys ?? '',
    v: o.caveat ?? '',
    rls: Boolean(o.rls_enabled),
    an: Boolean(o.anon_readable),
  }));

  const relations = rows.filter((r) => r.k !== 'function');
  const described = relations.filter((r) => r.d).length;

  return {
    rows,
    stats: {
      catalogued: rows.length,
      relations: relations.length,
      routines: rows.length - relations.length,
      described,
      // Denominator is relations, not everything. Routines were never in scope to describe,
      // so counting them would punish us for a decision we made on purpose. Issue #193.
      coveragePct: relations.length ? Math.round((described / relations.length) * 100) : 0,
      noTimestampCol: rows.filter((r) => r.f === 'no_column').length,
      anonReadable: rows.filter((r) => r.an).length,
      actBusiness: rows.filter((r) => r.a).length,
      refreshedAt: all[0]?.refreshed_at ?? null,
    },
  };
}

export default async function ClarityPage() {
  let rows: LedgerRow[] = [];
  let stats: LedgerStats | null = null;
  let error: string | null = null;

  try {
    ({ rows, stats } = await loadCatalog());
  } catch (e) {
    error = e instanceof Error ? e.message : String(e);
  }

  if (error || !stats) {
    return (
      <main className="min-h-screen bg-bauhaus-canvas px-5 py-16">
        <div className="mx-auto max-w-3xl border-4 border-bauhaus-black bg-bauhaus-white p-8">
          <h1 className="text-2xl font-black uppercase tracking-widest text-bauhaus-red">
            Catalog unavailable
          </h1>
          <p className="mt-4 text-sm text-bauhaus-black">
            <code className="font-mono">clarity_object</code> could not be read. The catalog is
            built by <code className="font-mono">clarity_refresh()</code>; if it has never run,
            there is nothing to show yet.
          </p>
          <pre className="mt-4 overflow-x-auto border-2 border-bauhaus-muted bg-bauhaus-canvas p-3 font-mono text-xs">
            {error}
          </pre>
        </div>
      </main>
    );
  }

  if (!rows.length) {
    return (
      <main className="min-h-screen bg-bauhaus-canvas px-5 py-16">
        <div className="mx-auto max-w-3xl border-4 border-bauhaus-black bg-bauhaus-white p-8">
          <h1 className="text-2xl font-black uppercase tracking-widest">Catalog is empty</h1>
          <p className="mt-4 text-sm text-bauhaus-muted">
            The table exists but holds no rows. Run{' '}
            <code className="font-mono text-bauhaus-black">SELECT clarity_refresh();</code> and
            reload — it takes about 37 seconds.
          </p>
        </div>
      </main>
    );
  }

  return <LedgerClient rows={rows} stats={stats} />;
}
