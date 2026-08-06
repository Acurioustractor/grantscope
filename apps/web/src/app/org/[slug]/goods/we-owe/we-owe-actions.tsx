'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';

const btn = 'border-2 border-bauhaus-black px-4 py-2 text-xs font-black uppercase tracking-widest transition-colors disabled:opacity-50';
const field = 'w-full border-2 border-bauhaus-black bg-white px-3 py-2 text-sm';
const label = 'block text-[10px] font-black uppercase tracking-widest';

export function ObligationStateButtons({ orgProfileId, obligationId, owedTo }: {
  orgProfileId: string;
  obligationId: string;
  owedTo: 'funder' | 'community';
}) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [dropping, setDropping] = useState(false);
  const [reason, setReason] = useState('');
  const [error, setError] = useState<string | null>(null);

  async function patch(payload: Record<string, unknown>) {
    setBusy(true);
    setError(null);
    try {
      const res = await fetch(`/api/org/${orgProfileId}/obligations`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id: obligationId, ...payload }),
      });
      if (!res.ok) throw new Error(((await res.json()) as { error?: string }).error || 'failed');
      setDropping(false);
      router.refresh();
    } catch (e) {
      setError(e instanceof Error ? e.message : 'failed');
    } finally {
      setBusy(false);
    }
  }

  if (dropping) {
    return (
      <div className="space-y-2 border-2 border-bauhaus-red p-3">
        <p className="text-xs font-bold">
          This releases a promise to {owedTo === 'community' ? 'community' : 'the funder'}.
          {owedTo === 'community' ? ' Record why:' : ' Reason (optional):'}
        </p>
        <input className={field} value={reason} onChange={(e) => setReason(e.target.value)} placeholder="Why is this being released?" />
        <div className="flex gap-2">
          <button type="button" disabled={busy} onClick={() => patch({ state: 'dropped', drop_reason: reason || undefined })} className={`${btn} bg-bauhaus-red text-white hover:bg-bauhaus-black`}>
            {busy ? '…' : 'Confirm drop'}
          </button>
          <button type="button" disabled={busy} onClick={() => setDropping(false)} className={`${btn} bg-white hover:bg-bauhaus-canvas`}>
            Cancel
          </button>
        </div>
        {error && <p className="text-xs font-bold text-bauhaus-red">{error}</p>}
      </div>
    );
  }

  return (
    <div className="flex flex-wrap items-center gap-2">
      <button type="button" disabled={busy} onClick={() => patch({ state: 'done' })} className={`${btn} bg-bauhaus-black text-white hover:bg-bauhaus-blue`}>
        {busy ? '…' : 'Done'}
      </button>
      <button type="button" disabled={busy} onClick={() => setDropping(true)} className={`${btn} bg-white hover:bg-bauhaus-canvas`}>
        Dropped
      </button>
      {error && <span className="text-xs font-bold text-bauhaus-red">{error}</span>}
    </div>
  );
}

export function MintObligationForm({ orgProfileId, projectCode }: { orgProfileId: string; projectCode: string }) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [form, setForm] = useState({ title: '', owed_to: 'community', due_date: '', next_action: '', promised_to: '', owner: '' });

  async function submit() {
    setBusy(true);
    setError(null);
    try {
      const res = await fetch(`/api/org/${orgProfileId}/obligations`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          project_code: projectCode,
          title: form.title,
          owed_to: form.owed_to,
          due_date: form.due_date || undefined,
          next_action: form.next_action || undefined,
          promised_to: form.promised_to || undefined,
          owner: form.owner || undefined,
        }),
      });
      if (!res.ok) throw new Error(((await res.json()) as { error?: string }).error || 'failed');
      setForm({ title: '', owed_to: 'community', due_date: '', next_action: '', promised_to: '', owner: '' });
      setOpen(false);
      router.refresh();
    } catch (e) {
      setError(e instanceof Error ? e.message : 'failed');
    } finally {
      setBusy(false);
    }
  }

  if (!open) {
    return (
      <button type="button" onClick={() => setOpen(true)} className={`${btn} bg-bauhaus-black text-white hover:bg-bauhaus-blue`}>
        + We owe something
      </button>
    );
  }

  return (
    <div className="w-full max-w-xl space-y-3 border-4 border-bauhaus-black bg-white p-4">
      <p className="text-xs font-black uppercase tracking-widest">Record a promise — minting acknowledges it, not starts it</p>
      <div>
        <span className={label}>What do we owe?</span>
        <input className={field} value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })} placeholder="Return the trailer to Anyinginyi" />
      </div>
      <div className="grid grid-cols-2 gap-3">
        <div>
          <span className={label}>Owed to</span>
          <select className={field} value={form.owed_to} onChange={(e) => setForm({ ...form, owed_to: e.target.value })}>
            <option value="community">Community</option>
            <option value="funder">Funder</option>
          </select>
        </div>
        <div>
          <span className={label}>Due (optional)</span>
          <input type="date" className={field} value={form.due_date} onChange={(e) => setForm({ ...form, due_date: e.target.value })} />
        </div>
      </div>
      <div>
        <span className={label}>Promised to (optional)</span>
        <input className={field} value={form.promised_to} onChange={(e) => setForm({ ...form, promised_to: e.target.value })} placeholder="Who did we promise?" />
      </div>
      <div className="grid grid-cols-2 gap-3">
        <div>
          <span className={label}>Next action (optional)</span>
          <input className={field} value={form.next_action} onChange={(e) => setForm({ ...form, next_action: e.target.value })} />
        </div>
        <div>
          <span className={label}>Owner (optional)</span>
          <input className={field} value={form.owner} onChange={(e) => setForm({ ...form, owner: e.target.value })} placeholder="Ben / Nic" />
        </div>
      </div>
      <div className="flex gap-2">
        <button type="button" disabled={busy || !form.title.trim()} onClick={submit} className={`${btn} bg-bauhaus-black text-white hover:bg-bauhaus-blue`}>
          {busy ? '…' : 'Mint'}
        </button>
        <button type="button" disabled={busy} onClick={() => setOpen(false)} className={`${btn} bg-white hover:bg-bauhaus-canvas`}>
          Cancel
        </button>
      </div>
      {error && <p className="text-xs font-bold text-bauhaus-red">{error}</p>}
    </div>
  );
}
