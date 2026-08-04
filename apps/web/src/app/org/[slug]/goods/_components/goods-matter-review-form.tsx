'use client';

import { useState, type FormEvent } from 'react';
import { useRouter } from 'next/navigation';
import type {
  GoodsDecisionMemory,
  GoodsFundingMatter,
  GoodsFundingRoute,
} from '@/lib/services/goods-capital-workspace';
import { recordGoodsMatterReview } from '../matters/actions';

type NextMove = 'act' | 'listen' | 'verify' | 'revisit' | 'close';

const NEXT_MOVES: Array<{ value: NextMove; label: string; detail: string }> = [
  { value: 'act', label: 'Act', detail: 'Make a concrete move now.' },
  { value: 'listen', label: 'Listen', detail: 'Talk with the right people before deciding.' },
  { value: 'verify', label: 'Verify', detail: 'Resolve a named evidence gap.' },
  { value: 'revisit', label: 'Revisit', detail: 'Return on a deliberate date.' },
  { value: 'close', label: 'Close', detail: 'Consciously stop this line of work.' },
];

function isUuid(value: string): boolean {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(value);
}

export function GoodsMatterReviewForm({
  slug,
  matter,
  route,
  orgProfileId,
  latestDecision,
  compact = false,
}: {
  slug: string;
  matter: GoodsFundingMatter;
  route: GoodsFundingRoute | null;
  orgProfileId: string;
  latestDecision: GoodsDecisionMemory | null;
  compact?: boolean;
}) {
  const router = useRouter();
  const [whatChanged, setWhatChanged] = useState('');
  const [nextMove, setNextMove] = useState<NextMove>('verify');
  const [nextQuestion, setNextQuestion] = useState(matter.currentLearningQuestion ?? '');
  const [revisitAt, setRevisitAt] = useState('');
  const [includePromise, setIncludePromise] = useState(false);
  const [promiseKind, setPromiseKind] = useState<'commitment' | 'return'>('commitment');
  const [promiseOwner, setPromiseOwner] = useState('Ben');
  const [promiseBeneficiary, setPromiseBeneficiary] = useState(matter.counterpartyName);
  const [promiseAction, setPromiseAction] = useState('');
  const [promiseDueAt, setPromiseDueAt] = useState('');
  const [status, setStatus] = useState<{ state: 'idle' | 'saving' | 'saved' | 'error'; message: string }>({ state: 'idle', message: '' });
  const canWrite = isUuid(orgProfileId);

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!canWrite) {
      setStatus({ state: 'error', message: 'Open the live organisation workspace to record this review.' });
      return;
    }
    if (!whatChanged.trim()) {
      setStatus({ state: 'error', message: 'Record what changed in your understanding.' });
      return;
    }
    if (nextMove === 'revisit' && !revisitAt) {
      setStatus({ state: 'error', message: 'Choose a revisit date.' });
      return;
    }
    if (includePromise && (!promiseOwner.trim() || !promiseAction.trim())) {
      setStatus({ state: 'error', message: 'A real promise or return needs an owner and a concrete action.' });
      return;
    }

    setStatus({ state: 'saving', message: 'Recording the human read…' });
    const payload = {
      slug,
      orgProfileId,
      matterSlug: matter.slug,
      evidenceGaps: Array.from(new Set([...matter.evidenceGaps, ...(route?.evidenceGaps ?? [])])),
      supersedesId: latestDecision?.id,
      whatChanged: whatChanged.trim(),
      nextMove,
      nextLearningQuestion: nextQuestion.trim() || undefined,
      revisitAt: nextMove === 'revisit' ? revisitAt : undefined,
      commitment: includePromise
        ? {
            kind: promiseKind,
            owner: promiseOwner.trim(),
            beneficiary: promiseBeneficiary.trim() || undefined,
            action: promiseAction.trim(),
            dueAt: promiseDueAt || undefined,
          }
        : undefined,
    };

    try {
      const receipt = await recordGoodsMatterReview(payload);
      if (!receipt.ok) throw new Error(receipt.error || 'Could not record the review.');
      setStatus({
        state: 'saved',
        message: receipt.nextStep || 'Review appended. No relationship stage or external system was changed.',
      });
      setWhatChanged('');
      setIncludePromise(false);
      setPromiseAction('');
      router.refresh();
    } catch (error) {
      setStatus({ state: 'error', message: error instanceof Error ? error.message : 'Could not record the review.' });
    }
  }

  return (
    <form onSubmit={submit} className={`border-4 border-bauhaus-black bg-white ${compact ? 'p-4' : 'p-5'}`}>
      <div className="text-[10px] font-black uppercase tracking-widest text-bauhaus-blue">Human decision</div>
      <h3 className="mt-1 text-lg font-black text-bauhaus-black">Record the material delta</h3>
      <p className="mt-1 text-xs leading-5 text-bauhaus-muted">
        This appends learning. It does not send outreach, change a relationship stage, or create a GHL deal.
      </p>

      <label className="mt-4 block text-[10px] font-black uppercase tracking-widest text-bauhaus-black" htmlFor={`changed-${matter.slug}`}>
        What changed in our understanding?
      </label>
      <textarea
        id={`changed-${matter.slug}`}
        value={whatChanged}
        onChange={(event) => setWhatChanged(event.target.value)}
        rows={compact ? 3 : 4}
        className="mt-2 w-full border-2 border-bauhaus-black bg-white px-3 py-2 text-sm leading-6 text-bauhaus-black"
        placeholder="Name the new fact, corrected assumption, explicit refusal, or remaining uncertainty."
        required
      />

      <fieldset className="mt-4">
        <legend className="text-[10px] font-black uppercase tracking-widest text-bauhaus-black">Next move</legend>
        <div className="mt-2 grid grid-cols-2 gap-2 sm:grid-cols-5">
          {NEXT_MOVES.map((move) => (
            <label
              key={move.value}
              className={`flex min-h-12 cursor-pointer flex-col justify-center border-2 px-3 py-2 ${nextMove === move.value ? 'border-bauhaus-black bg-bauhaus-black text-white' : 'border-bauhaus-black/30 bg-white text-bauhaus-black hover:border-bauhaus-black'}`}
              title={move.detail}
            >
              <input
                type="radio"
                name={`next-move-${matter.slug}`}
                value={move.value}
                checked={nextMove === move.value}
                onChange={() => setNextMove(move.value)}
                className="sr-only"
              />
              <span className="text-[10px] font-black uppercase tracking-wider">{move.label}</span>
            </label>
          ))}
        </div>
      </fieldset>

      {nextMove === 'revisit' ? (
        <label className="mt-4 block text-[10px] font-black uppercase tracking-widest text-bauhaus-black">
          Revisit date
          <input
            type="date"
            value={revisitAt}
            onChange={(event) => setRevisitAt(event.target.value)}
            className="mt-2 block min-h-11 w-full border-2 border-bauhaus-black px-3 text-sm font-bold"
            required
          />
        </label>
      ) : null}

      <label className="mt-4 block text-[10px] font-black uppercase tracking-widest text-bauhaus-black" htmlFor={`question-${matter.slug}`}>
        Next learning question
      </label>
      <textarea
        id={`question-${matter.slug}`}
        value={nextQuestion}
        onChange={(event) => setNextQuestion(event.target.value)}
        rows={2}
        className="mt-2 w-full border-2 border-bauhaus-black px-3 py-2 text-sm leading-5"
      />

      <label className="mt-4 flex min-h-11 cursor-pointer items-center gap-3 border-2 border-bauhaus-black/30 bg-bauhaus-canvas px-3 py-2 text-xs font-bold text-bauhaus-black">
        <input
          type="checkbox"
          checked={includePromise}
          onChange={(event) => setIncludePromise(event.target.checked)}
          className="h-4 w-4"
        />
        A real promise or return was explicitly made
      </label>

      {includePromise ? (
        <div className="mt-2 grid gap-3 border-2 border-bauhaus-black bg-bauhaus-yellow p-3 sm:grid-cols-2">
          <label className="text-[10px] font-black uppercase tracking-widest">
            Kind
            <select value={promiseKind} onChange={(event) => setPromiseKind(event.target.value as 'commitment' | 'return')} className="mt-1 min-h-11 w-full border-2 border-bauhaus-black bg-white px-2 text-sm">
              <option value="commitment">Commitment</option>
              <option value="return">Return owed</option>
            </select>
          </label>
          <label className="text-[10px] font-black uppercase tracking-widest">
            Owner
            <input value={promiseOwner} onChange={(event) => setPromiseOwner(event.target.value)} className="mt-1 min-h-11 w-full border-2 border-bauhaus-black px-2 text-sm" required />
          </label>
          <label className="text-[10px] font-black uppercase tracking-widest">
            Beneficiary
            <input value={promiseBeneficiary} onChange={(event) => setPromiseBeneficiary(event.target.value)} className="mt-1 min-h-11 w-full border-2 border-bauhaus-black px-2 text-sm" />
          </label>
          <label className="text-[10px] font-black uppercase tracking-widest">
            Due date
            <input type="date" value={promiseDueAt} onChange={(event) => setPromiseDueAt(event.target.value)} className="mt-1 min-h-11 w-full border-2 border-bauhaus-black px-2 text-sm" />
          </label>
          <label className="text-[10px] font-black uppercase tracking-widest sm:col-span-2">
            What was promised?
            <textarea value={promiseAction} onChange={(event) => setPromiseAction(event.target.value)} rows={2} className="mt-1 w-full border-2 border-bauhaus-black px-2 py-2 text-sm normal-case tracking-normal" required />
          </label>
        </div>
      ) : null}

      {status.state !== 'idle' ? (
        <div className={`mt-4 border-2 px-3 py-2 text-xs leading-5 ${status.state === 'error' ? 'border-red-300 bg-red-50 text-red-800' : status.state === 'saved' ? 'border-emerald-300 bg-emerald-50 text-emerald-800' : 'border-blue-300 bg-blue-50 text-blue-800'}`} role="status">
          {status.message}
        </div>
      ) : null}

      <button
        type="submit"
        disabled={status.state === 'saving' || !canWrite}
        className="mt-4 inline-flex min-h-11 w-full items-center justify-center border-2 border-bauhaus-black bg-bauhaus-black px-4 text-[10px] font-black uppercase tracking-widest text-white hover:bg-bauhaus-blue disabled:cursor-not-allowed disabled:opacity-50"
      >
        {status.state === 'saving' ? 'Recording…' : 'Append review'}
      </button>
      {!canWrite ? (
        <p className="mt-2 text-[10px] leading-4 text-bauhaus-muted">Review capture is disabled in the fast local profile. Open the live organisation record to write.</p>
      ) : null}
    </form>
  );
}
