'use client';

import { useState } from 'react';
import type { TriageGrantRow } from '@/lib/services/goods-grants-triage';

// Push a live grant round into the GHL Grants pipeline ("Grant Opportunity
// Identified"). Grants attach to the triage contact, so the linked state is a
// badge, not a deep link — opportunity deep links are unreliable.
export function PushGrantGhlButton({ g }: { g: TriageGrantRow }) {
  const [busy, setBusy] = useState(false);
  const [linkedId, setLinkedId] = useState<string | null>(g.ghlOpportunityId);
  const [error, setError] = useState<string | null>(null);

  async function push() {
    setBusy(true);
    setError(null);
    try {
      const res = await fetch('/api/goods/grants/push-ghl', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          grantId: g.id,
          name: g.name,
          provider: g.provider,
          fitScore: g.goodsScore,
          deadline: g.deadline,
          url: g.url,
          geography: g.geography,
          amountMin: g.amountMin,
          amountMax: g.amountMax,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error((data as { error?: string }).error || 'failed');
      setLinkedId(data.opportunityId as string);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'failed');
    } finally {
      setBusy(false);
    }
  }

  if (linkedId) {
    return (
      <span className="bg-bauhaus-yellow px-1.5 py-0.5 font-mono text-[9px] font-black uppercase tracking-wider" title="Tracked in the GHL Grants pipeline">
        ✓ In GHL
      </span>
    );
  }

  return (
    <span className="inline-flex flex-col items-start gap-0.5">
      <button
        type="button"
        onClick={push}
        disabled={busy}
        className="border border-bauhaus-black bg-white px-1.5 py-0.5 font-mono text-[9px] font-black uppercase tracking-wider hover:bg-bauhaus-red hover:text-white disabled:opacity-50"
      >
        {busy ? '…' : 'Push to GHL'}
      </button>
      {error && <span className="text-[9px] text-bauhaus-red">{error}</span>}
    </span>
  );
}
