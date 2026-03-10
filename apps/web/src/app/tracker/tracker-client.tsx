'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import type { SavedGrantRow } from './page';
import { KanbanBoard } from './kanban-board';

export function TrackerClient() {
  const [grants, setGrants] = useState<SavedGrantRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [viewMode, setViewMode] = useState<'personal' | 'org'>('personal');
  const router = useRouter();

  useEffect(() => {
    setLoading(true);
    fetch(`/api/tracker?view=${viewMode}`)
      .then((r) => {
        if (r.status === 401) {
          router.push('/login');
          return [];
        }
        return r.json();
      })
      .then((data) => {
        if (Array.isArray(data)) setGrants(data);
      })
      .catch(() => {})
      .finally(() => setLoading(false));
  }, [router, viewMode]);

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[40vh]">
        <div className="text-sm font-black text-bauhaus-muted uppercase tracking-widest">
          Loading tracker...
        </div>
      </div>
    );
  }

  return (
    <div>
      <div className="mb-4">
        <h1 className="text-2xl font-black text-bauhaus-black uppercase tracking-tight">
          Grant Tracker
        </h1>
      </div>
      <div className="flex gap-0 mb-6 border-4 border-bauhaus-black w-fit">
        <button
          onClick={() => setViewMode('personal')}
          className={`px-4 py-2 text-[11px] font-black uppercase tracking-widest transition-colors ${
            viewMode === 'personal'
              ? 'bg-bauhaus-black text-white'
              : 'bg-white text-bauhaus-black hover:bg-bauhaus-canvas'
          }`}
        >
          My Grants
        </button>
        <button
          onClick={() => setViewMode('org')}
          className={`px-4 py-2 text-[11px] font-black uppercase tracking-widest border-l-2 border-bauhaus-black/20 transition-colors ${
            viewMode === 'org'
              ? 'bg-bauhaus-black text-white'
              : 'bg-white text-bauhaus-black hover:bg-bauhaus-canvas'
          }`}
        >
          Team Grants
        </button>
      </div>
      <KanbanBoard initialGrants={grants} />
    </div>
  );
}
