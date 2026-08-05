'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';

// Done → next: persists through the same daily-actions store as the Today
// queue, then refreshes — the queue advances and the next record is selected.
export function DeskMarkButtons({ orgProfileId, actionId, title, detail }: {
  orgProfileId: string;
  actionId: string;
  title: string;
  detail: string;
}) {
  const router = useRouter();
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function mark(status: 'done' | 'waiting' | 'tomorrow') {
    setBusy(status);
    setError(null);
    try {
      const res = await fetch(`/api/org/${orgProfileId}/daily-actions`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action_id: actionId, title, detail, status }),
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
        {busy === 'done' ? '…' : 'Done → next'}
      </button>
      <button type="button" onClick={() => mark('waiting')} disabled={busy !== null} className={`${btn} border border-ql-border bg-ql-surface text-ql-ink hover:bg-ql-surface2`}>
        {busy === 'waiting' ? '…' : 'Waiting'}
      </button>
      <button type="button" onClick={() => mark('tomorrow')} disabled={busy !== null} className={`${btn} border border-ql-border bg-ql-surface text-ql-ink hover:bg-ql-surface2`}>
        {busy === 'tomorrow' ? '…' : 'Tomorrow'}
      </button>
      {error && <span className="text-[10px] text-ql-alert">{error}</span>}
    </div>
  );
}
