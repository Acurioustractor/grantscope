'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';

const FUNDER_PRESETS = [
  'Snow Foundation',
  'The Funding Network',
  'FRRR',
  'Vincent Fairfax Family Foundation',
  'AMP Spark',
  'Centrecorp Foundation',
  'QBE Foundation',
  'Other',
];

const PRODUCT_PRESETS = [
  { slug: 'basket-bed-single',  type: 'Basket Bed', label: 'Basket Bed — Single' },
  { slug: 'basket-bed-double',  type: 'Basket Bed', label: 'Basket Bed — Double' },
  { slug: 'stretch-bed',        type: 'Stretch Bed', label: 'Stretch Bed' },
  { slug: 'washing-machine-id', type: 'Washing Machine', label: 'ID Washing Machine' },
];

export function RecordDeploymentButton({ communityId, communityName }: { communityId: string; communityName: string }) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const [done, setDone] = useState<{ inserted: number; batch_id: string } | null>(null);
  const [error, setError] = useState<string | null>(null);

  // Form state
  const [product, setProduct] = useState(PRODUCT_PRESETS[0]);
  const [count, setCount] = useState(10);
  const [funder, setFunder] = useState(FUNDER_PRESETS[0]);
  const [funderOther, setFunderOther] = useState('');
  const [amount, setAmount] = useState('');
  const [invoice, setInvoice] = useState('');
  const [deployedAt, setDeployedAt] = useState(new Date().toISOString().slice(0, 10));
  const [notes, setNotes] = useState('');

  async function submit() {
    setBusy(true);
    setError(null);
    try {
      const res = await fetch(`/api/goods/community/${communityId}/deploy`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          product_slug: product.slug,
          product_type: product.type,
          count,
          funder_label: funder === 'Other' ? funderOther : funder,
          funded_amount_aud: amount ? Number(amount) : undefined,
          funded_via_invoice: invoice || undefined,
          deployed_at: deployedAt,
          notes: notes || undefined,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || data.detail || 'failed');
      setDone({ inserted: data.inserted, batch_id: data.batch_id });
      router.refresh();
    } catch (e) {
      setError(e instanceof Error ? e.message : 'failed');
    } finally {
      setBusy(false);
    }
  }

  if (done) {
    return (
      <div className="border-4 border-bauhaus-black bg-bauhaus-yellow p-3">
        <div className="font-black uppercase tracking-widest text-xs">✓ Deployment recorded</div>
        <div className="mt-1 text-xs">{done.inserted} units logged · batch {done.batch_id.slice(0, 8)}</div>
        <button
          type="button"
          onClick={() => { setDone(null); setOpen(false); }}
          className="mt-2 border-2 border-bauhaus-black bg-white px-2 py-0.5 font-mono text-[10px] uppercase tracking-wider"
        >
          Record another
        </button>
      </div>
    );
  }

  if (!open) {
    return (
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="border-4 border-bauhaus-black bg-bauhaus-red px-3 py-1.5 font-mono text-xs font-black uppercase tracking-widest text-white hover:bg-bauhaus-black"
      >
        + Record deployment
      </button>
    );
  }

  return (
    <div className="border-4 border-bauhaus-black bg-white p-4">
      <div className="mb-3 flex items-center justify-between">
        <h3 className="text-sm font-black uppercase tracking-widest">Record deployment to {communityName}</h3>
        <button type="button" onClick={() => setOpen(false)} className="text-xs underline hover:text-bauhaus-red">cancel</button>
      </div>

      <div className="grid gap-3 sm:grid-cols-2">
        <Field label="Product">
          <select
            value={product.slug}
            onChange={e => setProduct(PRODUCT_PRESETS.find(p => p.slug === e.target.value) || PRODUCT_PRESETS[0])}
            className="w-full border-2 border-bauhaus-black bg-white px-2 py-1 font-mono text-xs"
          >
            {PRODUCT_PRESETS.map(p => <option key={p.slug} value={p.slug}>{p.label}</option>)}
          </select>
        </Field>

        <Field label="Count">
          <input
            type="number"
            value={count}
            min={1}
            max={500}
            onChange={e => setCount(Number(e.target.value))}
            className="w-full border-2 border-bauhaus-black bg-white px-2 py-1 font-mono text-xs"
          />
        </Field>

        <Field label="Funder">
          <select
            value={funder}
            onChange={e => setFunder(e.target.value)}
            className="w-full border-2 border-bauhaus-black bg-white px-2 py-1 font-mono text-xs"
          >
            {FUNDER_PRESETS.map(f => <option key={f} value={f}>{f}</option>)}
          </select>
        </Field>

        {funder === 'Other' && (
          <Field label="Funder name">
            <input
              type="text"
              value={funderOther}
              onChange={e => setFunderOther(e.target.value)}
              className="w-full border-2 border-bauhaus-black bg-white px-2 py-1 font-mono text-xs"
            />
          </Field>
        )}

        <Field label="Amount (AUD, total)">
          <input
            type="number"
            value={amount}
            placeholder="60000"
            onChange={e => setAmount(e.target.value)}
            className="w-full border-2 border-bauhaus-black bg-white px-2 py-1 font-mono text-xs"
          />
        </Field>

        <Field label="Invoice ref (Xero)">
          <input
            type="text"
            value={invoice}
            placeholder="INV-0321"
            onChange={e => setInvoice(e.target.value)}
            className="w-full border-2 border-bauhaus-black bg-white px-2 py-1 font-mono text-xs"
          />
        </Field>

        <Field label="Deployed on">
          <input
            type="date"
            value={deployedAt}
            onChange={e => setDeployedAt(e.target.value)}
            className="w-full border-2 border-bauhaus-black bg-white px-2 py-1 font-mono text-xs"
          />
        </Field>

        <Field label="Notes (optional)">
          <input
            type="text"
            value={notes}
            placeholder="Trip ref, household batch, etc"
            onChange={e => setNotes(e.target.value)}
            className="w-full border-2 border-bauhaus-black bg-white px-2 py-1 font-mono text-xs"
          />
        </Field>
      </div>

      <div className="mt-4 flex items-center justify-between">
        <div className="text-xs text-gray-700">
          {count} × {product.label} → {communityName} · funded by {funder === 'Other' ? funderOther || '?' : funder}
        </div>
        <button
          type="button"
          onClick={submit}
          disabled={busy || (funder === 'Other' && !funderOther) || count < 1}
          className="border-2 border-bauhaus-black bg-bauhaus-red px-3 py-1 font-mono text-xs font-black uppercase tracking-widest text-white hover:bg-bauhaus-black disabled:bg-gray-300 disabled:text-gray-500"
        >
          {busy ? 'Recording…' : `Record ${count} units`}
        </button>
      </div>

      {error && <div className="mt-2 text-xs text-bauhaus-red">{error}</div>}
    </div>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label className="block">
      <span className="block text-[10px] font-black uppercase tracking-widest text-gray-600 mb-1">{label}</span>
      {children}
    </label>
  );
}
