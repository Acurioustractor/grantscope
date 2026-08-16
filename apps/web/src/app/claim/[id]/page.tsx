import type { Metadata } from 'next';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import { getDirectServiceSupabase } from '@/lib/supabase';
import {
  blockingSentinels,
  coverageText,
  stampLabel,
  type BoardCard,
} from '../../clarity/board-types';
import CopyClaim from '../../clarity/q/[slug]/CopyClaim';

export const dynamic = 'force-dynamic';

/**
 * A citable claim URL — slice J, the research unlock.
 *
 * "This claim, as at 2026-08-15." Every registered question carries its SQL, sentinels, coverage
 * and exclusions, but none of it was addressable: the live pages re-run and the matviews refresh
 * nightly, so a number cited in a paper would not reproduce a year later. `clarity_answer` pins
 * runs; this page gives each pinned run a stable URL.
 *
 * PUBLIC, and therefore stricter than the admin console behind it:
 *  - Only questions marked public/shareable render. Internal or defamation-sensitive questions
 *    show a withheld notice — withheld beats promoted, and stating that a claim exists but is not
 *    published is honest where a 404 would be a lie about the ID space.
 *  - Only the claim layer renders: phrasing, headline, coverage, caveat, exclusions, flags.
 *    Never the payload rows. A screen may be stricter than its data, never looser.
 */

interface AnswerRow {
  id: number;
  question_slug: string;
  computed_at: string;
  ok: boolean;
  error_text: string | null;
  headline: string | null;
  headline_sub: string | null;
  coverage_num: number | null;
  coverage_den: number | null;
  coverage_label: string | null;
  sentinel_flags: BoardCard['sentinel_flags'];
  row_count: number | null;
}

export async function generateMetadata({ params }: { params: Promise<{ id: string }> }): Promise<Metadata> {
  const { id } = await params;
  return { title: `Claim ${id} — CivicGraph` };
}

async function load(id: number): Promise<{ answer: AnswerRow; card: BoardCard | null } | null> {
  const supabase = getDirectServiceSupabase();
  const { data: answers, error } = await supabase.from('clarity_answer').select('*').eq('id', id).limit(1);
  if (error) throw new Error(`claim query failed: ${error.message}`);
  if (!answers?.length) return null;
  const answer = answers[0] as unknown as AnswerRow;

  const { data: cards } = await supabase
    .from('v_clarity_board_cards')
    .select('*')
    .eq('slug', answer.question_slug)
    .limit(1);
  return { answer, card: (cards?.[0] as unknown as BoardCard) ?? null };
}

function Withheld({ id }: { id: number }) {
  return (
    <main className="min-h-screen bg-bauhaus-canvas px-5 py-16">
      <div className="mx-auto max-w-2xl border-4 border-bauhaus-black bg-white p-8">
        <p className="font-mono text-[11px] font-black uppercase tracking-widest text-bauhaus-muted">
          Claim {id}
        </p>
        <h1 className="mt-2 text-2xl font-black uppercase tracking-widest text-bauhaus-black">
          Recorded, not published
        </h1>
        <p className="mt-3 text-sm font-medium leading-relaxed text-bauhaus-black/80">
          A pinned answer with this ID exists, but its question is not published for citation —
          either it is internal working material or it concerns named individuals. That is a
          deliberate refusal, not a missing page.
        </p>
      </div>
    </main>
  );
}

export default async function ClaimPage({ params }: { params: Promise<{ id: string }> }) {
  const { id: rawId } = await params;
  const id = Number(rawId);
  if (!Number.isInteger(id) || id <= 0) notFound();

  const loaded = await load(id);
  if (!loaded) notFound();
  const { answer, card } = loaded;

  const citable = card && (card.publishable === 'public' || card.publishable === 'shareable') && !card.defamation_sensitive;
  if (!citable) return <Withheld id={id} />;

  const asAt = answer.computed_at.slice(0, 10);
  const stamp = stampLabel(card);
  const blocked = blockingSentinels(answer);
  const coverage = coverageText(answer);
  const url = `https://civicgraph.au/claim/${id}`;

  return (
    <main className="min-h-screen bg-bauhaus-canvas px-5 py-10">
      <div className="mx-auto max-w-3xl">
        <article className="border-4 border-bauhaus-black bg-white">
          <header className="border-b-2 border-bauhaus-black bg-bauhaus-black p-6 text-bauhaus-canvas">
            <div className="flex flex-wrap items-center gap-2 font-mono text-[10px] font-black uppercase tracking-widest">
              <span className="border-2 border-bauhaus-canvas/40 px-2 py-0.5">Claim {id}</span>
              <span className="border-2 border-bauhaus-canvas/40 px-2 py-0.5">As at {asAt}</span>
              {stamp ? (
                <span className="border-2 border-bauhaus-red bg-bauhaus-red px-2 py-0.5 text-white">{stamp}</span>
              ) : null}
            </div>
            <h1 className="mt-4 text-2xl font-black leading-snug">
              {answer.headline ?? card.claim_phrasing}
            </h1>
            {answer.headline_sub ? <p className="mt-1 text-sm text-bauhaus-canvas/70">{answer.headline_sub}</p> : null}
          </header>

          <div className="grid gap-5 p-6">
            {!answer.ok ? (
              <p className="border-4 border-bauhaus-red bg-bauhaus-red/5 p-4 text-sm font-bold text-bauhaus-red">
                This pinned run FAILED and produced no number. It is preserved because deleting
                failed runs is how a system flatters itself.
                {answer.error_text ? ` Error: ${answer.error_text}` : ''}
              </p>
            ) : null}

            {blocked.length > 0 ? (
              <p className="border-4 border-bauhaus-red bg-bauhaus-red/5 p-4 text-sm font-bold text-bauhaus-red">
                Blocking sentinel tripped at compute time: {blocked.join(', ')}. Quote this number
                only with that named.
              </p>
            ) : null}

            {card.claim_phrasing?.trim() ? (
              <p className="text-base font-medium leading-relaxed text-bauhaus-black">{card.claim_phrasing}</p>
            ) : null}

            <dl className="grid gap-3 border-t-2 border-bauhaus-black/10 pt-4 text-sm sm:grid-cols-2">
              {coverage ? (
                <div>
                  <dt className="font-mono text-[10px] font-black uppercase tracking-widest text-bauhaus-muted">
                    Coverage
                  </dt>
                  <dd className="mt-1 font-medium">
                    {coverage}
                    {answer.coverage_label ? ` — ${answer.coverage_label}` : ''}
                  </dd>
                </div>
              ) : null}
              <div>
                <dt className="font-mono text-[10px] font-black uppercase tracking-widest text-bauhaus-muted">
                  Exclusions
                </dt>
                <dd className="mt-1 font-medium">{card.exclusions || 'None recorded.'}</dd>
              </div>
              <div className="sm:col-span-2">
                <dt className="font-mono text-[10px] font-black uppercase tracking-widest text-bauhaus-muted">
                  Caveat
                </dt>
                <dd className="mt-1 font-medium">{card.caveat || 'None recorded.'}</dd>
              </div>
            </dl>

            {answer.ok ? (
              <CopyClaim
                claim={card.claim_phrasing}
                headline={answer.headline}
                headlineSub={answer.headline_sub}
                caveat={card.caveat}
                exclusions={card.exclusions}
                coverage={coverage}
                computedAt={answer.computed_at}
                url={url}
              />
            ) : null}

            <p className="border-t-2 border-bauhaus-black/10 pt-4 text-xs leading-5 text-bauhaus-black/60">
              This is a pinned answer: it states what the database said on {asAt} and will not
              change. The live question re-runs against a moving snapshot and may now differ — a
              difference between this page and the live number is data moving, not an error.
            </p>
          </div>
        </article>

        <p className="mt-4 text-center font-mono text-[10px] font-black uppercase tracking-widest text-bauhaus-black/40">
          <Link href="/" className="hover:text-bauhaus-black">
            CivicGraph
          </Link>{' '}
          · registered question &ldquo;{answer.question_slug}&rdquo;
        </p>
      </div>
    </main>
  );
}
