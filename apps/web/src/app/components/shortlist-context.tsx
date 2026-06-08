'use client';

/**
 * Tender-pack shortlist — the spine of the buyer flow.
 *
 * A buyer collects suppliers while searching (/suppliers) and assessing
 * profiles (/social-enterprises/[id]), then carries that exact set into the
 * Tender Intelligence Pack (/procurement/tender-pack) instead of re-discovering
 * by geography. State lives in localStorage so a logged-out buyer keeps their
 * shortlist across pages without an account.
 */

import { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';

export interface ShortlistItem {
  se_id: string;
  name: string;
  abn: string | null;
  state: string | null;
}

interface ShortlistContextValue {
  items: ShortlistItem[];
  count: number;
  hydrated: boolean;
  has: (seId: string) => boolean;
  add: (item: ShortlistItem) => void;
  remove: (seId: string) => void;
  toggle: (item: ShortlistItem) => void;
  clear: () => void;
}

const STORAGE_KEY = 'cg_tender_shortlist';

const ShortlistContext = createContext<ShortlistContextValue | null>(null);

export function ShortlistProvider({ children }: { children: React.ReactNode }) {
  const [items, setItems] = useState<ShortlistItem[]>([]);
  const [hydrated, setHydrated] = useState(false);

  // Hydrate from localStorage on mount (client only — avoids SSR mismatch).
  useEffect(() => {
    try {
      const raw = window.localStorage.getItem(STORAGE_KEY);
      if (raw) {
        const parsed = JSON.parse(raw) as ShortlistItem[];
        if (Array.isArray(parsed)) {
          setItems(parsed.filter((i) => i && typeof i.se_id === 'string'));
        }
      }
    } catch {
      // corrupt/blocked storage — start empty, don't crash the page
    }
    setHydrated(true);
  }, []);

  // Persist after hydration (skip the initial empty render so we don't clobber storage).
  useEffect(() => {
    if (!hydrated) return;
    try {
      window.localStorage.setItem(STORAGE_KEY, JSON.stringify(items));
    } catch {
      // storage full/blocked — in-memory shortlist still works for this session
    }
  }, [items, hydrated]);

  // Keep multiple open tabs in sync.
  useEffect(() => {
    function onStorage(e: StorageEvent) {
      if (e.key !== STORAGE_KEY) return;
      try {
        const parsed = e.newValue ? (JSON.parse(e.newValue) as ShortlistItem[]) : [];
        setItems(Array.isArray(parsed) ? parsed : []);
      } catch {
        /* ignore */
      }
    }
    window.addEventListener('storage', onStorage);
    return () => window.removeEventListener('storage', onStorage);
  }, []);

  const has = useCallback((seId: string) => items.some((i) => i.se_id === seId), [items]);

  const add = useCallback((item: ShortlistItem) => {
    setItems((prev) => (prev.some((i) => i.se_id === item.se_id) ? prev : [...prev, item]));
  }, []);

  const remove = useCallback((seId: string) => {
    setItems((prev) => prev.filter((i) => i.se_id !== seId));
  }, []);

  const toggle = useCallback((item: ShortlistItem) => {
    setItems((prev) =>
      prev.some((i) => i.se_id === item.se_id)
        ? prev.filter((i) => i.se_id !== item.se_id)
        : [...prev, item]
    );
  }, []);

  const clear = useCallback(() => setItems([]), []);

  const value = useMemo<ShortlistContextValue>(
    () => ({ items, count: items.length, hydrated, has, add, remove, toggle, clear }),
    [items, hydrated, has, add, remove, toggle, clear]
  );

  return <ShortlistContext.Provider value={value}>{children}</ShortlistContext.Provider>;
}

export function useShortlist(): ShortlistContextValue {
  const ctx = useContext(ShortlistContext);
  if (!ctx) {
    throw new Error('useShortlist must be used within a ShortlistProvider');
  }
  return ctx;
}
