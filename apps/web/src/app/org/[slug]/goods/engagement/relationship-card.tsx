'use client';

import { useState, useTransition } from 'react';
import {
  warmthBand, nextBestAction, bandFill, bandPill, relDays, money,
  REL_TYPE_LABEL, STAGE_LABEL, STAGE_ORDER, REL_TRACK,
  type GoodsRelationship, type GoodsStage,
} from '@/lib/services/goods-engagement-shared';
import { updateRelationship } from './actions';

/** Tracks where a dollar ask is meaningful (grants + investment). */
const ASK_TRACKS = new Set(['grant', 'investment']);

export function RelationshipCard({ r, slug }: { r: GoodsRelationship; slug: string }) {
  const [open, setOpen] = useState(false);
  const [pending, start] = useTransition();
  const [err, setErr] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);
  const [stage, setStage] = useState<GoodsStage>(r.stage);
  const [override, setOverride] = useState<string>(r.warmth_override?.toString() ?? '');
  const [action, setAction] = useState<string>(r.next_action ?? '');
  const [askAmount, setAskAmount] = useState<string>(r.ask_amount_aud?.toString() ?? '');
  const [askPurpose, setAskPurpose] = useState<string>(r.ask_purpose ?? '');

  const band = warmthBand(r.warmth_display);
  const overridden = r.warmth_override != null;
  const showAsk = ASK_TRACKS.has(REL_TRACK[r.relationship_type]);

  function save() {
    setErr(null);
    setSaved(false);
    start(async () => {
      const amountChanged = askAmount.trim() !== (r.ask_amount_aud?.toString() ?? '');
      const purposeChanged = (askPurpose.trim() || '') !== (r.ask_purpose ?? '');
      const res = await updateRelationship({
        id: r.id,
        slug,
        stage,
        warmth_override: override.trim() === '' ? null : Number(override),
        next_action: action,
        // Only send ask fields when they actually changed — the columns may not
        // be migrated yet, so an untouched edit must never reference them.
        ...(showAsk && amountChanged
          ? { ask_amount_aud: askAmount.trim() === '' ? null : Number(askAmount) }
          : {}),
        ...(showAsk && purposeChanged ? { ask_purpose: askPurpose.trim() || null } : {}),
      });
      if (!res.ok) { setErr(res.error ?? 'Save failed'); return; }
      setSaved(true);
      setTimeout(() => { setSaved(false); setOpen(false); }, 900);
    });
  }

  return (
    <div className="border-b-2 border-bauhaus-black/10 last:border-b-0">
      <div className="grid grid-cols-12 items-center gap-3 px-3 py-3">
        {/* name + type */}
        <div className="col-span-12 md:col-span-4">
          <div className="font-black text-bauhaus-black">{r.display_name}</div>
          <div className="mt-0.5 flex items-center gap-2">
            <span className="text-[10px] font-black uppercase tracking-widest text-bauhaus-muted">{REL_TYPE_LABEL[r.relationship_type]}</span>
            <span className="text-[10px] font-bold uppercase tracking-wide text-bauhaus-black/60">· {STAGE_LABEL[r.stage]}</span>
          </div>
        </div>
        {/* warmth */}
        <div className="col-span-6 md:col-span-3">
          <div className="flex items-center gap-2">
            <div className="relative h-3 flex-1 bg-bauhaus-canvas">
              <div className={`absolute inset-y-0 left-0 ${bandFill(band)}`} style={{ width: `${Math.max(r.warmth_display, 3)}%` }} />
            </div>
            <span className={`min-w-[2.2rem] px-1.5 py-0.5 text-center text-[11px] font-black ${bandPill(band)}`}>{r.warmth_display}</span>
          </div>
          <div className="mt-0.5 text-[10px] font-bold uppercase tracking-widest text-bauhaus-muted">
            {band}{overridden ? ' · manual' : ''} · {relDays(r.last_touch_at)}
          </div>
        </div>
        {/* next action */}
        <div className="col-span-6 md:col-span-4 text-[12px] text-bauhaus-black">
          <span className="text-bauhaus-red font-black">→ </span>{nextBestAction(r)}
          {r.warm_intro_path && <div className="mt-0.5 text-[10px] text-bauhaus-blue">↳ {r.warm_intro_path}</div>}
        </div>
        {/* received + edit */}
        <div className="col-span-12 md:col-span-1 flex items-center justify-end gap-2">
          <span className="text-[12px] font-black text-bauhaus-blue">
            {r.total_received_aud > 0 ? money(r.total_received_aud) : <span className="text-bauhaus-muted">—</span>}
          </span>
          <button
            onClick={() => setOpen((o) => !o)}
            className="border-2 border-bauhaus-black px-1.5 py-0.5 text-[9px] font-black uppercase tracking-widest hover:bg-bauhaus-black hover:text-white"
          >
            {open ? '×' : 'Edit'}
          </button>
        </div>
      </div>

      {open && (
        <div className="border-t-2 border-bauhaus-black/10 bg-bauhaus-canvas px-3 py-3">
          <div className="grid grid-cols-1 gap-3 md:grid-cols-3">
            <label className="block">
              <span className="text-[10px] font-black uppercase tracking-widest text-bauhaus-muted">Stage</span>
              <select
                value={stage}
                onChange={(e) => setStage(e.target.value as GoodsStage)}
                className="mt-1 w-full border-2 border-bauhaus-black bg-white px-2 py-1 text-sm"
              >
                {STAGE_ORDER.map((s) => <option key={s} value={s}>{STAGE_LABEL[s]}</option>)}
              </select>
            </label>
            <label className="block">
              <span className="text-[10px] font-black uppercase tracking-widest text-bauhaus-muted">
                Warmth override <span className="text-bauhaus-black/40">(blank = computed {r.warmth_computed})</span>
              </span>
              <input
                type="number" min={0} max={100} value={override}
                onChange={(e) => setOverride(e.target.value)}
                placeholder={`${r.warmth_computed}`}
                className="mt-1 w-full border-2 border-bauhaus-black bg-white px-2 py-1 text-sm"
              />
            </label>
            <label className="block">
              <span className="text-[10px] font-black uppercase tracking-widest text-bauhaus-muted">Next action</span>
              <input
                type="text" value={action}
                onChange={(e) => setAction(e.target.value)}
                placeholder="What to do to get closer"
                className="mt-1 w-full border-2 border-bauhaus-black bg-white px-2 py-1 text-sm"
              />
            </label>
          </div>
          {showAsk && (
            <div className="mt-3 grid grid-cols-1 gap-3 md:grid-cols-3">
              <label className="block">
                <span className="text-[10px] font-black uppercase tracking-widest text-bauhaus-muted">Ask amount (AUD)</span>
                <input
                  type="number" min={0} value={askAmount}
                  onChange={(e) => setAskAmount(e.target.value)}
                  placeholder="250000"
                  className="mt-1 w-full border-2 border-bauhaus-black bg-white px-2 py-1 text-sm"
                />
              </label>
              <label className="block md:col-span-2">
                <span className="text-[10px] font-black uppercase tracking-widest text-bauhaus-muted">Ask purpose</span>
                <input
                  type="text" value={askPurpose}
                  onChange={(e) => setAskPurpose(e.target.value)}
                  placeholder="Beds for the next on-country build"
                  className="mt-1 w-full border-2 border-bauhaus-black bg-white px-2 py-1 text-sm"
                />
              </label>
            </div>
          )}
          <div className="mt-3 flex items-center gap-3">
            <button
              onClick={save} disabled={pending}
              className="border-2 border-bauhaus-black bg-bauhaus-black px-3 py-1 text-[11px] font-black uppercase tracking-widest text-white disabled:opacity-50"
            >
              {pending ? 'Saving…' : 'Save'}
            </button>
            {saved && (
              <span className="border-2 border-bauhaus-blue bg-bauhaus-blue px-2 py-0.5 text-[10px] font-black uppercase tracking-widest text-white">Saved ✓</span>
            )}
            <button
              onClick={() => { setOpen(false); setErr(null); setStage(r.stage); setOverride(r.warmth_override?.toString() ?? ''); setAction(r.next_action ?? ''); setAskAmount(r.ask_amount_aud?.toString() ?? ''); setAskPurpose(r.ask_purpose ?? ''); }}
              className="text-[11px] font-bold uppercase tracking-widest text-bauhaus-muted hover:text-bauhaus-black"
            >
              Cancel
            </button>
            {override.trim() !== '' && (
              <button
                onClick={() => setOverride('')}
                className="text-[11px] font-bold uppercase tracking-widest text-bauhaus-blue hover:underline"
              >
                Clear override
              </button>
            )}
            {err && <span className="text-[11px] font-bold text-bauhaus-red">{err}</span>}
          </div>
        </div>
      )}
    </div>
  );
}
