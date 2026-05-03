'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';
import type { SavedGrantRow } from './page';
import { KanbanBoard } from './kanban-board';
import { GrantActionsProvider } from '@/app/components/grant-card-actions';
import { GrantListWithPreview } from '@/app/components/grant-list-with-preview';

type AutoReviewResult = {
  ok: boolean;
  lens: TriageLens;
  reviewed: number;
  applied: {
    expired: number;
    sourceCleanup: number;
    lost: number;
    keptReviewable: number;
  };
  message: string;
};

type DirectiveActionKind =
  | 'no'
  | 'later'
  | 'research'
  | 'partner_path'
  | 'apply_path'
  | 'add_evidence_gap'
  | 'send_to_ghl';

type DirectiveSource = 'wiki' | 'grant' | 'foundation' | 'procurement' | 'crm' | 'notion' | 'goods';

type OpportunityDirectiveRoute = {
  id: string;
  signalId: string;
  title: string;
  source: DirectiveSource;
  sourceRef: string;
  sourceUrl: string | null;
  project: string;
  project_code: string;
  project_name: string;
  pathway: 'grant' | 'foundation' | 'procurement' | 'buyer' | 'capital' | 'relationship' | 'monitor';
  recommended_role: 'lead' | 'partner' | 'contractor' | 'monitor';
  fit_score: number;
  readiness_score: number;
  relationship_score: number;
  urgency_score: number;
  overall_score: number;
  why_recommended: string;
  why_not: string | null;
  evidence_gaps: string[];
  next_action: string;
  ghl: {
    recommendedPipeline: string;
    suggestedStage: string;
    existingOpportunityId: string | null;
    contactId: string | null;
    tags: string[];
  };
  signal: {
    id: string;
    title: string;
    source: DirectiveSource;
    sourceRef: string;
    sourceUrl: string | null;
    lane: string;
    project: string;
    projects: string[];
    organisation: string | null;
    amount: string | null;
    deadline: string | null;
  };
};

type OpportunityDirectiveResponse = {
  topDirective: OpportunityDirectiveRoute | null;
  routes: OpportunityDirectiveRoute[];
  learningSummary?: {
    decisionCount: number;
    negativeCount: number;
    positiveCount: number;
    moreInfoCount: number;
  };
};

const TERMINAL_STAGES = new Set(['realized', 'lost', 'expired']);
const DECISION_STAGES = new Set(['discovered', 'researching', 'pursuing']);
const REVIEW_GATE_THRESHOLD = 65;
const OBVIOUS_NO_GO_THRESHOLD = 35;

type TriageLens = 'ACT' | 'Goods' | 'JusticeHub' | 'Empathy Ledger';

const TRIAGE_LENSES: TriageLens[] = ['ACT', 'Goods', 'JusticeHub', 'Empathy Ledger'];

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

function sortForTriage(
  a: SavedGrantRow,
  b: SavedGrantRow,
  learning: ReviewLearning,
  lens: TriageLens
): number {
  const aAssessment = assessGrantForReview(a, learning, lens);
  const bAssessment = assessGrantForReview(b, learning, lens);
  if (aAssessment.score !== bAssessment.score) return bAssessment.score - aAssessment.score;
  return sortForDecision(a, b);
}

function recordNoFeedback(grantId: string, sourceContext: string) {
  fetch(`/api/grants/${grantId}/feedback`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ vote: -1, reason: 'Not relevant', source_context: sourceContext }),
  }).catch(() => {
    // The lost stage remains the source of truth for hiding this item from review.
  });
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

function QuickTriagePanel({
  item,
  remainingCount,
  suppressedCount,
  activeLens,
  assessment,
  onNo,
  onLater,
  onResearch,
}: {
  item: SavedGrantRow | null;
  remainingCount: number;
  suppressedCount: number;
  activeLens: TriageLens;
  assessment: ReviewAssessment | null;
  onNo: (grantId: string) => void;
  onLater: (grantId: string) => void;
  onResearch: (grantId: string) => void;
}) {
  if (!item) {
    return (
      <section className="mb-6 border-4 border-bauhaus-black bg-white p-4">
        <div className="text-[10px] font-black uppercase tracking-[0.3em] text-bauhaus-muted">
          Smart shortlist
        </div>
        <div className="mt-2 text-lg font-black uppercase tracking-tight text-bauhaus-black">
          No strong {activeLens} grant ready.
        </div>
        <p className="mt-1 text-sm font-medium text-bauhaus-muted">
          Run Find best grants again, switch the project lens above, or scout the frontier when you want the system to pull in fresher candidates.
        </p>
      </section>
    );
  }

  const score = Math.max(item.stars || 0, item.grant.fit_score || 0, item.grant.relevance_score || 0);
  const description = item.grant.description?.trim();
  const tags = [...(item.grant.focus_areas ?? []), ...(item.grant.categories ?? [])].filter(Boolean).slice(0, 4);

  return (
    <section className="mb-6 overflow-hidden border-4 border-bauhaus-black bg-white">
      <div className="grid gap-0 lg:grid-cols-[minmax(0,1fr)_280px]">
        <div className="min-w-0 p-4">
          <div className="flex flex-wrap items-center gap-2">
            <div className="text-[10px] font-black uppercase tracking-[0.3em] text-bauhaus-red">
              Smart shortlist
            </div>
            <div className="border border-bauhaus-black/20 px-2 py-1 text-[10px] font-black uppercase tracking-widest text-bauhaus-muted">
              {activeLens}
            </div>
            <div className="border border-bauhaus-black/20 px-2 py-1 text-[10px] font-black uppercase tracking-widest text-bauhaus-muted">
              {remainingCount.toLocaleString()} suggested
            </div>
            {suppressedCount > 0 && (
              <div className="border border-bauhaus-red/30 px-2 py-1 text-[10px] font-black uppercase tracking-widest text-bauhaus-red">
                {suppressedCount.toLocaleString()} low-confidence held back
              </div>
            )}
          </div>
          <h2 className="mt-3 text-xl font-black uppercase leading-tight tracking-tight text-bauhaus-black">
            {item.grant.name}
          </h2>
          <div className="mt-1 flex flex-wrap items-center gap-x-3 gap-y-1 text-sm font-medium text-bauhaus-muted">
            <span>{item.grant.provider}</span>
            {formatMoney(item.grant.amount_max) && (
              <span className="font-black text-bauhaus-blue">{formatMoney(item.grant.amount_max)}</span>
            )}
            <span className="font-black uppercase tracking-widest">{deadlineLabel(item)}</span>
            {score > 0 && <span>{score} signal</span>}
            {assessment && <span>{assessment.score} ACT review score</span>}
          </div>
          {description && (
            <p className="mt-3 line-clamp-2 text-sm font-medium leading-6 text-bauhaus-muted">
              {description}
            </p>
          )}
          {tags.length > 0 && (
            <div className="mt-3 flex flex-wrap gap-2">
              {tags.map((tag) => (
                <span
                  key={tag}
                  className="border border-bauhaus-black/15 px-2 py-1 text-[10px] font-black uppercase tracking-widest text-bauhaus-muted"
                >
                  {tag}
                </span>
              ))}
            </div>
          )}
          {assessment && (assessment.reasons.length > 0 || assessment.penalties.length > 0) && (
            <div className="mt-3 grid gap-2 text-xs font-medium leading-5 text-bauhaus-muted sm:grid-cols-2">
              {assessment.reasons.length > 0 && (
                <div className="border border-bauhaus-black/10 bg-bauhaus-canvas p-2">
                  <span className="font-black text-bauhaus-black">Why shown: </span>
                  {assessment.reasons.slice(0, 2).join('; ')}
                </div>
              )}
              {assessment.penalties.length > 0 && (
                <div className="border border-bauhaus-red/20 bg-red-50 p-2 text-bauhaus-red">
                  <span className="font-black">Caution: </span>
                  {assessment.penalties.slice(0, 2).join('; ')}
                </div>
              )}
            </div>
          )}
        </div>
        <div className="border-t-2 border-bauhaus-black/10 p-4 lg:border-l-2 lg:border-t-0">
          <div className="text-[10px] font-black uppercase tracking-[0.3em] text-bauhaus-muted">
            Decision
          </div>
          <div className="mt-3 grid gap-2">
            <button
              type="button"
              onClick={() => onNo(item.grant_id)}
              className="min-h-11 border-2 border-bauhaus-red px-4 py-3 text-[11px] font-black uppercase tracking-widest text-bauhaus-red transition-colors hover:bg-bauhaus-red hover:text-white"
            >
              No
            </button>
            <button
              type="button"
              onClick={() => onLater(item.grant_id)}
              className="min-h-11 border-2 border-bauhaus-black/25 px-4 py-3 text-[11px] font-black uppercase tracking-widest text-bauhaus-muted transition-colors hover:border-bauhaus-black hover:text-bauhaus-black"
            >
              Later
            </button>
            <button
              type="button"
              onClick={() => onResearch(item.grant_id)}
              className="min-h-11 border-2 border-bauhaus-black bg-bauhaus-black px-4 py-3 text-[11px] font-black uppercase tracking-widest text-white transition-colors hover:bg-white hover:text-bauhaus-black"
            >
              Research
            </button>
            <Link
              href={`/grants/${item.grant.id}`}
              className="min-h-11 border-2 border-bauhaus-blue px-4 py-3 text-center text-[11px] font-black uppercase tracking-widest text-bauhaus-blue transition-colors hover:bg-bauhaus-blue hover:text-white"
            >
              Open details
            </Link>
          </div>
          <p className="mt-3 text-xs font-medium leading-5 text-bauhaus-muted">
            No teaches the model. Later skips this card for now. Research moves it into real work.
          </p>
        </div>
      </div>
    </section>
  );
}

function OpportunityDirectivePanel({
  route,
  loading,
  actingKind,
  actionMessage,
  learningCount,
  onAction,
}: {
  route: OpportunityDirectiveRoute | null;
  loading: boolean;
  actingKind: DirectiveActionKind | null;
  actionMessage: string | null;
  learningCount: number;
  onAction: (kind: DirectiveActionKind) => void;
}) {
  const actions: Array<{
    kind: DirectiveActionKind;
    label: string;
    description: string;
    tone: 'no' | 'quiet' | 'work' | 'crm';
  }> = [
    { kind: 'no', label: 'Not for us', description: 'Reject this and make similar ideas less likely.', tone: 'no' },
    { kind: 'later', label: 'Park it', description: 'Keep it out of today without saying it is bad.', tone: 'quiet' },
    { kind: 'research', label: 'Investigate', description: 'Make this a real research task.', tone: 'work' },
    { kind: 'partner_path', label: 'Find partner', description: 'Treat ACT as a partner, not the lead applicant.', tone: 'quiet' },
    { kind: 'apply_path', label: 'Start application', description: 'Treat ACT as lead once gaps are closed.', tone: 'work' },
    { kind: 'add_evidence_gap', label: 'Add missing info', description: 'Tell the system what proof is still missing.', tone: 'quiet' },
    { kind: 'send_to_ghl', label: 'Send to HighLevel', description: 'Create/update CRM only after confirmation.', tone: 'crm' },
  ];

  const buttonClass = (tone: 'no' | 'quiet' | 'work' | 'crm') => {
    if (tone === 'no') return 'border-bauhaus-red text-bauhaus-red hover:bg-bauhaus-red hover:text-white';
    if (tone === 'work') return 'border-bauhaus-black bg-bauhaus-black text-white hover:bg-white hover:text-bauhaus-black';
    if (tone === 'crm') return 'border-bauhaus-blue text-bauhaus-blue hover:bg-bauhaus-blue hover:text-white';
    return 'border-bauhaus-black/25 text-bauhaus-muted hover:border-bauhaus-black hover:text-bauhaus-black';
  };

  const pathwayLabel = (pathway: OpportunityDirectiveRoute['pathway']) => {
    const labels: Record<OpportunityDirectiveRoute['pathway'], string> = {
      grant: 'grant application',
      foundation: 'foundation relationship',
      procurement: 'buyer/procurement path',
      buyer: 'buyer follow-up',
      capital: 'capital raise',
      relationship: 'relationship follow-up',
      monitor: 'watch only',
    };
    return labels[pathway];
  };

  const roleLabel = (role: OpportunityDirectiveRoute['recommended_role']) => {
    const labels: Record<OpportunityDirectiveRoute['recommended_role'], string> = {
      lead: 'ACT leads',
      partner: 'ACT partners',
      contractor: 'ACT supplies',
      monitor: 'ACT watches',
    };
    return labels[role];
  };

  const firstGap = route?.evidence_gaps?.[0] ?? null;
  const plainNextStep = route
    ? firstGap
      ? `Before this can move forward, capture the missing piece: ${firstGap}.`
      : route.next_action
    : null;

  if (loading) {
    return (
      <section className="mb-6 border-4 border-bauhaus-black bg-white p-4">
        <div className="text-[10px] font-black uppercase tracking-[0.3em] text-bauhaus-muted">
          ACT opportunity router
        </div>
        <div className="mt-2 text-lg font-black uppercase tracking-tight text-bauhaus-black">
          Finding the next route...
        </div>
      </section>
    );
  }

  if (!route) {
    return (
      <section className="mb-6 border-4 border-bauhaus-black bg-white p-4">
        <div className="text-[10px] font-black uppercase tracking-[0.3em] text-bauhaus-muted">
          ACT opportunity router
        </div>
        <div className="mt-2 text-lg font-black uppercase tracking-tight text-bauhaus-black">
          No directive route yet.
        </div>
        <p className="mt-1 text-sm font-medium leading-6 text-bauhaus-muted">
          The router needs fresher source rows, decision memory, or a lower threshold before it can recommend the next best ACT move.
        </p>
      </section>
    );
  }

  return (
    <section className="mb-6 overflow-hidden border-4 border-bauhaus-black bg-white">
      <div className="grid gap-0 xl:grid-cols-[minmax(0,1fr)_360px]">
        <div className="min-w-0 p-4">
          <div className="flex flex-wrap items-center gap-2">
            <div className="text-[10px] font-black uppercase tracking-[0.3em] text-bauhaus-red">
              Recommended move
            </div>
            <span className="border border-bauhaus-black/20 px-2 py-1 text-[10px] font-black uppercase tracking-widest text-bauhaus-muted">
              Project: {route.project_name}
            </span>
            <span className="border border-bauhaus-black/20 px-2 py-1 text-[10px] font-black uppercase tracking-widest text-bauhaus-muted">
              Path: {pathwayLabel(route.pathway)}
            </span>
            <span className="border border-bauhaus-black/20 px-2 py-1 text-[10px] font-black uppercase tracking-widest text-bauhaus-muted">
              {roleLabel(route.recommended_role)}
            </span>
          </div>
          <h2 className="mt-3 text-xl font-black uppercase leading-tight tracking-tight text-bauhaus-black">
            {route.title}
          </h2>
          <div className="mt-1 flex flex-wrap items-center gap-x-3 gap-y-1 text-sm font-medium text-bauhaus-muted">
            {route.signal.organisation && <span>{route.signal.organisation}</span>}
            {route.signal.amount && <span className="font-black text-bauhaus-blue">{route.signal.amount}</span>}
            {route.signal.deadline && <span className="font-black uppercase tracking-widest">{route.signal.deadline}</span>}
            <span>{route.overall_score}/100 confidence</span>
          </div>
          <div className="mt-4 border-l-4 border-bauhaus-blue bg-blue-50 p-4">
            <div className="text-[10px] font-black uppercase tracking-[0.24em] text-bauhaus-blue">What this means</div>
            <p className="mt-2 text-sm font-medium leading-6 text-bauhaus-black">
              CivicGraph is saying: focus on <span className="font-black">{route.project_name}</span> now, through a{' '}
              <span className="font-black">{pathwayLabel(route.pathway)}</span>. The suggested role is{' '}
              <span className="font-black">{roleLabel(route.recommended_role).toLowerCase()}</span>.
            </p>
          </div>
          <div className="mt-3 grid gap-3 lg:grid-cols-3">
            <div className="border border-bauhaus-black/10 bg-bauhaus-canvas p-3">
              <div className="text-[10px] font-black uppercase tracking-[0.24em] text-bauhaus-muted">Why it was picked</div>
              <p className="mt-2 text-xs font-medium leading-5 text-bauhaus-muted">
                Good project fit, enough evidence to look at, and a clear pathway. Raw reason: {route.why_recommended}
              </p>
            </div>
            <div className="border border-bauhaus-black/10 bg-bauhaus-canvas p-3">
              <div className="text-[10px] font-black uppercase tracking-[0.24em] text-bauhaus-muted">Missing before action</div>
              <p className="mt-2 text-xs font-medium leading-5 text-bauhaus-muted">
                {route.evidence_gaps.length ? route.evidence_gaps.slice(0, 3).join('; ') : 'No critical gap detected.'}
              </p>
            </div>
            <div className="border border-bauhaus-black/10 bg-bauhaus-canvas p-3">
              <div className="text-[10px] font-black uppercase tracking-[0.24em] text-bauhaus-muted">Where it would go</div>
              <p className="mt-2 text-xs font-medium leading-5 text-bauhaus-muted">
                {route.ghl.contactId
                  ? `HighLevel contact exists. Pipeline: ${route.ghl.recommendedPipeline}.`
                  : `If you progress it, use ${route.ghl.recommendedPipeline}. Choose a contact before CRM write.`}
              </p>
            </div>
          </div>
          <div className="mt-3 border-2 border-bauhaus-black bg-white p-4 text-sm font-medium leading-6 text-bauhaus-black">
            <div className="text-[10px] font-black uppercase tracking-[0.24em] text-bauhaus-red">What to do now</div>
            <p className="mt-2">
              <span className="font-black">{plainNextStep}</span>
              {' '}If that sounds worth doing, click <span className="font-black">Investigate</span>. If it is not right, click <span className="font-black">Not for us</span>.
            </p>
          </div>
          {route.why_not && (
            <div className="mt-3 border-l-4 border-bauhaus-red bg-red-50 p-3 text-xs font-medium leading-5 text-bauhaus-red">
              {route.why_not}
            </div>
          )}
        </div>
        <div className="border-t-2 border-bauhaus-black/10 p-4 xl:border-l-2 xl:border-t-0">
          <div className="text-[10px] font-black uppercase tracking-[0.3em] text-bauhaus-muted">
            Choose one
          </div>
          <p className="mt-2 text-sm font-medium leading-6 text-bauhaus-black">
            You are only deciding what happens to this recommendation. You are not submitting a grant from here.
          </p>
          <div className="mt-3 grid gap-2">
            {actions.map((action) => (
              <button
                key={action.kind}
                type="button"
                onClick={() => onAction(action.kind)}
                disabled={actingKind !== null}
                className={`min-h-12 border-2 px-3 py-2 text-left transition-colors disabled:cursor-not-allowed disabled:opacity-50 ${buttonClass(action.tone)}`}
              >
                <span className="block text-[10px] font-black uppercase tracking-widest">
                  {actingKind === action.kind ? 'Working...' : action.label}
                </span>
                <span className="mt-1 block text-xs font-medium normal-case tracking-normal opacity-80">
                  {action.description}
                </span>
              </button>
            ))}
          </div>
          <p className="mt-3 text-xs font-medium leading-5 text-bauhaus-muted">
            HighLevel actions always ask for confirmation and never send email/SMS.
          </p>
          <div className="mt-3 border border-bauhaus-black/10 bg-bauhaus-canvas p-3 text-xs font-medium leading-5 text-bauhaus-muted">
            Decisions learned: <span className="font-black text-bauhaus-black">{learningCount.toLocaleString()}</span>
          </div>
          {actionMessage && (
            <div className="mt-3 border border-bauhaus-black/10 p-3 text-xs font-medium leading-5 text-bauhaus-muted">
              {actionMessage}
            </div>
          )}
        </div>
      </div>
    </section>
  );
}

function TrackerProcess({
  cleanableCount,
  deadlineCount,
  reviewCount,
  hiddenBeforeReviewCount,
  activeCount,
  discoveredCount,
  autoReviewing,
  viewMode,
  activeLens,
  autoReview,
  preSweepError,
  onRunAutoReview,
  onLensChange,
}: {
  cleanableCount: number;
  deadlineCount: number;
  reviewCount: number;
  hiddenBeforeReviewCount: number;
  activeCount: number;
  discoveredCount: number;
  autoReviewing: boolean;
  viewMode: 'personal' | 'org';
  activeLens: TriageLens;
  autoReview: AutoReviewResult | null;
  preSweepError: string | null;
  onRunAutoReview: () => void;
  onLensChange: (lens: TriageLens) => void;
}) {
  const steps = [
    {
      title: 'Can auto-decide',
      count: cleanableCount,
      detail: 'Expired, weak-source, no-deadline, or obvious no-fit records the system can move before you read.',
    },
    {
      title: 'Urgent',
      count: deadlineCount,
      detail: 'Tracked grants closing in seven days that need a real pursue, park, or no decision.',
    },
    {
      title: 'Suggested',
      count: reviewCount,
      detail: `Best remaining ${activeLens} candidates after project fit, source quality, and your No decisions.`,
    },
    {
      title: 'Active',
      count: activeCount,
      detail: 'Applications and real research already in motion.',
    },
  ];

  return (
    <div className="mb-6 overflow-hidden border-4 border-bauhaus-black bg-white">
      <div className="border-b-2 border-bauhaus-black/10 p-4">
        <div className="flex flex-col gap-5 xl:flex-row xl:items-start xl:justify-between">
          <div className="max-w-3xl">
            <div className="text-[10px] font-black uppercase tracking-[0.3em] text-bauhaus-red">
              Intelligent grant review
            </div>
            <h2 className="mt-2 text-xl font-black uppercase tracking-tight text-bauhaus-black">
              Do not review the backlog manually.
            </h2>
            <p className="mt-2 text-sm font-medium leading-6 text-bauhaus-muted">
              Pick a project lens and let CivicGraph reject obvious no-fit grants, keep uncertain ones ranked, and show only the next decision. Your job is to say <span className="font-black text-bauhaus-black">No</span>, <span className="font-black text-bauhaus-black">Later</span>, or <span className="font-black text-bauhaus-black">Research</span> on the shortlist.
            </p>
            <div className="mt-4 flex flex-wrap gap-2">
              {TRIAGE_LENSES.map((lens) => (
                <button
                  key={lens}
                  type="button"
                  onClick={() => onLensChange(lens)}
                  className={`min-h-10 border-2 px-3 py-2 text-[10px] font-black uppercase tracking-widest transition-colors ${
                    activeLens === lens
                      ? 'border-bauhaus-black bg-bauhaus-black text-white'
                      : 'border-bauhaus-black/20 text-bauhaus-muted hover:border-bauhaus-black hover:text-bauhaus-black'
                  }`}
                >
                  {lens}
                </button>
              ))}
            </div>
          </div>
          <div className="w-full max-w-sm border-2 border-bauhaus-black bg-bauhaus-canvas p-3">
            <button
              type="button"
              onClick={onRunAutoReview}
              disabled={autoReviewing || viewMode !== 'personal'}
              className="min-h-12 w-full border-2 border-bauhaus-red bg-bauhaus-red px-4 py-3 text-[11px] font-black uppercase tracking-widest text-white transition-colors hover:bg-white hover:text-bauhaus-red disabled:cursor-not-allowed disabled:opacity-50"
            >
              {autoReviewing ? 'Finding...' : 'Find best grants'}
            </button>
            <p className="mt-3 text-xs font-medium leading-5 text-bauhaus-muted">
              Runs against your current tracker only. It does not submit, email, change active applications, or write to CRM.
            </p>
          </div>
        </div>

        {autoReview && (
          <div className="mt-4 border border-bauhaus-red/20 bg-red-50 p-3 text-xs font-medium leading-5 text-bauhaus-red">
            {autoReview.message} Lens: {activeLens}.
          </div>
        )}
        {preSweepError && (
          <div className="mt-3 text-xs font-black text-bauhaus-red">{preSweepError}</div>
        )}
        {viewMode !== 'personal' && (
          <div className="mt-3 text-xs font-medium text-bauhaus-muted">
            Team cleanup is read-only here. Run deeper source cleanup from Home or Data Clarity.
          </div>
        )}
      </div>

      <div className="grid gap-0 md:grid-cols-2 xl:grid-cols-4">
        {steps.map((step, index) => (
          <div key={step.title} className={`min-w-0 p-4 ${index > 0 ? 'border-t-2 border-bauhaus-black/10 md:border-l-2 md:border-t-0' : ''} ${index === 2 ? 'md:border-t-2 xl:border-t-0' : ''}`}>
            <div className="flex items-start justify-between gap-3">
              <div className="min-w-0">
                <div className="text-[10px] font-black uppercase tracking-[0.24em] text-bauhaus-muted">
                  {step.title}
                </div>
              </div>
              <div className="shrink-0 text-2xl font-black tabular-nums text-bauhaus-black">
                {step.count.toLocaleString()}
              </div>
            </div>
            <p className="mt-2 text-xs font-medium leading-5 text-bauhaus-muted">
              {step.detail}
            </p>
          </div>
        ))}
      </div>

      {discoveredCount > 50 && (
        <div className="border-t-2 border-bauhaus-black/10 px-4 py-3 text-xs font-medium text-bauhaus-muted">
          Raw discovered backlog is {discoveredCount.toLocaleString()}. You should not read it card by card. The system is holding back {hiddenBeforeReviewCount.toLocaleString()} low-confidence records and ranking the rest into the shortlist.
        </div>
      )}
    </div>
  );
}

export function TrackerClient() {
  const [grants, setGrants] = useState<SavedGrantRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [autoReviewing, setAutoReviewing] = useState(false);
  const [autoReview, setAutoReview] = useState<AutoReviewResult | null>(null);
  const [preSweepError, setPreSweepError] = useState<string | null>(null);
  const [triageSkippedIds, setTriageSkippedIds] = useState<Set<string>>(() => new Set());
  const [triageLens, setTriageLens] = useState<TriageLens>('ACT');
  const [directive, setDirective] = useState<OpportunityDirectiveRoute | null>(null);
  const [directiveLearningCount, setDirectiveLearningCount] = useState(0);
  const [directiveLoading, setDirectiveLoading] = useState(true);
  const [directiveAction, setDirectiveAction] = useState<DirectiveActionKind | null>(null);
  const [directiveMessage, setDirectiveMessage] = useState<string | null>(null);
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

  const loadDirective = useCallback(async () => {
    setDirectiveLoading(true);
    try {
      const response = await fetch('/api/opportunity-intelligence?minScore=55');
      if (!response.ok) throw new Error('Opportunity router failed');
      const data = (await response.json()) as OpportunityDirectiveResponse;
      setDirective(data.topDirective ?? data.routes?.[0] ?? null);
      setDirectiveLearningCount(data.learningSummary?.decisionCount ?? 0);
    } catch {
      setDirective(null);
      setDirectiveMessage('The opportunity router could not load. The tracker still works, but the directive layer is unavailable.');
    } finally {
      setDirectiveLoading(false);
    }
  }, []);

  useEffect(() => {
    void loadDirective();
  }, [loadDirective]);

  const onboardingMode = searchParams.get('onboarding') === '1' && viewMode === 'personal';
  const completedMode = searchParams.get('completed') === '1' && viewMode === 'personal';
  const hasProgressedGrant = grants.some((grant) => grant.stage !== 'discovered');
  const showGuidedOnboarding = onboardingMode && !hasProgressedGrant;
  const discoveredCount = grants.filter((grant) => grant.stage === 'discovered').length;
  const researchingCount = grants.filter((grant) => grant.stage === 'researching').length;
  const activeCount = grants.filter((grant) =>
    ['pursuing', 'submitted', 'negotiating', 'approved'].includes(grant.stage)
  ).length;
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
  const ungatedHumanReadyGrants = grants
    .filter((grant) => grant.stage === 'discovered' && !isMachineCleanCandidate(grant))
    .sort(sortForDecision);
  const humanReadyGrants = ungatedHumanReadyGrants
    .filter((grant) => assessGrantForReview(grant, reviewLearning, triageLens).isReviewable)
    .sort((a, b) => sortForTriage(a, b, reviewLearning, triageLens));
  const fallbackSuggestedGrants = ungatedHumanReadyGrants
    .filter((grant) => assessGrantForReview(grant, reviewLearning, triageLens).score >= OBVIOUS_NO_GO_THRESHOLD)
    .sort((a, b) => sortForTriage(a, b, reviewLearning, triageLens));
  const suggestedGrants = humanReadyGrants.length > 0 ? humanReadyGrants : fallbackSuggestedGrants;
  const humanReadyTop5 = suggestedGrants.slice(0, 5);
  const quickTriageQueue = suggestedGrants.filter((grant) => !triageSkippedIds.has(grant.grant_id));
  const quickTriageGrant = quickTriageQueue[0] ?? null;
  const quickTriageAssessment = quickTriageGrant
    ? assessGrantForReview(quickTriageGrant, reviewLearning, triageLens)
    : null;
  const learningHiddenGrantIds = useMemo(() => {
    const hidden = new Set<string>();
    for (const grant of grants) {
      if (grant.stage !== 'discovered' || isMachineCleanCandidate(grant)) continue;
      if (assessGrantForReview(grant, reviewLearning, triageLens).score < OBVIOUS_NO_GO_THRESHOLD) {
        hidden.add(grant.grant_id);
      }
    }
    return hidden;
  }, [grants, reviewLearning, triageLens]);
  const reviewHiddenGrantIds = useMemo(() => {
    const hidden = new Set<string>(learningHiddenGrantIds);
    for (const grant of machineCleanCandidates) {
      hidden.add(grant.grant_id);
    }
    return hidden;
  }, [learningHiddenGrantIds, machineCleanCandidates]);
  const hiddenBeforeReviewCount = reviewHiddenGrantIds.size;
  const visibleHumanReadyCount = suggestedGrants.length;
  const visibleMachinePassCount = machineCleanCandidates.length + learningHiddenGrantIds.size;

  const runAutoReview = async () => {
    if (viewMode !== 'personal') return;
    setAutoReviewing(true);
    setPreSweepError(null);
    try {
      const response = await fetch('/api/tracker/auto-review', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ lens: triageLens }),
      });
      if (!response.ok) {
        const data = await response.json().catch(() => null);
        throw new Error(data?.error || 'Machine review failed');
      }
      const data = await response.json();
      setAutoReview(data);
      setTriageSkippedIds(new Set());
      await loadGrants(false);
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Machine review failed';
      setPreSweepError(`${message}. Nothing was changed after the failed request.`);
    } finally {
      setAutoReviewing(false);
    }
  };

  const updateGrantStage = useCallback(
    async (grantId: string, stage: string) => {
      const previousGrants = grants;
      const now = new Date().toISOString();
      const nextGrants = previousGrants.map((grant) =>
        grant.grant_id === grantId ? { ...grant, stage, updated_at: now } : grant
      );

      setPreSweepError(null);
      setGrants(nextGrants);

      try {
        const response = await fetch(`/api/tracker/${grantId}`, {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ stage }),
        });
        if (!response.ok) throw new Error('Stage update failed');
      } catch {
        setGrants(previousGrants);
        setPreSweepError('Could not update that grant. Try again from the card.');
      }
    },
    [grants]
  );

  const handleQuickNo = useCallback(
    (grantId: string) => {
      setTriageSkippedIds((previous) => {
        const next = new Set(previous);
        next.delete(grantId);
        return next;
      });
      recordNoFeedback(grantId, 'tracker_quick_triage');
      void updateGrantStage(grantId, 'lost');
    },
    [updateGrantStage]
  );

  const handleQuickLater = useCallback((grantId: string) => {
    setTriageSkippedIds((previous) => new Set(previous).add(grantId));
  }, []);

  const handleQuickResearch = useCallback(
    (grantId: string) => {
      setTriageSkippedIds((previous) => {
        const next = new Set(previous);
        next.delete(grantId);
        return next;
      });
      void updateGrantStage(grantId, 'researching');
    },
    [updateGrantStage]
  );

  const handleDirectiveAction = useCallback(
    async (kind: DirectiveActionKind) => {
      if (!directive || directiveAction) return;
      const confirmWrite =
        kind === 'send_to_ghl'
          ? window.confirm('Create or update this opportunity in HighLevel? This will not send email or SMS.')
          : false;
      if (kind === 'send_to_ghl' && !confirmWrite) return;

      setDirectiveAction(kind);
      setDirectiveMessage(null);
      try {
        const response = await fetch('/api/opportunity-intelligence/actions', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            kind,
            signalId: directive.signalId,
            signal: directive.signal,
            route: directive,
            confirmWrite,
            reason: kind === 'no' ? 'Not aligned enough for ACT right now' : undefined,
            evidenceGaps: directive.evidence_gaps,
          }),
        });
        const receipt = await response.json().catch(() => null);
        if (!response.ok) {
          throw new Error(receipt?.detail || receipt?.error || receipt?.warnings?.[0] || 'Action failed');
        }
        const warning = Array.isArray(receipt?.warnings) && receipt.warnings.length ? ` ${receipt.warnings[0]}` : '';
        setDirectiveMessage(`${receipt?.status || 'planned'}: ${receipt?.nextStep || 'Action recorded.'}${warning}`);
        await loadDirective();
      } catch (error) {
        setDirectiveMessage(error instanceof Error ? error.message : 'Could not record that route decision.');
      } finally {
        setDirectiveAction(null);
      }
    },
    [directive, directiveAction, loadDirective]
  );

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
              {showGuidedOnboarding ? 'Build Your Grant Pipeline' : completedMode ? 'Your Tracker Is Live' : 'Today’s Opportunity Decision'}
            </h1>
            <p className="mt-1 text-sm font-medium text-bauhaus-muted">
              {showGuidedOnboarding
                ? 'Your shortlisted grants are here. Move the strongest options out of Discovered and use the board as your working queue.'
                : completedMode
                ? 'You have moved at least one grant into active pipeline work. From here, use the tracker as your working system and the home dashboard as your daily summary.'
                : 'Start here. CivicGraph chooses one recommended move, then you either reject it, park it, investigate it, or turn it into real pipeline work.'}
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
          <OpportunityDirectivePanel
            route={directive}
            loading={directiveLoading}
            actingKind={directiveAction}
            actionMessage={directiveMessage}
            learningCount={directiveLearningCount}
            onAction={handleDirectiveAction}
          />

          <TrackerProcess
            cleanableCount={visibleMachinePassCount}
            deadlineCount={deadlineDecisionGrants.length}
            reviewCount={visibleHumanReadyCount}
            hiddenBeforeReviewCount={hiddenBeforeReviewCount}
            activeCount={activeCount}
            discoveredCount={discoveredCount}
            autoReviewing={autoReviewing}
            viewMode={viewMode}
            activeLens={triageLens}
            autoReview={autoReview}
            preSweepError={preSweepError}
            onRunAutoReview={runAutoReview}
            onLensChange={setTriageLens}
          />

          <QuickTriagePanel
            item={quickTriageGrant}
            remainingCount={quickTriageQueue.length}
            suppressedCount={hiddenBeforeReviewCount}
            activeLens={triageLens}
            assessment={quickTriageAssessment}
            onNo={handleQuickNo}
            onLater={handleQuickLater}
            onResearch={handleQuickResearch}
          />

          <div className="mb-6 grid min-w-0 gap-4 xl:grid-cols-2">
            <section className="min-w-0 overflow-hidden border-4 border-bauhaus-black bg-white">
              <div className="border-b-2 border-bauhaus-black/10 px-4 py-3">
                <div className="text-[10px] font-black uppercase tracking-[0.3em] text-bauhaus-muted">
                  Decide this week
                </div>
                <p className="mt-1 text-xs font-medium text-bauhaus-muted">
                  These close soon. Open one, decide pursue / park / no-go, then move it on the board.
                </p>
              </div>
              {deadlineDecisionGrants.length > 0 ? (
                deadlineDecisionGrants.slice(0, 5).map((item) => (
                  <DecisionGrantRow key={item.id} item={item} />
                ))
              ) : (
                <div className="p-4 text-sm font-medium text-bauhaus-muted">No tracked grants closing this week.</div>
              )}
            </section>

            <section className="min-w-0 overflow-hidden border-4 border-bauhaus-black bg-white">
              <div className="border-b-2 border-bauhaus-black/10 px-4 py-3">
                <div className="text-[10px] font-black uppercase tracking-[0.3em] text-bauhaus-muted">
                  Suggested next 5
                </div>
                <p className="mt-1 text-xs font-medium text-bauhaus-muted">
                  These are the best current {triageLens} candidates. Review only these before going back to search.
                </p>
              </div>
              {humanReadyTop5.length > 0 ? (
                humanReadyTop5.map((item) => (
                  <DecisionGrantRow key={item.id} item={item} />
                ))
              ) : (
                <div className="p-4 text-sm font-medium text-bauhaus-muted">Nothing reviewable after cleanup.</div>
              )}
            </section>
          </div>
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
