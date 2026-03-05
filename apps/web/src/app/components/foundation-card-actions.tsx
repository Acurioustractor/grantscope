'use client';

import { createContext, useContext, useEffect, useState, useCallback, type ReactNode } from 'react';
import { createSupabaseBrowser } from '@/lib/supabase-browser';

interface SavedFoundationData {
  foundation_id: string;
  stars: number;
  stage: string;
  notes: string | null;
  last_contact_date: string | null;
}

interface FoundationActionsContextType {
  savedMap: Map<string, SavedFoundationData>;
  upsert: (foundationId: string, updates: Partial<{ stars: number; stage: string; notes: string; last_contact_date: string }>) => void;
  remove: (foundationId: string) => void;
  isLoggedIn: boolean;
}

const FoundationActionsContext = createContext<FoundationActionsContextType | null>(null);

export function useFoundationActions() {
  return useContext(FoundationActionsContext);
}

export function FoundationActionsProvider({ children }: { children: ReactNode }) {
  const [savedMap, setSavedMap] = useState<Map<string, SavedFoundationData>>(new Map());
  const [isLoggedIn, setIsLoggedIn] = useState(false);

  useEffect(() => {
    const supabase = createSupabaseBrowser();
    supabase.auth.getUser().then(({ data }) => {
      if (!data.user) return;
      setIsLoggedIn(true);
      fetch('/api/foundations/saved')
        .then((r) => (r.ok ? r.json() : []))
        .then((all: SavedFoundationData[]) => {
          const map = new Map<string, SavedFoundationData>();
          for (const s of all) map.set(s.foundation_id, s);
          setSavedMap(map);
        })
        .catch(() => {});
    });
  }, []);

  const upsert = useCallback(
    (foundationId: string, updates: Partial<{ stars: number; stage: string; notes: string; last_contact_date: string }>) => {
      setSavedMap((prev) => {
        const next = new Map(prev);
        const existing = next.get(foundationId);
        const updated: SavedFoundationData = {
          foundation_id: foundationId,
          stars: updates.stars ?? existing?.stars ?? 0,
          stage: updates.stage ?? existing?.stage ?? 'discovered',
          notes: updates.notes ?? existing?.notes ?? null,
          last_contact_date: updates.last_contact_date ?? existing?.last_contact_date ?? null,
        };
        next.set(foundationId, updated);
        return next;
      });
      // Fire-and-forget API call
      const existing = savedMap.get(foundationId);
      const payload = {
        stars: updates.stars ?? existing?.stars ?? 0,
        stage: updates.stage ?? existing?.stage ?? 'discovered',
        ...(updates.notes !== undefined && { notes: updates.notes }),
        ...(updates.last_contact_date !== undefined && { last_contact_date: updates.last_contact_date }),
      };
      fetch(`/api/foundations/saved/${foundationId}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      }).catch(() => {});
    },
    [savedMap]
  );

  const remove = useCallback(
    (foundationId: string) => {
      setSavedMap((prev) => {
        const next = new Map(prev);
        next.delete(foundationId);
        return next;
      });
      fetch(`/api/foundations/saved/${foundationId}`, { method: 'DELETE' }).catch(() => {});
    },
    []
  );

  return (
    <FoundationActionsContext.Provider value={{ savedMap, upsert, remove, isLoggedIn }}>
      {children}
    </FoundationActionsContext.Provider>
  );
}

export function FoundationCardActions({ foundationId }: { foundationId: string }) {
  const ctx = useContext(FoundationActionsContext);
  if (!ctx || !ctx.isLoggedIn) return null;

  const saved = ctx.savedMap.get(foundationId);
  const stars = saved?.stars ?? 0;

  return (
    <div
      className="flex items-center gap-0 z-10"
      onClick={(e) => e.preventDefault()}
    >
      {[1, 2, 3].map((star) => (
        <button
          key={star}
          onClick={(e) => {
            e.stopPropagation();
            ctx.upsert(foundationId, { stars: star === stars ? 0 : star });
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
  );
}
