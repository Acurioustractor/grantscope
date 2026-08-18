'use client';

import { useEffect, useState, useTransition } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { trackProductEvent } from '@/lib/product-events-client';
import { startCheckoutForTier } from '@/lib/start-checkout';
import type { ReviewSweepStatus } from '@/lib/review-pre-sweep';
import type { AlertFrequency, Tier } from '@/lib/subscription';
import { SlidePanel, SlidePanelHeader, SlidePanelBody } from '../components/slide-panel';

/* ── Shared types (serializable from server) ── */

export interface GrantItem {
  id: string;
  stage: string;
  grant: {
    id: string;
    name: string;
    provider: string;
    amount_min: number | null;
    amount_max: number | null;
    closes_at: string | null;
    categories: string[];
    url?: string | null;
    updated_at?: string | null;
    focus_areas?: string[] | null;
    description?: string | null;
    source?: string | null;
    fit_score?: number | null;
    relevance_score?: number | null;
  } | null;
}

export interface ActRecommendationItem {
  project_code: string;
  opportunity_id: string;
  opportunity_name: string;
  funder_name: string | null;
  fit_score: number;
  deadline: string | null;
  max_grant_amount: number | null;
  source_url: string | null;
  is_strong_fit: boolean;
  temperature: 'WARM' | 'TEPID' | 'LIGHT' | 'COLD';
  relationship_score: number;
  decision: string | null;
}

export interface ActProjectLens {
  project_code: string;
  project_label: string;
  status: 'active' | 'scout' | 'blocked' | 'needs_repair';
  status_message: string;
  strong_fits_count: number;
  deadlines_30d_count: number;
  max_score: number;
  top_fits: ActRecommendationItem[];
}

export interface FoundationItem {
  id: string;
  stage: string;
  foundation: {
    id: string;
    name: string;
    total_giving_annual: number | null;
    thematic_focus: string[];
    geographic_focus: string[];
  } | null;
}

export interface AgentRun {
  id: string;
  agent_name: string;
  status: string;
  items_found: number | null;
  items_new: number | null;
  started_at: string;
  duration_ms: number | null;
}

export interface AlertActivityItem {
  id: string;
  notification_type: string;
  status: string;
  subject: string | null;
  match_score: number | null;
  match_signals: string[];
  queued_at: string;
  sent_at: string | null;
  last_error: string | null;
  alert: {
    id: string;
    name: string;
    frequency: string;
    enabled: boolean;
  } | null;
  grant: {
    id: string;
    name: string;
    provider: string | null;
    closes_at: string | null;
  } | null;
}

export interface AlertLearningItem {
  id: string;
  name: string;
  frequency: string;
  enabled: boolean;
  last_sent_at: string | null;
  match_count: number | null;
  sent: number;
  clicks: number;
  tracked: number;
  lastOptimizedAt: string | null;
  lastOptimizationAction: string | null;
  recommendation: {
    key:
      | 'keep_expand'
      | 'working_pipeline'
      | 'good_prospect_flow'
      | 'clicks_not_converting'
      | 'low_engagement'
      | 'low_fit'
      | 'no_recent_activity'
      | 'monitor'
      | 'optimization_improving'
      | 'optimization_underperforming';
    tone: 'success' | 'info' | 'warning' | 'neutral';
    title: string;
    detail: string;
  };
  optimizationComparison: {
    hasComparisonData: boolean;
    enoughComparisonData: boolean;
    delta: {
      openRate: number | null;
      clickRate: number | null;
      trackRate: number | null;
    };
  } | null;
}

export interface ScenarioFocus {
  title: string;
  detail: string;
  nextAction: string;
  href: string;
  tone: 'ready' | 'blocked' | 'watch';
  primaryMetric: {
    label: string;
    value: string;
  };
  secondaryMetric: {
    label: string;
    value: string;
  };
}

export interface SourceFreshnessStatus {
  grantsUpdated7d: number;
  staleOpenGrants: number;
  grantsMissingUrl: number;
  frontierDue: number;
  frontierChanged7d: number;
  frontierFailing: number;
  frontierPriority: {
    id: string;
    project: 'Goods' | 'JusticeHub' | 'Empathy Ledger';
    title: string;
    sourceKind: string;
    reason: string;
    href: string;
    priority: number;
  }[];
  scoutRuns: {
    agent_id: string;
    agent_name: string;
    status: string;
    items_found: number | null;
    items_new: number | null;
    items_updated: number | null;
    started_at: string;
    completed_at: string | null;
  }[];
}

type ActionFeedback = {
  tone: 'success' | 'error';
  message: string;
};

type NotificationOverride = {
  status?: string;
  last_error?: string | null;
};

export type PreSweepRunResult = {
  ranAt: string;
  applied: {
    expiredUpdated: number;
    staleUpdated: number;
    missingUrlUpdated: number;
    noDeadlineUpdated: number;
  };
  before: ReviewSweepStatus;
  sweep: ReviewSweepStatus;
  decisionBatch: {
    humanReadyTop5: {
      savedGrantId: string;
      grantId: string;
      name: string | null;
      provider: string | null;
      amountMin: number | null;
      amountMax: number | null;
      closesAt: string | null;
      categories: string[];
      url: string | null;
      fitScore: number | null;
      relevanceScore: number | null;
    }[];
  };
  nextSteps: string[];
};

interface HomeClientProps {
  greeting: string;
  contextLine: string;
  profileReady: boolean;
  hasShortlistedGrants: boolean;
  hasWorkedGrantPipeline: boolean;
  grants: GrantItem[];
  foundations: FoundationItem[];
  agentRuns: AgentRun[];
  activeAlertCount: number;
  recentAlertActivity: AlertActivityItem[];
  alertLearning: AlertLearningItem[];
  alertLearningSummary: {
    improving: number;
    needsAttention: number;
    stable: number;
  };
  subscriptionTier: Tier;
  alertEntitlements: {
    maxAlerts: number;
    frequencies: AlertFrequency[];
    weeklyDigest: boolean;
  };
  billingStatus: {
    tone: 'warning' | 'error' | 'info';
    title: string;
    detail: string;
    primaryLabel: string;
    primaryHref: string;
    secondaryLabel: string;
    secondaryHref: string;
  } | null;
  openGrantCount: number;
  entityCount: number;
  urgentDeadlines: GrantItem[];
  soonDeadlines: GrantItem[];
  actUrgentRecs: ActRecommendationItem[];
  actProjectLenses: ActProjectLens[];
  discoveredCount: number;
  activeCount: number;
  submittedCount: number;
  wonCount: number;
  scenarioFocus: ScenarioFocus | null;
  sourceFreshness: SourceFreshnessStatus;
  reviewSweep?: ReviewSweepStatus;
  autoRunPreSweepKey?: string | null;
  initialPreSweepRun?: PreSweepRunResult | null;
}

function formatMoney(amount: number | null): string {
  if (!amount) return '\u2014';
  if (amount >= 1_000_000) return `$${(amount / 1_000_000).toFixed(1)}M`;
  if (amount >= 1_000) return `$${(amount / 1_000).toFixed(0)}K`;
  return `$${amount.toLocaleString()}`;
}

function daysUntil(dateStr: string): number {
  const diff = new Date(dateStr).getTime() - Date.now();
  return Math.max(0, Math.ceil(diff / (1000 * 60 * 60 * 24)));
}

function relativeTime(dateStr: string): string {
  const diff = Date.now() - new Date(dateStr).getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h ago`;
  const days = Math.floor(hrs / 24);
  return `${days}d ago`;
}

function formatDate(dateStr: string | null): string {
  if (!dateStr) return 'Ongoing';
  return new Date(dateStr).toLocaleDateString('en-AU', { day: 'numeric', month: 'short', year: 'numeric' });
}

const ALERT_STATUS_STYLES: Record<string, { bg: string; color: string }> = {
  queued: { bg: 'rgba(217,119,6,0.1)', color: 'var(--ws-amber)' },
  sent: { bg: 'rgba(22,163,74,0.1)', color: 'var(--ws-green)' },
  failed: { bg: 'rgba(220,38,38,0.08)', color: 'var(--ws-red)' },
  cancelled: { bg: 'var(--ws-surface-2)', color: 'var(--ws-text-tertiary)' },
};

type PreviewTarget =
  | { type: 'grant'; item: GrantItem }
  | { type: 'foundation'; item: FoundationItem }
  | null;

export function HomeClient(props: HomeClientProps) {
  const router = useRouter();
  const [preview, setPreview] = useState<PreviewTarget>(null);
  const [pendingTrackGrantId, setPendingTrackGrantId] = useState<string | null>(null);
  const [pendingPauseAlertId, setPendingPauseAlertId] = useState<string | null>(null);
  const [pendingNotificationAction, setPendingNotificationAction] = useState<{ id: string; action: 'retry' | 'cancel' } | null>(null);
  const [optimisticTrackedGrantIds, setOptimisticTrackedGrantIds] = useState<string[]>([]);
  const [optimisticPausedAlertIds, setOptimisticPausedAlertIds] = useState<string[]>([]);
  const [notificationOverrides, setNotificationOverrides] = useState<Record<string, NotificationOverride>>({});
  const [feedback, setFeedback] = useState<ActionFeedback | null>(null);
  const {
    greeting, contextLine, profileReady, hasShortlistedGrants, hasWorkedGrantPipeline,
    grants, foundations, agentRuns, activeAlertCount, recentAlertActivity, alertLearning, alertLearningSummary, subscriptionTier, alertEntitlements, billingStatus, openGrantCount, entityCount,
    urgentDeadlines, soonDeadlines,
    actUrgentRecs, actProjectLenses,
    discoveredCount, activeCount, submittedCount, wonCount,
    scenarioFocus,
    sourceFreshness,
    reviewSweep,
    autoRunPreSweepKey,
    initialPreSweepRun,
  } = props;
  const [preSweepRun, setPreSweepRun] = useState<PreSweepRunResult | null>(initialPreSweepRun || null);
  const [isRunningPreSweep, setIsRunningPreSweep] = useState(false);
  const [isRefreshing, startRefresh] = useTransition();
  const [startingUpgrade, setStartingUpgrade] = useState(false);
  const baseReviewSweep: ReviewSweepStatus = reviewSweep ?? {
    total: discoveredCount,
    machinePass: 0,
    humanReady: discoveredCount,
    expired: 0,
    stale: 0,
    missingUrl: 0,
    noDeadline: 0,
    wikiCandidates: 0,
    onlineFrontier: sourceFreshness.frontierPriority.length,
  };
  const currentReviewSweep = preSweepRun?.sweep ?? baseReviewSweep;
  const showActivation = !profileReady || !hasShortlistedGrants || !hasWorkedGrantPipeline;
  const trackerHref = hasWorkedGrantPipeline ? '/tracker' : '/tracker?onboarding=1';
  const pausedAlertIds = new Set(optimisticPausedAlertIds);
  const trackedGrantIds = new Set([
    ...grants.map((item) => item.grant?.id).filter(Boolean),
    ...optimisticTrackedGrantIds,
  ]);
  const effectiveActiveAlertCount = Math.max(0, activeAlertCount - pausedAlertIds.size);
  const effectiveRecentAlertActivity = recentAlertActivity.map((activity) => {
    const override = notificationOverrides[activity.id];
    return override
      ? {
          ...activity,
          status: override.status ?? activity.status,
          last_error: override.last_error === undefined ? activity.last_error : override.last_error,
        }
      : activity;
  });
  const recentQueuedAlerts = effectiveRecentAlertActivity.filter((activity) => activity.status === 'queued').length;
  const recentSentAlerts = effectiveRecentAlertActivity.filter((activity) => activity.status === 'sent').length;
  const failedAlertCount = effectiveRecentAlertActivity.filter((activity) => activity.status === 'failed').length;
  const trackedFromAlerts = alertLearning.reduce((sum, alert) => sum + alert.tracked, 0);
  const visibleAlertLearning = alertLearning.slice(0, 2);
  const alertNeedsAttention = alertLearningSummary.needsAttention > 0 || failedAlertCount > 0;
  const visibleAlertActivity = effectiveRecentAlertActivity.filter((activity) => activity.status === 'failed').slice(0, 2);
  const allWorkbenchDeadlines = [...urgentDeadlines, ...soonDeadlines];
  const workbenchDeadlines = allWorkbenchDeadlines.slice(0, 6);
  const hiddenWorkbenchDeadlineCount = Math.max(0, allWorkbenchDeadlines.length - workbenchDeadlines.length);
  const showAlertUpsell = subscriptionTier === 'community';
  const sourceFreshnessTone =
    sourceFreshness.frontierFailing > 0 || sourceFreshness.grantsMissingUrl > 100
      ? 'warning'
      : sourceFreshness.frontierDue > 0
        ? 'info'
        : 'success';
  const todayActions = [
    {
      label: 'Triage deadlines',
      value: urgentDeadlines.length.toLocaleString(),
      detail: urgentDeadlines.length > 0
        ? 'Decide pursue, park, or no-go before the week closes.'
        : 'No tracked grants close in the next seven days.',
      href: urgentDeadlines.length > 0 ? '#grant-workbench' : '/grants',
      tone: urgentDeadlines.length > 0 ? 'danger' : 'calm',
    },
    {
      label: 'Pre-sweep review',
      value: discoveredCount.toLocaleString(),
      detail: discoveredCount > 0
        ? 'Let the system clean, verify, and enrich the backlog before CT reviews it.'
        : 'The review queue is clear.',
      href: '#pre-sweep',
      tone: discoveredCount > 100 ? 'warning' : 'calm',
    },
    {
      label: 'Move active work',
      value: activeCount.toLocaleString(),
      detail: activeCount > 0
        ? 'Push active grants toward evidence, partner contact, or submission.'
        : 'No active grant work is underway.',
      href: trackerHref,
      tone: activeCount > 0 ? 'info' : 'calm',
    },
  ] as const;
  const primaryCommands = [
    {
      href: '/grants',
      label: 'Search grants',
      detail: `${openGrantCount.toLocaleString()} open opportunities in the database`,
      context: 'Scout',
      tone: 'neutral',
    },
    {
      href: trackerHref,
      label: 'Grant tracker',
      detail: `${discoveredCount.toLocaleString()} pre-sweep, ${activeCount.toLocaleString()} active`,
      context: discoveredCount > 100 ? 'Backlog' : 'Pipeline',
      tone: discoveredCount > 100 ? 'warning' : 'neutral',
    },
    {
      href: '/opportunities/ecosystem',
      label: 'Opportunity cockpit',
      detail: scenarioFocus?.title || 'ACT project lenses, source health, and next actions',
      context: scenarioFocus?.tone === 'blocked' ? 'Blocked' : 'ACT',
      tone: scenarioFocus?.tone === 'blocked' ? 'warning' : 'info',
    },
    {
      href: '/procurement',
      label: 'Tender intelligence',
      detail: 'Buyer pathways, contracts, suppliers, and decision packs',
      context: 'Procurement',
      tone: 'neutral',
    },
    {
      href: '/briefing',
      label: 'Briefing hub',
      detail: 'Carry the same evidence into memos, packs, reports, and story handoffs',
      context: 'Brief',
      tone: 'neutral',
    },
    {
      href: '/entities',
      label: 'Entity graph',
      detail: `${entityCount.toLocaleString()} entities for due diligence and relationship mapping`,
      context: 'Graph',
      tone: 'neutral',
    },
  ] as const;
  const secondaryCommands = [
    { href: '/profile/matches', label: 'Matched grants' },
    { href: '/alerts', label: 'Grant alerts' },
    { href: '/foundations/tracker', label: 'Foundation tracker' },
    { href: '/power', label: 'Power map' },
    { href: '/insights', label: 'Data clarity' },
    { href: '/reports', label: 'Reports' },
    { href: '/home/watchlist', label: 'Watchlist' },
  ] as const;
  const preSweepLanes = [
    {
      label: 'Machine clean',
      value: currentReviewSweep.machinePass.toLocaleString(),
      detail: `${currentReviewSweep.expired.toLocaleString()} expired, ${currentReviewSweep.stale.toLocaleString()} stale, ${currentReviewSweep.missingUrl.toLocaleString()} missing URLs, ${currentReviewSweep.noDeadline.toLocaleString()} without deadlines.`,
      href: '/mission-control',
      action: 'Run sweep',
      tone: currentReviewSweep.machinePass > 0 ? 'warning' : 'neutral',
    },
    {
      label: 'Wiki enrich',
      value: currentReviewSweep.wikiCandidates.toLocaleString(),
      detail: 'Search Tractorpedia/wiki for project fit, evidence packs, partners, and missing ACT context.',
      href: '/opportunities/ecosystem',
      action: 'Open cockpit',
      tone: currentReviewSweep.wikiCandidates > 0 ? 'info' : 'neutral',
    },
    {
      label: 'Online scout',
      value: currentReviewSweep.onlineFrontier.toLocaleString(),
      detail: 'Refresh adjacent source pages, funder sites, procurement pages, and foundation programs before triage.',
      href: '#source-freshness',
      action: 'View frontier',
      tone: currentReviewSweep.onlineFrontier > 0 ? 'info' : 'neutral',
    },
    {
      label: 'Human-ready',
      value: currentReviewSweep.humanReady.toLocaleString(),
      detail: 'Only these should become CT decision work after the machine pass has removed obvious noise.',
      href: trackerHref,
      action: 'Review tracker',
      tone: currentReviewSweep.humanReady > 0 ? 'success' : 'neutral',
    },
  ] as const;
  const dailyRhythm = [
    {
      step: '1',
      label: 'Scan',
      time: '5 min',
      detail: 'Read the focus stack, Goods blocker, and source freshness before opening any detail page.',
      href: '#grant-workbench',
    },
    {
      step: '2',
      label: 'Pre-sweep',
      time: '20 min',
      detail: currentReviewSweep.total > 0
        ? `Clean ${currentReviewSweep.machinePass.toLocaleString()} machine-pass item${currentReviewSweep.machinePass !== 1 ? 's' : ''} before opening the human queue.`
        : 'No pre-sweep backlog needs attention.',
      href: '#pre-sweep',
    },
    {
      step: '3',
      label: 'Decide',
      time: '20 min',
      detail: urgentDeadlines.length > 0
        ? `Resolve the first ${Math.min(3, urgentDeadlines.length)} deadline decision${Math.min(3, urgentDeadlines.length) !== 1 ? 's' : ''}: pursue, park, or no-go.`
        : 'Review only the human-ready opportunities left after the pre-sweep.',
      href: '#grant-workbench',
    },
    {
      step: '4',
      label: 'Scout',
      time: '15 min',
      detail: sourceFreshness.frontierPriority.length > 0
        ? 'Check the first three priority frontier sources, then update or ignore with a reason.'
        : 'Review source health and decide what needs seeding into the frontier.',
      href: '#source-freshness',
    },
    {
      step: '5',
      label: 'File',
      time: '10 min',
      detail: 'Leave the trail: tracker stage, cockpit action, brief note, or alert tuning.',
      href: '/briefing',
    },
  ] as const;

  useEffect(() => {
    if (!feedback) return;
    const timeout = window.setTimeout(() => setFeedback(null), 4000);
    return () => window.clearTimeout(timeout);
  }, [feedback]);

  useEffect(() => {
    if (!autoRunPreSweepKey || preSweepRun || isRunningPreSweep) return;

    const storageKey = `home-pre-sweep:${autoRunPreSweepKey}`;
    if (window.localStorage.getItem(storageKey)) return;

    window.localStorage.setItem(storageKey, 'started');
    void runPreSweep({ storageKey });
  }, [autoRunPreSweepKey, preSweepRun, isRunningPreSweep]);

  useEffect(() => {
    if (!showAlertUpsell) return;
    void trackProductEvent('upgrade_prompt_viewed', {
      source: 'home_alerts_upsell',
      metadata: {
        tier: subscriptionTier,
        max_alerts: alertEntitlements.maxAlerts,
        weekly_digest: alertEntitlements.weeklyDigest,
      },
      onceKey: 'home_alerts_upsell:viewed',
    });
  }, [showAlertUpsell, subscriptionTier, alertEntitlements.maxAlerts, alertEntitlements.weeklyDigest]);

  function openGrant(item: GrantItem) {
    setPreview({ type: 'grant', item });
  }

  function openFoundation(item: FoundationItem) {
    setPreview({ type: 'foundation', item });
  }

  async function runPreSweep(options?: { storageKey?: string }) {
    setIsRunningPreSweep(true);
    setFeedback(null);
    try {
      const response = await fetch('/api/home/pre-sweep', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ applyExpired: true }),
      });
      const payload = await response.json();

      if (!response.ok) {
        throw new Error(payload?.error || 'Pre-sweep failed');
      }

      setPreSweepRun(payload as PreSweepRunResult);
      setFeedback({
        tone: 'success',
        message: `Pre-sweep complete. ${payload.applied?.expiredUpdated || 0} expired item${payload.applied?.expiredUpdated === 1 ? '' : 's'} moved out of review.`,
      });
      startRefresh(() => router.refresh());
    } catch (error) {
      if (options?.storageKey) window.localStorage.removeItem(options.storageKey);
      setFeedback({
        tone: 'error',
        message: error instanceof Error ? error.message : 'Pre-sweep failed',
      });
    } finally {
      setIsRunningPreSweep(false);
    }
  }

  async function trackGrant(grantId: string, options?: { alertId?: string | null; notificationId?: string | null }) {
    setPendingTrackGrantId(grantId);
    setOptimisticTrackedGrantIds((current) => current.includes(grantId) ? current : [...current, grantId]);
    try {
      const sourceAlertPreferenceId =
        options?.alertId && Number.isFinite(Number(options.alertId)) ? Number(options.alertId) : null;
      const res = await fetch(`/api/tracker/${grantId}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          stage: 'discovered',
          ...(sourceAlertPreferenceId !== null ? { source_alert_preference_id: sourceAlertPreferenceId } : {}),
          ...(options?.notificationId ? { source_notification_id: options.notificationId } : {}),
          ...(sourceAlertPreferenceId !== null || options?.notificationId ? { source_attribution_type: 'manual' } : {}),
        }),
      });

      if (!res.ok) {
        throw new Error('Failed to track grant');
      }

      setFeedback({ tone: 'success', message: 'Grant added to your tracker.' });

      startRefresh(() => {
        router.refresh();
      });
    } catch {
      setOptimisticTrackedGrantIds((current) => current.filter((id) => id !== grantId));
      setFeedback({ tone: 'error', message: 'Could not add this grant to your tracker.' });
    } finally {
      setPendingTrackGrantId(null);
    }
  }

  async function pauseAlert(alertId: string) {
    setPendingPauseAlertId(alertId);
    setOptimisticPausedAlertIds((current) => current.includes(alertId) ? current : [...current, alertId]);
    try {
      const res = await fetch(`/api/alerts/${alertId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ enabled: false }),
      });

      if (!res.ok) {
        throw new Error('Failed to pause alert');
      }

      setFeedback({ tone: 'success', message: 'Alert paused. You can re-enable it from Alerts.' });

      startRefresh(() => {
        router.refresh();
      });
    } catch {
      setOptimisticPausedAlertIds((current) => current.filter((id) => id !== alertId));
      setFeedback({ tone: 'error', message: 'Could not pause this alert.' });
    } finally {
      setPendingPauseAlertId(null);
    }
  }

  async function updateNotification(notificationId: string, action: 'retry' | 'cancel') {
    setPendingNotificationAction({ id: notificationId, action });
    setNotificationOverrides((current) => ({
      ...current,
      [notificationId]: action === 'retry'
        ? { status: 'queued', last_error: null }
        : { status: 'cancelled', last_error: 'Dismissed by user' },
    }));

    try {
      const res = await fetch('/api/alerts/notifications', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ notificationId, action }),
      });

      if (!res.ok) {
        throw new Error('Failed to update notification');
      }

      setFeedback({
        tone: 'success',
        message: action === 'retry'
          ? 'Notification re-queued for delivery.'
          : 'Notification dismissed from the queue.',
      });

      startRefresh(() => {
        router.refresh();
      });
    } catch {
      setNotificationOverrides((current) => {
        const next = { ...current };
        delete next[notificationId];
        return next;
      });
      setFeedback({
        tone: 'error',
        message: action === 'retry'
          ? 'Could not retry this notification.'
          : 'Could not dismiss this notification.',
      });
    } finally {
      setPendingNotificationAction(null);
    }
  }

  async function upgradeAlerts() {
    setStartingUpgrade(true);
    const result = await startCheckoutForTier('professional', 'home_alerts_upsell');
    if (!result.ok) {
      setFeedback({ tone: 'error', message: result.error });
      setStartingUpgrade(false);
    }
  }

  const priorityByProject = {
    Goods: sourceFreshness.frontierPriority.filter((item) => item.project === 'Goods'),
    JusticeHub: sourceFreshness.frontierPriority.filter((item) => item.project === 'JusticeHub'),
    'Empathy Ledger': sourceFreshness.frontierPriority.filter((item) => item.project === 'Empathy Ledger'),
  };
  const firstMove = urgentDeadlines.length > 0
    ? {
        label: 'First move today',
        title: `Decide ${Math.min(3, urgentDeadlines.length)} urgent grant${Math.min(3, urgentDeadlines.length) !== 1 ? 's' : ''}`,
        detail: `${urgentDeadlines.length} tracked deadline${urgentDeadlines.length !== 1 ? 's' : ''} close this week. Do not browse the database first; decide pursue, park, or no-go on the urgent lane.`,
        href: '#grant-decisions',
        action: 'Start deadline decisions',
        tone: 'danger',
      }
    : scenarioFocus?.tone === 'blocked'
      ? {
          label: 'First move today',
          title: 'Clear the Goods blocker',
          detail: scenarioFocus.nextAction,
          href: scenarioFocus.href,
          action: 'Open blocker',
          tone: 'warning',
        }
      : currentReviewSweep.machinePass > 0
        ? {
            label: 'First move today',
            title: 'Clean before review',
            detail: `${currentReviewSweep.machinePass.toLocaleString()} item${currentReviewSweep.machinePass !== 1 ? 's' : ''} should be machine-cleaned before CT reviews anything by hand.`,
            href: '#clean-review',
            action: 'Run pre-sweep',
            tone: 'info',
          }
        : activeCount > 0
          ? {
              label: 'First move today',
              title: 'Move active work',
              detail: `${activeCount.toLocaleString()} active grant${activeCount !== 1 ? 's' : ''} need evidence, partner contact, or submission movement.`,
              href: trackerHref,
              action: 'Open active work',
              tone: 'info',
            }
          : {
              label: 'First move today',
              title: 'Choose the next opportunity',
              detail: 'The urgent queue is clear. Use the router to pick the next ACT-fit pathway across grants, funders, procurement, buyers, and relationships.',
              href: '/opportunities/ecosystem',
              action: 'Open router',
              tone: 'success',
            };
  const projectLenses = [
    {
      name: 'Goods',
      status: scenarioFocus?.title.toLowerCase().includes('goods') ? (scenarioFocus.tone === 'blocked' ? 'Blocked' : 'Watch') : 'Watch',
      opportunity: priorityByProject.Goods[0]?.title || scenarioFocus?.title || 'Capital, buyer, procurement, and governance pathway',
      missing: scenarioFocus?.title.toLowerCase().includes('goods') ? scenarioFocus.nextAction : 'Confirm buyer need, ask size, vehicle, and support route before promotion.',
      action: 'Open Goods route',
      href: '/opportunities/ecosystem?project=Goods',
      tone: scenarioFocus?.title.toLowerCase().includes('goods') && scenarioFocus.tone === 'blocked' ? 'warning' : 'info',
      metric: `${priorityByProject.Goods.length} source${priorityByProject.Goods.length !== 1 ? 's' : ''}`,
    },
    {
      name: 'JusticeHub',
      status: priorityByProject.JusticeHub.length > 0 ? 'Scout' : 'Monitor',
      opportunity: priorityByProject.JusticeHub[0]?.title || 'Youth justice funders, policy signals, and community-led program evidence',
      missing: 'Attach live evidence and relationship context before moving a grant or partner path.',
      action: 'Open JusticeHub route',
      href: '/opportunities/ecosystem?project=JusticeHub',
      tone: 'danger',
      metric: `${priorityByProject.JusticeHub.length} source${priorityByProject.JusticeHub.length !== 1 ? 's' : ''}`,
    },
    {
      name: 'Empathy Ledger',
      status: priorityByProject['Empathy Ledger'].length > 0 ? 'Scout' : 'Monitor',
      opportunity: priorityByProject['Empathy Ledger'][0]?.title || 'Story, rights, lived-experience, digital, and data-sovereignty pathways',
      missing: 'Confirm narrative sovereignty, partner role, and evidence chain before a funder brief.',
      action: 'Open Empathy route',
      href: '/opportunities/ecosystem?project=Empathy%20Ledger',
      tone: 'success',
      metric: `${priorityByProject['Empathy Ledger'].length} source${priorityByProject['Empathy Ledger'].length !== 1 ? 's' : ''}`,
    },
    {
      name: 'CivicGraph',
      status: sourceFreshness.frontierFailing > 0 ? 'Needs repair' : 'Healthy',
      opportunity: `${openGrantCount.toLocaleString()} open grants, ${entityCount.toLocaleString()} entities, ${sourceFreshness.grantsUpdated7d.toLocaleString()} grants refreshed this week`,
      missing: sourceFreshness.frontierFailing > 0
        ? `${sourceFreshness.frontierFailing.toLocaleString()} source${sourceFreshness.frontierFailing !== 1 ? 's' : ''} failing; repair in source health.`
        : 'Keep the source frontier moving and feed only ranked opportunities into ACT decisions.',
      action: 'Open source health',
      href: '/reports/grant-frontier',
      tone: sourceFreshness.frontierFailing > 0 ? 'warning' : 'neutral',
      metric: `${sourceFreshness.frontierChanged7d.toLocaleString()} changed`,
    },
  ] as const;
  const compactCommands = [
    { href: '/opportunities/ecosystem', label: 'Opportunity Router', detail: 'Best ACT-fit routes across grants, funders, procurement, buyers, and GHL' },
    { href: trackerHref, label: 'Active Work', detail: 'Only accepted research, partner, apply, and follow-up work' },
    { href: '/reports/grant-frontier', label: 'Source Health', detail: 'Live web sources, stale grants, failing URLs, and frontier pressure' },
    { href: '/mission-control', label: 'System Ops', detail: 'Agents, runs, discoveries, ACK/dismiss, and operational status' },
    { href: '/briefing', label: 'Briefing Hub', detail: 'Turn evidence into a memo, pack, report, story, or handoff' },
    { href: '/entities', label: 'Entity Graph', detail: 'Due diligence, relationships, ABNs, funders, contractors, and people' },
  ] as const;
  const decisionDeadlines = workbenchDeadlines.slice(0, 5);
  const topFrontierSources = sourceFreshness.frontierPriority.slice(0, 3);
  const showDecisionHome = true;

  if (showDecisionHome) {
    return (
      <div className="max-w-[1440px] space-y-6">
        <header>
          <p className="text-xs font-semibold uppercase tracking-wide" style={{ color: 'var(--ws-text-tertiary)' }}>
            CivicGraph operating home
          </p>
          <h1 className="mt-2 text-2xl font-semibold tracking-tight" style={{ color: 'var(--ws-text)' }}>
            {greeting}
          </h1>
          <p className="mt-1 text-sm" style={{ color: 'var(--ws-text-secondary)' }}>
            {contextLine}
          </p>
        </header>

        {feedback && (
          <div
            className="rounded-lg border px-4 py-3 text-sm font-medium"
            role={feedback.tone === 'error' ? 'alert' : 'status'}
            style={{
              borderColor: feedback.tone === 'error' ? 'var(--ws-red)' : 'var(--ws-green)',
              background: feedback.tone === 'error' ? 'rgba(220,38,38,0.08)' : 'rgba(22,163,74,0.08)',
              color: feedback.tone === 'error' ? 'var(--ws-red)' : 'var(--ws-green)',
            }}
          >
            {feedback.message}
          </div>
        )}

        {billingStatus && (
          <div
            className="rounded-lg border p-4"
            style={{
              borderColor:
                billingStatus.tone === 'error'
                  ? 'var(--ws-red)'
                  : billingStatus.tone === 'warning'
                    ? 'var(--ws-amber)'
                    : 'var(--ws-accent)',
              background:
                billingStatus.tone === 'error'
                  ? 'rgba(220,38,38,0.06)'
                  : billingStatus.tone === 'warning'
                    ? 'rgba(217,119,6,0.06)'
                    : 'rgba(37,99,235,0.05)',
            }}
          >
            <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
              <div>
                <p className="text-sm font-medium" style={{ color: 'var(--ws-text)' }}>{billingStatus.title}</p>
                <p className="mt-1 text-xs" style={{ color: 'var(--ws-text-secondary)' }}>{billingStatus.detail}</p>
              </div>
              <div className="flex shrink-0 gap-2">
                <Link href={billingStatus.primaryHref} className="rounded-lg px-3 py-2 text-xs font-medium" style={{ background: 'var(--ws-accent)', color: '#fff' }}>
                  {billingStatus.primaryLabel}
                </Link>
                <Link href={billingStatus.secondaryHref} className="rounded-lg border px-3 py-2 text-xs font-medium" style={{ borderColor: 'var(--ws-border)', color: 'var(--ws-text-secondary)' }}>
                  {billingStatus.secondaryLabel}
                </Link>
              </div>
            </div>
          </div>
        )}

        {showActivation ? (
          <section className="rounded-xl border p-5" style={{ borderColor: 'var(--ws-accent)', background: 'rgba(37,99,235,0.04)' }}>
            <h2 className="text-base font-semibold" style={{ color: 'var(--ws-text)' }}>Set up the pipeline first</h2>
            <p className="mt-1 text-sm" style={{ color: 'var(--ws-text-secondary)' }}>
              Finish the minimum setup before using the operating home: profile, shortlist, then one real tracked opportunity.
            </p>
            <div className="mt-4 grid gap-3 md:grid-cols-3">
              {[
                { href: '/profile', step: '1', title: 'Complete profile', desc: 'Mission, domains, geography', done: profileReady },
                { href: '/profile/matches', step: '2', title: 'Shortlist matches', desc: 'Save only strong matches', done: hasShortlistedGrants },
                { href: '/tracker?onboarding=1', step: '3', title: 'Move one item', desc: 'Start real pipeline work', done: hasWorkedGrantPipeline },
              ].map((item) => (
                <Link
                  key={item.href}
                  href={item.href}
                  className="rounded-lg border p-3 transition-colors hover:border-[var(--ws-accent)]"
                  style={{ borderColor: item.done ? 'var(--ws-green)' : 'var(--ws-border)', background: 'var(--ws-surface-1)' }}
                >
                  <div className="flex items-start gap-3">
                    <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full text-xs font-semibold" style={{ background: item.done ? 'var(--ws-green)' : 'var(--ws-surface-2)', color: item.done ? '#fff' : 'var(--ws-text-secondary)' }}>
                      {item.done ? 'OK' : item.step}
                    </span>
                    <div>
                      <p className="text-sm font-medium" style={{ color: 'var(--ws-text)' }}>{item.title}</p>
                      <p className="mt-0.5 text-xs" style={{ color: 'var(--ws-text-tertiary)' }}>{item.desc}</p>
                    </div>
                  </div>
                </Link>
              ))}
            </div>
          </section>
        ) : null}

        <section
          className="rounded-xl border p-5"
          style={{
            borderColor:
              firstMove.tone === 'danger'
                ? 'var(--ws-red)'
                : firstMove.tone === 'warning'
                  ? 'var(--ws-amber)'
                  : firstMove.tone === 'success'
                    ? 'var(--ws-green)'
                    : 'var(--ws-accent)',
            background:
              firstMove.tone === 'danger'
                ? 'rgba(220,38,38,0.06)'
                : firstMove.tone === 'warning'
                  ? 'rgba(217,119,6,0.06)'
                  : firstMove.tone === 'success'
                    ? 'rgba(22,163,74,0.05)'
                    : 'rgba(37,99,235,0.05)',
          }}
        >
          <div className="grid gap-5 lg:grid-cols-[minmax(0,1fr)_320px] lg:items-end">
            <div>
              <p className="text-xs font-semibold uppercase tracking-wide" style={{ color: 'var(--ws-text-tertiary)' }}>
                {firstMove.label}
              </p>
              <h2 className="mt-2 text-2xl font-semibold tracking-tight" style={{ color: 'var(--ws-text)' }}>
                {firstMove.title}
              </h2>
              <p className="mt-2 max-w-3xl text-sm leading-6" style={{ color: 'var(--ws-text-secondary)' }}>
                {firstMove.detail}
              </p>
            </div>
            <div className="flex flex-col gap-2 sm:flex-row lg:flex-col">
              {firstMove.href === '#clean-review' ? (
                <button
                  type="button"
                  onClick={() => void runPreSweep()}
                  disabled={isRunningPreSweep || isRefreshing}
                  className="rounded-lg px-4 py-3 text-sm font-medium transition-opacity disabled:opacity-50"
                  style={{ background: 'var(--ws-accent)', color: '#fff' }}
                >
                  {isRunningPreSweep ? 'Running pre-sweep...' : firstMove.action}
                </button>
              ) : (
                <Link href={firstMove.href} className="rounded-lg px-4 py-3 text-center text-sm font-medium" style={{ background: 'var(--ws-accent)', color: '#fff' }}>
                  {firstMove.action}
                </Link>
              )}
              <Link href="/opportunities/ecosystem" className="rounded-lg border px-4 py-3 text-center text-sm font-medium" style={{ borderColor: 'var(--ws-border)', color: 'var(--ws-text-secondary)', background: 'var(--ws-surface-0)' }}>
                Open Opportunity Router
              </Link>
            </div>
          </div>
        </section>

        <section className="rounded-xl border p-4" style={{ borderColor: 'var(--ws-border)', background: 'var(--ws-surface-1)' }}>
          <div className="mb-4 flex items-center justify-between gap-3">
            <div>
              <h2 className="text-base font-semibold" style={{ color: 'var(--ws-text)' }}>Cut Through</h2>
              <p className="mt-1 text-xs" style={{ color: 'var(--ws-text-secondary)' }}>
                Three lanes only: decide what needs a human, build the blocker, and let agents handle the raw system work.
              </p>
            </div>
            <Link href="/briefing" className="shrink-0 text-xs font-medium hover:underline" style={{ color: 'var(--ws-accent)' }}>
              File the trail
            </Link>
          </div>
          <div className="grid gap-3 xl:grid-cols-[1.2fr_1fr_1fr]">
            <div id="grant-decisions" className="rounded-xl border p-4" style={{ borderColor: actUrgentRecs.length > 0 ? 'var(--ws-red)' : 'var(--ws-border)', background: 'var(--ws-surface-0)' }}>
              <div className="flex items-start justify-between gap-3">
                <div>
                  <p className="text-[11px] font-semibold uppercase tracking-wide" style={{ color: 'var(--ws-red)' }}>Human decision · ACT-fit</p>
                  <h3 className="mt-1 text-lg font-semibold" style={{ color: 'var(--ws-text)' }}>Decide the first three deadlines</h3>
                </div>
                <span className="text-2xl font-semibold tabular-nums" style={{ color: actUrgentRecs.length > 0 ? 'var(--ws-red)' : 'var(--ws-text-tertiary)' }}>
                  {actUrgentRecs.length.toLocaleString()}
                </span>
              </div>
              <p className="mt-2 text-xs leading-5" style={{ color: 'var(--ws-text-secondary)' }}>
                Strong-fit grants in the ACT recommendation MV with deadlines ≤14d. Already filtered by blocklist + your prior decisions.
              </p>
              <div className="mt-4 overflow-hidden rounded-lg border" style={{ borderColor: 'var(--ws-border)' }}>
                {actUrgentRecs.slice(0, 3).length > 0 ? actUrgentRecs.slice(0, 3).map((rec, index) => {
                  const days = rec.deadline ? daysUntil(rec.deadline) : null;
                  const tempBg = rec.temperature === 'WARM' ? '#16a34a'
                    : rec.temperature === 'TEPID' ? '#eab308'
                    : rec.temperature === 'LIGHT' ? '#9ca3af'
                    : '#d1d5db';
                  const tempColor = rec.temperature === 'TEPID' || rec.temperature === 'COLD' ? '#1f2937' : '#fff';
                  return (
                    <Link
                      key={`${rec.project_code}|${rec.opportunity_id}`}
                      href="/ops/grant-recommendations"
                      className="block px-3 py-2.5 transition-colors hover:bg-[var(--ws-surface-2)]"
                      style={{ borderTop: index > 0 ? '1px solid var(--ws-border)' : 'none', background: 'var(--ws-surface-1)' }}
                    >
                      <div className="flex items-start justify-between gap-3">
                        <div className="min-w-0">
                          <div className="flex items-center gap-1.5 flex-wrap">
                            <span className="px-1.5 py-0.5 text-[9px] font-bold uppercase tracking-wider rounded" style={{ background: tempBg, color: tempColor }}>{rec.temperature}</span>
                            <span className="px-1.5 py-0.5 text-[9px] font-bold uppercase tracking-wider rounded bg-bauhaus-black text-white" style={{ background: 'var(--ws-text)', color: 'var(--ws-surface-0)' }}>{rec.project_code}</span>
                            <span className="text-[10px] font-mono tabular-nums" style={{ color: 'var(--ws-text-tertiary)' }}>{rec.fit_score}</span>
                          </div>
                          <p className="mt-1 truncate text-sm font-medium" style={{ color: 'var(--ws-text)' }}>{rec.opportunity_name}</p>
                          <p className="mt-0.5 truncate text-xs" style={{ color: 'var(--ws-text-tertiary)' }}>{rec.funder_name || 'Unknown funder'}</p>
                        </div>
                        <div className="shrink-0 text-right text-xs">
                          {rec.max_grant_amount ? <p className="font-semibold tabular-nums" style={{ color: 'var(--ws-text)' }}>{formatMoney(rec.max_grant_amount)}</p> : null}
                          {days !== null ? <p className="mt-1 font-semibold tabular-nums" style={{ color: days <= 7 ? 'var(--ws-red)' : 'var(--ws-text-tertiary)' }}>{days === 0 ? 'Today' : days === 1 ? '1 day' : `${days}d`}</p> : null}
                        </div>
                      </div>
                    </Link>
                  );
                }) : (
                  <div className="px-3 py-4" style={{ background: 'var(--ws-surface-1)' }}>
                    <p className="text-sm font-medium" style={{ color: 'var(--ws-text)' }}>No urgent ACT-fit deadlines.</p>
                    <p className="mt-1 text-xs" style={{ color: 'var(--ws-text-secondary)' }}>Open the recommendations to scan strong fits, or check Source Health for stale data.</p>
                  </div>
                )}
              </div>
              <Link href="/ops/grant-recommendations" className="mt-4 inline-flex rounded-lg px-3 py-2 text-xs font-medium" style={{ background: 'var(--ws-red)', color: '#fff' }}>
                Open recommendations
              </Link>
            </div>

            <div className="rounded-xl border p-4" style={{ borderColor: scenarioFocus?.tone === 'blocked' ? 'var(--ws-amber)' : 'var(--ws-border)', background: 'var(--ws-surface-0)' }}>
              <div className="flex items-start justify-between gap-3">
                <div>
                  <p className="text-[11px] font-semibold uppercase tracking-wide" style={{ color: 'var(--ws-amber)' }}>Project build</p>
                  <h3 className="mt-1 text-lg font-semibold" style={{ color: 'var(--ws-text)' }}>
                    {scenarioFocus?.tone === 'blocked' ? 'Clear the Goods blocker' : 'Move the strongest project signal'}
                  </h3>
                </div>
                <span className="text-2xl font-semibold tabular-nums" style={{ color: 'var(--ws-amber)' }}>
                  {scenarioFocus?.tone === 'blocked' ? scenarioFocus.primaryMetric.value : projectLenses.filter((project) => project.status !== 'Monitor').length}
                </span>
              </div>
              <p className="mt-2 text-xs leading-5" style={{ color: 'var(--ws-text-secondary)' }}>
                {scenarioFocus?.tone === 'blocked'
                  ? scenarioFocus.nextAction
                  : 'Pick one project lane and turn the best signal into evidence, a contact, or a route decision.'}
              </p>
              <div className="mt-4 space-y-2">
                {projectLenses.slice(0, 3).map((project) => {
                  const toneColor = project.tone === 'danger'
                    ? 'var(--ws-red)'
                    : project.tone === 'warning'
                      ? 'var(--ws-amber)'
                      : project.tone === 'success'
                        ? 'var(--ws-green)'
                        : 'var(--ws-accent)';
                  return (
                    <Link key={project.name} href={project.href} className="block rounded-lg border px-3 py-2 transition-colors hover:border-[var(--ws-accent)]" style={{ borderColor: 'var(--ws-border)', background: 'var(--ws-surface-1)' }}>
                      <div className="flex items-start justify-between gap-3">
                        <p className="text-sm font-medium" style={{ color: 'var(--ws-text)' }}>{project.name}</p>
                        <span className="text-[10px] font-semibold uppercase tracking-wide" style={{ color: toneColor }}>{project.status}</span>
                      </div>
                      <p className="mt-1 line-clamp-2 text-xs leading-5" style={{ color: 'var(--ws-text-secondary)' }}>{project.missing}</p>
                    </Link>
                  );
                })}
              </div>
              <Link href={scenarioFocus?.href || '/opportunities/ecosystem'} className="mt-4 inline-flex rounded-lg px-3 py-2 text-xs font-medium" style={{ background: 'var(--ws-accent)', color: '#fff' }}>
                Open project route
              </Link>
            </div>

            <div id="clean-review" className="rounded-xl border p-4" style={{ borderColor: 'var(--ws-border)', background: 'var(--ws-surface-0)' }}>
              <div className="flex items-start justify-between gap-3">
                <div>
                  <p className="text-[11px] font-semibold uppercase tracking-wide" style={{ color: 'var(--ws-accent)' }}>Agent/system work</p>
                  <h3 className="mt-1 text-lg font-semibold" style={{ color: 'var(--ws-text)' }}>Do not review raw backlog</h3>
                </div>
                <span className="text-2xl font-semibold tabular-nums" style={{ color: 'var(--ws-accent)' }}>
                  {currentReviewSweep.humanReady.toLocaleString()}
                </span>
              </div>
              <p className="mt-2 text-xs leading-5" style={{ color: 'var(--ws-text-secondary)' }}>
                Agents clean and enrich broadly. CT only reviews the human-ready count after the sweep.
              </p>
              <div className="mt-4 grid grid-cols-2 gap-2">
                {[
                  { label: 'Clean', value: currentReviewSweep.machinePass },
                  { label: 'Wiki', value: currentReviewSweep.wikiCandidates },
                  { label: 'Scout', value: currentReviewSweep.onlineFrontier },
                  { label: 'Ready', value: currentReviewSweep.humanReady },
                ].map((stat) => (
                  <div key={stat.label} className="rounded-lg border px-3 py-2" style={{ borderColor: 'var(--ws-border)', background: 'var(--ws-surface-1)' }}>
                    <p className="text-lg font-semibold tabular-nums" style={{ color: 'var(--ws-text)' }}>{stat.value.toLocaleString()}</p>
                    <p className="text-[11px]" style={{ color: 'var(--ws-text-tertiary)' }}>{stat.label}</p>
                  </div>
                ))}
              </div>
              <div className="mt-4 grid gap-2 sm:grid-cols-2">
                <button
                  type="button"
                  onClick={() => void runPreSweep()}
                  disabled={isRunningPreSweep || isRefreshing}
                  className="rounded-lg px-3 py-2 text-xs font-medium transition-opacity disabled:opacity-50"
                  style={{ background: 'var(--ws-accent)', color: '#fff' }}
                >
                  {isRunningPreSweep ? 'Running...' : 'Run sweep'}
                </button>
                <Link href="#source-health" className="rounded-lg border px-3 py-2 text-center text-xs font-medium" style={{ borderColor: 'var(--ws-border)', color: 'var(--ws-text-secondary)' }}>
                  Source health
                </Link>
              </div>
            </div>
          </div>

          <div className="mt-3 rounded-lg border px-3 py-2" style={{ borderColor: 'var(--ws-border)', background: 'var(--ws-surface-0)' }}>
            <p className="text-[11px] font-semibold uppercase tracking-wide" style={{ color: 'var(--ws-text-tertiary)' }}>Not today</p>
            <p className="mt-1 text-xs leading-5" style={{ color: 'var(--ws-text-secondary)' }}>
              Do not browse {openGrantCount.toLocaleString()} open grants, {sourceFreshness.frontierDue.toLocaleString()} due sources, or {entityCount.toLocaleString()} entities from home. Those stay in Search, Source Health, and Entity Graph until the router asks for them.
            </p>
          </div>
        </section>

        {/* ACT recommendations per project — sourced from act_grant_recommendations MV */}
        <section>
          <div className="mb-3 flex items-baseline justify-between">
            <div>
              <h2 className="text-base font-semibold" style={{ color: 'var(--ws-text)' }}>ACT Project Lenses · Grant Recommendations</h2>
              <p className="mt-1 text-xs" style={{ color: 'var(--ws-text-secondary)' }}>
                Top fits per project from the act_grant_recommendations MV (blocklist + decision filtered). Click into any project to see its full pile.
              </p>
            </div>
            <Link href="/ops/grant-recommendations" className="text-xs font-medium hover:underline" style={{ color: 'var(--ws-accent)' }}>
              Open recommendations →
            </Link>
          </div>
          <div className="grid gap-3 lg:grid-cols-3 xl:grid-cols-3 mb-6">
            {actProjectLenses.map((lens) => {
              const statusColor = lens.status === 'blocked'
                ? 'var(--ws-red)'
                : lens.status === 'scout'
                  ? 'var(--ws-amber)'
                  : lens.status === 'needs_repair'
                    ? 'var(--ws-red)'
                    : 'var(--ws-green)';
              return (
                <div key={lens.project_code} className="rounded-xl border p-4" style={{ borderColor: 'var(--ws-border)', background: 'var(--ws-surface-1)' }}>
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <p className="text-[10px] font-bold uppercase tracking-widest" style={{ color: 'var(--ws-text-tertiary)' }}>{lens.project_code}</p>
                      <p className="text-sm font-semibold" style={{ color: 'var(--ws-text)' }}>{lens.project_label}</p>
                      <p className="mt-1 text-[10px] font-medium uppercase tracking-wide" style={{ color: statusColor }}>{lens.status}</p>
                    </div>
                    <div className="shrink-0 text-right">
                      <p className="text-2xl font-semibold tabular-nums" style={{ color: 'var(--ws-text)' }}>{lens.strong_fits_count}</p>
                      <p className="text-[10px]" style={{ color: 'var(--ws-text-tertiary)' }}>strong fits</p>
                    </div>
                  </div>
                  <p className="mt-2 text-[11px] leading-snug" style={{ color: 'var(--ws-text-secondary)' }}>{lens.status_message}</p>
                  <p className="mt-2 text-[10px] font-mono" style={{ color: 'var(--ws-text-tertiary)' }}>
                    {lens.deadlines_30d_count} deadline{lens.deadlines_30d_count !== 1 ? 's' : ''} ≤ 30d · max score {lens.max_score}
                  </p>
                  <div className="mt-3 space-y-1.5">
                    {lens.top_fits.length === 0 ? (
                      <p className="text-[11px] italic" style={{ color: 'var(--ws-text-tertiary)' }}>No undecided strong fits yet.</p>
                    ) : lens.top_fits.map((fit) => {
                      const tempBg = fit.temperature === 'WARM' ? '#16a34a'
                        : fit.temperature === 'TEPID' ? '#eab308'
                        : fit.temperature === 'LIGHT' ? '#9ca3af'
                        : '#d1d5db';
                      const tempColor = fit.temperature === 'TEPID' || fit.temperature === 'COLD' ? '#1f2937' : '#fff';
                      return (
                        <Link
                          key={fit.opportunity_id}
                          href="/ops/grant-recommendations"
                          className="block rounded-md border px-2 py-1.5 hover:bg-[var(--ws-surface-2)]"
                          style={{ borderColor: 'var(--ws-border)', background: 'var(--ws-surface-0)' }}
                        >
                          <div className="flex items-center gap-1.5 flex-wrap">
                            <span className="px-1.5 py-0.5 text-[8px] font-bold uppercase tracking-wider rounded" style={{ background: tempBg, color: tempColor }}>{fit.temperature}</span>
                            <span className="text-[10px] font-mono tabular-nums" style={{ color: 'var(--ws-text-tertiary)' }}>{fit.fit_score}</span>
                            {fit.deadline && (
                              <span className="text-[10px] font-mono" style={{ color: 'var(--ws-text-tertiary)' }}>{new Date(fit.deadline).toLocaleDateString('en-AU', { day: 'numeric', month: 'short' })}</span>
                            )}
                          </div>
                          <p className="mt-1 truncate text-[11px] font-medium leading-snug" style={{ color: 'var(--ws-text)' }}>{fit.opportunity_name}</p>
                          <p className="truncate text-[10px]" style={{ color: 'var(--ws-text-tertiary)' }}>{fit.funder_name}</p>
                        </Link>
                      );
                    })}
                  </div>
                </div>
              );
            })}
          </div>
        </section>

        <section>
          <div className="mb-3">
            <h2 className="text-base font-semibold" style={{ color: 'var(--ws-text)' }}>Project Lenses</h2>
            <p className="mt-1 text-xs" style={{ color: 'var(--ws-text-secondary)' }}>
              Each ACT project gets one readable state: best signal, missing evidence, and next pathway.
            </p>
          </div>
          <div className="grid gap-3 lg:grid-cols-4">
            {projectLenses.map((project) => {
              const toneColor = project.tone === 'danger'
                ? 'var(--ws-red)'
                : project.tone === 'warning'
                  ? 'var(--ws-amber)'
                  : project.tone === 'success'
                    ? 'var(--ws-green)'
                    : project.tone === 'info'
                      ? 'var(--ws-accent)'
                      : 'var(--ws-text-secondary)';
              return (
                <Link key={project.name} href={project.href} className="rounded-xl border p-4 transition-colors hover:border-[var(--ws-accent)]" style={{ borderColor: 'var(--ws-border)', background: 'var(--ws-surface-1)' }}>
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <p className="text-sm font-semibold" style={{ color: 'var(--ws-text)' }}>{project.name}</p>
                      <p className="mt-1 text-[11px] font-medium uppercase tracking-wide" style={{ color: toneColor }}>{project.status}</p>
                    </div>
                    <span className="shrink-0 rounded-full px-2.5 py-1 text-[11px] font-medium" style={{ background: 'var(--ws-surface-2)', color: 'var(--ws-text-tertiary)' }}>
                      {project.metric}
                    </span>
                  </div>
                  <p className="mt-4 text-sm leading-5" style={{ color: 'var(--ws-text)' }}>{project.opportunity}</p>
                  <p className="mt-3 text-xs leading-5" style={{ color: 'var(--ws-text-secondary)' }}>{project.missing}</p>
                  <p className="mt-4 text-[11px] font-semibold uppercase tracking-wide" style={{ color: toneColor }}>{project.action}</p>
                </Link>
              );
            })}
          </div>
        </section>

        <section id="source-health" className="rounded-xl border p-4" style={{ borderColor: sourceFreshness.frontierFailing > 0 ? 'var(--ws-amber)' : 'var(--ws-border)', background: sourceFreshness.frontierFailing > 0 ? 'rgba(217,119,6,0.05)' : 'var(--ws-surface-1)' }}>
          <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
            <div>
              <h2 className="text-base font-semibold" style={{ color: 'var(--ws-text)' }}>System Health</h2>
              <p className="mt-1 text-xs leading-5" style={{ color: 'var(--ws-text-secondary)' }}>
                Keep raw infrastructure here: source freshness, failing URLs, alert health, data activity, and database scale.
              </p>
            </div>
            <div className="flex shrink-0 gap-2">
              <Link href="/reports/grant-frontier" className="rounded-lg border px-3 py-2 text-xs font-medium" style={{ borderColor: 'var(--ws-border)', color: 'var(--ws-text-secondary)', background: 'var(--ws-surface-0)' }}>
                Source health
              </Link>
              <Link href="/mission-control" className="rounded-lg border px-3 py-2 text-xs font-medium" style={{ borderColor: 'var(--ws-border)', color: 'var(--ws-text-secondary)', background: 'var(--ws-surface-0)' }}>
                Mission Control
              </Link>
            </div>
          </div>
          <div className="mt-4 grid gap-2 md:grid-cols-4">
            {[
              { label: 'Priority checks', value: sourceFreshness.frontierPriority.length },
              { label: 'Due sources', value: sourceFreshness.frontierDue },
              { label: 'Failing sources', value: sourceFreshness.frontierFailing },
              { label: 'Scout agents', value: sourceFreshness.scoutRuns.length },
            ].map((stat) => (
              <div key={stat.label} className="rounded-lg border px-3 py-2.5" style={{ borderColor: 'var(--ws-border)', background: 'var(--ws-surface-0)' }}>
                <p className="text-lg font-semibold tabular-nums" style={{ color: 'var(--ws-text)' }}>{stat.value.toLocaleString()}</p>
                <p className="text-[11px]" style={{ color: 'var(--ws-text-tertiary)' }}>{stat.label}</p>
              </div>
            ))}
          </div>
          {topFrontierSources.length > 0 ? (
            <div className="mt-4 grid gap-2 lg:grid-cols-3">
              {topFrontierSources.map((item) => (
                <a key={`${item.project}-${item.id}`} href={item.href} target="_blank" rel="noreferrer" className="rounded-lg border p-3 transition-colors hover:border-[var(--ws-accent)]" style={{ borderColor: 'var(--ws-border)', background: 'var(--ws-surface-0)' }}>
                  <div className="flex items-start justify-between gap-3">
                    <p className="min-w-0 truncate text-sm font-medium" style={{ color: 'var(--ws-text)' }}>{item.title}</p>
                    <span className="shrink-0 text-[10px] font-semibold uppercase tracking-wide" style={{ color: item.project === 'Goods' ? 'var(--ws-accent)' : item.project === 'JusticeHub' ? 'var(--ws-red)' : 'var(--ws-green)' }}>
                      {item.project}
                    </span>
                  </div>
                  <p className="mt-2 text-xs leading-5" style={{ color: 'var(--ws-text-secondary)' }}>{item.reason}</p>
                </a>
              ))}
            </div>
          ) : null}
          <div className="mt-4 grid gap-2 md:grid-cols-3">
            <div className="rounded-lg border px-3 py-2.5" style={{ borderColor: 'var(--ws-border)', background: 'var(--ws-surface-0)' }}>
              <p className="text-sm font-medium" style={{ color: 'var(--ws-text)' }}>Alerts</p>
              <p className="mt-1 text-xs" style={{ color: alertNeedsAttention ? 'var(--ws-amber)' : 'var(--ws-text-secondary)' }}>
                {alertNeedsAttention ? 'Needs tuning or delivery attention' : `${effectiveActiveAlertCount} active, stable unless tuning is needed`}
              </p>
            </div>
            <div className="rounded-lg border px-3 py-2.5" style={{ borderColor: 'var(--ws-border)', background: 'var(--ws-surface-0)' }}>
              <p className="text-sm font-medium" style={{ color: 'var(--ws-text)' }}>Database</p>
              <p className="mt-1 text-xs" style={{ color: 'var(--ws-text-secondary)' }}>
                {entityCount.toLocaleString()} entities, {openGrantCount.toLocaleString()} open grants
              </p>
            </div>
            <div className="rounded-lg border px-3 py-2.5" style={{ borderColor: 'var(--ws-border)', background: 'var(--ws-surface-0)' }}>
              <p className="text-sm font-medium" style={{ color: 'var(--ws-text)' }}>Recent agents</p>
              <p className="mt-1 text-xs" style={{ color: 'var(--ws-text-secondary)' }}>
                {agentRuns[0] ? `${agentRuns[0].agent_name.replace(/-/g, ' ')} ${relativeTime(agentRuns[0].started_at)}` : 'No recent run shown'}
              </p>
            </div>
          </div>
        </section>

        <section>
          <div className="mb-3">
            <h2 className="text-base font-semibold" style={{ color: 'var(--ws-text)' }}>Where To Go Next</h2>
            <p className="mt-1 text-xs" style={{ color: 'var(--ws-text-secondary)' }}>
              Six lead surfaces. Everything else should hang off one of these.
            </p>
          </div>
          <div className="grid gap-3 md:grid-cols-2 lg:grid-cols-3">
            {compactCommands.map((item) => (
              <Link key={item.href} href={item.href} className="rounded-xl border p-4 transition-colors hover:border-[var(--ws-accent)]" style={{ borderColor: 'var(--ws-border)', background: 'var(--ws-surface-1)' }}>
                <p className="text-sm font-semibold" style={{ color: 'var(--ws-text)' }}>{item.label}</p>
                <p className="mt-2 text-xs leading-5" style={{ color: 'var(--ws-text-secondary)' }}>{item.detail}</p>
              </Link>
            ))}
          </div>
        </section>
      </div>
    );
  }

  return (
    <div className="max-w-7xl">
      {/* Greeting */}
      <header className="mb-8">
        <h1 className="text-2xl font-semibold tracking-tight" style={{ color: 'var(--ws-text)' }}>
          {greeting}
        </h1>
        <p className="text-sm mt-1" style={{ color: 'var(--ws-text-secondary)' }}>
          {contextLine}
        </p>
      </header>

      {feedback && (
        <div
          className="mb-6 rounded-lg border px-4 py-3 text-sm font-medium"
          role={feedback.tone === 'error' ? 'alert' : 'status'}
          style={{
            borderColor: feedback.tone === 'error' ? 'var(--ws-red)' : 'var(--ws-green)',
            background: feedback.tone === 'error' ? 'rgba(220,38,38,0.08)' : 'rgba(22,163,74,0.08)',
            color: feedback.tone === 'error' ? 'var(--ws-red)' : 'var(--ws-green)',
          }}
        >
          {feedback.message}
        </div>
      )}

      {billingStatus && (
        <div
          className="mb-6 rounded-lg border p-4"
          style={{
            borderColor:
              billingStatus.tone === 'error'
                ? 'var(--ws-red)'
                : billingStatus.tone === 'warning'
                  ? 'var(--ws-amber)'
                  : 'var(--ws-accent)',
            background:
              billingStatus.tone === 'error'
                ? 'rgba(220,38,38,0.06)'
                : billingStatus.tone === 'warning'
                  ? 'rgba(217,119,6,0.06)'
                  : 'rgba(37,99,235,0.05)',
          }}
        >
          <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
            <div>
              <p className="text-sm font-medium" style={{ color: 'var(--ws-text)' }}>{billingStatus.title}</p>
              <p className="mt-1 text-xs" style={{ color: 'var(--ws-text-secondary)' }}>{billingStatus.detail}</p>
            </div>
            <div className="flex shrink-0 gap-2">
              <Link
                href={billingStatus.primaryHref}
                className="rounded-lg px-3 py-2 text-xs font-medium transition-colors"
                style={{ background: 'var(--ws-accent)', color: '#fff' }}
              >
                {billingStatus.primaryLabel}
              </Link>
              <Link
                href={billingStatus.secondaryHref}
                className="rounded-lg border px-3 py-2 text-xs font-medium transition-colors"
                style={{ borderColor: 'var(--ws-border)', color: 'var(--ws-text-secondary)' }}
              >
                {billingStatus.secondaryLabel}
              </Link>
            </div>
          </div>
        </div>
      )}

      {/* Activation */}
      {showActivation && (
        <div className="rounded-lg border p-5 mb-8" style={{ borderColor: 'var(--ws-accent)', background: 'rgba(37,99,235,0.04)' }}>
          <h2 className="text-sm font-semibold mb-2" style={{ color: 'var(--ws-text)' }}>Build Your Funding Pipeline</h2>
          <p className="text-xs mb-4" style={{ color: 'var(--ws-text-secondary)' }}>
            Complete the setup in order: finish your profile, shortlist the best matched grants, then move one real opportunity into active pipeline work.
          </p>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
            {[
              { href: '/profile', step: '1', title: 'Complete Profile', desc: 'Mission, domains, geography', done: profileReady },
              { href: '/profile/matches', step: '2', title: 'Shortlist Grants', desc: 'Save the strongest matched grants', done: hasShortlistedGrants },
              { href: '/tracker?onboarding=1', step: '3', title: 'Work Tracker', desc: 'Move one grant beyond Discovered', done: hasWorkedGrantPipeline },
            ].map(item => (
              <Link
                key={item.href}
                href={item.href}
                className="flex items-center gap-3 p-3 rounded-lg border transition-colors hover:border-[var(--ws-accent)]"
                style={{
                  borderColor: item.done ? 'var(--ws-green)' : 'var(--ws-border)',
                  background: item.done ? 'rgba(22,163,74,0.04)' : 'var(--ws-surface-1)',
                }}
              >
                <div
                  className="w-7 h-7 rounded-full flex items-center justify-center text-xs font-semibold shrink-0"
                  style={{
                    background: item.done ? 'var(--ws-green)' : 'var(--ws-surface-2)',
                    color: item.done ? '#fff' : 'var(--ws-text-secondary)',
                  }}
                >
                  {item.done ? '\u2713' : item.step}
                </div>
                <div>
                  <p className="text-sm font-medium" style={{ color: 'var(--ws-text)' }}>{item.title}</p>
                  <p className="text-xs" style={{ color: 'var(--ws-text-tertiary)' }}>{item.desc}</p>
                </div>
              </Link>
            ))}
          </div>
        </div>
      )}

      {/* Profile nudge */}
      {!showActivation && (
        <div className="rounded-lg border p-4 mb-6" style={{ borderColor: 'var(--ws-green)', background: 'rgba(22,163,74,0.04)' }}>
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <p className="text-sm font-medium" style={{ color: 'var(--ws-text)' }}>Your pipeline is live.</p>
              <p className="text-xs mt-1" style={{ color: 'var(--ws-text-secondary)' }}>
                Start with the focus stack, then use the tracker and opportunity cockpit to move the next real decision.
              </p>
            </div>
            <div className="flex gap-2">
              <Link
                href={trackerHref}
                className="px-4 py-2 text-sm font-medium rounded-lg transition-colors"
                style={{ background: 'var(--ws-accent)', color: '#fff' }}
              >
                Open Tracker
              </Link>
              <Link
                href="/profile/matches"
                className="px-4 py-2 text-sm font-medium rounded-lg transition-colors border"
                style={{ borderColor: 'var(--ws-border)', color: 'var(--ws-text-secondary)' }}
              >
                Review Matches
              </Link>
            </div>
          </div>
        </div>
      )}

      <section className="mb-6 grid grid-cols-1 gap-4 xl:grid-cols-[minmax(0,1fr)_360px]">
        <div className="rounded-lg border p-4" style={{ borderColor: 'var(--ws-border)', background: 'var(--ws-surface-1)' }}>
          <div className="flex flex-col gap-3 md:flex-row md:items-start md:justify-between">
            <div>
              <p className="text-xs font-semibold uppercase tracking-wide" style={{ color: 'var(--ws-text-tertiary)' }}>Today&apos;s Focus</p>
              <h2 className="mt-1 text-lg font-semibold tracking-tight" style={{ color: 'var(--ws-text)' }}>
                {urgentDeadlines.length > 0
                  ? `${urgentDeadlines.length} deadline${urgentDeadlines.length !== 1 ? 's' : ''} need a decision first`
                  : discoveredCount > 0
                    ? 'The review queue is the next constraint'
                    : 'The pipeline is ready for active follow-through'}
              </h2>
              <p className="mt-1 text-sm" style={{ color: 'var(--ws-text-secondary)' }}>
                Run the daily rhythm: scan what matters, pre-sweep the backlog, make the next decision, scout the live edge, then file the trail.
              </p>
            </div>
            <Link
              href="/opportunities/ecosystem"
              className="inline-flex shrink-0 items-center justify-center rounded-lg border px-3 py-2 text-xs font-medium transition-colors hover:border-[var(--ws-accent)]"
              style={{ borderColor: 'var(--ws-border)', color: 'var(--ws-text-secondary)' }}
            >
              Open Opportunity Cockpit
            </Link>
          </div>

          <div className="mt-4 grid grid-cols-1 gap-3 md:grid-cols-3">
            {todayActions.map((action) => {
              const toneStyle =
                action.tone === 'danger'
                  ? { border: 'var(--ws-red)', bg: 'rgba(220,38,38,0.06)', color: 'var(--ws-red)' }
                  : action.tone === 'warning'
                    ? { border: 'var(--ws-amber)', bg: 'rgba(217,119,6,0.06)', color: 'var(--ws-amber)' }
                    : action.tone === 'info'
                      ? { border: 'var(--ws-accent)', bg: 'rgba(37,99,235,0.05)', color: 'var(--ws-accent)' }
                      : { border: 'var(--ws-border)', bg: 'var(--ws-surface-0)', color: 'var(--ws-text-secondary)' };

              return (
                <Link
                  key={action.label}
                  href={action.href}
                  className="rounded-lg border p-3 transition-colors hover:border-[var(--ws-accent)]"
                  style={{ borderColor: toneStyle.border, background: toneStyle.bg }}
                >
                  <div className="flex items-start justify-between gap-3">
                    <p className="text-sm font-medium" style={{ color: 'var(--ws-text)' }}>{action.label}</p>
                    <p className="text-xl font-semibold tabular-nums" style={{ color: toneStyle.color }}>{action.value}</p>
                  </div>
                  <p className="mt-2 text-xs leading-5" style={{ color: 'var(--ws-text-secondary)' }}>{action.detail}</p>
                </Link>
              );
            })}
          </div>
        </div>

        {scenarioFocus && (
          <Link
            href={scenarioFocus.href}
            className="rounded-lg border p-4 transition-colors hover:border-[var(--ws-accent)]"
            style={{
              borderColor:
                scenarioFocus.tone === 'blocked'
                  ? 'var(--ws-amber)'
                  : scenarioFocus.tone === 'ready'
                    ? 'var(--ws-green)'
                    : 'var(--ws-border)',
              background:
                scenarioFocus.tone === 'blocked'
                  ? 'rgba(217,119,6,0.06)'
                  : scenarioFocus.tone === 'ready'
                    ? 'rgba(22,163,74,0.05)'
                    : 'var(--ws-surface-1)',
            }}
          >
            <div className="flex items-center justify-between gap-3">
              <p className="text-xs font-semibold uppercase tracking-wide" style={{ color: 'var(--ws-text-tertiary)' }}>ACT Scenario</p>
              <span
                className="rounded-full px-2.5 py-1 text-[11px] font-medium uppercase tracking-wide"
                style={{
                  background:
                    scenarioFocus.tone === 'blocked'
                      ? 'rgba(217,119,6,0.12)'
                      : scenarioFocus.tone === 'ready'
                        ? 'rgba(22,163,74,0.1)'
                        : 'var(--ws-surface-2)',
                  color:
                    scenarioFocus.tone === 'blocked'
                      ? 'var(--ws-amber)'
                      : scenarioFocus.tone === 'ready'
                        ? 'var(--ws-green)'
                        : 'var(--ws-text-secondary)',
                }}
              >
                {scenarioFocus.tone === 'blocked' ? 'Blocked' : scenarioFocus.tone === 'ready' ? 'Ready' : 'Watch'}
              </span>
            </div>
            <h2 className="mt-2 text-base font-semibold leading-snug" style={{ color: 'var(--ws-text)' }}>{scenarioFocus.title}</h2>
            <p className="mt-2 text-xs leading-5" style={{ color: 'var(--ws-text-secondary)' }}>{scenarioFocus.detail}</p>
            <div className="mt-4 grid grid-cols-2 gap-2">
              {[scenarioFocus.primaryMetric, scenarioFocus.secondaryMetric].map((metric) => (
                <div
                  key={metric.label}
                  className="rounded-lg border px-3 py-2"
                  style={{ borderColor: 'var(--ws-border)', background: 'var(--ws-surface-0)' }}
                >
                  <p className="text-lg font-semibold tabular-nums" style={{ color: 'var(--ws-text)' }}>{metric.value}</p>
                  <p className="text-[11px]" style={{ color: 'var(--ws-text-tertiary)' }}>{metric.label}</p>
                </div>
              ))}
            </div>
            <p className="mt-3 text-xs font-medium leading-5" style={{ color: 'var(--ws-text)' }}>{scenarioFocus.nextAction}</p>
          </Link>
        )}
      </section>

      {/* Main grid */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Left column */}
        <div className="lg:col-span-2 space-y-6">

          {/* Pre-sweep gate */}
          {currentReviewSweep.total > 0 && (
            <section id="pre-sweep">
              <div className="mb-3 flex items-center justify-between gap-3">
                <div>
                  <h2 className="text-sm font-semibold" style={{ color: 'var(--ws-text)' }}>Pre-Sweep Gate</h2>
                  <p className="mt-1 text-xs" style={{ color: 'var(--ws-text-secondary)' }}>
                    Do not manually review all {currentReviewSweep.total.toLocaleString()} discovered items. Clean, enrich, and current-check first.
                  </p>
                </div>
                <div className="flex shrink-0 items-center gap-2">
                  <button
                    type="button"
                    onClick={() => void runPreSweep()}
                    disabled={isRunningPreSweep || isRefreshing}
                    className="rounded-lg px-3 py-2 text-xs font-medium transition-opacity disabled:opacity-50"
                    style={{ background: 'var(--ws-accent)', color: '#fff' }}
                  >
                    {isRunningPreSweep ? 'Running...' : 'Run one-off pre-sweep'}
                  </button>
                  <Link href="/mission-control" className="text-xs font-medium transition-colors hover:underline" style={{ color: 'var(--ws-accent)' }}>
                    Mission Control &rarr;
                  </Link>
                </div>
              </div>

              <div className="rounded-lg border overflow-hidden" style={{ borderColor: 'var(--ws-border)', background: 'var(--ws-surface-1)' }}>
                {preSweepRun && (
                  <div className="px-4 py-3 text-xs leading-5" style={{ borderBottom: '1px solid var(--ws-border)', color: 'var(--ws-text-secondary)', background: 'rgba(22,163,74,0.06)' }}>
                    Pre-sweep ran {relativeTime(preSweepRun.ranAt)}. Moved {preSweepRun.applied.expiredUpdated.toLocaleString()} expired item{preSweepRun.applied.expiredUpdated !== 1 ? 's' : ''} out of review; the remaining counts are ready for wiki enrichment and source refresh.
                  </div>
                )}
                <div className="grid grid-cols-1 gap-px md:grid-cols-4" style={{ background: 'var(--ws-border)' }}>
                  {preSweepLanes.map((lane) => {
                    const color = lane.tone === 'warning'
                      ? 'var(--ws-amber)'
                      : lane.tone === 'info'
                        ? 'var(--ws-accent)'
                        : lane.tone === 'success'
                          ? 'var(--ws-green)'
                          : 'var(--ws-text-secondary)';

                    return (
                      <Link
                        key={lane.label}
                        href={lane.href}
                        className="flex min-h-[180px] flex-col justify-between p-4 transition-colors hover:bg-[var(--ws-surface-2)]"
                        style={{ background: 'var(--ws-surface-1)' }}
                      >
                        <div>
                          <p className="text-xs font-semibold uppercase tracking-wide" style={{ color: 'var(--ws-text-tertiary)' }}>{lane.label}</p>
                          <p className="mt-2 text-2xl font-semibold tabular-nums" style={{ color }}>{lane.value}</p>
                          <p className="mt-2 text-xs leading-5" style={{ color: 'var(--ws-text-secondary)' }}>{lane.detail}</p>
                        </div>
                        <p className="mt-4 text-[11px] font-semibold uppercase tracking-wide" style={{ color }}>{lane.action}</p>
                      </Link>
                    );
                  })}
                </div>
                <div className="px-4 py-3 text-xs leading-5" style={{ borderTop: '1px solid var(--ws-border)', color: 'var(--ws-text-secondary)' }}>
                  Operating rule: agents scout and enrich broadly, CT reviews narrowly. The tracker should receive a small decision batch, not a raw discovery dump.
                </div>
                {preSweepRun?.decisionBatch.humanReadyTop5.length ? (
                  <div className="px-4 py-4" style={{ borderTop: '1px solid var(--ws-border)' }}>
                    <div className="mb-3 flex items-center justify-between gap-3">
                      <div>
                        <p className="text-sm font-semibold" style={{ color: 'var(--ws-text)' }}>Today&apos;s Decision Batch</p>
                        <p className="mt-1 text-xs" style={{ color: 'var(--ws-text-secondary)' }}>
                          After urgent deadlines, decide these five human-ready items. Leave the rest alone today.
                        </p>
                      </div>
                      <span className="shrink-0 rounded-full px-2.5 py-1 text-[11px] font-medium" style={{ background: 'rgba(22,163,74,0.1)', color: 'var(--ws-green)' }}>
                        Top 5
                      </span>
                    </div>
                    <div className="space-y-2">
                      {preSweepRun.decisionBatch.humanReadyTop5.map((item) => (
                        <Link
                          key={item.savedGrantId}
                          href={`/grants/${item.grantId}`}
                          className="flex items-center justify-between gap-3 rounded-lg border px-3 py-3 transition-colors hover:border-[var(--ws-accent)]"
                          style={{ borderColor: 'var(--ws-border)', background: 'var(--ws-surface-0)' }}
                        >
                          <div className="min-w-0">
                            <p className="truncate text-sm font-medium" style={{ color: 'var(--ws-text)' }}>{item.name}</p>
                            <p className="mt-1 truncate text-xs" style={{ color: 'var(--ws-text-tertiary)' }}>{item.provider || 'Provider unknown'}</p>
                          </div>
                          <div className="flex shrink-0 items-center gap-2 text-xs" style={{ color: 'var(--ws-text-secondary)' }}>
                            {item.amountMax && <span className="font-semibold tabular-nums">{formatMoney(item.amountMax)}</span>}
                            <span>{formatDate(item.closesAt)}</span>
                          </div>
                        </Link>
                      ))}
                    </div>
                  </div>
                ) : null}
              </div>
            </section>
          )}

          {/* Grant workbench */}
          {(grants.length > 0 || workbenchDeadlines.length > 0) && (
            <section id="grant-workbench">
              <div className="mb-3 flex items-center justify-between gap-3">
                <div>
                  <h2 className="text-sm font-semibold" style={{ color: 'var(--ws-text)' }}>Grant Workbench</h2>
                  <p className="mt-1 text-xs" style={{ color: 'var(--ws-text-secondary)' }}>
                    Deadline decisions and pipeline movement in one place.
                  </p>
                </div>
                <Link href={trackerHref} className="shrink-0 text-xs font-medium transition-colors hover:underline" style={{ color: 'var(--ws-accent)' }}>
                  Open Tracker &rarr;
                </Link>
              </div>

              <div className="rounded-lg border overflow-hidden" style={{ borderColor: urgentDeadlines.length > 0 ? 'var(--ws-red)' : 'var(--ws-border)', background: 'var(--ws-surface-1)' }}>
                <div className="grid grid-cols-2 gap-px md:grid-cols-4" style={{ background: 'var(--ws-border)' }}>
                  {[
                    { label: 'Closing 7d', value: urgentDeadlines.length, tone: urgentDeadlines.length > 0 ? 'danger' : 'neutral' },
                    { label: 'Pre-sweep', value: discoveredCount, tone: discoveredCount > 100 ? 'warning' : 'neutral' },
                    { label: 'In progress', value: activeCount, tone: activeCount > 0 ? 'info' : 'neutral' },
                    { label: 'Won', value: wonCount, tone: wonCount > 0 ? 'success' : 'neutral' },
                  ].map((stat) => {
                    const color = stat.tone === 'danger'
                      ? 'var(--ws-red)'
                      : stat.tone === 'warning'
                        ? 'var(--ws-amber)'
                        : stat.tone === 'info'
                          ? 'var(--ws-accent)'
                          : stat.tone === 'success'
                            ? 'var(--ws-green)'
                            : 'var(--ws-text)';
                    return (
                      <Link
                        key={stat.label}
                        href={trackerHref}
                        className="p-4 transition-colors hover:bg-[var(--ws-surface-2)]"
                        style={{ background: 'var(--ws-surface-1)' }}
                      >
                        <p className="text-2xl font-semibold tabular-nums" style={{ color }}>{stat.value}</p>
                        <p className="mt-1 text-xs" style={{ color: 'var(--ws-text-secondary)' }}>{stat.label}</p>
                      </Link>
                    );
                  })}
                </div>

                {workbenchDeadlines.length > 0 ? (
                  <div>
                    <div className="flex items-center justify-between px-4 py-2.5" style={{ background: urgentDeadlines.length > 0 ? 'rgba(220,38,38,0.08)' : 'var(--ws-surface-2)' }}>
                      <span className="text-xs font-semibold uppercase tracking-wide" style={{ color: urgentDeadlines.length > 0 ? 'var(--ws-red)' : 'var(--ws-text-tertiary)' }}>
                        Deadline lane
                      </span>
                      <span className="text-xs" style={{ color: 'var(--ws-text-tertiary)' }}>
                        {urgentDeadlines.length} urgent / {soonDeadlines.length} next
                      </span>
                    </div>
                    {workbenchDeadlines.map((item, i) => {
                      const days = daysUntil(item.grant!.closes_at!);
                      const urgent = days <= 7;
                      return (
                        <button
                          key={item.id}
                          onClick={() => openGrant(item)}
                          className="w-full text-left flex items-center justify-between px-4 py-3 transition-colors hover:bg-[var(--ws-surface-2)]"
                          style={{ borderTop: i > 0 ? '1px solid var(--ws-border)' : 'none' }}
                        >
                          <div className="flex-1 min-w-0">
                            <p className="text-sm font-medium truncate" style={{ color: 'var(--ws-text)' }}>{item.grant?.name}</p>
                            <p className="text-xs" style={{ color: 'var(--ws-text-tertiary)' }}>{item.grant?.provider}</p>
                          </div>
                          <div className="ml-4 flex shrink-0 items-center gap-3">
                            {item.grant?.amount_max && (
                              <span className="text-sm font-semibold tabular-nums" style={{ color: 'var(--ws-text)' }}>{formatMoney(item.grant.amount_max)}</span>
                            )}
                            <span
                              className="rounded px-2 py-0.5 text-[11px] font-semibold tabular-nums"
                              style={{
                                background: urgent ? 'rgba(220,38,38,0.1)' : 'var(--ws-surface-2)',
                                color: urgent ? 'var(--ws-red)' : 'var(--ws-text-tertiary)',
                              }}
                            >
                              {days === 0 ? 'Today' : days === 1 ? '1 day' : urgent ? `${days} days` : `${days}d`}
                            </span>
                          </div>
                        </button>
                      );
                    })}
                    {hiddenWorkbenchDeadlineCount > 0 && (
                      <Link
                        href={trackerHref}
                        className="flex items-center justify-between gap-3 px-4 py-3 text-xs font-medium transition-colors hover:bg-[var(--ws-surface-2)]"
                        style={{ borderTop: '1px solid var(--ws-border)', color: 'var(--ws-accent)' }}
                      >
                        <span>
                          Review {hiddenWorkbenchDeadlineCount} more tracked deadline{hiddenWorkbenchDeadlineCount !== 1 ? 's' : ''}
                        </span>
                        <span className="shrink-0">Open tracker</span>
                      </Link>
                    )}
                  </div>
                ) : (
                  <div className="px-4 py-5">
                    <p className="text-sm font-medium" style={{ color: 'var(--ws-text)' }}>No tracked deadlines in the next 30 days</p>
                    <p className="mt-1 text-xs" style={{ color: 'var(--ws-text-secondary)' }}>Use Search Grants or Alerts to bring the next strong opportunities into the tracker.</p>
                  </div>
                )}
              </div>
            </section>
          )}

          {/* Foundations */}
          {foundations.length > 0 && (
            <section>
              <div className="flex items-center justify-between mb-3">
                <h2 className="text-sm font-semibold" style={{ color: 'var(--ws-text)' }}>Foundations</h2>
                <Link href="/foundations/tracker" className="text-xs font-medium transition-colors hover:underline" style={{ color: 'var(--ws-accent)' }}>
                  View All {foundations.length} &rarr;
                </Link>
              </div>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
                {foundations.slice(0, 6).map((f) => (
                  <button
                    key={f.id}
                    onClick={() => openFoundation(f)}
                    className="text-left flex items-center justify-between rounded-lg border px-4 py-3 transition-colors hover:border-[var(--ws-accent)]"
                    style={{ borderColor: 'var(--ws-border)', background: 'var(--ws-surface-1)' }}
                  >
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium truncate" style={{ color: 'var(--ws-text)' }}>{f.foundation?.name}</p>
                      <p className="text-xs" style={{ color: 'var(--ws-text-tertiary)' }}>
                        {f.foundation?.total_giving_annual
                          ? `${formatMoney(f.foundation.total_giving_annual)}/yr`
                          : 'Giving unknown'}
                        {f.foundation?.thematic_focus?.[0] && ` \u00B7 ${f.foundation.thematic_focus[0]}`}
                      </p>
                    </div>
                    <span
                      className="text-[10px] font-medium uppercase tracking-wide ml-3 shrink-0 px-2 py-0.5 rounded"
                      style={{ color: 'var(--ws-text-tertiary)', background: 'var(--ws-surface-2)' }}
                    >
                      {f.stage.replace('_', ' ')}
                    </span>
                  </button>
                ))}
              </div>
            </section>
          )}

          {/* Empty state */}
          {grants.length === 0 && foundations.length === 0 && profileReady && (
            <div className="rounded-lg border border-dashed p-8 text-center" style={{ borderColor: 'var(--ws-border)' }}>
              <p className="text-sm mb-3" style={{ color: 'var(--ws-text-secondary)' }}>Your pipeline is empty</p>
              <Link
                href="/grants"
                className="inline-block px-5 py-2 text-sm font-medium rounded-lg transition-colors"
                style={{ background: 'var(--ws-accent)', color: '#fff' }}
              >
                Find Grants
              </Link>
            </div>
          )}
        </div>

        {/* Right column */}
        <div className="space-y-6">
          <section id="daily-rhythm">
            <h2 className="text-xs font-semibold uppercase tracking-wide mb-3" style={{ color: 'var(--ws-text-tertiary)' }}>Daily Rhythm</h2>
            <div className="rounded-lg border p-4" style={{ borderColor: 'var(--ws-border)', background: 'var(--ws-surface-1)' }}>
              <p className="text-sm font-medium" style={{ color: 'var(--ws-text)' }}>
                Run the dashboard once, top to bottom.
              </p>
              <p className="text-xs mt-1.5" style={{ color: 'var(--ws-text-secondary)' }}>
                The routine is deliberately small: sweep the noise, make decisions, check the live edge, and leave a trail.
              </p>
              <div className="mt-4 grid grid-cols-1 gap-2">
                {dailyRhythm.map((item) => (
                  <Link
                    key={item.step}
                    href={item.href}
                    className="rounded-lg border px-3 py-3 transition-colors hover:border-[var(--ws-accent)]"
                    style={{ borderColor: 'var(--ws-border)', background: 'var(--ws-surface-0)' }}
                  >
                    <div className="flex items-start gap-3">
                      <span
                        className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full text-[11px] font-semibold tabular-nums"
                        style={{ background: 'var(--ws-surface-2)', color: 'var(--ws-text-secondary)' }}
                      >
                        {item.step}
                      </span>
                      <div className="min-w-0">
                        <div className="flex items-center justify-between gap-2">
                          <p className="text-sm font-medium" style={{ color: 'var(--ws-text)' }}>{item.label}</p>
                          <span className="shrink-0 text-[10px] uppercase tracking-wide" style={{ color: 'var(--ws-text-tertiary)' }}>{item.time}</span>
                        </div>
                        <p className="mt-1 text-[11px] leading-5" style={{ color: 'var(--ws-text-secondary)' }}>{item.detail}</p>
                      </div>
                    </div>
                  </Link>
                ))}
              </div>
              <p className="text-[11px] mt-3" style={{ color: 'var(--ws-text-tertiary)' }}>
                Stop when the trail is clear enough for the next person to continue without a catch-up meeting.
              </p>
            </div>
          </section>

          {/* Command navigation */}
          <section id="source-freshness">
            <div className="mb-3 flex items-center justify-between gap-3">
              <h2 className="text-xs font-semibold uppercase tracking-wide" style={{ color: 'var(--ws-text-tertiary)' }}>Commands</h2>
              <span className="text-[11px]" style={{ color: 'var(--ws-text-tertiary)' }}>Move work, then file the rest</span>
            </div>
            <div className="rounded-lg border overflow-hidden" style={{ borderColor: 'var(--ws-border)', background: 'var(--ws-surface-1)' }}>
              {primaryCommands.map((item, index) => {
                const toneColor = item.tone === 'warning'
                  ? 'var(--ws-amber)'
                  : item.tone === 'info'
                    ? 'var(--ws-accent)'
                    : 'var(--ws-text-tertiary)';

                return (
                  <Link
                    key={item.href}
                    href={item.href}
                    className="block px-4 py-3 transition-colors hover:bg-[var(--ws-surface-2)]"
                    style={{ borderTop: index > 0 ? '1px solid var(--ws-border)' : 'none' }}
                  >
                    <div className="flex items-start justify-between gap-3">
                      <div className="min-w-0">
                        <p className="text-sm font-medium" style={{ color: 'var(--ws-text)' }}>{item.label}</p>
                        <p className="mt-1 text-[11px] leading-5" style={{ color: 'var(--ws-text-secondary)' }}>{item.detail}</p>
                      </div>
                      <span className="shrink-0 text-[10px] font-semibold uppercase tracking-wide" style={{ color: toneColor }}>
                        {item.context}
                      </span>
                    </div>
                  </Link>
                );
              })}
            </div>

            <div className="mt-3 grid grid-cols-2 gap-2">
              {secondaryCommands.map((item) => (
                <Link
                  key={item.href}
                  href={item.href}
                  className="rounded-lg border px-3 py-2.5 text-xs font-medium transition-colors hover:border-[var(--ws-accent)]"
                  style={{ borderColor: 'var(--ws-border)', color: 'var(--ws-text-secondary)', background: 'var(--ws-surface-0)' }}
                >
                  {item.label}
                </Link>
              ))}
            </div>
          </section>

          {/* Source freshness */}
          <section>
            <div className="mb-3 flex items-center justify-between gap-3">
              <h2 className="text-xs font-semibold uppercase tracking-wide" style={{ color: 'var(--ws-text-tertiary)' }}>Source Freshness</h2>
              <Link href="/reports/grant-frontier" className="text-[11px] font-medium hover:underline" style={{ color: 'var(--ws-accent)' }}>
                Grant frontier
              </Link>
            </div>
            <div
              className="rounded-lg border p-4"
              style={{
                borderColor:
                  sourceFreshnessTone === 'warning'
                    ? 'var(--ws-amber)'
                    : sourceFreshnessTone === 'info'
                      ? 'var(--ws-accent)'
                      : 'var(--ws-border)',
                background:
                  sourceFreshnessTone === 'warning'
                    ? 'rgba(217,119,6,0.06)'
                    : sourceFreshnessTone === 'info'
                      ? 'rgba(37,99,235,0.05)'
                      : 'var(--ws-surface-1)',
              }}
            >
              <p className="text-sm font-medium" style={{ color: 'var(--ws-text)' }}>
                {sourceFreshness.frontierPriority.length > 0
                  ? `Check the next ${sourceFreshness.frontierPriority.length} sources first.`
                  : 'No project priority targets are ready.'}
              </p>
              <p className="mt-1.5 text-xs leading-5" style={{ color: 'var(--ws-text-secondary)' }}>
                The backlog is large, so home shows project-shaped frontier targets for Goods, JusticeHub, and Empathy Ledger before the raw due count.
              </p>

              <div className="mt-4 grid grid-cols-3 gap-2">
                {[
                  { label: 'Priority', value: sourceFreshness.frontierPriority.length.toLocaleString() },
                  { label: 'Updated 7d', value: sourceFreshness.grantsUpdated7d.toLocaleString() },
                  { label: 'Changed 7d', value: sourceFreshness.frontierChanged7d.toLocaleString() },
                ].map((stat) => (
                  <div
                    key={stat.label}
                    className="rounded-lg border px-3 py-2"
                    style={{ borderColor: 'var(--ws-border)', background: 'var(--ws-surface-0)' }}
                  >
                    <p className="text-lg font-semibold tabular-nums" style={{ color: 'var(--ws-text)' }}>{stat.value}</p>
                    <p className="text-[11px]" style={{ color: 'var(--ws-text-tertiary)' }}>{stat.label}</p>
                  </div>
                ))}
              </div>

              {sourceFreshness.frontierPriority.length > 0 && (
                <div className="mt-3 space-y-2">
                  {sourceFreshness.frontierPriority.slice(0, 6).map((item) => {
                    const projectColor = item.project === 'Goods'
                      ? 'var(--ws-accent)'
                      : item.project === 'JusticeHub'
                        ? 'var(--ws-red)'
                        : 'var(--ws-green)';

                    return (
                      <a
                        key={`${item.project}-${item.id}`}
                        href={item.href}
                        target="_blank"
                        rel="noreferrer"
                        className="block rounded-lg border px-3 py-3 transition-colors hover:border-[var(--ws-accent)]"
                        style={{ borderColor: 'var(--ws-border)', background: 'var(--ws-surface-0)' }}
                      >
                        <div className="flex items-start justify-between gap-3">
                          <div className="min-w-0">
                            <p className="truncate text-xs font-medium" style={{ color: 'var(--ws-text)' }}>{item.title}</p>
                            <p className="mt-1 text-[11px] leading-5" style={{ color: 'var(--ws-text-secondary)' }}>{item.reason}</p>
                          </div>
                          <span className="shrink-0 text-[10px] font-semibold uppercase tracking-wide" style={{ color: projectColor }}>
                            {item.project}
                          </span>
                        </div>
                        <p className="mt-2 text-[10px] uppercase tracking-wide" style={{ color: 'var(--ws-text-tertiary)' }}>{item.sourceKind}</p>
                      </a>
                    );
                  })}
                </div>
              )}

              <div className="mt-3 grid grid-cols-2 gap-2">
                {[
                  { label: 'Due backlog', value: sourceFreshness.frontierDue, warn: sourceFreshness.frontierDue > 1000 },
                  { label: 'Stale open grants', value: sourceFreshness.staleOpenGrants, warn: sourceFreshness.staleOpenGrants > 0 },
                  { label: 'Missing URLs', value: sourceFreshness.grantsMissingUrl, warn: sourceFreshness.grantsMissingUrl > 0 },
                  { label: 'Failing sources', value: sourceFreshness.frontierFailing, warn: sourceFreshness.frontierFailing > 0 },
                  { label: 'Scout agents', value: sourceFreshness.scoutRuns.length, warn: false },
                ].map((item) => (
                  <div
                    key={item.label}
                    className="rounded-lg px-3 py-2 text-xs"
                    style={{
                      background: item.warn ? 'rgba(217,119,6,0.08)' : 'var(--ws-surface-2)',
                      color: item.warn ? 'var(--ws-amber)' : 'var(--ws-text-secondary)',
                    }}
                  >
                    <span className="font-semibold tabular-nums">{item.value.toLocaleString()}</span> {item.label.toLowerCase()}
                  </div>
                ))}
              </div>

              {sourceFreshness.scoutRuns.length > 0 && (
                <div className="mt-4 space-y-2">
                  {sourceFreshness.scoutRuns.slice(0, 3).map((run) => (
                    <div key={run.agent_id} className="flex items-start justify-between gap-3">
                      <div className="min-w-0">
                        <p className="truncate text-xs font-medium" style={{ color: 'var(--ws-text)' }}>
                          {run.agent_name.replace(/-/g, ' ').replace(/\b\w/g, c => c.toUpperCase())}
                        </p>
                        <p className="text-[11px]" style={{ color: 'var(--ws-text-tertiary)' }}>
                          {run.items_new != null && run.items_new > 0
                            ? `+${run.items_new} new`
                            : run.items_updated != null && run.items_updated > 0
                              ? `${run.items_updated} updated`
                              : run.items_found != null
                                ? `${run.items_found} checked`
                                : run.status}
                          {' \u00B7 '}
                          {relativeTime(run.started_at)}
                        </p>
                      </div>
                      <span
                        className="shrink-0 text-[10px] font-semibold uppercase tracking-wide"
                        style={{
                          color: run.status === 'success'
                            ? 'var(--ws-green)'
                            : run.status === 'error'
                              ? 'var(--ws-red)'
                              : 'var(--ws-text-tertiary)',
                        }}
                      >
                        {run.status}
                      </span>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </section>

          {/* Alert activity */}
          <section>
            <div className="flex items-center justify-between mb-3">
              <h2 className="text-xs font-semibold uppercase tracking-wide" style={{ color: 'var(--ws-text-tertiary)' }}>Grant Alerts</h2>
              <Link href="/alerts" className="text-[11px] font-medium hover:underline" style={{ color: 'var(--ws-accent)' }}>
                Manage
              </Link>
            </div>

            {activeAlertCount === 0 ? (
              <div className="rounded-lg border p-4" style={{ borderColor: 'var(--ws-border)', background: 'var(--ws-surface-1)' }}>
                <p className="text-sm font-medium" style={{ color: 'var(--ws-text)' }}>No active alerts yet</p>
                <p className="text-xs mt-1.5" style={{ color: 'var(--ws-text-secondary)' }}>
                  Turn on alerts to get notified when new grant matches are queued or delivered.
                </p>
                <Link
                  href="/alerts"
                  className="inline-flex mt-3 px-3 py-2 text-xs font-medium rounded-lg transition-colors"
                  style={{ background: 'var(--ws-accent)', color: '#fff' }}
                >
                  Open Alerts
                </Link>
              </div>
            ) : (
              <div className="space-y-3">
                <div className="grid grid-cols-3 gap-2">
                  {[
                    { label: 'Active', value: effectiveActiveAlertCount.toString() },
                    { label: 'Queued', value: recentQueuedAlerts.toString() },
                    { label: 'Sent', value: recentSentAlerts.toString() },
                  ].map((stat) => (
                    <div
                      key={stat.label}
                      className="rounded-lg border px-3 py-2.5"
                      style={{ borderColor: 'var(--ws-border)', background: 'var(--ws-surface-1)' }}
                    >
                      <p className="text-lg font-semibold tabular-nums" style={{ color: 'var(--ws-text)' }}>{stat.value}</p>
                      <p className="text-[11px]" style={{ color: 'var(--ws-text-tertiary)' }}>{stat.label}</p>
                    </div>
                  ))}
                </div>

                {!alertNeedsAttention && alertLearning.length > 0 && (
                  <div className="rounded-lg border p-4" style={{ borderColor: 'var(--ws-border)', background: 'var(--ws-surface-1)' }}>
                    <div className="flex items-start justify-between gap-3">
                      <div>
                        <p className="text-sm font-medium" style={{ color: 'var(--ws-text)' }}>Alerts are stable</p>
                        <p className="text-xs mt-1.5 leading-5" style={{ color: 'var(--ws-text-secondary)' }}>
                          {alertLearningSummary.stable} active alert{alertLearningSummary.stable !== 1 ? 's' : ''} are producing tracked prospects. Keep the detail in Alerts unless tuning is needed.
                        </p>
                      </div>
                      <span className="shrink-0 rounded-full px-2.5 py-1 text-[11px] font-medium" style={{ color: 'var(--ws-green)', background: 'rgba(22,163,74,0.1)' }}>
                        {trackedFromAlerts.toLocaleString()} tracked
                      </span>
                    </div>
                    <div className="mt-3 space-y-2">
                      {visibleAlertLearning.map((item) => (
                        <div key={item.id} className="flex items-center justify-between gap-3 text-xs">
                          <span className="min-w-0 truncate" style={{ color: 'var(--ws-text-secondary)' }}>{item.name}</span>
                          <span className="shrink-0 tabular-nums" style={{ color: 'var(--ws-text-tertiary)' }}>{item.tracked.toLocaleString()} tracked</span>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {alertNeedsAttention && alertLearning.length > 0 && (
                  <div className="rounded-lg border p-4" style={{ borderColor: 'var(--ws-border)', background: 'var(--ws-surface-1)' }}>
                    <div className="flex items-start justify-between gap-3">
                      <div>
                        <p className="text-sm font-medium" style={{ color: 'var(--ws-text)' }}>Alert learning</p>
                        <p className="text-xs mt-1" style={{ color: 'var(--ws-text-secondary)' }}>
                          CivicGraph is learning which alerts are improving and which ones need tightening.
                        </p>
                      </div>
                      <Link href="/alerts" className="text-[11px] font-medium hover:underline shrink-0" style={{ color: 'var(--ws-accent)' }}>
                        Tune alerts
                      </Link>
                    </div>

                    <div className="flex flex-wrap gap-2 mt-3">
                      {[
                        { label: 'Improving', value: alertLearningSummary.improving, color: 'var(--ws-green)', bg: 'rgba(22,163,74,0.08)' },
                        { label: 'Needs attention', value: alertLearningSummary.needsAttention, color: 'var(--ws-amber)', bg: 'rgba(217,119,6,0.08)' },
                        { label: 'Stable', value: alertLearningSummary.stable, color: 'var(--ws-text-secondary)', bg: 'var(--ws-surface-2)' },
                      ].map((item) => (
                        <div
                          key={item.label}
                          className="rounded-full px-3 py-1.5 text-[11px] font-medium"
                          style={{ color: item.color, background: item.bg }}
                        >
                          {item.value} {item.label.toLowerCase()}
                        </div>
                      ))}
                    </div>

                    <div className="mt-3 space-y-2">
                      {visibleAlertLearning.map((item) => {
                        const toneStyles = item.recommendation.tone === 'success'
                          ? { border: 'var(--ws-green)', bg: 'rgba(22,163,74,0.06)', color: 'var(--ws-green)' }
                          : item.recommendation.tone === 'warning'
                            ? { border: 'var(--ws-amber)', bg: 'rgba(217,119,6,0.06)', color: 'var(--ws-amber)' }
                            : item.recommendation.tone === 'info'
                              ? { border: 'var(--ws-accent)', bg: 'rgba(37,99,235,0.06)', color: 'var(--ws-accent)' }
                              : { border: 'var(--ws-border)', bg: 'var(--ws-surface-2)', color: 'var(--ws-text-secondary)' };

                        return (
                          <div
                            key={item.id}
                            className="rounded-lg border p-3"
                            style={{ borderColor: toneStyles.border, background: toneStyles.bg }}
                          >
                            <div className="flex items-start justify-between gap-3">
                              <div className="min-w-0">
                                <p className="text-sm font-medium truncate" style={{ color: 'var(--ws-text)' }}>{item.name}</p>
                                <p className="text-[11px] mt-0.5" style={{ color: toneStyles.color }}>{item.recommendation.title}</p>
                              </div>
                              <span className="text-[10px] uppercase tracking-wide shrink-0" style={{ color: 'var(--ws-text-tertiary)' }}>
                                {item.frequency}
                              </span>
                            </div>
                            <p className="text-xs mt-2 leading-5" style={{ color: 'var(--ws-text-secondary)' }}>
                              {item.recommendation.detail}
                            </p>
                            <div className="flex flex-wrap gap-x-3 gap-y-1 mt-2 text-[11px]" style={{ color: 'var(--ws-text-tertiary)' }}>
                              <span>{item.sent} sent</span>
                              <span>{item.clicks} clicks</span>
                              <span>{item.tracked} tracked</span>
                              {item.lastOptimizedAt && (
                                <span>Optimized {relativeTime(item.lastOptimizedAt)}</span>
                              )}
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                )}

                {showAlertUpsell && (
                  <div className="rounded-lg border p-4" style={{ borderColor: 'var(--ws-accent)', background: 'rgba(37,99,235,0.06)' }}>
                    <div className="flex items-start justify-between gap-3">
                      <div>
                        <p className="text-sm font-medium" style={{ color: 'var(--ws-text)' }}>Unlock the full alert loop</p>
                        <p className="text-xs mt-1.5" style={{ color: 'var(--ws-text-secondary)' }}>
                          Professional unlocks daily alerts, up to 10 saved alerts, weekly digest delivery, and stronger monitoring workflows.
                        </p>
                        <div className="flex flex-wrap gap-2 mt-3 text-[11px]">
                          <span className="rounded-full px-3 py-1.5" style={{ background: 'var(--ws-surface-1)', color: 'var(--ws-text-secondary)' }}>
                            {alertEntitlements.maxAlerts} alert on Community
                          </span>
                          <span className="rounded-full px-3 py-1.5" style={{ background: 'var(--ws-surface-1)', color: 'var(--ws-text-secondary)' }}>
                            Weekly only
                          </span>
                          <span className="rounded-full px-3 py-1.5" style={{ background: 'var(--ws-surface-1)', color: 'var(--ws-text-secondary)' }}>
                            Weekly digest locked
                          </span>
                        </div>
                      </div>
                      <div className="flex shrink-0 gap-2">
                        <button
                          type="button"
                          onClick={() => void upgradeAlerts()}
                          disabled={startingUpgrade}
                          className="rounded-lg px-3 py-2 text-xs font-medium transition-colors"
                          style={{ background: 'var(--ws-accent)', color: '#fff', opacity: startingUpgrade ? 0.7 : 1 }}
                        >
                          {startingUpgrade ? 'Starting…' : 'Upgrade to Professional'}
                        </button>
                        <Link
                          href="/support"
                          className="rounded-lg border px-3 py-2 text-xs font-medium transition-colors"
                          style={{ borderColor: 'var(--ws-border)', color: 'var(--ws-text-secondary)' }}
                        >
                          View plans
                        </Link>
                      </div>
                    </div>
                  </div>
                )}

                {visibleAlertActivity.length === 0 ? (
                  <div className="rounded-lg border p-4" style={{ borderColor: 'var(--ws-border)', background: 'var(--ws-surface-1)' }}>
                    <p className="text-sm font-medium" style={{ color: 'var(--ws-text)' }}>Alert queue is summarized</p>
                    <p className="text-xs mt-1.5" style={{ color: 'var(--ws-text-secondary)' }}>
                      Home only surfaces failures or tuning needs. Review queued matches in the Alerts workspace.
                    </p>
                    {recentQueuedAlerts > 0 && (
                      <Link
                        href="/alerts"
                        className="mt-3 inline-flex rounded-lg border px-3 py-2 text-xs font-medium transition-colors hover:border-[var(--ws-accent)]"
                        style={{ borderColor: 'var(--ws-border)', color: 'var(--ws-text-secondary)' }}
                      >
                        Review {recentQueuedAlerts} queued
                      </Link>
                    )}
                  </div>
                ) : (
                  <div className="rounded-lg border overflow-hidden" style={{ borderColor: 'var(--ws-border)', background: 'var(--ws-surface-1)' }}>
                    {visibleAlertActivity.map((activity, i) => (
                      <AlertActivityRow
                        key={activity.id}
                        activity={activity}
                        borderTop={i > 0}
                        trackerHref={trackerHref}
                        tracked={!!(activity.grant?.id && trackedGrantIds.has(activity.grant.id))}
                        tracking={pendingTrackGrantId === activity.grant?.id}
                        pausing={pendingPauseAlertId === activity.alert?.id}
                        disabled={isRefreshing}
                        onTrackGrant={activity.grant?.id ? () => trackGrant(activity.grant!.id, {
                          alertId: activity.alert?.id || null,
                          notificationId: activity.id,
                        }) : undefined}
                        onPauseAlert={activity.alert?.id && activity.alert.enabled && !pausedAlertIds.has(activity.alert.id) ? () => pauseAlert(activity.alert!.id) : undefined}
                        retrying={pendingNotificationAction?.id === activity.id && pendingNotificationAction.action === 'retry'}
                        dismissing={pendingNotificationAction?.id === activity.id && pendingNotificationAction.action === 'cancel'}
                        onRetry={activity.status === 'failed' || activity.status === 'cancelled' ? () => updateNotification(activity.id, 'retry') : undefined}
                        onDismiss={activity.status === 'queued' || activity.status === 'failed' ? () => updateNotification(activity.id, 'cancel') : undefined}
                      />
                    ))}
                  </div>
                )}
              </div>
            )}
          </section>

          {/* Agent activity feed */}
          {agentRuns.length > 0 && (
            <section>
              <div className="flex items-center justify-between mb-3">
                <h2 className="text-xs font-semibold uppercase tracking-wide" style={{ color: 'var(--ws-text-tertiary)' }}>Data Activity</h2>
                <Link href="/mission-control" className="text-[11px] font-medium hover:underline" style={{ color: 'var(--ws-accent)' }}>
                  All Agents
                </Link>
              </div>
              <div className="rounded-lg border overflow-hidden" style={{ borderColor: 'var(--ws-border)', background: 'var(--ws-surface-1)' }}>
                {agentRuns.map((run, i) => (
                  <div
                    key={run.id}
                    className="px-3 py-2.5 flex items-start gap-2.5"
                    style={{ borderTop: i > 0 ? '1px solid var(--ws-border)' : 'none' }}
                  >
                    <div
                      className="w-1.5 h-1.5 rounded-full mt-1.5 shrink-0"
                      style={{
                        background: run.status === 'success' ? 'var(--ws-green)'
                          : run.status === 'running' ? 'var(--ws-accent)'
                          : run.status === 'error' ? 'var(--ws-red)'
                          : 'var(--ws-text-tertiary)',
                      }}
                    />
                    <div className="flex-1 min-w-0">
                      <p className="text-xs font-medium truncate" style={{ color: 'var(--ws-text)' }}>
                        {run.agent_name.replace(/-/g, ' ').replace(/\b\w/g, c => c.toUpperCase())}
                      </p>
                      <p className="text-[11px]" style={{ color: 'var(--ws-text-tertiary)' }}>
                        {run.items_new != null && run.items_new > 0
                          ? `+${run.items_new} new`
                          : run.items_found != null
                            ? `${run.items_found} checked`
                            : run.status}
                        {' \u00B7 '}
                        {relativeTime(run.started_at)}
                      </p>
                    </div>
                  </div>
                ))}
              </div>
            </section>
          )}

          {/* Database pulse */}
          <section>
            <h2 className="text-xs font-semibold uppercase tracking-wide mb-3" style={{ color: 'var(--ws-text-tertiary)' }}>Database</h2>
            <div className="grid grid-cols-2 gap-2">
              {[
                { label: 'Entities', value: entityCount.toLocaleString() },
                { label: 'Open Grants', value: openGrantCount.toLocaleString() },
              ].map(stat => (
                <div
                  key={stat.label}
                  className="rounded-lg border px-3 py-2.5"
                  style={{ borderColor: 'var(--ws-border)', background: 'var(--ws-surface-1)' }}
                >
                  <p className="text-lg font-semibold tabular-nums" style={{ color: 'var(--ws-text)' }}>{stat.value}</p>
                  <p className="text-[11px]" style={{ color: 'var(--ws-text-tertiary)' }}>{stat.label}</p>
                </div>
              ))}
            </div>
          </section>
        </div>
      </div>

      {/* ── Grant preview panel ── */}
      <SlidePanel open={preview?.type === 'grant'} onClose={() => setPreview(null)}>
        {preview?.type === 'grant' && preview.item.grant && (
          <>
            <SlidePanelHeader onClose={() => setPreview(null)} href={`/grants/${preview.item.grant.id}`}>
              <p className="text-[11px] font-medium uppercase tracking-wide" style={{ color: 'var(--ws-text-tertiary)' }}>
                Grant Preview
              </p>
            </SlidePanelHeader>
            <SlidePanelBody>
              <div className="space-y-5">
                {/* Title */}
                <div>
                  <h2 className="text-lg font-semibold leading-snug" style={{ color: 'var(--ws-text)' }}>
                    {preview.item.grant.name}
                  </h2>
                  <p className="text-sm mt-1" style={{ color: 'var(--ws-text-secondary)' }}>
                    {preview.item.grant.provider}
                  </p>
                </div>

                {/* Key details grid */}
                <div className="grid grid-cols-2 gap-3">
                  <DetailCell label="Amount" value={
                    preview.item.grant.amount_min && preview.item.grant.amount_max
                      ? `${formatMoney(preview.item.grant.amount_min)} \u2013 ${formatMoney(preview.item.grant.amount_max)}`
                      : preview.item.grant.amount_max
                        ? `Up to ${formatMoney(preview.item.grant.amount_max)}`
                        : preview.item.grant.amount_min
                          ? `From ${formatMoney(preview.item.grant.amount_min)}`
                          : 'Not specified'
                  } />
                  <DetailCell label="Closes" value={formatDate(preview.item.grant.closes_at)} highlight={
                    preview.item.grant.closes_at ? daysUntil(preview.item.grant.closes_at) <= 7 : false
                  } />
                  <DetailCell label="Stage" value={preview.item.stage.replace('_', ' ')} />
                  <DetailCell label="Categories" value={
                    preview.item.grant.categories.length > 0
                      ? preview.item.grant.categories.slice(0, 3).join(', ')
                      : 'None'
                  } />
                </div>

                {/* Deadline urgency bar */}
                {preview.item.grant.closes_at && daysUntil(preview.item.grant.closes_at) <= 14 && (
                  <div
                    className="rounded-lg px-4 py-3 flex items-center gap-3"
                    style={{
                      background: daysUntil(preview.item.grant.closes_at) <= 7
                        ? 'rgba(220,38,38,0.08)'
                        : 'rgba(217,119,6,0.08)',
                    }}
                  >
                    <div
                      className="w-2 h-2 rounded-full shrink-0"
                      style={{
                        background: daysUntil(preview.item.grant.closes_at) <= 7 ? 'var(--ws-red)' : 'var(--ws-amber)',
                      }}
                    />
                    <p className="text-sm font-medium" style={{
                      color: daysUntil(preview.item.grant.closes_at) <= 7 ? 'var(--ws-red)' : 'var(--ws-amber)',
                    }}>
                      {daysUntil(preview.item.grant.closes_at) === 0
                        ? 'Closes today'
                        : `${daysUntil(preview.item.grant.closes_at)} days remaining`}
                    </p>
                  </div>
                )}

                {/* Actions */}
                <div className="flex gap-2 pt-2">
                  <Link
                    href={`/grants/${preview.item.grant.id}`}
                    className="flex-1 text-center px-4 py-2.5 text-sm font-medium rounded-lg transition-colors"
                    style={{ background: 'var(--ws-accent)', color: '#fff' }}
                  >
                    View Full Details
                  </Link>
                  <Link
                    href={trackerHref}
                    className="px-4 py-2.5 text-sm font-medium rounded-lg transition-colors border"
                    style={{ borderColor: 'var(--ws-border)', color: 'var(--ws-text-secondary)' }}
                  >
                    Tracker
                  </Link>
                </div>
              </div>
            </SlidePanelBody>
          </>
        )}
      </SlidePanel>

      {/* ── Foundation preview panel ── */}
      <SlidePanel open={preview?.type === 'foundation'} onClose={() => setPreview(null)}>
        {preview?.type === 'foundation' && preview.item.foundation && (
          <>
            <SlidePanelHeader onClose={() => setPreview(null)} href={`/foundations/${preview.item.foundation.id}`}>
              <p className="text-[11px] font-medium uppercase tracking-wide" style={{ color: 'var(--ws-text-tertiary)' }}>
                Foundation Preview
              </p>
            </SlidePanelHeader>
            <SlidePanelBody>
              <div className="space-y-5">
                {/* Title */}
                <div>
                  <h2 className="text-lg font-semibold leading-snug" style={{ color: 'var(--ws-text)' }}>
                    {preview.item.foundation.name}
                  </h2>
                </div>

                {/* Key details grid */}
                <div className="grid grid-cols-2 gap-3">
                  <DetailCell label="Annual Giving" value={
                    preview.item.foundation.total_giving_annual
                      ? `${formatMoney(preview.item.foundation.total_giving_annual)}/yr`
                      : 'Unknown'
                  } />
                  <DetailCell label="Relationship" value={preview.item.stage.replace('_', ' ')} />
                </div>

                {/* Thematic focus */}
                {preview.item.foundation.thematic_focus.length > 0 && (
                  <div>
                    <p className="text-[11px] font-medium uppercase tracking-wide mb-2" style={{ color: 'var(--ws-text-tertiary)' }}>
                      Thematic Focus
                    </p>
                    <div className="flex flex-wrap gap-1.5">
                      {preview.item.foundation.thematic_focus.map(t => (
                        <span
                          key={t}
                          className="text-xs font-medium px-2.5 py-1 rounded-full"
                          style={{ background: 'var(--ws-surface-2)', color: 'var(--ws-text-secondary)' }}
                        >
                          {t}
                        </span>
                      ))}
                    </div>
                  </div>
                )}

                {/* Geographic focus */}
                {preview.item.foundation.geographic_focus.length > 0 && (
                  <div>
                    <p className="text-[11px] font-medium uppercase tracking-wide mb-2" style={{ color: 'var(--ws-text-tertiary)' }}>
                      Geographic Focus
                    </p>
                    <div className="flex flex-wrap gap-1.5">
                      {preview.item.foundation.geographic_focus.map(g => (
                        <span
                          key={g}
                          className="text-xs font-medium px-2.5 py-1 rounded-full"
                          style={{ background: 'var(--ws-surface-2)', color: 'var(--ws-text-secondary)' }}
                        >
                          {g}
                        </span>
                      ))}
                    </div>
                  </div>
                )}

                {/* Actions */}
                <div className="flex gap-2 pt-2">
                  <Link
                    href={`/foundations/${preview.item.foundation.id}`}
                    className="flex-1 text-center px-4 py-2.5 text-sm font-medium rounded-lg transition-colors"
                    style={{ background: 'var(--ws-accent)', color: '#fff' }}
                  >
                    View Full Profile
                  </Link>
                  <Link
                    href="/foundations/tracker"
                    className="px-4 py-2.5 text-sm font-medium rounded-lg transition-colors border"
                    style={{ borderColor: 'var(--ws-border)', color: 'var(--ws-text-secondary)' }}
                  >
                    Tracker
                  </Link>
                </div>
              </div>
            </SlidePanelBody>
          </>
        )}
      </SlidePanel>
    </div>
  );
}

/* ── Small detail cell used in preview panels ── */

function DetailCell({ label, value, highlight }: { label: string; value: string; highlight?: boolean }) {
  return (
    <div
      className="rounded-lg px-3 py-2.5"
      style={{ background: 'var(--ws-surface-2)' }}
    >
      <p className="text-[11px] font-medium uppercase tracking-wide mb-0.5" style={{ color: 'var(--ws-text-tertiary)' }}>
        {label}
      </p>
      <p
        className="text-sm font-medium capitalize"
        style={{ color: highlight ? 'var(--ws-red)' : 'var(--ws-text)' }}
      >
        {value}
      </p>
    </div>
  );
}

function AlertActivityRow({
  activity,
  borderTop,
  trackerHref,
  tracked = false,
  tracking = false,
  pausing = false,
  retrying = false,
  dismissing = false,
  disabled = false,
  onTrackGrant,
  onPauseAlert,
  onRetry,
  onDismiss,
}: {
  activity: AlertActivityItem;
  borderTop?: boolean;
  trackerHref: string;
  tracked?: boolean;
  tracking?: boolean;
  pausing?: boolean;
  retrying?: boolean;
  dismissing?: boolean;
  disabled?: boolean;
  onTrackGrant?: () => void;
  onPauseAlert?: () => void;
  onRetry?: () => void;
  onDismiss?: () => void;
}) {
  const tone = ALERT_STATUS_STYLES[activity.status] || ALERT_STATUS_STYLES.cancelled;
  const statusLabel = activity.status === 'sent'
    ? 'Sent'
    : activity.status === 'failed'
      ? 'Failed'
      : activity.status === 'cancelled'
        ? 'Cancelled'
        : 'Queued';
  const activityTime = activity.sent_at || activity.queued_at;

  return (
    <div
      className="px-3 py-3"
      style={{ borderTop: borderTop ? '1px solid var(--ws-border)' : 'none' }}
    >
      <div className="flex items-start gap-3">
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <span
              className="text-[10px] font-medium uppercase tracking-wide px-2 py-0.5 rounded"
              style={{ background: tone.bg, color: tone.color }}
            >
              {statusLabel}
            </span>
            {activity.match_score != null && (
              <span
                className="text-[10px] font-medium uppercase tracking-wide px-2 py-0.5 rounded"
                style={{ background: 'rgba(37,99,235,0.08)', color: 'var(--ws-accent)' }}
              >
                {activity.match_score}% match
              </span>
            )}
          </div>

          <div className="mt-2">
            {activity.grant ? (
              <Link href={`/grants/${activity.grant.id}`} className="text-sm font-medium hover:underline" style={{ color: 'var(--ws-text)' }}>
                {activity.grant.name}
              </Link>
            ) : (
              <p className="text-sm font-medium" style={{ color: 'var(--ws-text)' }}>
                {activity.subject || 'Grant alert activity'}
              </p>
            )}
            <p className="text-[11px] mt-1" style={{ color: 'var(--ws-text-tertiary)' }}>
              {activity.alert?.name || 'Grant alert'}
              {(activity.grant?.provider || activity.subject) ? ` · ${activity.grant?.provider || activity.subject}` : ''}
            </p>
          </div>

          {activity.match_signals.length > 0 && (
            <div className="flex gap-1 mt-2 flex-wrap">
              {activity.match_signals.slice(0, 3).map((signal) => (
                <span
                  key={signal}
                  className="text-[10px] font-medium px-2 py-0.5 rounded"
                  style={{ background: 'var(--ws-surface-2)', color: 'var(--ws-text-tertiary)' }}
                >
                  {signal}
                </span>
              ))}
            </div>
          )}

          {activity.last_error && (
            <p className="text-[11px] mt-2" style={{ color: 'var(--ws-red)' }}>
              {activity.last_error}
            </p>
          )}

          <div className="mt-3 flex gap-2 flex-wrap">
            {activity.grant?.id ? (
              tracked ? (
                <Link
                  href={trackerHref}
                  className="text-[10px] font-medium uppercase tracking-wide px-2 py-1 rounded border"
                  style={{ borderColor: 'var(--ws-border)', color: 'var(--ws-text)' }}
                >
                  In Tracker
                </Link>
              ) : (
                <button
                  type="button"
                  onClick={onTrackGrant}
                  disabled={!onTrackGrant || tracking || disabled}
                  className="text-[10px] font-medium uppercase tracking-wide px-2 py-1 rounded transition-colors disabled:opacity-50"
                  style={{ background: 'var(--ws-accent)', color: '#fff' }}
                >
                  {tracking ? 'Saving...' : 'Track Grant'}
                </button>
              )
            ) : null}
            {activity.alert?.enabled && onPauseAlert ? (
              <button
                type="button"
                onClick={onPauseAlert}
                disabled={pausing || disabled}
                className="text-[10px] font-medium uppercase tracking-wide px-2 py-1 rounded border transition-colors disabled:opacity-50"
                style={{ borderColor: 'var(--ws-border)', color: 'var(--ws-text-secondary)' }}
              >
                {pausing ? 'Pausing...' : 'Pause Alert'}
              </button>
            ) : null}
            {onRetry ? (
              <button
                type="button"
                onClick={onRetry}
                disabled={retrying || disabled}
                className="text-[10px] font-medium uppercase tracking-wide px-2 py-1 rounded border transition-colors disabled:opacity-50"
                style={{ borderColor: 'var(--ws-accent)', color: 'var(--ws-accent)' }}
              >
                {retrying ? 'Retrying...' : 'Retry Delivery'}
              </button>
            ) : null}
            {onDismiss ? (
              <button
                type="button"
                onClick={onDismiss}
                disabled={dismissing || disabled}
                className="text-[10px] font-medium uppercase tracking-wide px-2 py-1 rounded border transition-colors disabled:opacity-50"
                style={{ borderColor: 'var(--ws-border)', color: 'var(--ws-text-tertiary)' }}
              >
                {dismissing ? 'Dismissing...' : 'Dismiss'}
              </button>
            ) : null}
          </div>
        </div>

        <div className="text-right shrink-0">
          <p className="text-[11px]" style={{ color: 'var(--ws-text-tertiary)' }}>{relativeTime(activityTime)}</p>
          {activity.grant?.closes_at && (
            <p className="text-[11px] mt-1 font-medium" style={{ color: daysUntil(activity.grant.closes_at) <= 7 ? 'var(--ws-red)' : 'var(--ws-text-tertiary)' }}>
              {daysUntil(activity.grant.closes_at) === 0 ? 'Today' : `${daysUntil(activity.grant.closes_at)}d`}
            </p>
          )}
        </div>
      </div>
    </div>
  );
}
