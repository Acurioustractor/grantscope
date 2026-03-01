'use client';

import { useEffect, useState, useCallback } from 'react';
import { createSupabaseBrowser } from '@/lib/supabase-browser';
import { StarRating } from './star-rating';
import { ColorLabel } from './color-label';

interface SavedGrant {
  stars: number;
  color: string | null;
  stage: string;
}

export function GrantActions({ grantId }: { grantId: string }) {
  const [user, setUser] = useState<{ id: string } | null>(null);
  const [saved, setSaved] = useState<SavedGrant | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const supabase = createSupabaseBrowser();
    supabase.auth.getUser().then(({ data }) => {
      setUser(data.user);
      if (!data.user) {
        setLoading(false);
        return;
      }
      fetch('/api/tracker')
        .then((r) => (r.ok ? r.json() : []))
        .then((all: Array<{ grant_id: string; stars: number; color: string | null; stage: string }>) => {
          const match = all.find((s) => s.grant_id === grantId);
          if (match) setSaved({ stars: match.stars, color: match.color, stage: match.stage });
        })
        .catch(() => {})
        .finally(() => setLoading(false));
    });
  }, [grantId]);

  const upsert = useCallback(
    async (updates: Partial<SavedGrant>) => {
      const newSaved = {
        stars: saved?.stars ?? 0,
        color: saved?.color ?? 'none',
        stage: saved?.stage ?? 'discovered',
        ...updates,
      };
      setSaved(newSaved);
      await fetch(`/api/tracker/${grantId}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(newSaved),
      });
    },
    [grantId, saved]
  );

  if (loading || !user) return null;

  return (
    <div className="flex items-center gap-4 py-2">
      <StarRating value={saved?.stars ?? 0} onChange={(stars) => upsert({ stars })} />
      <div className="w-px h-5 bg-bauhaus-black/20" />
      <ColorLabel value={saved?.color ?? null} onChange={(color) => upsert({ color })} />
      {saved && (
        <>
          <div className="w-px h-5 bg-bauhaus-black/20" />
          <span className="text-xs font-black uppercase tracking-widest text-bauhaus-muted">
            {saved.stage}
          </span>
        </>
      )}
    </div>
  );
}
