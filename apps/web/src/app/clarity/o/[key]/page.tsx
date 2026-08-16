import type { Metadata } from 'next';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import { getDirectServiceSupabase } from '@/lib/supabase';
import { VISIBILITY_MEANING, canRender, type Surface } from '@/lib/visibility';
import { floorFor, floorReason } from '../../visibility-floor';
import {
  formatBytes,
  formatCount,
  formatRate,
  isStub,
  usageMeasurement,
  type CodeRefRow,
  type ColumnRow,
  type EdgeRow,
  type ObjectRow,
  type QuestionUse,
} from './types';

export const dynamic = 'force-dynamic';

export async function generateMetadata({
  params,
}: {
  params: Promise<{ key: string }>;
}): Promise<Metadata> {
  const { key } = await params;
  return { title: `Clarity · ${decodeURIComponent(key)}` };
}

interface Loaded {
  object: ObjectRow;
  columns: ColumnRow[];
  edges: EdgeRow[];
  codeRefs: CodeRefRow[];
  questions: QuestionUse[];
}

/**
 * A secondary panel degrades to empty rather than taking the page down. PostgREST builders are
 * PromiseLike, not Promise, so they need wrapping before they can be caught.
 */
async function safe<T>(builder: PromiseLike<{ data: unknown }>): Promise<T[]> {
  try {
    const { data } = await builder;
    return (data ?? []) as T[];
  } catch {
    return [];
  }
}

/**
 * The object row is the page; everything else is a panel that degrades to empty rather than
 * taking the page down. Same rule as the worked-answer page after the 15 Aug pool incident — a
 * secondary query losing its connection must not 500 the thing the reader came for.
 */
async function load(key: string): Promise<Loaded | null> {
  const supabase = getDirectServiceSupabase();

  const { data: rows, error } = await supabase
    .from('clarity_object')
    .select('*')
    .eq('object_key', key)
    .limit(1);
  if (error) throw new Error(`object query failed: ${error.message}`);
  if (!rows?.length) return null;

  const object = rows[0] as unknown as ObjectRow;

  const columns = await safe<ColumnRow>(
    supabase
      .from('clarity_column')
      .select('ordinal,column_name,data_type,is_nullable,is_pk,is_indexed,is_vector,vector_dim')
      .eq('object_key', key)
      .order('ordinal'),
  );

  // Both directions in one pass. `clarity_edge` uses BARE object names, matching
  // `clarity_object.object_key` — see the key-forms note in ./types.ts.
  const edges = await safe<EdgeRow>(
    supabase
      .from('clarity_edge')
      .select(
        'src_object,src_column,tgt_object,tgt_column,mechanism,declared,match_rate,match_numerator,match_denominator,rows_at_stake,note',
      )
      .or(`src_object.eq.${key},tgt_object.eq.${key}`),
  );

  const codeRefs = await safe<CodeRefRow>(
    supabase
      .from('clarity_code_ref')
      .select('ref_class,repo,file_path,hits')
      .eq('object_key', key)
      .order('hits', { ascending: false }),
  );

  // The ONE place the prefixed key form is correct. `public.` is CHECK-constrained on this table.
  const questions = await safe<QuestionUse>(
    supabase
      .from('clarity_question_ingredient')
      .select('question_slug,role')
      .eq('object_key', `public.${key}`),
  );

  return { object, columns, edges, codeRefs, questions };
}

function Panel({
  title,
  note,
  children,
}: {
  title: string;
  note?: string;
  children: React.ReactNode;
}) {
  return (
    <section className="border-4 border-bauhaus-black bg-bauhaus-white">
      <h2 className="flex flex-wrap items-baseline gap-x-3 border-b-2 border-bauhaus-black px-4 py-2 font-mono text-[11px] font-black uppercase tracking-widest">
        {title}
        {note ? <span className="font-normal normal-case text-neutral-500">{note}</span> : null}
      </h2>
      <div className="p-4">{children}</div>
    </section>
  );
}

/**
 * The curated prose is written in markdown — 467 caveats and 84 purposes contain `**bold**` or
 * backtick code. Rendered as plain text it reads as broken formatting, which is how it looked the
 * first time this page was opened. Only two inline forms are supported on purpose: no dependency,
 * no `dangerouslySetInnerHTML`, and nothing here can inject markup.
 */
function Prose({ text, className }: { text: string; className?: string }) {
  const parts = text.split(/(\*\*[^*]+\*\*|`[^`]+`)/g);
  return (
    <p className={className}>
      {parts.map((part, i) => {
        if (part.startsWith('**') && part.endsWith('**') && part.length > 4) {
          return <strong key={i}>{part.slice(2, -2)}</strong>;
        }
        if (part.startsWith('`') && part.endsWith('`') && part.length > 2) {
          return (
            <code key={i} className="bg-bauhaus-canvas px-1 font-mono text-[0.92em]">
              {part.slice(1, -1)}
            </code>
          );
        }
        return <span key={i}>{part}</span>;
      })}
    </p>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="border-b border-neutral-200 py-2 last:border-b-0">
      <dt className="font-mono text-[10px] font-black uppercase tracking-widest text-neutral-500">
        {label}
      </dt>
      <dd className="mt-0.5 font-mono text-[12.5px] break-words">{children}</dd>
    </div>
  );
}

function Flag({ on, label }: { on: boolean | null; label: string }) {
  if (on === null) return null;
  return (
    <span
      className={`inline-block border-2 px-1.5 py-0.5 font-mono text-[10px] font-black uppercase tracking-widest ${
        on
          ? 'border-bauhaus-red bg-bauhaus-red text-white'
          : 'border-neutral-300 text-neutral-400'
      }`}
    >
      {label}
    </span>
  );
}

export default async function ObjectPage({ params }: { params: Promise<{ key: string }> }) {
  const { key: rawKey } = await params;
  const key = decodeURIComponent(rawKey);
  const loaded = await load(key);
  if (!loaded) notFound();

  const { object: o, columns, edges, codeRefs, questions } = loaded;
  const stub = isStub(o);
  const usage = usageMeasurement(o);
  const isRoutine = o.object_kind === 'function';

  // /clarity is an operator surface. The floor decides what an operator may see of THIS object.
  //
  // WHERE THE LINE SITS, and why it moved once.
  //
  // Metadata is visible at every tier: that the object exists, its shape, its columns, its grain,
  // its freshness, its access posture. ROWS are the contents, and rows are what the floor
  // governs. A storyteller consented to their story being used a particular way, not to it being
  // browsable by whoever holds the admin session.
  //
  // This first shipped withholding the COLUMN CATALOGUE too, and that was wrong twice over. It
  // contradicted the written design in clarity-console.md ("shows its row count, its grain, its
  // freshness, its RLS posture — and refuses the rows"), and it did not even work: column names
  // also arrive through `grain`, `join_keys` and `clarity_edge.src_column`/`tgt_column`, so
  // `transcripts` still shipped `storyteller_id` and `transcript_text` in its payload. A guard
  // that blocks one of four paths is worse than no guard, because it reads as protection.
  //
  // If a future object has a column name that is itself disclosive (a diagnosis, a status), that
  // is an argument for withholding THAT object's metadata explicitly — not for a blanket rule
  // enforced in one place out of four.
  const SURFACE: Surface = 'operator';
  const floor = floorFor(o);
  const rowsVisible = canRender(floor, SURFACE);
  const withheldBecause = floorReason(o);

  return (
    <main className="mx-auto max-w-[1180px] px-4 py-8">
      <Link
        href="/clarity"
        className="font-mono text-[11px] font-black uppercase tracking-widest text-bauhaus-blue"
      >
        ◂ Clarity
      </Link>

      <header className="mt-3 border-4 border-bauhaus-black bg-bauhaus-white p-5">
        <h1 className="font-mono text-2xl font-black break-words">{o.object_name}</h1>
        <div className="mt-3 flex flex-wrap items-center gap-2">
          <span className="border-2 border-bauhaus-black px-2 py-0.5 font-mono text-[10px] font-black uppercase tracking-widest">
            {o.object_kind}
          </span>
          {/* An object with no domain is UNFILED, never guessed into a bucket. 667 of 1,479. */}
          <span
            className={`border-2 px-2 py-0.5 font-mono text-[10px] font-black uppercase tracking-widest ${
              o.domain ? 'border-bauhaus-black' : 'border-neutral-400 text-neutral-500'
            }`}
          >
            {o.domain ?? 'unfiled'}
          </span>
          {o.lifecycle ? (
            <span className="border-2 border-neutral-300 px-2 py-0.5 font-mono text-[10px] font-black uppercase tracking-widest text-neutral-600">
              {o.lifecycle}
            </span>
          ) : null}
          {o.act_business ? (
            <span className="border-2 border-bauhaus-blue bg-bauhaus-blue px-2 py-0.5 font-mono text-[10px] font-black uppercase tracking-widest text-white">
              ACT business
            </span>
          ) : null}
          {o.missing_since ? (
            <span className="border-2 border-bauhaus-red bg-bauhaus-red px-2 py-0.5 font-mono text-[10px] font-black uppercase tracking-widest text-white">
              missing since {o.missing_since.slice(0, 10)}
            </span>
          ) : null}
          {!rowsVisible ? (
            <span className="border-2 border-bauhaus-black bg-bauhaus-black px-2 py-0.5 font-mono text-[10px] font-black uppercase tracking-widest text-bauhaus-canvas">
              rows withheld
            </span>
          ) : null}
        </div>

        {!rowsVisible ? (
          <p className="mt-4 border-l-4 border-bauhaus-black bg-bauhaus-canvas p-3 text-[14px] leading-relaxed">
            <strong>The rows of this object are withheld.</strong> {withheldBecause}.{' '}
            {VISIBILITY_MEANING[floor]} Everything <em>about</em> it is below — what it is, its
            shape, how fresh, who may reach it — because knowing that a thing exists is not the
            same as reading what is inside it. Admin access is not a consent basis.
          </p>
        ) : null}

        {stub ? (
          <p className="mt-4 border-l-4 border-neutral-400 pl-3 text-[14px] text-neutral-600">
            This object has no purpose, grain or join keys recorded. It is one of{' '}
            <strong>667 stubs</strong> in a catalogue of 1,479 — described objects carry all three
            fields, so nothing here is half-written. Everything below is measured rather than
            curated.
          </p>
        ) : (
          <>
            {o.purpose ? (
              <Prose text={o.purpose} className="mt-4 text-[15px] leading-relaxed" />
            ) : null}
            {o.caveat ? (
              <Prose
                text={o.caveat}
                className="mt-3 border-l-4 border-bauhaus-red pl-3 text-[14px] leading-relaxed"
              />
            ) : null}
          </>
        )}
      </header>

      <div className="mt-4 grid gap-4 lg:grid-cols-[minmax(0,1fr)_360px]">
        <div className="grid gap-4">
          <Panel
            title="Columns"
            note={
              columns.length
                ? `${columns.length} of ${o.column_count ?? '?'}`
                : 'not catalogued for this object'
            }
          >
            {columns.length === 0 ? (
              <p className="font-mono text-[12px] text-neutral-500">
                No column catalogue. 1,056 of 1,479 objects have one; routines never do.
              </p>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full border-collapse text-left font-mono text-[12px]">
                  <thead>
                    <tr className="border-b-2 border-bauhaus-black">
                      <th className="py-1.5 pr-3 font-black uppercase tracking-widest">#</th>
                      <th className="py-1.5 pr-3 font-black uppercase tracking-widest">Column</th>
                      <th className="py-1.5 pr-3 font-black uppercase tracking-widest">Type</th>
                      <th className="py-1.5 pr-3 font-black uppercase tracking-widest">Null</th>
                      <th className="py-1.5 font-black uppercase tracking-widest">Keys</th>
                    </tr>
                  </thead>
                  <tbody>
                    {columns.map((c) => (
                      <tr key={c.ordinal} className="border-b border-neutral-200">
                        <td className="py-1.5 pr-3 text-neutral-400">{c.ordinal}</td>
                        <td className="py-1.5 pr-3 font-semibold">{c.column_name}</td>
                        <td className="py-1.5 pr-3 text-neutral-600">{c.data_type}</td>
                        <td className="py-1.5 pr-3 text-neutral-500">
                          {c.is_nullable ? 'null' : 'not null'}
                        </td>
                        <td className="py-1.5">
                          <span className="flex flex-wrap gap-1">
                            {c.is_pk ? <Flag on label="pk" /> : null}
                            {c.is_indexed ? <Flag on label="idx" /> : null}
                            {c.is_vector ? <Flag on label={`vec ${c.vector_dim ?? ''}`} /> : null}
                          </span>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </Panel>

          <Panel
            title="What it connects to"
            note={edges.length ? `${edges.length} edges` : 'no declared edges'}
          >
            {edges.length === 0 ? (
              <p className="font-mono text-[12px] text-neutral-500">
                Nothing in <code>clarity_edge</code> touches this object. 1,367 edges are declared
                across the whole catalogue, so an absence here is measured, not assumed.
              </p>
            ) : (
              <ul className="grid gap-2">
                {edges.map((e, i) => {
                  const outbound = e.src_object === key;
                  const other = outbound ? e.tgt_object : e.src_object;
                  return (
                    <li
                      key={`${e.src_object}.${e.src_column ?? ''}→${e.tgt_object}.${e.tgt_column ?? ''}#${i}`}
                      className="border-b border-neutral-200 pb-2 last:border-b-0 last:pb-0"
                    >
                      <div className="flex flex-wrap items-baseline gap-2 font-mono text-[12.5px]">
                        <span className="text-neutral-400">{outbound ? '→' : '←'}</span>
                        <Link
                          href={`/clarity/o/${encodeURIComponent(other)}`}
                          className="font-semibold text-bauhaus-blue underline"
                        >
                          {other}
                        </Link>
                        <span className="text-neutral-500">
                          {outbound ? e.src_column : e.tgt_column} ↔{' '}
                          {outbound ? e.tgt_column : e.src_column}
                        </span>
                        {/* A seam we never measured renders `?`, never 0. */}
                        <span
                          className={
                            e.match_rate !== null && Number(e.match_rate) < 0.9
                              ? 'font-black text-bauhaus-red'
                              : 'text-neutral-600'
                          }
                        >
                          {formatRate(e.match_rate)}
                        </span>
                        {e.declared ? null : (
                          <span className="text-[10px] uppercase tracking-widest text-neutral-400">
                            inferred
                          </span>
                        )}
                      </div>
                      {e.note ? (
                        <p className="mt-1 text-[12px] text-neutral-600">{e.note}</p>
                      ) : null}
                    </li>
                  );
                })}
              </ul>
            )}
          </Panel>

          <Panel title="What uses it">
            <dl className="grid gap-0">
              {(
                [
                  ['App', usage.app],
                  ['Scripts', usage.script],
                  ['Migrations', usage.migration],
                  ['DB functions', usage.dbFunction],
                ] as const
              ).map(([label, m]) => (
                <Field key={label} label={label}>
                  {m.state === 'measured' ? (
                    <span className={m.value === 0 ? 'text-neutral-500' : ''}>
                      {m.value === 0 ? 'nothing references it' : `${m.value} references`}
                    </span>
                  ) : (
                    // Never render 0 for a probe that never ran. Doing so would call 1,151
                    // objects orphans on the strength of an unrun scanner.
                    <span className="text-neutral-500">
                      <strong className="text-bauhaus-red">UNMEASURED</strong> — {m.why}
                    </span>
                  )}
                </Field>
              ))}
            </dl>
            {codeRefs.length > 0 ? (
              <ul className="mt-3 grid gap-1 font-mono text-[12px]">
                {codeRefs.map((r, i) => (
                  <li key={`${r.ref_class}:${r.file_path ?? ''}#${i}`} className="break-words">
                    <span className="mr-2 text-[10px] uppercase tracking-widest text-neutral-500">
                      {r.ref_class}
                    </span>
                    {r.file_path ?? r.repo ?? '—'}
                    {r.hits ? <span className="ml-2 text-neutral-400">×{r.hits}</span> : null}
                  </li>
                ))}
              </ul>
            ) : null}
          </Panel>
        </div>

        <div className="grid content-start gap-4">
          <Panel title="Shape">
            <dl>
              <Field label="Rows">
                {formatCount(o.row_count, o.row_count_is_estimate)}
                {o.row_count_is_estimate ? (
                  <span className="ml-2 text-[10px] uppercase tracking-widest text-neutral-500">
                    estimate
                  </span>
                ) : null}
              </Field>
              <Field label="Size">{formatBytes(o.bytes)}</Field>
              <Field label="Columns">
                {o.column_count ?? '—'}
                {o.nullable_columns !== null ? (
                  <span className="text-neutral-500"> · {o.nullable_columns} nullable</span>
                ) : null}
              </Field>
              <Field label="Grain">{o.grain ?? <span className="text-neutral-400">—</span>}</Field>
              <Field label="Join keys">
                {o.join_keys ?? <span className="text-neutral-400">—</span>}
              </Field>
              <Field label="Degree">
                {o.degree ?? '—'}
                <span className="text-neutral-500">
                  {' '}
                  · fk {o.fk_in ?? 0}/{o.fk_out ?? 0} · join {o.join_in ?? 0}/{o.join_out ?? 0} ·
                  lineage {o.lineage_in ?? 0}/{o.lineage_out ?? 0}
                </span>
              </Field>
            </dl>
          </Panel>

          <Panel title="Freshness">
            <dl>
              <Field label="Probe">{o.freshness_probe ?? '—'}</Field>
              <Field label="Last write">
                {o.last_write_at ? (
                  o.last_write_at.slice(0, 10)
                ) : (
                  <span className="text-neutral-500">
                    {o.freshness_probe === 'no_column'
                      ? 'no timestamp column — our omission, not the data’s'
                      : 'unknown'}
                  </span>
                )}
              </Field>
              <Field label="Column">{o.freshness_column ?? '—'}</Field>
              <Field label="First seen">{o.first_seen_at?.slice(0, 10) ?? '—'}</Field>
            </dl>
          </Panel>

          <Panel title="Access">
            <div className="flex flex-wrap gap-1.5">
              <Flag on={o.rls_enabled} label="RLS" />
              <Flag on={o.anon_readable} label="anon read" />
              <Flag on={o.anon_grant} label="anon grant" />
              <Flag on={o.authenticated_grant} label="auth grant" />
              <Flag on={o.security_definer} label="sec definer" />
              <Flag on={o.security_invoker} label="sec invoker" />
              <Flag on={o.anon_execute} label="anon exec" />
            </div>
            <dl className="mt-2">
              <Field label="Policies">
                {o.policy_count ?? 0}
                {o.anon_open_policies ? (
                  <span className="text-bauhaus-red"> · {o.anon_open_policies} open to anon</span>
                ) : null}
              </Field>
            </dl>
          </Panel>

          {isRoutine ? (
            <Panel title="Routine">
              <dl>
                <Field label="Language">{o.routine_language ?? '—'}</Field>
                <Field label="Kind">{o.routine_kind ?? '—'}</Field>
                <Field label="Returns">{o.routine_returns ?? '—'}</Field>
                <Field label="Volatility">{o.routine_volatility ?? '—'}</Field>
                <Field label="Source">{formatBytes(o.routine_src_bytes)}</Field>
                <Field label="Triggers">{o.trigger_attachments ?? 0}</Field>
              </dl>
            </Panel>
          ) : null}

          {questions.length > 0 ? (
            <Panel title="Questions built on it">
              <ul className="grid gap-1.5">
                {questions.map((q) => (
                  <li key={q.question_slug}>
                    <Link
                      href={`/clarity/q/${q.question_slug}`}
                      className="font-mono text-[12.5px] font-semibold text-bauhaus-blue underline"
                    >
                      {q.question_slug}
                    </Link>
                    {q.role ? (
                      <span className="ml-2 font-mono text-[10px] uppercase tracking-widest text-neutral-500">
                        {q.role}
                      </span>
                    ) : null}
                  </li>
                ))}
              </ul>
            </Panel>
          ) : null}

          <Panel title="Provenance">
            <dl>
              <Field label="Owner app">
                {/* 'neither' on all 1,479 rows — the column exists and has never been populated. */}
                {o.owner_app && o.owner_app !== 'neither' ? (
                  o.owner_app
                ) : (
                  <span className="text-neutral-500">
                    <strong className="text-bauhaus-red">UNMEASURED</strong> — owner_app is
                    &lsquo;neither&rsquo; on all 1,479 objects
                  </span>
                )}
              </Field>
              <Field label="ACT business">
                {o.act_business ? 'yes' : 'no'}
                {o.act_business_source ? (
                  <span className="text-neutral-500"> · via {o.act_business_source}</span>
                ) : null}
              </Field>
              <Field label="Verdict">
                {o.verdict ? (
                  <>
                    {o.verdict}
                    {o.verdict_by ? (
                      <span className="text-neutral-500">
                        {' '}
                        · {o.verdict_by} {o.verdict_at?.slice(0, 10)}
                      </span>
                    ) : null}
                    {o.verdict_reason ? (
                      <p className="mt-1 font-sans text-[12px] text-neutral-600">
                        {o.verdict_reason}
                      </p>
                    ) : null}
                  </>
                ) : (
                  <span className="text-neutral-500">never adjudicated</span>
                )}
              </Field>
              <Field label="State">{o.state ?? '—'}</Field>
              <Field label="Catalogue refreshed">{o.refreshed_at?.slice(0, 10) ?? '—'}</Field>
            </dl>
          </Panel>
        </div>
      </div>
    </main>
  );
}
