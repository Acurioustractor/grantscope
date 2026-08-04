'use client';

import { useState } from 'react';

/**
 * Capture a human correction against one queued opportunity.
 *
 * The copy here is deliberate: a reviewer needs to know that correcting a
 * result teaches the benchmark and does not quietly re-rank tomorrow's queue.
 * If people believe corrections change production, they stop giving honest
 * ones.
 */

type CorrectionType = 'not_useful' | 'good_result' | 'wrong_eligibility' | 'wrong_fact';

const CORRECTION_OPTIONS: Array<{ value: CorrectionType; label: string; hint: string }> = [
  { value: 'not_useful', label: 'Not useful for this project', hint: 'Records a not_relevant benchmark label.' },
  { value: 'good_result', label: 'Good result, keep surfacing these', hint: 'Records a relevant benchmark label.' },
  { value: 'wrong_eligibility', label: 'Eligibility is wrong', hint: 'You must say which way it should read.' },
  { value: 'wrong_fact', label: 'A stated fact is inaccurate', hint: 'Logged for review. No benchmark label.' },
];

export function CorrectionForm({
  projectCode,
  opportunityId,
  opportunityName,
}: {
  projectCode: string;
  opportunityId: string;
  opportunityName: string;
}) {
  const [correctionType, setCorrectionType] = useState<CorrectionType>('not_useful');
  const [pending, setPending] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [done, setDone] = useState(false);

  async function submit(formData: FormData) {
    setPending(true);
    setMessage(null);
    try {
      const response = await fetch('/api/ops/ask-grantscope/corrections', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({
          question: `Weekly funding desk review of ${opportunityName}`,
          projectCode,
          opportunityId,
          correctionType,
          label: correctionType === 'wrong_eligibility' ? formData.get('label') : null,
          rationale: String(formData.get('rationale') || ''),
          answerSnapshot: { surface: 'weekly-funding-desk', opportunityName },
        }),
      });
      const payload = await response.json() as {
        error?: string;
        details?: string[];
        note?: string;
        impliedLabel?: string | null;
      };
      if (!response.ok) {
        throw new Error(payload.details?.join('; ') || payload.error || 'Correction failed');
      }
      setMessage(payload.note || 'Correction recorded.');
      setDone(true);
    } catch (error) {
      setMessage(error instanceof Error ? error.message : 'Correction failed');
    } finally {
      setPending(false);
    }
  }

  const activeHint = CORRECTION_OPTIONS.find(option => option.value === correctionType)?.hint;

  return (
    <details className="mt-3 rounded-lg border border-[#cbd5e1] bg-[#f8fafc]">
      <summary className="min-h-11 cursor-pointer list-none px-4 py-3 text-xs font-black uppercase tracking-wide text-[#183426]">
        Correct this result
      </summary>
      <form action={submit} className="grid gap-3 border-t border-[#cbd5e1] p-4">
        <p className="text-xs leading-5 text-[#475569]">
          Corrections update benchmark memory so we can measure whether ranking improves. They do not change
          what production surfaces — that only moves when the ranker is retuned deliberately.
        </p>
        <label className="text-xs font-semibold">
          What is wrong
          <select
            name="correctionType"
            value={correctionType}
            onChange={event => setCorrectionType(event.target.value as CorrectionType)}
            className="mt-1 min-h-11 w-full rounded border border-[#94a3b8] bg-white px-3"
          >
            {CORRECTION_OPTIONS.map(option => (
              <option key={option.value} value={option.value}>{option.label}</option>
            ))}
          </select>
        </label>
        {activeHint ? <p className="font-mono text-[10px] text-[#64748b]">{activeHint}</p> : null}
        {correctionType === 'wrong_eligibility' ? (
          <label className="text-xs font-semibold">
            It should read as
            <select name="label" required className="mt-1 min-h-11 w-full rounded border border-[#94a3b8] bg-white px-3">
              <option value="relevant">Relevant — we can pursue this</option>
              <option value="not_relevant">Not relevant — we cannot</option>
            </select>
          </label>
        ) : null}
        <label className="text-xs font-semibold">
          Why—this is what teaches the benchmark
          <textarea
            name="rationale"
            required
            rows={3}
            className="mt-1 w-full rounded border border-[#94a3b8] bg-white px-3 py-2 text-sm"
            placeholder="e.g. Research-only program, does not fund manufacturing or freight."
          />
        </label>
        <button
          type="submit"
          disabled={pending || done}
          className="min-h-11 rounded bg-[#183426] px-4 py-3 text-xs font-black uppercase tracking-wide text-white disabled:opacity-50"
        >
          {pending ? 'Recording…' : done ? 'Recorded' : 'Record correction'}
        </button>
        {message ? <p role="status" className="text-xs leading-5 text-[#475569]">{message}</p> : null}
      </form>
    </details>
  );
}
