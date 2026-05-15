'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';

type Status = 'new' | 'reviewing' | 'actioned' | 'won' | 'lost' | 'expired' | 'dismissed';

export function SignalActionButton({
  signalId,
  grantIds,
  status,
  disabled,
}: {
  signalId: string;
  grantIds: string[];
  status: Status | string;
  disabled?: boolean;
}) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [optimisticStatus, setOptimisticStatus] = useState<Status | null>(null);
  const [error, setError] = useState<string | null>(null);

  const effectiveStatus = (optimisticStatus || status) as Status;

  async function handleAction(action: 'track' | 'review' | 'dismiss' | 'reset') {
    setBusy(true);
    setError(null);
    const nextOptimistic: Record<typeof action, Status> = {
      track: 'actioned',
      review: 'reviewing',
      dismiss: 'dismissed',
      reset: 'new',
    };
    setOptimisticStatus(nextOptimistic[action]);
    try {
      const res = await fetch(`/api/goods/signals/${signalId}/action`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action, grant_ids: action === 'track' ? grantIds : undefined }),
      });
      if (!res.ok) {
        const text = await res.text();
        throw new Error(text.slice(0, 100));
      }
      router.refresh();
    } catch (e) {
      setError(e instanceof Error ? e.message : 'failed');
      setOptimisticStatus(null);
    } finally {
      setBusy(false);
    }
  }

  // Already actioned (tracked) — show terminal state + an "undo to new" option
  if (effectiveStatus === 'actioned') {
    return (
      <div className="flex flex-col items-end gap-1">
        <div className="border-2 border-bauhaus-black bg-bauhaus-yellow px-3 py-1 font-mono text-[11px] font-black uppercase tracking-wider">
          ✓ Tracked
        </div>
        <button
          type="button"
          disabled={busy}
          onClick={() => handleAction('reset')}
          className="border border-bauhaus-black bg-white px-2 py-0.5 font-mono text-[9px] uppercase tracking-wider hover:bg-bauhaus-canvas"
        >
          {busy ? '…' : 'Move to new'}
        </button>
        {error && <div className="text-[10px] text-bauhaus-red">{error}</div>}
      </div>
    );
  }

  if (effectiveStatus === 'dismissed') {
    return (
      <div className="flex flex-col items-end gap-1">
        <div className="border-2 border-bauhaus-black bg-gray-300 px-3 py-1 font-mono text-[11px] font-black uppercase tracking-wider">
          ✗ Dismissed
        </div>
        <button
          type="button"
          disabled={busy}
          onClick={() => handleAction('reset')}
          className="border border-bauhaus-black bg-white px-2 py-0.5 font-mono text-[9px] uppercase tracking-wider hover:bg-bauhaus-canvas"
        >
          {busy ? '…' : 'Move to new'}
        </button>
        {error && <div className="text-[10px] text-bauhaus-red">{error}</div>}
      </div>
    );
  }

  // Reviewing — claimed but not yet actioned. Persist the "I'm working on this"
  // signal across refreshes, with paths forward.
  if (effectiveStatus === 'reviewing') {
    return (
      <div className="flex flex-col items-end gap-1">
        <div className="border-2 border-bauhaus-black bg-bauhaus-blue px-3 py-1 font-mono text-[11px] font-black uppercase tracking-wider text-white">
          ▶ Reviewing
        </div>
        <div className="flex gap-1">
          <button
            type="button"
            disabled={disabled || busy}
            onClick={() => handleAction('track')}
            className="border border-bauhaus-black bg-bauhaus-red px-2 py-0.5 font-mono text-[10px] font-black uppercase tracking-wider text-white hover:bg-bauhaus-black disabled:bg-gray-300 disabled:text-gray-500"
          >
            {busy ? '…' : 'Track all'}
          </button>
          <button
            type="button"
            disabled={busy}
            onClick={() => handleAction('dismiss')}
            className="border border-bauhaus-black bg-white px-2 py-0.5 font-mono text-[10px] font-black uppercase tracking-wider hover:bg-bauhaus-canvas"
          >
            Dismiss
          </button>
          <button
            type="button"
            disabled={busy}
            onClick={() => handleAction('reset')}
            className="border border-bauhaus-black bg-white px-2 py-0.5 font-mono text-[10px] uppercase tracking-wider hover:bg-bauhaus-canvas"
          >
            Unclaim
          </button>
        </div>
        {error && <div className="text-[10px] text-bauhaus-red">{error}</div>}
      </div>
    );
  }

  // Default 'new' state — initial triage
  return (
    <div className="flex flex-col gap-1">
      <div className="flex gap-1">
        <button
          type="button"
          disabled={disabled || busy}
          onClick={() => handleAction('track')}
          className="border-2 border-bauhaus-black bg-bauhaus-red px-2 py-1 font-mono text-[10px] font-black uppercase tracking-wider text-white hover:bg-bauhaus-black disabled:bg-gray-300 disabled:text-gray-500"
        >
          {busy ? '…' : 'Track all matched'}
        </button>
        <button
          type="button"
          disabled={busy}
          onClick={() => handleAction('review')}
          className="border-2 border-bauhaus-black bg-white px-2 py-1 font-mono text-[10px] font-black uppercase tracking-wider hover:bg-bauhaus-canvas"
        >
          {busy ? '…' : 'Reviewing'}
        </button>
        <button
          type="button"
          disabled={busy}
          onClick={() => handleAction('dismiss')}
          className="border-2 border-bauhaus-black bg-white px-2 py-1 font-mono text-[10px] font-black uppercase tracking-wider hover:bg-bauhaus-canvas"
        >
          Dismiss
        </button>
      </div>
      {error && <div className="text-[10px] text-bauhaus-red">{error}</div>}
    </div>
  );
}
