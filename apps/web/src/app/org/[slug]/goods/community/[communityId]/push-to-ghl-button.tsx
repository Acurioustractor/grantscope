'use client';

import { useState } from 'react';

type Payload = {
  entityName: string;
  buyerRole: string | null;
  abn: string | null;
  website: string | null;
  communityName: string;
  communityState: string | null;
  isCommunityControlled: boolean;
  relationshipStatus: string | null;
  govtContractValue: number | null;
  communityId?: string;
  entityId?: string | null;
  buyerEntityRowId?: string;
};

type LinkedState = {
  contactId: string;
  opportunityId?: string;
  stageName?: string;
  lastPushedAt?: string;
};

export function PushToGhlButton({ payload, compact, linked }: { payload: Payload; compact?: boolean; linked?: LinkedState }) {
  const [busy, setBusy] = useState(false);
  const [done, setDone] = useState<{ contactId: string; opportunityId?: string; warning?: string } | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function push() {
    setBusy(true);
    setError(null);
    try {
      const res = await fetch('/api/goods/buyer/push-ghl', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });
      const data = await res.json();
      if (!res.ok) throw new Error((data as { error?: string }).error || 'failed');
      setDone({ contactId: data.contactId, opportunityId: data.opportunityId, warning: data.opportunityWarning });
    } catch (e) {
      setError(e instanceof Error ? e.message : 'failed');
    } finally {
      setBusy(false);
    }
  }

  const sizeCls = compact ? 'px-2 py-0.5 text-[10px]' : 'px-3 py-1 text-xs';

  // State after a successful push this session
  if (done) {
    const label = done.opportunityId ? '✓ Pushed to GHL' : done.warning ? '✓ Contact only' : '✓ in GHL';
    return (
      <div className="flex flex-col items-end gap-1">
        <div className={`border-2 border-bauhaus-black bg-bauhaus-yellow font-mono font-black uppercase tracking-wider ${sizeCls}`}>
          {label}
        </div>
        {done.warning && <div className="text-[10px] text-bauhaus-red max-w-[160px] text-right">{done.warning}</div>}
      </div>
    );
  }

  // Persistent linked state (this buyer is already in GHL from a previous push)
  if (linked) {
    const ago = linked.lastPushedAt ? relativeAgo(linked.lastPushedAt) : '';
    return (
      <div className="flex flex-col items-end gap-1">
        <div className={`flex items-center gap-1 border-2 border-bauhaus-black bg-bauhaus-yellow font-mono font-black uppercase tracking-wider ${sizeCls}`}>
          <span>✓ In GHL</span>
          {linked.stageName && <span className="text-gray-700">· {linked.stageName}</span>}
          {ago && <span className="text-gray-500">· {ago}</span>}
        </div>
        <button
          type="button"
          onClick={push}
          disabled={busy}
          className={`border border-bauhaus-black bg-white font-mono uppercase tracking-wider hover:bg-bauhaus-canvas disabled:opacity-50 ${compact ? 'px-1 py-0 text-[9px]' : 'px-2 py-0.5 text-[10px]'}`}
        >
          {busy ? '…' : 'Re-sync'}
        </button>
        {error && <div className="text-[10px] text-bauhaus-red max-w-[160px] text-right">{error}</div>}
      </div>
    );
  }

  return (
    <div className="flex flex-col items-end gap-1">
      <button
        type="button"
        onClick={push}
        disabled={busy}
        className={`border-2 border-bauhaus-black bg-bauhaus-red font-mono font-black uppercase tracking-wider text-white hover:bg-bauhaus-black disabled:bg-gray-300 disabled:text-gray-500 ${sizeCls}`}
      >
        {busy ? '…' : 'Push to GHL'}
      </button>
      {error && <div className="text-[10px] text-bauhaus-red max-w-[120px] text-right">{error}</div>}
    </div>
  );
}

function relativeAgo(iso: string): string {
  const t = new Date(iso).getTime();
  if (isNaN(t)) return '';
  const secs = (Date.now() - t) / 1000;
  if (secs < 60) return 'just now';
  if (secs < 3600) return `${Math.floor(secs / 60)}m`;
  if (secs < 86400) return `${Math.floor(secs / 3600)}h`;
  return `${Math.floor(secs / 86400)}d`;
}
