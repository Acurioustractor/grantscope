'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';
import type { SavedGrantRow } from './page';
import { KanbanBoard } from './kanban-board';
import { GrantActionsProvider } from '@/app/components/grant-card-actions';
import { GrantListWithPreview } from '@/app/components/grant-list-with-preview';

const TERMINAL_STAGES = new Set(['realized', 'lost', 'expired']);
const DECISION_STAGES = new Set(['discovered', 'researching', 'pursuing']);
const REVIEW_GATE_THRESHOLD = 65;
const OBVIOUS_NO_GO_THRESHOLD = 35;

type TriageLens = 'ACT' | 'Goods' | 'JusticeHub' | 'Empathy Ledger';

const TRIAGE_KEYWORDS: Record<TriageLens, string[]> = {
  ACT: [
    'aboriginal',
    'advocacy',
    'arts',
    'civic',
    'community',
    'culture',
    'data',
    'digital',
    'equity',
    'evidence',
    'first nations',
    'health equity',
    'indigenous',
    'infrastructure',
    'justice',
    'lived experience',
    'procurement',
    'regional',
    'remote',
    'rural',
    'social enterprise',
    'social impact',
    'story',
    'systems',
    'youth',
  ],
  Goods: [
    'bed',
    'circular',
    'equipment',
    'first nations',
    'goods',
    'health',
    'housing',
    'indigenous',
    'infrastructure',
    'laundry',
    'manufacturing',
    'mattress',
    'medical equipment',
    'procurement',
    'regional',
    'remote',
    'repair',
    'supplies',
    'washing',
  ],
  JusticeHub: [
    'aboriginal',
    'children',
    'community safety',
    'court',
    'crime',
    'diversion',
    'family',
    'first nations',
    'indigenous',
    'justice',
    'legal',
    'police',
    'prevention',
    'reintegration',
    'social justice',
    'youth',
  ],
  'Empathy Ledger': [
    'advocacy',
    'arts',
    'consent',
    'creative',
    'culture',
    'data',
    'digital',
    'human rights',
    'lived experience',
    'media',
    'narrative',
    'privacy',
    'story',
    'storytelling',
    'voice',
  ],
};

type ReviewLearning = {
  rejectedCount: number;
  rejectedProviders: Map<string, number>;
  rejectedCategories: Map<string, number>;
  rejectedFocusAreas: Map<string, number>;
};

type ReviewAssessment = {
  score: number;
  isReviewable: boolean;
  reasons: string[];
  penalties: string[];
};

function deadlineMs(grant: SavedGrantRow): number | null {
  return grant.grant.closes_at ? new Date(grant.grant.closes_at).getTime() : null;
}

function daysUntil(grant: SavedGrantRow): number | null {
  const deadline = deadlineMs(grant);
  if (!deadline) return null;
  return Math.ceil((deadline - Date.now()) / (1000 * 60 * 60 * 24));
}

function isExpired(grant: SavedGrantRow): boolean {
  const deadline = deadlineMs(grant);
  return !!deadline && deadline < Date.now();
}

function isMachineCleanCandidate(grant: SavedGrantRow): boolean {
  if (grant.stage !== 'discovered') return false;
  if (isExpired(grant)) return true;
  if (!grant.grant.url) return true;
  if (!grant.grant.closes_at) return true;
  return false;
}

function sortForDecision(a: SavedGrantRow, b: SavedGrantRow): number {
  const aDeadline = deadlineMs(a) ?? Number.POSITIVE_INFINITY;
  const bDeadline = deadlineMs(b) ?? Number.POSITIVE_INFINITY;
  if (aDeadline !== bDeadline) return aDeadline - bDeadline;
  const aScore = Math.max(a.stars || 0, a.grant.fit_score || 0, a.grant.relevance_score || 0);
  const bScore = Math.max(b.stars || 0, b.grant.fit_score || 0, b.grant.relevance_score || 0);
  if (aScore !== bScore) return bScore - aScore;
  return (b.grant.amount_max || 0) - (a.grant.amount_max || 0);
}

function formatMoney(amount: number | null): string {
  if (!amount) return '';
  if (amount >= 1_000_000) return `$${(amount / 1_000_000).toFixed(1)}M`;
  if (amount >= 1_000) return `$${(amount / 1_000).toFixed(0)}K`;
  return `$${amount.toLocaleString()}`;
}

function deadlineLabel(grant: SavedGrantRow): string {
  const days = daysUntil(grant);
  if (days == null) return 'No deadline';
  if (days < 0) return 'Expired';
  if (days === 0) return 'Today';
  return `${days}d`;
}

function normaliseToken(value: string | null | undefined): string {
  return (value || '').trim().toLowerCase();
}

function textForGrant(grant: SavedGrantRow): string {
  return [
    grant.grant.name,
    grant.grant.provider,
    grant.grant.description,
    grant.grant.source,
    ...(grant.grant.categories || []),
    ...(grant.grant.focus_areas || []),
  ].filter(Boolean).join(' ').toLowerCase();
}

function keywordHits(text: string, keywords: string[]): string[] {
  return keywords.filter((keyword) => text.includes(keyword));
}

function addCount(map: Map<string, number>, value: string | null | undefined) {
  const key = normaliseToken(value);
  if (!key) return;
  map.set(key, (map.get(key) || 0) + 1);
}

function buildReviewLearning(grants: SavedGrantRow[]): ReviewLearning {
  const rejected = grants.filter((grant) => grant.stage === 'lost');
  const rejectedProviders = new Map<string, number>();
  const rejectedCategories = new Map<string, number>();
  const rejectedFocusAreas = new Map<string, number>();

  for (const grant of rejected) {
    addCount(rejectedProviders, grant.grant.provider);
    for (const category of grant.grant.categories || []) addCount(rejectedCategories, category);
    for (const focus of grant.grant.focus_areas || []) addCount(rejectedFocusAreas, focus);
  }

  return {
    rejectedCount: rejected.length,
    rejectedProviders,
    rejectedCategories,
    rejectedFocusAreas,
  };
}

function scoreSimilarityPenalty(values: string[] | null | undefined, rejectedMap: Map<string, number>, maxPenalty: number) {
  let penalty = 0;
  for (const value of values || []) {
    const count = rejectedMap.get(normaliseToken(value)) || 0;
    if (count >= 8) penalty += 10;
    else if (count >= 4) penalty += 6;
    else if (count >= 2) penalty += 3;
  }
  return Math.min(penalty, maxPenalty);
}

function assessGrantForReview(
  grant: SavedGrantRow,
  learning: ReviewLearning,
  lens: TriageLens
): ReviewAssessment {
  const text = textForGrant(grant);
  const actHits = keywordHits(text, TRIAGE_KEYWORDS.ACT);
  const lensHits = lens === 'ACT' ? actHits : keywordHits(text, TRIAGE_KEYWORDS[lens]);
  const dbScore = Math.max(grant.grant.fit_score || 0, grant.grant.relevance_score || 0);
  const starScore = (grant.stars || 0) * 18;
  const strongExplicitSignal = dbScore >= 75 || starScore >= 36;
  let score = Math.max(dbScore, starScore);
  const reasons: string[] = [];
  const penalties: string[] = [];

  if (actHits.length > 0) {
    score += Math.min(actHits.length * 5, 35);
    reasons.push(`ACT language: ${actHits.slice(0, 3).join(', ')}`);
  }

  if (lens !== 'ACT') {
    if (lensHits.length > 0) {
      score += Math.min(lensHits.length * 8, 35);
      reasons.push(`${lens} fit: ${lensHits.slice(0, 3).join(', ')}`);
    } else {
      score -= 25;
      penalties.push(`No ${lens} signal`);
    }
  }

  const providerRejects = learning.rejectedProviders.get(normaliseToken(grant.grant.provider)) || 0;
  if (providerRejects >= 4) {
    score -= 35;
    penalties.push(`Rejected provider ${providerRejects}x`);
  } else if (providerRejects >= 2) {
    score -= 22;
    penalties.push(`Rejected provider ${providerRejects}x`);
  } else if (providerRejects === 1) {
    score -= 8;
  }

  const categoryPenalty = scoreSimilarityPenalty(grant.grant.categories, learning.rejectedCategories, 22);
  if (categoryPenalty > 0) {
    score -= categoryPenalty;
    penalties.push('Similar rejected category');
  }

  const focusPenalty = scoreSimilarityPenalty(grant.grant.focus_areas, learning.rejectedFocusAreas, 18);
  if (focusPenalty > 0) {
    score -= focusPenalty;
    penalties.push('Similar rejected focus');
  }

  if (!grant.grant.description || grant.grant.description.length < 80) {
    score -= 6;
    penalties.push('Thin source record');
  }

  if (!actHits.length && dbScore < 55) {
    score -= 30;
    penalties.push('Weak ACT fit');
  }

  if (grant.grant.amount_max && grant.grant.amount_max >= 50_000) {
    score += 5;
    reasons.push('Useful grant size');
  }

  const finalScore = Math.max(0, Math.min(100, Math.round(score)));
  const hasLensSignal = lens === 'ACT'
    ? actHits.length > 0 || strongExplicitSignal
    : lensHits.length > 0;

  return {
    score: finalScore,
    isReviewable: finalScore >= REVIEW_GATE_THRESHOLD && hasLensSignal,
    reasons,
    penalties,
  };
}

function DecisionGrantRow({ item }: { item: SavedGrantRow }) {
  return (
    <Link
      href={`/grants/${item.grant.id}`}
      className="flex min-h-[58px] min-w-0 items-center justify-between gap-3 overflow-hidden border-b border-bauhaus-black/10 px-3 py-2 transition-colors last:border-b-0 hover:bg-bauhaus-canvas"
    >
      <div className="min-w-0">
        <div className="truncate text-sm font-black text-bauhaus-black">{item.grant.name}</div>
        <div className="truncate text-xs font-medium text-bauhaus-muted">{item.grant.provider}</div>
      </div>
      <div className="shrink-0 text-right">
        <div className="text-xs font-black text-bauhaus-blue">{formatMoney(item.grant.amount_max)}</div>
        <div className="text-[10px] font-black uppercase tracking-widest text-bauhaus-muted">{deadlineLabel(item)}</div>
      </div>
    </Link>
  );
}

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

  const loadGrants = useCallback(async (showLoading = true) => {
    if (!didInit) return;
    if (showLoading) setLoading(true);
    try {
      const response = await fetch(`/api/tracker?view=${viewMode}`);
      if (response.status === 401) {
        router.push('/login');
        return;
      }
      const data = await response.json();
      if (Array.isArray(data)) setGrants(data);
    } catch {
      // Keep the current board visible if a refresh fails.
    } finally {
      if (showLoading) setLoading(false);
    }
  }, [router, viewMode, didInit]);

  useEffect(() => {
    void loadGrants();
  }, [loadGrants]);

  const onboardingMode = searchParams.get('onboarding') === '1' && viewMode === 'personal';
  const completedMode = searchParams.get('completed') === '1' && viewMode === 'personal';
  const hasProgressedGrant = grants.some((grant) => grant.stage !== 'discovered');
  const showGuidedOnboarding = onboardingMode && !hasProgressedGrant;
  const discoveredCount = grants.filter((grant) => grant.stage === 'discovered').length;
  const researchingCount = grants.filter((grant) => grant.stage === 'researching').length;
  const activeCount = grants.filter((grant) =>
    ['pursuing', 'submitted', 'negotiating', 'approved'].includes(grant.stage)
  ).length;
  const workInMotionCount = researchingCount + activeCount;
  const reviewLearning = useMemo(() => buildReviewLearning(grants), [grants]);
  const workingGrants = grants.filter((grant) => !TERMINAL_STAGES.has(grant.stage) && DECISION_STAGES.has(grant.stage));
  const deadlineDecisionGrants = workingGrants
    .filter((grant) => {
      const days = daysUntil(grant);
      if (days === null || days < 0 || days > 7) return false;
      return grant.stage !== 'discovered' || assessGrantForReview(grant, reviewLearning, 'ACT').isReviewable;
    })
    .sort(sortForDecision);
  const machineCleanCandidates = grants.filter(isMachineCleanCandidate);
  const learningHiddenGrantIds = useMemo(() => {
    const hidden = new Set<string>();
    for (const grant of grants) {
      if (grant.stage !== 'discovered' || isMachineCleanCandidate(grant)) continue;
      if (assessGrantForReview(grant, reviewLearning, 'ACT').score < OBVIOUS_NO_GO_THRESHOLD) {
        hidden.add(grant.grant_id);
      }
    }
    return hidden;
  }, [grants, reviewLearning]);
  const reviewHiddenGrantIds = useMemo(() => {
    const hidden = new Set<string>(learningHiddenGrantIds);
    for (const grant of machineCleanCandidates) {
      hidden.add(grant.grant_id);
    }
    return hidden;
  }, [learningHiddenGrantIds, machineCleanCandidates]);
  const hiddenBeforeReviewCount = reviewHiddenGrantIds.size;

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
      <div className="mb-5">
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
                : 'This page is only for work you may actually move. Decide urgent deadlines first, then use the board. Use Home or the Opportunity Cockpit to find new opportunities.'}
            </p>
          </div>
          {(showGuidedOnboarding || completedMode) && (
            <div className="flex flex-wrap gap-2">
              <Link
                href="/profile/matches"
                className="inline-flex px-4 py-3 border-2 border-bauhaus-black text-bauhaus-black text-[10px] font-black uppercase tracking-widest hover:bg-bauhaus-black hover:text-white transition-colors"
              >
                {completedMode ? 'Review More Matches' : 'Add More Matches'}
              </Link>
            </div>
          )}
        </div>
      </div>

      {!showGuidedOnboarding && !completedMode && (
        <>
          <section className="mb-6 overflow-hidden border-4 border-bauhaus-black bg-white">
            <div className="border-b-2 border-bauhaus-black/10 p-4">
              <div className="text-[10px] font-black uppercase tracking-[0.3em] text-bauhaus-red">
                Today
              </div>
              <h2 className="mt-2 text-xl font-black uppercase tracking-tight text-bauhaus-black">
                Use the board. Only decide urgent grants first.
              </h2>
              <p className="mt-2 max-w-3xl text-sm font-medium leading-6 text-bauhaus-muted">
                This page is not the discovery engine. Home and the cockpit find the next opportunity; this page is where real grant work moves.
              </p>
            </div>
            <div className="grid gap-0 md:grid-cols-3">
              <div className="border-b-2 border-bauhaus-black/10 p-4 md:border-b-0 md:border-r-2">
                <div className="text-[10px] font-black uppercase tracking-[0.24em] text-bauhaus-muted">
                  Decide first
                </div>
                <div className="mt-2 text-3xl font-black text-bauhaus-black">{deadlineDecisionGrants.length}</div>
                <p className="mt-2 text-xs font-medium leading-5 text-bauhaus-muted">
                  Tracked grants closing this week. Open the first one, then choose pursue, park, or no-go.
                </p>
                {deadlineDecisionGrants[0] && (
                  <Link
                    href={`/grants/${deadlineDecisionGrants[0].grant.id}`}
                    className="mt-3 inline-flex border-2 border-bauhaus-black bg-bauhaus-black px-3 py-2 text-[10px] font-black uppercase tracking-widest text-white transition-colors hover:bg-white hover:text-bauhaus-black"
                  >
                    Open first deadline
                  </Link>
                )}
              </div>
              <div className="border-b-2 border-bauhaus-black/10 p-4 md:border-b-0 md:border-r-2">
                <div className="text-[10px] font-black uppercase tracking-[0.24em] text-bauhaus-muted">
                  Work in motion
                </div>
                <div className="mt-2 text-3xl font-black text-bauhaus-black">{workInMotionCount}</div>
                <p className="mt-2 text-xs font-medium leading-5 text-bauhaus-muted">
                  Researching, pursuing, submitted, negotiating, or approved. This is the board work below.
                </p>
                <a
                  href="#work-board"
                  className="mt-3 inline-flex border-2 border-bauhaus-black px-3 py-2 text-[10px] font-black uppercase tracking-widest text-bauhaus-black transition-colors hover:bg-bauhaus-black hover:text-white"
                >
                  Go to board
                </a>
              </div>
              <div className="p-4">
                <div className="text-[10px] font-black uppercase tracking-[0.24em] text-bauhaus-muted">
                  Not work here
                </div>
                <div className="mt-2 text-3xl font-black text-bauhaus-black">{hiddenBeforeReviewCount}</div>
                <p className="mt-2 text-xs font-medium leading-5 text-bauhaus-muted">
                  Low-fit or cleanup records are held out of the board. Use the cockpit when you need the next recommended opportunity.
                </p>
                <Link
                  href="/opportunities/ecosystem"
                  className="mt-3 inline-flex border-2 border-bauhaus-red px-3 py-2 text-[10px] font-black uppercase tracking-widest text-bauhaus-red transition-colors hover:bg-bauhaus-red hover:text-white"
                >
                  Open cockpit
                </Link>
              </div>
            </div>
          </section>

          {deadlineDecisionGrants.length > 0 && (
            <section className="mb-6 min-w-0 overflow-hidden border-4 border-bauhaus-black bg-white">
              <div className="border-b-2 border-bauhaus-black/10 px-4 py-3">
                <div className="text-[10px] font-black uppercase tracking-[0.3em] text-bauhaus-muted">
                  Deadline decisions
                </div>
                <p className="mt-1 text-xs font-medium text-bauhaus-muted">
                  Only these need attention before the board. Open each one, decide, then move on.
                </p>
              </div>
              {deadlineDecisionGrants.slice(0, 5).map((item) => (
                <DecisionGrantRow key={item.id} item={item} />
              ))}
            </section>
          )}
        </>
      )}

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

      <div id="work-board" className="flex gap-0 mb-6 border-4 border-bauhaus-black w-fit scroll-mt-24">
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
          <KanbanBoard
            grants={grants}
            onGrantsChange={setGrants}
            learningHiddenGrantIds={reviewHiddenGrantIds}
            learningHiddenCount={hiddenBeforeReviewCount}
          />
        </GrantListWithPreview>
      </GrantActionsProvider>
    </div>
  );
}
