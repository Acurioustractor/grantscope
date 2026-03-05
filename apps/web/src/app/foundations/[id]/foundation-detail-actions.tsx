'use client';

import { useState, useRef, useEffect } from 'react';
import { useFoundationActions } from '@/app/components/foundation-card-actions';

const STAGES = [
  { value: 'discovered', label: 'Discovered', desc: 'Found this foundation' },
  { value: 'researching', label: 'Researching', desc: 'Reading their profile & programs' },
  { value: 'connected', label: 'Connected', desc: 'Made first contact' },
  { value: 'active_relationship', label: 'Active Relationship', desc: 'Ongoing partnership' },
];

const STAGE_COLORS: Record<string, string> = {
  discovered: 'border-bauhaus-black/20 bg-bauhaus-canvas text-bauhaus-muted',
  researching: 'border-bauhaus-blue bg-link-light text-bauhaus-blue',
  connected: 'border-bauhaus-yellow bg-warning-light text-bauhaus-black',
  active_relationship: 'border-money bg-money-light text-money',
};

export function FoundationDetailActions({ foundationId }: { foundationId: string }) {
  const ctx = useFoundationActions();
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const saved = ctx?.savedMap.get(foundationId);
  const [localNotes, setLocalNotes] = useState(saved?.notes ?? '');
  const [notesInitialized, setNotesInitialized] = useState(false);

  // Sync notes from context once data loads
  useEffect(() => {
    if (!notesInitialized && saved?.notes) {
      setLocalNotes(saved.notes);
      setNotesInitialized(true);
    }
  }, [saved?.notes, notesInitialized]);

  if (!ctx || !ctx.isLoggedIn) return null;

  const stage = saved?.stage ?? 'discovered';
  const isSaved = !!saved;

  function handleSave() {
    ctx!.upsert(foundationId, { stars: 1 });
  }

  function handleNotesChange(value: string) {
    setLocalNotes(value);
    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => {
      ctx!.upsert(foundationId, { notes: value });
    }, 800);
  }

  // Not saved yet — show a prominent save CTA
  if (!isSaved) {
    return (
      <div className="border-4 border-bauhaus-red bg-white p-4">
        <button
          onClick={handleSave}
          className="w-full py-3 bg-bauhaus-red text-white text-xs font-black uppercase tracking-widest hover:bg-bauhaus-black transition-colors cursor-pointer flex items-center justify-center gap-2"
        >
          <svg className="w-4 h-4" viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth={2}>
            <path d="M10 1l2.39 4.84 5.34.78-3.87 3.77.91 5.33L10 13.27l-4.77 2.51.91-5.33L2.27 6.62l5.34-.78L10 1z" />
          </svg>
          Save Foundation
        </button>
        <p className="text-[11px] text-bauhaus-muted font-medium mt-2 text-center">
          Track this foundation, add notes, and manage the relationship
        </p>
      </div>
    );
  }

  // Saved — show full management panel
  const stageColor = STAGE_COLORS[stage] || STAGE_COLORS.discovered;

  return (
    <div className="border-4 border-money bg-white">
      {/* Header */}
      <div className="px-4 py-3 bg-money-light border-b-2 border-money/30 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <svg className="w-4 h-4 text-money" viewBox="0 0 20 20" fill="currentColor">
            <path d="M10 1l2.39 4.84 5.34.78-3.87 3.77.91 5.33L10 13.27l-4.77 2.51.91-5.33L2.27 6.62l5.34-.78L10 1z" />
          </svg>
          <span className="text-xs font-black text-money uppercase tracking-widest">Saved</span>
        </div>
        <span className={`text-[10px] font-black px-2 py-0.5 uppercase tracking-wider border-2 ${stageColor}`}>
          {STAGES.find(s => s.value === stage)?.label}
        </span>
      </div>

      <div className="p-4 space-y-3">
        {/* Stars */}
        <div>
          <label className="text-[11px] font-black text-bauhaus-muted uppercase tracking-wider block mb-1">
            Priority
          </label>
          <div className="flex items-center gap-0.5">
            {[1, 2, 3].map((star) => (
              <button
                key={star}
                onClick={() => ctx.upsert(foundationId, { stars: star === saved.stars ? 0 : star })}
                className="p-0.5 hover:scale-110 transition-transform"
                title={star === saved.stars ? 'Remove rating' : `Rate ${star}`}
              >
                <svg
                  className="w-5 h-5"
                  viewBox="0 0 20 20"
                  fill={star <= saved.stars ? '#F0C020' : 'none'}
                  stroke={star <= saved.stars ? '#F0C020' : '#CCCCCC'}
                  strokeWidth={2}
                >
                  <path d="M10 1l2.39 4.84 5.34.78-3.87 3.77.91 5.33L10 13.27l-4.77 2.51.91-5.33L2.27 6.62l5.34-.78L10 1z" />
                </svg>
              </button>
            ))}
          </div>
        </div>

        {/* Stage */}
        <div>
          <label className="text-[11px] font-black text-bauhaus-muted uppercase tracking-wider block mb-1">
            Relationship Stage
          </label>
          <select
            value={stage}
            onChange={(e) => ctx.upsert(foundationId, { stage: e.target.value })}
            className="w-full px-3 py-2 text-sm font-bold border-2 border-bauhaus-black bg-white focus:outline-none focus:bg-bauhaus-yellow"
          >
            {STAGES.map((s) => (
              <option key={s.value} value={s.value}>{s.label} — {s.desc}</option>
            ))}
          </select>
        </div>

        {/* Notes */}
        <div>
          <label className="text-[11px] font-black text-bauhaus-muted uppercase tracking-wider block mb-1">
            Notes & Ideas
          </label>
          <textarea
            value={localNotes}
            onChange={(e) => handleNotesChange(e.target.value)}
            placeholder="Key contacts, conversation history, grant ideas, follow-up actions..."
            rows={5}
            className="w-full px-3 py-2 text-sm font-medium border-2 border-bauhaus-black bg-white focus:outline-none focus:bg-bauhaus-yellow resize-y"
          />
        </div>

        {/* Actions */}
        <div className="flex items-center justify-between pt-1">
          <a
            href="/foundations/tracker"
            className="text-[11px] font-black text-bauhaus-blue uppercase tracking-wider hover:text-bauhaus-red"
          >
            View All Saved &rarr;
          </a>
          <button
            onClick={() => ctx.remove(foundationId)}
            className="text-[11px] font-black text-bauhaus-muted uppercase tracking-wider hover:text-bauhaus-red transition-colors"
          >
            Remove
          </button>
        </div>
      </div>
    </div>
  );
}
