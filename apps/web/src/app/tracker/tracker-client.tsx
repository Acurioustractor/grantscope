'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';
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
  const searchParams = useSearchParams();

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

  const onboardingMode = searchParams.get('onboarding') === '1' && viewMode === 'personal';
  const completedMode = searchParams.get('completed') === '1' && viewMode === 'personal';
  const hasProgressedGrant = grants.some((grant) => grant.stage !== 'discovered');
  const showGuidedOnboarding = onboardingMode && !hasProgressedGrant;
  const discoveredCount = grants.filter((grant) => grant.stage === 'discovered').length;
  const researchingCount = grants.filter((grant) => grant.stage === 'researching').length;
  const activeCount = grants.filter((grant) =>
    ['pursuing', 'submitted', 'negotiating', 'approved'].includes(grant.stage)
  ).length;

  useEffect(() => {
    if (onboardingMode && hasProgressedGrant) {
      router.replace('/tracker?completed=1');
    }
  }, [onboardingMode, hasProgressedGrant, router]);

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
            {showGuidedOnboarding && (
              <div className="text-[10px] font-black uppercase tracking-[0.3em] text-bauhaus-red">
                Step 3 of 3
              </div>
            )}
            {completedMode && (
              <div className="text-[10px] font-black uppercase tracking-[0.3em] text-green-700">
                Setup Complete
              </div>
            )}
            <h1 className="text-2xl font-black text-bauhaus-black uppercase tracking-tight">
              {showGuidedOnboarding ? 'Build Your Grant Pipeline' : completedMode ? 'Your Tracker Is Live' : 'Grant Tracker'}
            </h1>
            <p className="mt-1 text-sm font-medium text-bauhaus-muted">
              {showGuidedOnboarding
                ? 'Your shortlisted grants are here. Move the strongest options out of Discovered and use the board as your working queue.'
                : completedMode
                ? 'You have moved at least one grant into active pipeline work. From here, use the tracker as your working system and the home dashboard as your daily summary.'
                : 'Detailed grant-stage movement still lives here. For the joined money, funder, partner, and need view, use the funding workspace.'}
            </p>
          </div>
          {showGuidedOnboarding || completedMode ? (
            <div className="flex flex-wrap gap-2">
              <Link
                href="/profile/matches"
                className="inline-flex px-4 py-3 border-2 border-bauhaus-black text-bauhaus-black text-[10px] font-black uppercase tracking-widest hover:bg-bauhaus-black hover:text-white transition-colors"
              >
                {completedMode ? 'Review More Matches' : 'Add More Matches'}
              </Link>
              <Link
                href="/home"
                className="inline-flex px-4 py-3 border-2 border-bauhaus-blue text-bauhaus-blue text-[10px] font-black uppercase tracking-widest hover:bg-bauhaus-blue hover:text-white transition-colors"
              >
                Go To Home
              </Link>
            </div>
          ) : (
            <a
              href="/graph"
              className="inline-flex px-4 py-3 border-2 border-bauhaus-black text-bauhaus-black text-[10px] font-black uppercase tracking-widest hover:bg-bauhaus-black hover:text-white transition-colors"
            >
              Open Funding Workspace
            </a>
          )}
        </div>
      </div>

      {showGuidedOnboarding && (
        <div className="mb-6 grid gap-3 md:grid-cols-3">
          <div className="border-4 border-bauhaus-black bg-white p-4">
            <div className="text-[10px] font-black uppercase tracking-[0.3em] text-bauhaus-muted">Discovered</div>
            <div className="mt-2 text-3xl font-black text-bauhaus-black">{discoveredCount}</div>
            <p className="mt-2 text-xs text-bauhaus-black/75">
              Fresh shortlist items. Keep maybes here and open the strongest first.
            </p>
          </div>
          <div className="border-4 border-bauhaus-black bg-white p-4">
            <div className="text-[10px] font-black uppercase tracking-[0.3em] text-bauhaus-blue">Researching</div>
            <div className="mt-2 text-3xl font-black text-bauhaus-black">{researchingCount}</div>
            <p className="mt-2 text-xs text-bauhaus-black/75">
              Move grants here once they look real enough to investigate properly.
            </p>
          </div>
          <div className="border-4 border-bauhaus-black bg-bauhaus-blue p-4 text-white">
            <div className="text-[10px] font-black uppercase tracking-[0.3em] text-white/80">Active Work</div>
            <div className="mt-2 text-3xl font-black">{activeCount}</div>
            <p className="mt-2 text-xs text-white/85">
              Pursuing, submitted, negotiating, or approved. This is the active pipeline you are actually working.
            </p>
          </div>
        </div>
      )}

      {showGuidedOnboarding && grants.length > 0 && (
        <div className="mb-6 border-4 border-bauhaus-blue bg-bauhaus-blue/5 p-4">
          <div className="text-[10px] font-black uppercase tracking-[0.3em] text-bauhaus-blue">What To Do Next</div>
          <p className="mt-2 text-sm text-bauhaus-black/80">
            Start by dragging one or two strong-fit grants into <span className="font-black">Researching</span>. Leave weaker options in
            <span className="font-black"> Discovered</span> so the board stays honest and manageable.
          </p>
        </div>
      )}

      {completedMode && (
        <div className="mb-6 border-4 border-green-700 bg-green-50 p-4">
          <div className="text-[10px] font-black uppercase tracking-[0.3em] text-green-700">Pipeline Started</div>
          <p className="mt-2 text-sm text-bauhaus-black/80">
            Step 3 is complete. Keep moving strong grants through the tracker, and use the home dashboard for your overall pipeline summary.
          </p>
        </div>
      )}

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
          <KanbanBoard grants={grants} onGrantsChange={setGrants} />
        </GrantListWithPreview>
      </GrantActionsProvider>
    </div>
  );
}
