'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';

// Obligation rows get the two terminal states (#147) instead of the generic
// handled buttons: Done and Dropped. Dropped asks a one-line confirm —
// community-owed drops carry a relationship cost and the API requires a reason.
export function DeskObligationButtons({ orgProfileId, obligationId, owedTo }: {
  orgProfileId: string;
  obligationId: string;
  owedTo: 'funder' | 'community';
}) {
  const router = useRouter();
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function mark(state: 'done' | 'dropped') {
    let dropReason: string | null = null;
    if (state === 'dropped') {
      dropReason = window.prompt(
        owedTo === 'community'
          ? 'Dropping community-owed work needs a reason (recorded, never silent):'
          : 'Drop this obligation? One line on why (optional):',
      );
      if (dropReason === null) return; // cancelled
      if (owedTo === 'community' && !dropReason.trim()) {
        setError('A reason is required to drop community-owed work.');
        return;
      }
    }
    setBusy(state);
    setError(null);
    try {
      const res = await fetch(`/api/org/${orgProfileId}/obligations`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id: obligationId, state, ...(dropReason?.trim() ? { drop_reason: dropReason.trim() } : {}) }),
      });
      if (!res.ok) throw new Error(((await res.json()) as { error?: string }).error || 'failed');
      router.refresh();
    } catch (e) {
      setError(e instanceof Error ? e.message : 'failed');
    } finally {
      setBusy(null);
    }
  }

  const btn = 'rounded-md px-4 py-2 text-xs font-semibold transition-colors disabled:opacity-50';
  return (
    <div className="flex flex-wrap items-center gap-2">
      <button type="button" onClick={() => mark('done')} disabled={busy !== null} className={`${btn} bg-ql-bar text-ql-inverse hover:bg-ql-ink`}>
        {busy === 'done' ? '…' : 'Done'}
      </button>
      <button type="button" onClick={() => mark('dropped')} disabled={busy !== null} className={`${btn} border border-ql-border bg-ql-surface text-ql-ink hover:bg-ql-surface2`}>
        {busy === 'dropped' ? '…' : 'Dropped'}
      </button>
      {error && <span className="text-[10px] text-ql-alert">{error}</span>}
    </div>
  );
}
