'use client';

import { useRouter } from 'next/navigation';
import { useState } from 'react';
import { pipelineStatusRequiresReason } from '@/lib/services/act-pipeline-learning';

const STATUS_OPTIONS = [
  ['prospect', 'To qualify'],
  ['researching', 'Researching'],
  ['pursuing', 'Pursuing'],
  ['applied', 'Applied'],
  ['submitted', 'Submitted'],
  ['waiting', 'Waiting'],
  ['won', 'Won'],
  ['lost', 'Lost'],
  ['parked', 'Parked'],
] as const;

const OUTCOME_REASONS = [
  'Relationship',
  'Strategic fit',
  'Eligibility',
  'Evidence',
  'Timing',
  'Capacity',
  'Funder decision',
  'Other',
] as const;

export function ActPipelineStatusControl({
  itemId,
  itemName,
  orgProfileId,
  initialStatus,
  initialOwnerName,
  initialNextAction,
  initialNextActionAt,
  suggestedNextAction,
}: {
  itemId: string;
  itemName: string;
  orgProfileId: string;
  initialStatus: string;
  initialOwnerName: string | null;
  initialNextAction: string | null;
  initialNextActionAt: string | null;
  suggestedNextAction?: string | null;
}) {
  const router = useRouter();
  const [status, setStatus] = useState(initialStatus);
  const [proposedStatus, setProposedStatus] = useState<string | null>(null);
  const [reason, setReason] = useState('');
  const [detail, setDetail] = useState('');
  const [pending, setPending] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [planning, setPlanning] = useState(false);
  const [ownerName, setOwnerName] = useState(initialOwnerName ?? '');
  const [nextAction, setNextAction] = useState(initialNextAction ?? '');
  const [nextActionAt, setNextActionAt] = useState(initialNextActionAt?.slice(0, 10) ?? '');

  async function save(nextStatus: string, outcomeReason?: string) {
    setPending(true);
    setMessage(null);
    try {
      const response = await fetch(`/api/org/${orgProfileId}/pipeline`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id: itemId, status: nextStatus, outcome_reason: outcomeReason }),
      });
      const body = (await response.json()) as { error?: string; learning_memory_recorded?: boolean };
      if (!response.ok) throw new Error(body.error || `Update failed with ${response.status}`);
      setStatus(nextStatus);
      setProposedStatus(null);
      setReason('');
      setDetail('');
      setMessage(body.learning_memory_recorded ? 'Saved and learned' : 'Saved');
      router.refresh();
    } catch (error) {
      setMessage(error instanceof Error ? error.message : 'Update failed');
    } finally {
      setPending(false);
    }
  }

  async function savePlan() {
    if (!ownerName.trim() || !nextAction.trim() || !nextActionAt) {
      setMessage('Add an owner, next action, and date');
      return;
    }
    setPending(true);
    setMessage(null);
    try {
      const response = await fetch(`/api/org/${orgProfileId}/pipeline`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          id: itemId,
          owner_name: ownerName.trim(),
          next_action: nextAction.trim(),
          next_action_at: nextActionAt,
        }),
      });
      const body = (await response.json()) as { error?: string };
      if (!response.ok) throw new Error(body.error || `Update failed with ${response.status}`);
      setPlanning(false);
      setMessage('Plan saved');
      router.refresh();
    } catch (error) {
      setMessage(error instanceof Error ? error.message : 'Update failed');
    } finally {
      setPending(false);
    }
  }

  function choose(nextStatus: string) {
    if (nextStatus === status) return;
    if (pipelineStatusRequiresReason(nextStatus)) {
      setProposedStatus(nextStatus);
      setPlanning(false);
      setMessage(null);
      return;
    }
    void save(nextStatus);
  }

  const options = STATUS_OPTIONS.some(([value]) => value === status)
    ? STATUS_OPTIONS
    : ([[status, status.replaceAll('_', ' ')], ...STATUS_OPTIONS] as ReadonlyArray<readonly [string, string]>);

  return (
    <div className="min-w-[150px] text-xs">
      <select
        aria-label={`Status for ${itemName}`}
        value={status}
        onChange={(event) => choose(event.target.value)}
        disabled={pending}
        className="h-9 w-full rounded-md border border-[var(--ws-border)] bg-white px-2 font-semibold text-[var(--ws-text)] disabled:cursor-wait disabled:opacity-60"
      >
        {options.map(([value, label]) => <option key={value} value={value}>{label}</option>)}
      </select>

      <div className="mt-2 leading-relaxed text-[var(--ws-text-secondary)]">
        <div className="font-semibold text-[var(--ws-text)]">{ownerName || 'Unassigned'}</div>
        <div>{nextAction || 'No next action set'}</div>
        <div>{nextActionAt ? `Next ${new Date(`${nextActionAt}T00:00:00`).toLocaleDateString('en-AU', { day: 'numeric', month: 'short' })}` : 'No next date'}</div>
      </div>
      <button
        type="button"
        disabled={pending}
        onClick={() => {
          setPlanning((current) => !current);
          setProposedStatus(null);
          setMessage(null);
        }}
        className="mt-2 min-h-9 w-full rounded-md border border-[var(--ws-border)] bg-white px-2 text-left font-semibold hover:bg-[var(--ws-surface-2)] disabled:opacity-50"
      >
        {planning ? 'Close plan' : ownerName && nextAction && nextActionAt ? 'Edit plan' : 'Plan next step'}
      </button>

      {planning ? (
        <div className="mt-2 space-y-2 rounded-md border border-[var(--ws-border)] bg-[var(--ws-surface-2)] p-2">
          <label className="block font-semibold text-[var(--ws-text)]">
            Owner
            <input
              value={ownerName}
              onChange={(event) => setOwnerName(event.target.value)}
              placeholder="Person responsible"
              className="mt-1 h-9 w-full rounded-md border border-[var(--ws-border)] bg-white px-2 font-normal"
            />
          </label>
          <label className="block font-semibold text-[var(--ws-text)]">
            Next action
            <input
              value={nextAction}
              onChange={(event) => setNextAction(event.target.value)}
              placeholder="One concrete move"
              className="mt-1 h-9 w-full rounded-md border border-[var(--ws-border)] bg-white px-2 font-normal"
            />
          </label>
          {!nextAction.trim() && suggestedNextAction ? (
            <button
              type="button"
              onClick={() => setNextAction(suggestedNextAction)}
              className="w-full rounded-md border border-[#cbd8cf] bg-[#edf3ee] px-2 py-2 text-left font-medium leading-snug text-[#2f6b4a] hover:bg-[#e3ece5]"
            >
              Use suggestion: {suggestedNextAction}
            </button>
          ) : null}
          <label className="block font-semibold text-[var(--ws-text)]">
            Date
            <input
              type="date"
              value={nextActionAt}
              onChange={(event) => setNextActionAt(event.target.value)}
              className="mt-1 h-9 w-full rounded-md border border-[var(--ws-border)] bg-white px-2 font-normal"
            />
          </label>
          <button
            type="button"
            disabled={pending || !ownerName.trim() || !nextAction.trim() || !nextActionAt}
            onClick={() => void savePlan()}
            className="min-h-9 w-full rounded-md bg-[var(--ws-text)] px-2 font-semibold text-white disabled:opacity-40"
          >
            {pending ? 'Saving...' : 'Save plan'}
          </button>
        </div>
      ) : null}

      {proposedStatus ? (
        <div className="mt-2 space-y-2 rounded-md border border-[var(--ws-border)] bg-[var(--ws-surface-2)] p-2">
          <label className="block font-semibold text-[var(--ws-text)]">
            What did we learn?
            <select
              value={reason}
              onChange={(event) => setReason(event.target.value)}
              className="mt-1 h-9 w-full rounded-md border border-[var(--ws-border)] bg-white px-2 font-normal"
            >
              <option value="">Choose factor</option>
              {OUTCOME_REASONS.map((value) => <option key={value} value={value}>{value}</option>)}
            </select>
          </label>
          <input
            value={detail}
            onChange={(event) => setDetail(event.target.value)}
            placeholder="Short detail (optional)"
            className="h-9 w-full rounded-md border border-[var(--ws-border)] bg-white px-2"
          />
          <div className="flex gap-2">
            <button
              type="button"
              disabled={!reason || pending}
              onClick={() => void save(proposedStatus, detail.trim() ? `${reason}: ${detail.trim()}` : reason)}
              className="min-h-9 flex-1 rounded-md bg-[var(--ws-text)] px-2 font-semibold text-white disabled:opacity-40"
            >
              Save
            </button>
            <button
              type="button"
              disabled={pending}
              onClick={() => setProposedStatus(null)}
              className="min-h-9 rounded-md border border-[var(--ws-border)] bg-white px-2 font-semibold"
            >
              Cancel
            </button>
          </div>
        </div>
      ) : null}

      {message ? <div className="mt-1 leading-relaxed text-[var(--ws-text-secondary)]" aria-live="polite">{message}</div> : null}
    </div>
  );
}
