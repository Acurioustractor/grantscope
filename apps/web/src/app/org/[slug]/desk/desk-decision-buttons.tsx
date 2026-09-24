'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';

type Verb = 'pursue' | 'pass' | 'later' | 'undo';
type Reason = 'wrong_project' | 'cannot_apply' | 'not_now';

// Pursue / Pass / Save for later on a grant, funder or buyer. Writes one row to opportunity_decisions via
// /api/org/[id]/desk-decisions, then refreshes so the queue moves on.
export function DeskDecisionButtons({ orgProfileId, kind, refId, projectCode, projectLabel, mode, judgment, sendToGhl }: {
  orgProfileId: string;
  kind: 'grant' | 'funder' | 'buyer';
  refId: string;
  projectCode: string | null;
  projectLabel: string;
  /** decide: an undecided row. worked: already being worked (keeps Done/Waiting/Tomorrow beside it).
   *  undo: a saved or passed row. */
  mode: 'decide' | 'worked' | 'undo';
  judgment?: Record<string, string | number | boolean | null>;
  /** A pursued grant that no live GHL opportunity holds yet: offer the push again. */
  sendToGhl?: boolean;
}) {
  const router = useRouter();
  const [busy, setBusy] = useState<Verb | null>(null);
  const [choosing, setChoosing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function decide(verb: Verb, reason?: Reason) {
    setBusy(verb);
    setError(null);
    try {
      const res = await fetch(`/api/org/${orgProfileId}/desk-decisions`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ kind, ref: refId, project_code: projectCode, verb, reason, judgment }),
      });
      const out = (await res.json().catch(() => ({}))) as { error?: string; ghl?: { status: string; detail?: string } };
      if (!res.ok) throw new Error(out.error || 'Could not save that');
      setChoosing(false);
      // The pursue is saved either way; say so plainly when GHL did not take it, and leave the row up.
      if (out.ghl?.status === 'failed') {
        setError(`Saved as pursuing, but GHL did not take it (${out.ghl.detail ?? 'no reason given'}). Send to GHL retries.`);
        return;
      }
      router.refresh();
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Could not save that');
    } finally {
      setBusy(null);
    }
  }

  const btn = 'rounded-md px-4 py-2 text-xs font-semibold transition-colors disabled:opacity-50';
  const quiet = `${btn} border border-ql-border bg-ql-surface text-ql-ink hover:bg-ql-surface2`;
  const dis = busy !== null;

  if (mode === 'undo') {
    return (
      <div className="flex flex-wrap items-center gap-2">
        <button type="button" onClick={() => decide('undo')} disabled={dis} className={`${btn} bg-ql-bar text-ql-inverse hover:bg-ql-ink`}>
          {busy === 'undo' ? '…' : 'Put back on the desk'}
        </button>
        {error && <span className="text-[11px] text-ql-alert">{error}</span>}
      </div>
    );
  }

  if (choosing) {
    return (
      <div className="flex flex-wrap items-center gap-2">
        <span className="text-xs font-semibold text-ql-ink">Pass because:</span>
        <button type="button" onClick={() => decide('pass', 'wrong_project')} disabled={dis} className={quiet} title={`The nightly scorers will stop tagging this for ${projectLabel}`}>
          {busy === 'pass' ? '…' : `Not a ${projectLabel} fit`}
        </button>
        {kind === 'grant' && (
          <button type="button" onClick={() => decide('pass', 'cannot_apply')} disabled={dis} className={quiet}>
            We can&apos;t apply
          </button>
        )}
        <button type="button" onClick={() => decide('pass', 'not_now')} disabled={dis} className={quiet}>
          Not this time
        </button>
        <button type="button" onClick={() => setChoosing(false)} disabled={dis} className="px-2 text-xs text-ql-text2 underline hover:text-ql-ink">
          Cancel
        </button>
        {error && <span className="text-[11px] text-ql-alert">{error}</span>}
      </div>
    );
  }

  return (
    <div className="flex flex-wrap items-center gap-2">
      {mode === 'decide' && (
        <button type="button" onClick={() => decide('pursue')} disabled={dis} className={`${btn} bg-ql-bar text-ql-inverse hover:bg-ql-ink`}>
          {busy === 'pursue' ? '…' : 'Pursue'}
        </button>
      )}
      {mode === 'worked' && sendToGhl && (
        <button type="button" onClick={() => decide('pursue')} disabled={dis} className={`${btn} bg-ql-bar text-ql-inverse hover:bg-ql-ink`}>
          {busy === 'pursue' ? '…' : 'Send to GHL'}
        </button>
      )}
      <button type="button" onClick={() => setChoosing(true)} disabled={dis} className={quiet}>
        Pass
      </button>
      <button type="button" onClick={() => decide('later')} disabled={dis} className={quiet}>
        {busy === 'later' ? '…' : 'Save for later'}
      </button>
      {error && <span className="text-[11px] text-ql-alert">{error}</span>}
    </div>
  );
}
