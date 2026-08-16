import type { Metadata } from 'next';
import Link from 'next/link';
import { getDirectServiceSupabase } from '@/lib/supabase';
import { allThemes, reportsForTheme } from '../reports/theme/themes';
import IndexExplorer, { type ExplorerObject } from './IndexExplorer';
import { NOUN_ORDER, unfiledReason, type Noun } from './nouns';

export const dynamic = 'force-dynamic';

export const metadata: Metadata = {
  title: 'Clarity',
  description: 'Everything CivicGraph holds, on one page.',
};

/**
 * The index — the front door.
 *
 * Craigslist's trick is that the whole taxonomy is on one screen and nothing is behind a click.
 * The previous front door was the object catalogue: a 1,222-row table, 70,614px tall, sorted by an
 * `importance` score that is tied at 0.0225 for 424 objects. It showed everything and let you see
 * nothing. That table still exists, demoted to /clarity/catalogue where its filters and its
 * segment tabs are the right tool.
 *
 * Terse links, alphabetical, six nouns and an honest Unfiled group. See ./nouns.ts for why the
 * mapping is a hand-written table, and `thoughts/shared/plans/clarity-console.md` for the rest.
 */

interface IndexObject {
  object_key: string;
  object_name: string;
  object_kind: string;
  domain: string | null;
  noun: Noun | null;
  row_count: number | null;
  row_count_is_estimate: boolean | null;
  degree: number | null;
  purpose: string | null;
  refreshed_at: string | null;
  act_business: boolean | null;
  last_write_at: string | null;
  refs_app: number | null;
  refs_script: number | null;
  refs_migration: number | null;
  refs_db_function: number | null;
}

/** First sentence of the curated purpose, markdown stripped — the human line the index leads
 *  with. The full text lives on the object page. */
function firstSentence(purpose: string | null): string | null {
  if (!purpose) return null;
  const plain = purpose.replace(/\*\*|`/g, '').trim();
  const dot = plain.indexOf('. ');
  const s = dot > 10 ? plain.slice(0, dot + 1) : plain;
  return s.length > 150 ? `${s.slice(0, 150)}…` : s;
}

interface Loaded {
  explorer: ExplorerObject[];
  total: number;
  described: number;
  questionStates: [string, number][];
  questionSubjects: Map<string, number>;
  refreshedAt: string | null;
}

const nf = new Intl.NumberFormat('en-AU');

/** Terse by design: 1,024 of these render at once, so `824K` beats `824,978`. */
function terse(n: number | null, estimate: boolean | null): string {
  if (n === null) return '';
  const s =
    n >= 1_000_000
      ? `${(n / 1_000_000).toFixed(n >= 10_000_000 ? 0 : 1)}M`
      : n >= 1_000
        ? `${Math.round(n / 1000)}K`
        : String(n);
  return estimate ? `~${s}` : s;
}

async function load(): Promise<Loaded> {
  const supabase = getDirectServiceSupabase();

  // PostgREST caps a page at 1,000 and the catalogue is ~1,479. Paginate explicitly rather than
  // silently rendering a truncated index that looks complete — the same trap the ledger documents.
  const PAGE = 1000;
  const all: IndexObject[] = [];
  for (let from = 0; ; from += PAGE) {
    const { data, error } = await supabase
      .from('clarity_object')
      .select(
        'object_key,object_name,object_kind,domain,noun,row_count,row_count_is_estimate,degree,purpose,refreshed_at,act_business,last_write_at,refs_app,refs_script,refs_migration,refs_db_function',
      )
      .order('object_name')
      .range(from, from + PAGE - 1);
    if (error) throw new Error(`index query failed: ${error.message}`);
    const page = (data ?? []) as unknown as IndexObject[];
    all.push(...page);
    if (page.length < PAGE) break;
  }

  // Confirmed findings mark the worklist lenses: 'unused' (orphan) and 'could link' (join gap).
  // Confirmed only — a machine proposal never counts as true on the front door.
  const orphans = new Set<string>();
  const linkGaps = new Set<string>();
  try {
    const { data: findings } = await supabase
      .from('clarity_finding')
      .select('detector,subject_object_key')
      .eq('verdict', 'confirmed');
    for (const f of (findings ?? []) as { detector: string; subject_object_key: string }[]) {
      if (f.detector === 'orphan') orphans.add(f.subject_object_key);
      else if (f.detector === 'undiscovered_join') linkGaps.add(f.subject_object_key);
    }
  } catch {
    // lenses degrade to empty, the index still renders
  }

  const explorer: ExplorerObject[] = all.map((o) => {
    const reason = o.noun ? null : unfiledReason(o.domain);
    return {
      key: o.object_key,
      name: o.object_name,
      kind: o.object_kind,
      noun: o.noun ?? 'unfiled',
      rows: o.row_count,
      rowsEstimate: o.row_count_is_estimate ?? false,
      degree: o.degree ?? 0,
      purpose: firstSentence(o.purpose),
      sector: reason?.startsWith('sector:') ? reason.slice(8) : null,
      act: o.act_business ?? false,
      refs:
        (o.refs_app ?? 0) + (o.refs_script ?? 0) + (o.refs_migration ?? 0) + (o.refs_db_function ?? 0),
      lastWrite: o.last_write_at?.slice(0, 10) ?? null,
      canLink: linkGaps.has(o.object_key),
      orphan: orphans.has(o.object_key),
    };
  });

  // The questions strip degrades to empty rather than taking the front door down with it.
  let questionStates: [string, number][] = [];
  const questionSubjects = new Map<string, number>();
  try {
    const { data } = await supabase.from('v_clarity_board_cards').select('state, subject');
    const counts = new Map<string, number>();
    for (const r of (data ?? []) as { state: string; subject: string | null }[]) {
      counts.set(r.state, (counts.get(r.state) ?? 0) + 1);
      if (r.subject) questionSubjects.set(r.subject, (questionSubjects.get(r.subject) ?? 0) + 1);
    }
    questionStates = [...counts.entries()].sort((a, b) => b[1] - a[1]);
  } catch {
    questionStates = [];
  }

  return {
    explorer,
    total: all.length,
    described: all.filter((o) => o.purpose).length,
    questionStates,
    questionSubjects,
    refreshedAt: all.reduce<string | null>(
      (max, o) => (o.refreshed_at && (!max || o.refreshed_at > max) ? o.refreshed_at : max),
      null,
    ),
  };
}


export default async function ClarityIndexPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  await searchParams; // sort/filter moved client-side into the explorer
  const { explorer, total, described, questionStates, questionSubjects, refreshedAt } =
    await load();

  // Slice G — themes above the noun index. The 13 report sections are the only taxonomy written
  // in the language a human uses about the world; the six nouns are the plumbing. The plumbing
  // stays on the front door (completeness at the index layer) but it no longer leads.
  const themes = allThemes().map((t) => ({
    slug: t.slug,
    title: t.title,
    reportCount: reportsForTheme(t.slug).length,
    questionCount: t.questionSubjects.reduce((n, s) => n + (questionSubjects.get(s) ?? 0), 0),
  }));

  return (
    <main className="mx-auto max-w-[1180px] px-4 py-8">
      <header className="border-4 border-bauhaus-black bg-bauhaus-black p-5 text-bauhaus-canvas">
        <div className="flex flex-wrap items-center gap-2">
          <span className="border-2 border-bauhaus-canvas/40 px-2 py-0.5 font-mono text-[10px] font-black uppercase tracking-widest">
            Admin only
          </span>
          {refreshedAt ? (
            <span className="border-2 border-bauhaus-canvas/40 px-2 py-0.5 font-mono text-[10px] font-black uppercase tracking-widest">
              Refreshed {refreshedAt.slice(0, 10)}
            </span>
          ) : null}
          {(
            [
              ['/clarity/findings', 'Findings'],
              ['/clarity/owners', 'Owners'],
              ['/clarity/projects', 'Projects'],
              ['/clarity/stories', 'Stories'],
              ['/clarity/surfaces', 'Surfaces'],
              ['/clarity/catalogue', 'The catalogue'],
              ['/clarity/seams', 'The seams'],
              ['/clarity/cross', 'Cross-sections'],
              ['/clarity/wants', 'The want list'],
              ['/clarity/changes', 'What changed'],
            ] as const
          ).map(([href, label]) => (
            <Link
              key={href}
              href={href}
              className="border-2 border-bauhaus-canvas/40 px-2 py-0.5 font-mono text-[10px] font-black uppercase tracking-widest hover:border-bauhaus-canvas"
            >
              {label}
            </Link>
          ))}
        </div>

        <h1 className="mt-4 font-display text-5xl font-black uppercase tracking-tight">Clarity</h1>
        <p className="mt-2 max-w-[70ch] text-[14px] text-bauhaus-canvas/70">
          Everything CivicGraph holds, on one page. {nf.format(total)} objects,{' '}
          {nf.format(described)} of them described. The count beside each name is rows, from last
          night&rsquo;s snapshot.
        </p>

        {questionStates.length > 0 ? (
          <div className="mt-4 flex flex-wrap items-center gap-2 border-t-2 border-bauhaus-canvas/25 pt-3">
            <span className="font-mono text-[10px] font-black uppercase tracking-widest text-bauhaus-canvas/60">
              Questions
            </span>
            {questionStates.map(([state, n]) => (
              <span
                key={state}
                className={`border-2 px-2 py-0.5 font-mono text-[10px] font-black uppercase tracking-widest ${
                  state === 'refused'
                    ? 'border-bauhaus-red bg-bauhaus-red text-white'
                    : 'border-bauhaus-canvas/40'
                }`}
              >
                {n} {state}
              </span>
            ))}
          </div>
        ) : null}
      </header>

      <section className="mt-4 border-4 border-bauhaus-black bg-bauhaus-white" id="themes">
        <h2 className="flex flex-wrap items-baseline gap-x-3 border-b-2 border-bauhaus-black px-4 py-2">
          <span className="font-display text-lg font-black uppercase tracking-widest">Themes</span>
          <span className="font-mono text-[12px] font-black">{themes.length}</span>
          <span className="text-[12px] text-bauhaus-black/50">
            the world&rsquo;s language first; the schema below
          </span>
        </h2>
        <ul className="grid gap-x-6 gap-y-0.5 p-4 sm:grid-cols-2 lg:grid-cols-3">
          {themes.map((t) => (
            <li key={t.slug} className="flex items-baseline gap-2 text-[13px] leading-6">
              <Link
                href={`/reports/theme/${t.slug}`}
                className="truncate font-bold underline decoration-bauhaus-black/20 underline-offset-2 hover:decoration-bauhaus-black"
              >
                {t.title}
              </Link>
              <span className="ml-auto shrink-0 font-mono text-[11px] text-bauhaus-black/45">
                {t.reportCount} reports{t.questionCount > 0 ? ` · ${t.questionCount} q` : ''}
              </span>
            </li>
          ))}
        </ul>
      </section>

      <IndexExplorer objects={explorer} />

      <p className="mt-4 text-[12px] text-bauhaus-black/50">
        A name shown raw and grey has no purpose written yet — {nf.format(total - described)} of{' '}
        {nf.format(total)} objects. Nothing here is hidden for being undocumented; the
        &ldquo;Needs words&rdquo; lens is the writing worklist.
      </p>
    </main>
  );
}
