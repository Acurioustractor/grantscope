'use client';

import { createContext, useContext, useEffect, useState, useCallback, type ReactNode } from 'react';
import { createSupabaseBrowser } from '@/lib/supabase-browser';

interface SavedGrantData {
  grant_id: string;
  stars: number;
  color: string | null;
  stage: string;
}

interface GrantActionsContextType {
  savedMap: Map<string, SavedGrantData>;
  upsert: (grantId: string, updates: Partial<{ stars: number; color: string }>) => void;
  isLoggedIn: boolean;
}

const GrantActionsContext = createContext<GrantActionsContextType | null>(null);

export function GrantActionsProvider({ children }: { children: ReactNode }) {
  const [savedMap, setSavedMap] = useState<Map<string, SavedGrantData>>(new Map());
  const [isLoggedIn, setIsLoggedIn] = useState(false);

  useEffect(() => {
    const supabase = createSupabaseBrowser();
    supabase.auth.getUser().then(({ data }) => {
      if (!data.user) return;
      setIsLoggedIn(true);
      fetch('/api/tracker')
        .then((r) => (r.ok ? r.json() : []))
        .then((all: SavedGrantData[]) => {
          const map = new Map<string, SavedGrantData>();
          for (const s of all) map.set(s.grant_id, s);
          setSavedMap(map);
        })
        .catch(() => {});
    });
  }, []);

  const upsert = useCallback(
    (grantId: string, updates: Partial<{ stars: number; color: string }>) => {
      setSavedMap((prev) => {
        const next = new Map(prev);
        const existing = next.get(grantId);
        const updated: SavedGrantData = {
          grant_id: grantId,
          stars: updates.stars ?? existing?.stars ?? 0,
          color: updates.color ?? existing?.color ?? 'none',
          stage: existing?.stage ?? 'discovered',
        };
        next.set(grantId, updated);
        return next;
      });
      // Fire-and-forget API call
      const existing = savedMap.get(grantId);
      const payload = {
        stars: updates.stars ?? existing?.stars ?? 0,
        color: updates.color ?? existing?.color ?? 'none',
        stage: existing?.stage ?? 'discovered',
      };
      fetch(`/api/tracker/${grantId}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      }).catch(() => {});
    },
    [savedMap]
  );

  return (
    <GrantActionsContext.Provider value={{ savedMap, upsert, isLoggedIn }}>
      {children}
    </GrantActionsContext.Provider>
  );
}

const COLOR_MAP: Record<string, { hex: string; project: string }> = {
  red: { hex: '#D02020', project: 'Empathy Ledger' },
  blue: { hex: '#1040C0', project: 'JusticeHub' },
  green: { hex: '#059669', project: 'Goods on Country' },
  yellow: { hex: '#F0C020', project: 'The Harvest' },
  orange: { hex: '#EA580C', project: 'ACT Farm' },
  purple: { hex: '#7C3AED', project: 'Art' },
};

export function GrantCardActions({ grantId }: { grantId: string }) {
  const ctx = useContext(GrantActionsContext);
  if (!ctx || !ctx.isLoggedIn) return null;

  const saved = ctx.savedMap.get(grantId);
  const stars = saved?.stars ?? 0;
  const color = saved?.color ?? null;

  return (
    <div
      className="flex items-center gap-1.5 z-10"
      onClick={(e) => e.preventDefault()}
    >
      {/* Stars */}
      <div className="flex items-center gap-0">
        {[1, 2, 3].map((star) => (
          <button
            key={star}
            onClick={(e) => {
              e.stopPropagation();
              ctx.upsert(grantId, { stars: star === stars ? 0 : star });
            }}
            className="p-0.5 hover:scale-110 transition-transform"
            title={star === stars ? 'Remove rating' : `Rate ${star}`}
          >
            <svg
              className="w-4 h-4"
              viewBox="0 0 20 20"
              fill={star <= stars ? '#F0C020' : 'none'}
              stroke={star <= stars ? '#F0C020' : '#999999'}
              strokeWidth={2}
            >
              <path d="M10 1l2.39 4.84 5.34.78-3.87 3.77.91 5.33L10 13.27l-4.77 2.51.91-5.33L2.27 6.62l5.34-.78L10 1z" />
            </svg>
          </button>
        ))}
      </div>
      {/* Color dots */}
      <div className="flex items-center gap-0.5 ml-1">
        {Object.entries(COLOR_MAP).map(([key, { hex, project }]) => (
          <button
            key={key}
            onClick={(e) => {
              e.stopPropagation();
              ctx.upsert(grantId, { color: key === color ? 'none' : key });
            }}
            title={project}
            className="relative w-3.5 h-3.5 border-2 transition-transform hover:scale-110"
            style={{
              backgroundColor: hex,
              borderColor: key === color ? '#121212' : 'transparent',
            }}
          >
            {key === color && (
              <svg className="absolute inset-0 m-auto w-2 h-2" viewBox="0 0 12 12" fill="white">
                <path d="M10 3L4.5 8.5 2 6" stroke="white" strokeWidth={2} fill="none" />
              </svg>
            )}
          </button>
        ))}
      </div>
    </div>
  );
}
