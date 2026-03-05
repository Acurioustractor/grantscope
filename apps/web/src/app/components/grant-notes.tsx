'use client';

import { useEffect, useState, useRef, useCallback } from 'react';
import { createSupabaseBrowser } from '@/lib/supabase-browser';

export function GrantNotes({ grantId }: { grantId: string }) {
  const [user, setUser] = useState<{ id: string } | null>(null);
  const [notes, setNotes] = useState('');
  const [loaded, setLoaded] = useState(false);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const timeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    const supabase = createSupabaseBrowser();
    supabase.auth.getUser().then(({ data }) => {
      setUser(data.user);
      if (!data.user) return;
      fetch('/api/tracker')
        .then((r) => (r.ok ? r.json() : []))
        .then((all: Array<{ grant_id: string; notes: string | null }>) => {
          const match = all.find((s) => s.grant_id === grantId);
          if (match?.notes) setNotes(match.notes);
        })
        .catch(() => {})
        .finally(() => setLoaded(true));
    });
  }, [grantId]);

  const save = useCallback(
    async (text: string) => {
      setSaving(true);
      setSaved(false);
      await fetch(`/api/tracker/${grantId}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ notes: text }),
      }).catch(() => {});
      setSaving(false);
      setSaved(true);
      setTimeout(() => setSaved(false), 2000);
    },
    [grantId]
  );

  const handleChange = useCallback(
    (text: string) => {
      setNotes(text);
      setSaved(false);
      if (timeoutRef.current) clearTimeout(timeoutRef.current);
      timeoutRef.current = setTimeout(() => save(text), 500);
    },
    [save]
  );

  if (!loaded || !user) return null;

  return (
    <div className="mb-6">
      <div className="flex items-center gap-2 mb-1">
        <span className="text-xs font-black text-bauhaus-muted uppercase tracking-widest">Notes</span>
        {saving && <span className="text-[10px] font-bold text-bauhaus-muted animate-pulse">Saving...</span>}
        {saved && <span className="text-[10px] font-bold text-money">Saved</span>}
      </div>
      <textarea
        value={notes}
        onChange={(e) => handleChange(e.target.value)}
        placeholder="Add a note..."
        rows={3}
        className="w-full px-3 py-2 border-4 border-bauhaus-black/20 bg-white text-sm font-medium text-bauhaus-black focus:border-bauhaus-black focus:outline-none placeholder:text-bauhaus-muted/40 resize-y"
      />
    </div>
  );
}
