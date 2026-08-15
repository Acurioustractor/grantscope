import type { Metadata } from 'next';
import Link from 'next/link';
import { getDirectServiceSupabase } from '@/lib/supabase';
import { blockingSentinels, coverageText, type BoardCard } from './board-types';

export const dynamic = 'force-dynamic';

export const metadata: Metadata = {
  title: 'Clarity Board',
  description: 'Questions this database can answer that no public Australian source can.',
};

async function loadBoard(): Promise<BoardCard[]> {
  // getDirectServiceSupabase, NOT getServiceSupabase — the latter sniffs the call stack for
  // '/app/reports/' and returns a stub resolving every query to { data: null }, i.e. a silent [].
  const supabase = getDirectServiceSupabase();
  const { data, error } = await supabase
    .from('v_clarity_board_cards')
    .select('*')
    .order('state', { ascending: true })
    .order('uniqueness', { ascending: false });

  if (error) throw new Error(`v_clarity_board_cards query failed: ${error.message}`);
  return (data ?? []) as unknown as BoardCard[];
}

function Chip({ children, tone = 'plain' }: { children: React.ReactNode; tone?: 'plain' | 'red' | 'blue' | 'yellow' }) {
  const tones = {
    plain: 'border-bauhaus-black text-bauhaus-black',
    red: 'border-bauhaus-red text-bauhaus-red',
    blue: 'border-bauhaus-blue text-bauhaus-blue',
    yellow: 'border-bauhaus-black bg-bauhaus-yellow text-bauhaus-black',
  } as const;
  return (
    <span className={`border-2 px-2 py-0.5 font-mono text-[10px] font-black uppercase tracking-widest ${tones[tone]}`}>
      {children}
    </span>
  );
}

function Card({ card }: { card: BoardCard }) {
  const blocked = blockingSentinels(card);
  const coverage = coverageText(card);
  const neverRun = card.run_count === 0 || card.computed_at === null;
  const errored = card.ok === false;

  return (
    <article className="border-4 border-bauhaus-black bg-bauhaus-white">
      {errored && (
        <div className="border-b-4 border-bauhaus-black bg-bauhaus-red px-4 py-2">
          <p className="font-mono text-[11px] font-black uppercase tracking-widest text-bauhaus-white">
            Last run failed
          </p>
          <p className="mt-1 font-mono text-[11px] text-bauhaus-white">{card.error_text}</p>
        </div>
      )}

      <div className="flex flex-wrap items-center gap-2 border-b-2 border-bauhaus-black px-4 py-2">
        <Chip>{card.subject}</Chip>
        <Chip tone={card.state === 'answered' ? 'plain' : 'yellow'}>{card.state}</Chip>
        <Chip>honest at {card.honest_at}</Chip>
        <Chip tone={card.publishable === 'internal' ? 'yellow' : 'plain'}>{card.publishable}</Chip>
        {card.verification_stamp && <Chip tone="blue">{card.verification_stamp}</Chip>}
      </div>

      <div className="px-4 pb-4 pt-3">
        <Link href={`/clarity/q/${card.slug}`} className="group block">
          <h2 className="font-black uppercase tracking-widest text-bauhaus-black group-hover:text-bauhaus-red">
            {card.stub}
          </h2>
          <p className="mt-1 text-sm text-bauhaus-black">{card.question}</p>
        </Link>

        <div className="mt-4">
          {neverRun ? (
            // Never a zero. A question that has not run says so.
            <p className="font-mono text-2xl font-black uppercase tracking-widest text-bauhaus-blue">
              Never run
            </p>
          ) : blocked.length ? (
            <div>
              <p className="font-mono text-4xl font-black text-bauhaus-black line-through">
                {card.headline}
              </p>
              <p className="mt-1 font-mono text-[11px] font-black uppercase tracking-widest text-bauhaus-red">
                Not shown · {blocked.join(', ')}
              </p>
            </div>
          ) : (
            <div>
              <p className="font-mono text-4xl font-black text-bauhaus-black">{card.headline}</p>
              <p className="mt-1 text-sm text-bauhaus-black">{card.headline_sub}</p>
            </div>
          )}
        </div>

        {coverage && (
          <p className="mt-3 border-t-2 border-bauhaus-muted pt-2 font-mono text-[11px] text-bauhaus-black">
            {coverage}
            <span className="text-bauhaus-muted"> · {card.coverage_label}</span>
          </p>
        )}

        {card.binding_object && (
          // The binding join caps the claim, so it is named rather than left as an unexplained bar.
          <p className="mt-1 font-mono text-[11px] text-bauhaus-muted">
            capped by {card.binding_object.replace(/^public\./, '')}
            {card.binding_pct != null && ` at ${Number(card.binding_pct).toFixed(2)}%`}
          </p>
        )}

        <p className="mt-3 border-t-2 border-bauhaus-muted pt-2 text-xs leading-relaxed text-bauhaus-muted">
          {card.caveat}
        </p>

        <div className="mt-3 flex flex-wrap items-center gap-3 font-mono text-[10px] uppercase tracking-widest text-bauhaus-muted">
          {card.computed_at && <span>computed {card.computed_at.slice(0, 16).replace('T', ' ')}</span>}
          {card.duration_ms != null && <span>{card.duration_ms} ms</span>}
          <span>{card.ingredient_count} ingredients</span>
          {card.row_count != null && (
            <Link href={`/clarity/q/${card.slug}/rows`} className="text-bauhaus-blue hover:underline">
              see the {card.row_count.toLocaleString()} rows →
            </Link>
          )}
        </div>
      </div>
    </article>
  );
}

export default async function ClarityBoardPage() {
  let cards: BoardCard[] = [];
  let error: string | null = null;

  try {
    cards = await loadBoard();
  } catch (e) {
    error = e instanceof Error ? e.message : String(e);
  }

  // Never a partial board. One red panel beats numbers that might be half-loaded.
  if (error) {
    return (
      <main className="min-h-screen bg-bauhaus-canvas px-5 py-16">
        <div className="mx-auto max-w-3xl border-4 border-bauhaus-red bg-bauhaus-white p-8">
          <h1 className="text-2xl font-black uppercase tracking-widest text-bauhaus-red">
            Board unavailable
          </h1>
          <p className="mt-4 text-sm text-bauhaus-black">
            The question registry could not be read. If the migrations have not been applied,
            there is nothing to show yet.
          </p>
          <pre className="mt-4 overflow-x-auto border-2 border-bauhaus-muted bg-bauhaus-canvas p-3 font-mono text-xs">
            {error}
          </pre>
        </div>
      </main>
    );
  }

  return (
    <main className="min-h-screen bg-bauhaus-canvas px-5 py-10">
      <div className="mx-auto max-w-6xl">
        <header className="border-4 border-bauhaus-black bg-bauhaus-white p-6">
          <p className="font-mono text-[11px] font-black uppercase tracking-widest text-bauhaus-muted">
            Clarity
          </p>
          <h1 className="mt-1 text-3xl font-black uppercase tracking-widest text-bauhaus-black">
            The question board
          </h1>
          <p className="mt-3 max-w-3xl text-sm text-bauhaus-black">
            Questions this database can answer that no public Australian source can. Every number
            carries the filter that produced it, the join that caps it, and the sentence we are
            allowed to say about it.
          </p>
          <p className="mt-4 font-mono text-[11px] uppercase tracking-widest text-bauhaus-muted">
            {cards.length} registered ·{' '}
            <Link href="/clarity/data" className="text-bauhaus-blue hover:underline">
              the ledger →
            </Link>
          </p>
        </header>

        {cards.length === 0 ? (
          <div className="mt-6 border-4 border-bauhaus-black bg-bauhaus-white p-8">
            <h2 className="font-black uppercase tracking-widest">No questions registered</h2>
            <p className="mt-3 text-sm text-bauhaus-black">
              The registry is empty. Apply{' '}
              <code className="font-mono">20260815000400_clarity_question_seed.sql</code>, then run{' '}
              <code className="font-mono">node --env-file=.env scripts/run-clarity-answers.mjs</code>.
            </p>
          </div>
        ) : (
          <div className="mt-6 grid gap-6 md:grid-cols-2 xl:grid-cols-3">
            {cards.map((c) => (
              <Card key={c.slug} card={c} />
            ))}
          </div>
        )}
      </div>
    </main>
  );
}
