'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import type { SavedGrantRow } from './page';
import { KanbanBoard } from './kanban-board';
import { GrantActionsProvider } from '@/app/components/grant-card-actions';
import { GrantListWithPreview } from '@/app/components/grant-list-with-preview';

export function TrackerClient() {
  const [grants, setGrants] = useState<SavedGrantRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [viewMode, setViewMode] = useState<'personal' | 'org'>('personal');
  const [didInit, setDidInit] = useState(false);
  const router = useRouter();

  // Detect impersonation on client mount and auto-switch to org view
  useEffect(() => {
    const isImpersonating = document.cookie.split(';').some(c => c.trim().startsWith('cg_impersonate_org='));
    if (isImpersonating) {
      setViewMode('org');
    }
    setDidInit(true);
  }, []);

  useEffect(() => {
    if (!didInit) return;
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
  }, [router, viewMode, didInit]);

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
        <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <h1 className="text-2xl font-black text-bauhaus-black uppercase tracking-tight">
              Grant Tracker
            </h1>
            <p className="mt-1 text-sm font-medium text-bauhaus-muted">
              Detailed grant-stage movement still lives here. For the joined money, funder, partner, and need view, use the funding workspace.
            </p>
          </div>
          <a
            href="/funding-workspace"
            className="inline-flex px-4 py-3 border-2 border-bauhaus-black text-bauhaus-black text-[10px] font-black uppercase tracking-widest hover:bg-bauhaus-black hover:text-white transition-colors"
          >
            Open Funding Workspace
          </a>
        </div>
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
      <GrantActionsProvider>
        <GrantListWithPreview>
          <KanbanBoard initialGrants={grants} />
        </GrantListWithPreview>
      </GrantActionsProvider>
    </div>
  );
}
