'use client';

import { useState, useTransition } from 'react';
import {
  STAGE_ORDER, STAGE_LABEL, TYPES, REL_TYPE_LABEL, REL_TRACK,
  type GoodsStage, type GoodsRelType,
} from '@/lib/services/goods-engagement-shared';
import { addRelationship } from './actions';

/** Tracks where a dollar ask is meaningful (grants + investment). */
const ASK_TRACKS = new Set(['grant', 'investment']);
const ADDABLE_TYPES = TYPES.filter((t): t is GoodsRelType => t !== 'all');

export function AddPartnerForm({ slug }: { slug: string }) {
  const [open, setOpen] = useState(false);
  const [pending, start] = useTransition();
  const [err, setErr] = useState<string | null>(null);
  const [name, setName] = useState('');
  const [relType, setRelType] = useState<GoodsRelType>('production_partner');
  const [stage, setStage] = useState<GoodsStage>('identified');
  const [align, setAlign] = useState('');
  const [notes, setNotes] = useState('');
  const [askAmount, setAskAmount] = useState('');
  const [askPurpose, setAskPurpose] = useState('');

  const showAsk = ASK_TRACKS.has(REL_TRACK[relType]);

  function submit() {
    setErr(null);
    start(async () => {
      const res = await addRelationship({
        slug,
        relationship_type: relType,
        display_name: name,
        stage,
        alignment_score: align.trim() === '' ? null : Number(align),
        notes,
        ask_amount_aud: showAsk && askAmount.trim() !== '' ? Number(askAmount) : null,
        ask_purpose: showAsk && askPurpose.trim() !== '' ? askPurpose : null,
      });
      if (!res.ok) { setErr(res.error ?? 'Add failed'); return; }
      setName(''); setAlign(''); setNotes(''); setAskAmount(''); setAskPurpose('');
      setStage('identified'); setRelType('production_partner'); setOpen(false);
    });
  }

  if (!open) {
    return (
      <button
        onClick={() => setOpen(true)}
        className="border-2 border-bauhaus-black bg-white px-2.5 py-1 text-[11px] font-black uppercase tracking-widest text-bauhaus-black hover:bg-bauhaus-black hover:text-white"
      >
        + Add relationship
      </button>
    );
  }

  return (
    <div className="border-4 border-bauhaus-black bg-white p-3">
      <div className="mb-2 text-[10px] font-black uppercase tracking-widest text-bauhaus-muted">Add relationship</div>
      <div className="grid grid-cols-1 gap-3 md:grid-cols-4">
        <label className="block md:col-span-2">
          <span className="text-[10px] font-black uppercase tracking-widest text-bauhaus-muted">Name</span>
          <input
            value={name} onChange={(e) => setName(e.target.value)}
            placeholder="On-country manufacturing partner"
            className="mt-1 w-full border-2 border-bauhaus-black bg-white px-2 py-1 text-sm"
          />
        </label>
        <label className="block">
          <span className="text-[10px] font-black uppercase tracking-widest text-bauhaus-muted">Type</span>
          <select
            value={relType} onChange={(e) => setRelType(e.target.value as GoodsRelType)}
            className="mt-1 w-full border-2 border-bauhaus-black bg-white px-2 py-1 text-sm"
          >
            {ADDABLE_TYPES.map((t) => <option key={t} value={t}>{REL_TYPE_LABEL[t]}</option>)}
          </select>
        </label>
        <label className="block">
          <span className="text-[10px] font-black uppercase tracking-widest text-bauhaus-muted">Stage</span>
          <select
            value={stage} onChange={(e) => setStage(e.target.value as GoodsStage)}
            className="mt-1 w-full border-2 border-bauhaus-black bg-white px-2 py-1 text-sm"
          >
            {STAGE_ORDER.map((s) => <option key={s} value={s}>{STAGE_LABEL[s]}</option>)}
          </select>
        </label>
      </div>
      <div className="mt-3 grid grid-cols-1 gap-3 md:grid-cols-4">
        <label className="block">
          <span className="text-[10px] font-black uppercase tracking-widest text-bauhaus-muted">Alignment 0-100</span>
          <input
            type="number" min={0} max={100} value={align} onChange={(e) => setAlign(e.target.value)}
            className="mt-1 w-full border-2 border-bauhaus-black bg-white px-2 py-1 text-sm"
          />
        </label>
        {showAsk && (
          <>
            <label className="block">
              <span className="text-[10px] font-black uppercase tracking-widest text-bauhaus-muted">Ask amount (AUD)</span>
              <input
                type="number" min={0} value={askAmount} onChange={(e) => setAskAmount(e.target.value)}
                placeholder="250000"
                className="mt-1 w-full border-2 border-bauhaus-black bg-white px-2 py-1 text-sm"
              />
            </label>
            <label className="block md:col-span-2">
              <span className="text-[10px] font-black uppercase tracking-widest text-bauhaus-muted">Ask purpose</span>
              <input
                value={askPurpose} onChange={(e) => setAskPurpose(e.target.value)}
                placeholder="Beds for the next on-country build"
                className="mt-1 w-full border-2 border-bauhaus-black bg-white px-2 py-1 text-sm"
              />
            </label>
          </>
        )}
      </div>
      <label className="mt-3 block">
        <span className="text-[10px] font-black uppercase tracking-widest text-bauhaus-muted">Notes</span>
        <input
          value={notes} onChange={(e) => setNotes(e.target.value)}
          placeholder="Capability, location (Country), capacity to make beds"
          className="mt-1 w-full border-2 border-bauhaus-black bg-white px-2 py-1 text-sm"
        />
      </label>
      <div className="mt-3 flex items-center gap-3">
        <button
          onClick={submit} disabled={pending}
          className="border-2 border-bauhaus-black bg-bauhaus-black px-3 py-1 text-[11px] font-black uppercase tracking-widest text-white disabled:opacity-50"
        >
          {pending ? 'Adding…' : 'Add relationship'}
        </button>
        <button
          onClick={() => { setOpen(false); setErr(null); }}
          className="text-[11px] font-bold uppercase tracking-widest text-bauhaus-muted hover:text-bauhaus-black"
        >
          Cancel
        </button>
        {err && <span className="text-[11px] font-bold text-bauhaus-red">{err}</span>}
      </div>
    </div>
  );
}
