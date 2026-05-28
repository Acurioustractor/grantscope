'use client';

import { useState, useTransition } from 'react';

interface TriageCard {
  project_code: string;
  project_label: string;
  project_readiness: string | null;
  opportunity_id: string;
  opportunity_name: string;
  funder_name: string | null;
  deadline: string | null;
  min_grant_amount: number | null;
  max_grant_amount: number | null;
  fit_score: number;
  flags: string[] | null;
  theme_score: number;
  geography_score: number;
  eligibility_score: number;
  timing_score: number;
  source_url: string | null;
  application_url: string | null;
}

type Decision = 'pursuing' | 'watching' | 'passed';

interface Props {
  initialQueue: TriageCard[];
  slug: string;
}

function formatAmount(min: number | null, max: number | null): string {
  if (min != null && max != null) return `$${min.toLocaleString()}–$${max.toLocaleString()}`;
  if (max != null) return `≤ $${max.toLocaleString()}`;
  if (min != null) return `≥ $${min.toLocaleString()}`;
  return 'Amount unknown';
}

function deadlineLabel(deadline: string | null): { text: string; classes: string } {
  if (!deadline) return { text: 'Rolling deadline', classes: 'bg-gray-200 text-bauhaus-black' };
  const d = new Date(deadline);
  const days = Math.ceil((d.getTime() - Date.now()) / 86_400_000);
  const dateStr = d.toLocaleDateString('en-AU', { day: 'numeric', month: 'short', year: 'numeric' });
  if (days < 0) return { text: `${dateStr} (past)`, classes: 'bg-gray-400 text-white' };
  if (days <= 14) return { text: `${dateStr} (${days}d)`, classes: 'bg-bauhaus-red text-white' };
  if (days <= 45) return { text: `${dateStr} (${days}d)`, classes: 'bg-bauhaus-yellow text-bauhaus-black' };
  return { text: dateStr, classes: 'bg-bauhaus-canvas text-bauhaus-black border-2 border-bauhaus-black' };
}

export function TriageDeck({ initialQueue, slug }: Props) {
  const [queue, setQueue] = useState<TriageCard[]>(initialQueue);
  const [idx, setIdx] = useState(0);
  const [isPending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [history, setHistory] = useState<Array<{ card: TriageCard; decision: Decision }>>([]);

  const card = queue[idx];
  const remaining = queue.length - idx;

  async function decide(decision: Decision) {
    if (!card) return;
    setError(null);

    const optimisticHistory = [...history, { card, decision }];
    setHistory(optimisticHistory);

    startTransition(async () => {
      try {
        const res = await fetch('/api/ops/grant-recommendations/decide', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            project_code: card.project_code,
            opportunity_id: card.opportunity_id,
            decision,
            notes: `[via triage deck · ${new Date().toISOString().slice(0, 10)}]`,
          }),
        });
        if (!res.ok) {
          const text = await res.text();
          throw new Error(`Decision failed: ${text.slice(0, 200)}`);
        }
        setIdx((i) => i + 1);
      } catch (e) {
        setError(e instanceof Error ? e.message : 'Decision failed');
        // Roll back optimistic history
        setHistory(history);
      }
    });
  }

  function undo() {
    if (history.length === 0 || idx === 0) return;
    setIdx((i) => i - 1);
    setHistory((h) => h.slice(0, -1));
    setError('Undo only reverses the local deck; the decision remains in DB. Use kanban to re-decide.');
  }

  if (!card) {
    return (
      <div className="border-4 border-bauhaus-black bg-white p-12 text-center">
        <p className="text-[10px] font-black uppercase tracking-widest text-bauhaus-red">
          Deck complete
        </p>
        <p className="mt-3 font-mono text-2xl font-black">{history.length} decisions made</p>
        <p className="mt-1 text-sm text-bauhaus-muted">
          {history.filter((h) => h.decision === 'pursuing').length} pursuing ·{' '}
          {history.filter((h) => h.decision === 'watching').length} watching ·{' '}
          {history.filter((h) => h.decision === 'passed').length} passed
        </p>
        <a
          href={`/org/${slug}/pipeline`}
          className="inline-block mt-6 text-[10px] font-black uppercase tracking-widest bg-bauhaus-black text-white px-4 py-3 hover:bg-bauhaus-red transition-colors"
        >
          → Back to kanban
        </a>
      </div>
    );
  }

  const ddl = deadlineLabel(card.deadline);

  return (
    <div>
      <div className="mb-4 flex items-baseline justify-between font-mono text-[11px] text-bauhaus-muted">
        <span>
          <span className="font-black text-bauhaus-black">{idx + 1}</span> / {queue.length}
        </span>
        <span>{remaining} remaining</span>
      </div>

      <div className="border-4 border-bauhaus-black bg-white">
        <div className="border-b-4 border-bauhaus-black p-5">
          <div className="flex gap-2 flex-wrap mb-3">
            <span className="px-2 py-1 text-[10px] font-black uppercase tracking-widest bg-bauhaus-black text-white">
              {card.project_code}
            </span>
            {card.project_readiness && (
              <span className="px-2 py-1 text-[10px] font-black uppercase tracking-widest border-2 border-bauhaus-black">
                {card.project_readiness}
              </span>
            )}
            <span className={`px-2 py-1 text-[10px] font-black uppercase tracking-widest ${ddl.classes}`}>
              {ddl.text}
            </span>
            <span className="px-2 py-1 text-[10px] font-black uppercase tracking-widest tabular-nums bg-bauhaus-blue text-white">
              Fit {card.fit_score}
            </span>
            {(card.flags ?? []).map((f) => (
              <span
                key={f}
                className="px-2 py-1 text-[10px] font-black uppercase tracking-widest bg-bauhaus-yellow text-bauhaus-black"
              >
                {f.replace(/_/g, ' ')}
              </span>
            ))}
          </div>

          <h2 className="text-xl font-black leading-tight text-bauhaus-black">
            {card.opportunity_name}
          </h2>
          <p className="mt-1 text-sm font-mono text-bauhaus-muted">
            {card.funder_name ?? 'Unknown funder'}
          </p>
          <p className="mt-2 text-base font-mono text-bauhaus-black">
            {formatAmount(card.min_grant_amount, card.max_grant_amount)}
          </p>
        </div>

        <div className="border-b-4 border-bauhaus-black p-5 grid grid-cols-4 gap-3 text-center">
          {(['theme', 'geography', 'eligibility', 'timing'] as const).map((k) => {
            const v = card[`${k}_score` as 'theme_score' | 'geography_score' | 'eligibility_score' | 'timing_score'];
            return (
              <div key={k} className="border-2 border-bauhaus-black p-2">
                <div className="text-[9px] font-black uppercase tracking-widest text-bauhaus-muted">
                  {k}
                </div>
                <div className="text-xl font-black tabular-nums mt-1">{v}</div>
              </div>
            );
          })}
        </div>

        {(card.source_url || card.application_url) && (
          <div className="border-b-4 border-bauhaus-black p-5 flex gap-3 text-[11px] font-mono">
            {card.source_url && (
              <a
                href={card.source_url}
                target="_blank"
                rel="noopener noreferrer"
                className="underline decoration-2 underline-offset-4 hover:text-bauhaus-red"
              >
                Source ↗
              </a>
            )}
            {card.application_url && (
              <a
                href={card.application_url}
                target="_blank"
                rel="noopener noreferrer"
                className="underline decoration-2 underline-offset-4 hover:text-bauhaus-red"
              >
                Apply ↗
              </a>
            )}
          </div>
        )}

        {error && (
          <div className="border-b-4 border-bauhaus-black p-3 bg-bauhaus-red text-white text-[11px] font-mono">
            {error}
          </div>
        )}

        <div className="p-5 grid grid-cols-3 gap-3">
          <button
            type="button"
            disabled={isPending}
            onClick={() => decide('passed')}
            className="border-4 border-bauhaus-black bg-white text-bauhaus-black font-black uppercase tracking-widest py-4 hover:bg-bauhaus-black hover:text-white disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
            title="Skip — not pursuing this one"
          >
            Pass
            <span className="block text-[9px] font-mono mt-1 opacity-60">— skip</span>
          </button>
          <button
            type="button"
            disabled={isPending}
            onClick={() => decide('watching')}
            className="border-4 border-bauhaus-black bg-bauhaus-yellow text-bauhaus-black font-black uppercase tracking-widest py-4 hover:bg-bauhaus-black hover:text-bauhaus-yellow disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
            title="Keep an eye on it"
          >
            Watch
            <span className="block text-[9px] font-mono mt-1 opacity-60">— track</span>
          </button>
          <button
            type="button"
            disabled={isPending}
            onClick={() => decide('pursuing')}
            className="border-4 border-bauhaus-black bg-bauhaus-red text-white font-black uppercase tracking-widest py-4 hover:bg-bauhaus-black disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
            title="Commit — move to active kanban"
          >
            Pursue
            <span className="block text-[9px] font-mono mt-1 opacity-60">— commit</span>
          </button>
        </div>

        {idx > 0 && (
          <div className="border-t-4 border-bauhaus-black p-3 text-center">
            <button
              type="button"
              onClick={undo}
              className="text-[10px] font-black uppercase tracking-widest text-bauhaus-muted hover:text-bauhaus-red"
            >
              ← Undo last
            </button>
          </div>
        )}
      </div>

      {history.length > 0 && (
        <div className="mt-4 text-[10px] font-mono text-bauhaus-muted">
          Session: {history.filter((h) => h.decision === 'pursuing').length} pursuing /{' '}
          {history.filter((h) => h.decision === 'watching').length} watching /{' '}
          {history.filter((h) => h.decision === 'passed').length} passed
        </div>
      )}
    </div>
  );
}
