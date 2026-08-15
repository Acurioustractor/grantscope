import type { Metadata } from 'next';
import { getDirectServiceSupabase } from '@/lib/supabase';
import LedgerClient from './LedgerClient';
import type { LedgerRow, LedgerStats, ObjectKind, FreshnessProbe } from './types';

export const dynamic = 'force-dynamic';

export const metadata: Metadata = {
  title: 'Clarity',
  description: 'Everything CivicGraph holds, and the questions it can answer, in one index.',
};

const SEGMENT: Record<ObjectKind, string> = {
  table: 'SOURCES',
  matview: 'DERIVED',
  view: 'LENSES',
  function: 'ROUTINES',
  question: 'QUESTIONS',
};

interface CatalogRow {
  object_name: string;
  object_kind: Exclude<ObjectKind, 'question'>;
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

interface QuestionRow {
  slug: string;
  stub: string;
  question: string;
  subject: string;
  state: string;
  caveat: string;
  exclusions: string;
  headline: string | null;
  headline_sub: string | null;
  computed_at: string | null;
  ok: boolean | null;
  row_count: number | null;
  binding_object: string | null;
}

async function loadIndex(): Promise<{ rows: LedgerRow[]; stats: LedgerStats }> {
  // getDirectServiceSupabase, NOT getServiceSupabase — the latter sniffs the call stack for
  // '/app/reports/' and returns a stub resolving every query to { data: null }, i.e. a silent [].
  const supabase = getDirectServiceSupabase();

  // PostgREST caps a page at 1,000 rows and the catalog is ~1,455, so paginate explicitly
  // rather than silently receiving a truncated ledger that renders as if it were complete.
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
    all.push(...(data as unknown as CatalogRow[]));
    if (data.length < PAGE) break;
  }

  // Questions live in the same index as the objects they are computed from. A failure here must
  // not blank the catalog — the index is still worth having without them.
  let questions: QuestionRow[] = [];
  try {
    const { data } = await supabase
      .from('v_clarity_board_cards')
      .select(
        'slug,stub,question,subject,state,caveat,exclusions,headline,headline_sub,' +
          'computed_at,ok,row_count,binding_object',
      );
    questions = (data ?? []) as unknown as QuestionRow[];
  } catch {
    questions = [];
  }

  const objectRows: LedgerRow[] = all.map((o) => ({
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

  const questionRows: LedgerRow[] = questions.map((q) => ({
    n: q.stub,
    k: 'question',
    s: 'QUESTIONS',
    // The row count of a question is the size of the answer behind it, so "see the 775 rows"
    // and this column agree rather than telling two different stories.
    r: q.row_count,
    e: false,
    b: 0,
    d: q.subject.toLowerCase(),
    l: q.state,
    f: q.computed_at ? 'ok' : 'not_applicable',
    w: q.computed_at ? q.computed_at.slice(0, 10) : '',
    a: false,
    g: 0,
    c: 0,
    // Questions rank above every object on the default sort. They are the only rows here that
    // answer something about the world; everything else describes our estate.
    i: 1000,
    p: q.question,
    j: q.binding_object ?? '',
    v: q.caveat,
    rls: false,
    an: false,
    qs: q.slug,
    qh: q.ok === false ? null : q.headline,
    qsub: q.ok === false ? 'last run failed' : q.headline_sub,
  })) as LedgerRow[];

  const rows = [...questionRows, ...objectRows];
  const relations = objectRows.filter((r) => r.k !== 'function');
  const described = relations.filter((r) => r.d).length;

  return {
    rows,
    stats: {
      catalogued: objectRows.length,
      relations: relations.length,
      routines: objectRows.length - relations.length,
      described,
      // Denominator is relations, not everything. Routines were never in scope to describe,
      // so counting them would punish us for a decision we made on purpose. Issue #193.
      coveragePct: relations.length ? Math.round((described / relations.length) * 100) : 0,
      noTimestampCol: objectRows.filter((r) => r.f === 'no_column').length,
      anonReadable: objectRows.filter((r) => r.an).length,
      actBusiness: objectRows.filter((r) => r.a).length,
      refreshedAt: all[0]?.refreshed_at ?? null,
    },
  };
}

export default async function ClarityPage() {
  let rows: LedgerRow[] = [];
  let stats: LedgerStats | null = null;
  let error: string | null = null;

  try {
    ({ rows, stats } = await loadIndex());
  } catch (e) {
    error = e instanceof Error ? e.message : String(e);
  }

  if (error || !stats) {
    return (
      <main className="clarity-dark min-h-screen px-5 py-16">
        <div className="mx-auto max-w-3xl border-4 border-bauhaus-red bg-bauhaus-white p-8">
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
      <main className="clarity-dark min-h-screen px-5 py-16">
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

  // The dark scope is applied here, not in the client, so the ground is painted server-side and
  // the page never flashes light on first paint.
  return (
    <div className="clarity-dark">
      <LedgerClient rows={rows} stats={stats} />
    </div>
  );
}
