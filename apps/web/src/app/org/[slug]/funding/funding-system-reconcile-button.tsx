'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';

export function FundingSystemReconcileButton({ automaticActions }: { automaticActions: number }) {
  const router = useRouter();
  const [pending, setPending] = useState(false);
  const [message, setMessage] = useState<string | null>(null);

  async function reconcile() {
    setPending(true);
    setMessage(null);
    try {
      const response = await fetch('/api/ops/funding/reconcile', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ confirm: true }),
      });
      const payload = await response.json() as {
        error?: string;
        attempted?: { profiles: number; notionWorkspaces: number };
        completed?: { profiles: number; notionWorkspaces: number };
      };
      if (!response.ok) throw new Error(payload.error || 'Funding reconciliation failed');
      setMessage(
        `Reconciled ${payload.completed?.profiles || 0} project profiles and ${payload.completed?.notionWorkspaces || 0} Notion workspaces.`
      );
      router.refresh();
    } catch (error) {
      setMessage(error instanceof Error ? error.message : 'Funding reconciliation failed');
    } finally {
      setPending(false);
    }
  }

  return (
    <div className="flex flex-col items-end gap-2">
      <button
        type="button"
        onClick={reconcile}
        disabled={pending || automaticActions === 0}
        className="min-h-11 rounded-lg bg-[#e7ef65] px-4 py-3 text-xs font-black uppercase tracking-wide text-[#183426] disabled:cursor-not-allowed disabled:opacity-50"
      >
        {pending ? 'Reconciling system…' : automaticActions > 0 ? `Reconcile all automatic links (${automaticActions})` : 'Automatic links aligned'}
      </button>
      {message ? <p role="status" className="max-w-sm text-right text-xs text-[#dbe9e1]">{message}</p> : null}
    </div>
  );
}
