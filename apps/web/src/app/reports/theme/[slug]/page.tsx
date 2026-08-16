import type { Metadata } from 'next';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import { getDirectServiceSupabase } from '@/lib/supabase';
import { canRender, withheldNote, type Surface } from '@/lib/visibility';
import {
  STATUS_BADGE,
  allThemes,
  reportsForTheme,
  themeBySlug,
  type Theme,
  type ThemeReport,
} from '../themes';

export const dynamic = 'force-dynamic';

/**
 * A theme page — findings first, plumbing last.
 *
 * This is a PUBLIC surface. Everything it renders is governed by that: see the three refusals
 * below, each of which is a rule from the plan rather than a styling choice.
 *
 *  1. Key numbers come ONLY from registered questions. Never lifted from report prose — 20 reports
 *     are flagged as needing figure review and theirs are precisely the ones that must not be
 *     quoted. A theme with no registered question shows NO number, which is an honest
 *     advertisement for which question to register next.
 *  2. Accountability & Power's review-status reports are counted, not linked. Ten of the twenty
 *     live there and their subjects are named individuals and their board seats.
 *  3. `operator`-tier material — the HOUSE questions, the what's-missing work list — is visibly
 *     withheld rather than silently absent.
 */

const SURFACE: Surface = 'public';

export async function generateStaticParams() {
  return allThemes().map((t) => ({ slug: t.slug }));
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{ slug: string }>;
}): Promise<Metadata> {
  const { slug } = await params;
  const theme = themeBySlug(slug);
  if (!theme) return { title: 'Not found — CivicGraph' };
  return {
    title: `${theme.title} — CivicGraph`,
    description: theme.description ?? `Reports and evidence on ${theme.title}.`,
  };
}

interface QuestionCard {
  slug: string;
  question: string;
  subject: string;
  state: string;
  headline: string | null;
  headline_sub: string | null;
}

/** States a question may hold on a public page. The rest are work-in-progress, not findings. */
const PUBLIC_STATES = new Set(['answered', 'contested', 'refused']);

async function loadQuestions(theme: Theme): Promise<{ shown: QuestionCard[]; inProgress: number }> {
  if (theme.questionSubjects.length === 0) return { shown: [], inProgress: 0 };
  try {
    const supabase = getDirectServiceSupabase();
    const { data } = await supabase
      .from('v_clarity_board_cards')
      .select('slug,question,subject,state,headline,headline_sub')
      .in('subject', [...theme.questionSubjects]);
    const all = (data ?? []) as unknown as QuestionCard[];
    return {
      shown: all.filter((q) => PUBLIC_STATES.has(q.state)),
      inProgress: all.filter((q) => !PUBLIC_STATES.has(q.state)).length,
    };
  } catch {
    return { shown: [], inProgress: 0 };
  }
}

function Panel({ title, note, children }: { title: string; note?: string; children: React.ReactNode }) {
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

function StatusChip({ status }: { status: ThemeReport['status'] }) {
  const badge = STATUS_BADGE[status];
  const tone =
    badge.tone === 'warn'
      ? 'border-bauhaus-red text-bauhaus-red'
      : badge.tone === 'ok'
        ? 'border-bauhaus-black text-bauhaus-black'
        : 'border-neutral-300 text-neutral-500';
  return (
    <span
      className={`shrink-0 border px-1 font-mono text-[9px] font-black uppercase tracking-wider ${tone}`}
    >
      {badge.label}
    </span>
  );
}

export default async function ThemePage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const theme = themeBySlug(slug);
  if (!theme) notFound();

  const reports = reportsForTheme(slug);
  const { shown: questions, inProgress } = await loadQuestions(theme);

  // Rule 2. Accountability & Power names people; a framing-unreviewed claim about a named person
  // is a different kind of risk from a framing-unreviewed claim about a budget line.
  const countOnly = theme.reviewPolicy === 'count-only';
  const withheldReviews = countOnly ? reports.filter((r) => r.status === 'review') : [];
  const listedReports = countOnly ? reports.filter((r) => r.status !== 'review') : reports;

  // Rule 3. HOUSE questions describe our estate, not the world.
  const questionsAreOperator = theme.questionSubjects.includes('HOUSE');
  const questionsVisible = canRender(questionsAreOperator ? 'operator' : 'public', SURFACE);
  const questionsWithheld = withheldNote(
    questionsAreOperator ? 'operator' : 'public',
    SURFACE,
    'These questions',
  );

  const answered = questions.filter((q) => q.state === 'answered' && q.headline);

  return (
    <main className="mx-auto max-w-[1100px]">
      <Link
        href="/reports"
        className="font-mono text-[11px] font-black uppercase tracking-widest text-bauhaus-blue"
      >
        ◂ All reports
      </Link>

      <header className="mt-3 border-4 border-bauhaus-black bg-bauhaus-white p-6">
        <h1 className="font-display text-4xl font-black uppercase tracking-tight">{theme.title}</h1>
        {theme.description ? (
          <p className="mt-2 max-w-[65ch] text-[15px] text-neutral-700">{theme.description}</p>
        ) : null}
        <p className="mt-3 font-mono text-[11px] uppercase tracking-widest text-neutral-500">
          {reports.length} report{reports.length === 1 ? '' : 's'}
          {questionsVisible && questions.length > 0
            ? ` · ${questions.length} registered question${questions.length === 1 ? '' : 's'}`
            : ''}
        </p>
      </header>

      <div className="mt-4 grid gap-4">
        {/* 1. FINDINGS FIRST. The key numbers, and only from registered questions. */}
        {questionsVisible && answered.length > 0 ? (
          <Panel title="What we can say" note="from registered questions only">
            <ul className="grid gap-4 sm:grid-cols-2">
              {answered.map((q) => (
                <li key={q.slug} className="border-l-4 border-bauhaus-blue pl-3">
                  <Link href={`/clarity/q/${q.slug}`} className="block">
                    <div className="font-display text-3xl font-black">{q.headline}</div>
                    {q.headline_sub ? (
                      <div className="mt-0.5 font-mono text-[11px] text-neutral-500">
                        {q.headline_sub}
                      </div>
                    ) : null}
                    <div className="mt-1 text-[13px] text-neutral-700 underline decoration-neutral-300">
                      {q.question}
                    </div>
                  </Link>
                </li>
              ))}
            </ul>
          </Panel>
        ) : questionsVisible ? (
          <Panel title="What we can say">
            {/* An empty slot is a work queue, not a gap to paper over with a borrowed figure. */}
            <p className="text-[14px] text-neutral-700">
              <strong>No registered question answers anything on this theme yet.</strong> Figures in
              the reports below have not been through the question registry, so none is quoted here
              — a number on this page would carry a sentinel, a coverage figure and an exclusions
              note, or it does not appear.
            </p>
          </Panel>
        ) : (
          <Panel title="What we can say">
            <p className="text-[14px] text-neutral-700">{questionsWithheld}</p>
          </Panel>
        )}

        {/* Contested and refused questions are findings too — often the most important ones. */}
        {questionsVisible && questions.some((q) => q.state !== 'answered') ? (
          <Panel title="Contested and refused">
            <ul className="grid gap-2">
              {questions
                .filter((q) => q.state !== 'answered')
                .map((q) => (
                  <li key={q.slug} className="flex flex-wrap items-baseline gap-2">
                    <span
                      className={`shrink-0 border px-1 font-mono text-[9px] font-black uppercase tracking-wider ${
                        q.state === 'refused'
                          ? 'border-bauhaus-red bg-bauhaus-red text-white'
                          : 'border-bauhaus-black'
                      }`}
                    >
                      {q.state}
                    </span>
                    <Link
                      href={`/clarity/q/${q.slug}`}
                      className="text-[14px] underline decoration-neutral-300"
                    >
                      {q.question}
                    </Link>
                  </li>
                ))}
            </ul>
          </Panel>
        ) : null}

        <Panel title="Reports" note={`${listedReports.length} shown`}>
          <ul className="grid gap-1.5">
            {listedReports.map((r) => (
              <li
                key={r.href}
                className="flex flex-wrap items-baseline gap-2"
                style={{ paddingLeft: `${r.depth * 16}px` }}
              >
                <Link href={r.href} className="text-[14px] underline decoration-neutral-300">
                  {r.label}
                </Link>
                <StatusChip status={r.status} />
              </li>
            ))}
          </ul>

          {/* Absence is stated, never silent — including when the absence is our own caution. */}
          {withheldReviews.length > 0 ? (
            <p className="mt-4 border-l-4 border-bauhaus-red pl-3 text-[13px] text-neutral-700">
              <strong>
                {withheldReviews.length} further report
                {withheldReviews.length === 1 ? '' : 's'} on this theme {withheldReviews.length === 1 ? 'is' : 'are'} not
                listed.
              </strong>{' '}
              They are marked as needing source-date, figure and framing review before being quoted
              externally, and this theme names individuals and the boards they sit on. They stay
              unpublished until reviewed rather than published with a warning.
            </p>
          ) : null}
        </Panel>

        {/* The ACT line. One sentence — the substance lives behind the workspace login. */}
        {theme.actProjectCodes.length > 0 ? (
          <Panel title="Who runs this atlas">
            <p className="text-[14px] text-neutral-700">
              A Curious Tractor works in this area, through{' '}
              <span className="font-mono">{theme.actProjectCodes.join(', ')}</span>. We publish this
              atlas and we also operate in the field, which you are entitled to know when reading
              it.
            </p>
          </Panel>
        ) : null}

        {/* 4. PLUMBING LAST — and the work list is operator-tier, so it is named and withheld. */}
        <Panel title="What is missing">
          <p className="text-[14px] text-neutral-700">
            {inProgress > 0 ? (
              <>
                <strong>
                  {inProgress} question{inProgress === 1 ? '' : 's'} on this theme{' '}
                  {inProgress === 1 ? 'is' : 'are'} registered but unanswerable or in draft.
                </strong>{' '}
              </>
            ) : null}
            {withheldNote('operator', SURFACE, 'The full work list')} It records which reports need
            review, which questions the data cannot yet answer, and where our own projects have no
            evidence behind them. It is our to-do list rather than a finding, so it is not published
            — but it exists, and this says so.
          </p>
        </Panel>
      </div>
    </main>
  );
}
