'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';

export function FundingGhlContractManager({ ready }: { ready: boolean }) {
  const router = useRouter();
  const [pending, setPending] = useState(false);
  const [message, setMessage] = useState<string | null>(null);

  async function reconcile() {
    setPending(true);
    setMessage(null);
    try {
      const response = await fetch('/api/ops/funding/ghl-contract', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ confirm: true }),
      });
      const payload = await response.json() as { ready?: boolean; error?: string };
      if (!response.ok) throw new Error(payload.error || 'GHL contract reconciliation failed');
      setMessage(payload.ready ? 'GHL operating contract is ready.' : 'GHL still has unresolved configuration gaps.');
      router.refresh();
    } catch (error) {
      setMessage(error instanceof Error ? error.message : 'GHL contract reconciliation failed');
    } finally {
      setPending(false);
    }
  }

  return (
    <div className="flex flex-col items-start gap-2">
      <button
        type="button"
        onClick={reconcile}
        disabled={pending || ready}
        className="min-h-11 rounded-lg border border-white/40 bg-white px-4 py-3 text-xs font-black uppercase tracking-wide text-[#183426] disabled:opacity-60"
      >
        {pending ? 'Reconciling…' : ready ? 'GHL contract ready' : 'Repair GHL contract'}
      </button>
      {message ? <p role="status" className="max-w-xs text-xs text-[#dbe9e1]">{message}</p> : null}
    </div>
  );
}
