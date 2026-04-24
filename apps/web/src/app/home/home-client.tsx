'use client';

import { useEffect, useState, useTransition } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { trackProductEvent } from '@/lib/product-events-client';
import { startCheckoutForTier } from '@/lib/start-checkout';
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
  } | null;
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

type ActionFeedback = {
  tone: 'success' | 'error';
  message: string;
};

type NotificationOverride = {
  status?: string;
  last_error?: string | null;
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
  discoveredCount: number;
  activeCount: number;
  submittedCount: number;
  wonCount: number;
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
  const [isRefreshing, startRefresh] = useTransition();
  const [startingUpgrade, setStartingUpgrade] = useState(false);

  const {
    greeting, contextLine, profileReady, hasShortlistedGrants, hasWorkedGrantPipeline,
    grants, foundations, agentRuns, activeAlertCount, recentAlertActivity, alertLearning, alertLearningSummary, subscriptionTier, alertEntitlements, billingStatus, openGrantCount, entityCount,
    urgentDeadlines, soonDeadlines,
    discoveredCount, activeCount, submittedCount, wonCount,
  } = props;
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
  const visibleAlertLearning = alertLearning.slice(0, 3);
  const showAlertUpsell = subscriptionTier === 'community';

  useEffect(() => {
    if (!feedback) return;
    const timeout = window.setTimeout(() => setFeedback(null), 4000);
    return () => window.clearTimeout(timeout);
  }, [feedback]);

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

  return (
    <div className="max-w-5xl">
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
                Keep triaging new matches, work active grants in the tracker, and use the home dashboard as your daily summary.
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

      {/* Main grid */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Left column */}
        <div className="lg:col-span-2 space-y-6">

          {/* Urgent deadlines */}
          {urgentDeadlines.length > 0 && (
            <section>
              <div className="rounded-lg border overflow-hidden" style={{ borderColor: 'var(--ws-red)' }}>
                <div className="px-4 py-2.5 flex items-center justify-between" style={{ background: 'var(--ws-red)' }}>
                  <span className="text-xs font-semibold text-white uppercase tracking-wide">Closing This Week</span>
                  <span className="text-xs font-medium text-white/70">{urgentDeadlines.length} grant{urgentDeadlines.length !== 1 ? 's' : ''}</span>
                </div>
                <div>
                  {urgentDeadlines.map((item, i) => {
                    const days = daysUntil(item.grant!.closes_at!);
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
                        <div className="flex items-center gap-3 ml-4 shrink-0">
                          {item.grant?.amount_max && (
                            <span className="text-sm font-semibold tabular-nums" style={{ color: 'var(--ws-text)' }}>{formatMoney(item.grant.amount_max)}</span>
                          )}
                          <span
                            className="text-[11px] font-semibold px-2 py-0.5 rounded tabular-nums"
                            style={{ background: 'rgba(220,38,38,0.1)', color: 'var(--ws-red)' }}
                          >
                            {days === 0 ? 'Today' : days === 1 ? '1 day' : `${days} days`}
                          </span>
                        </div>
                      </button>
                    );
                  })}
                </div>
              </div>
            </section>
          )}

          {/* Pipeline stats */}
          {grants.length > 0 && (
            <section>
              <div className="flex items-center justify-between mb-3">
                <h2 className="text-sm font-semibold" style={{ color: 'var(--ws-text)' }}>Pipeline</h2>
                <Link href={trackerHref} className="text-xs font-medium transition-colors hover:underline" style={{ color: 'var(--ws-accent)' }}>
                  Open Tracker &rarr;
                </Link>
              </div>
              <div className="grid grid-cols-4 gap-3">
                {[
                  { label: 'To Review', value: discoveredCount, warn: discoveredCount > 20, href: trackerHref },
                  { label: 'In Progress', value: activeCount, href: trackerHref },
                  { label: 'Submitted', value: submittedCount, href: trackerHref },
                  { label: 'Won', value: wonCount, color: 'var(--ws-green)', href: trackerHref },
                ].map(stat => (
                  <Link
                    key={stat.label}
                    href={stat.href}
                    className="rounded-lg border p-4 transition-colors hover:border-[var(--ws-accent)]"
                    style={{ borderColor: 'var(--ws-border)', background: 'var(--ws-surface-1)' }}
                  >
                    <p className="text-2xl font-semibold tabular-nums" style={{ color: stat.color || 'var(--ws-text)' }}>
                      {stat.value}
                    </p>
                    <p className="text-xs mt-1" style={{ color: 'var(--ws-text-secondary)' }}>{stat.label}</p>
                    {stat.warn && (
                      <p className="text-[11px] font-medium mt-1.5" style={{ color: 'var(--ws-amber)' }}>Needs triaging</p>
                    )}
                  </Link>
                ))}
              </div>
            </section>
          )}

          {/* Upcoming deadlines */}
          {soonDeadlines.length > 0 && (
            <section>
              <h2 className="text-sm font-semibold mb-3" style={{ color: 'var(--ws-text)' }}>Coming Up</h2>
              <div className="rounded-lg border overflow-hidden" style={{ borderColor: 'var(--ws-border)', background: 'var(--ws-surface-1)' }}>
                {soonDeadlines.map((item, i) => {
                  const days = daysUntil(item.grant!.closes_at!);
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
                      <div className="flex items-center gap-3 ml-4 shrink-0">
                        {item.grant?.amount_max && (
                          <span className="text-sm font-semibold tabular-nums" style={{ color: 'var(--ws-text)' }}>{formatMoney(item.grant.amount_max)}</span>
                        )}
                        <span className="text-xs tabular-nums" style={{ color: 'var(--ws-text-tertiary)' }}>{days}d</span>
                      </div>
                    </button>
                  );
                })}
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
          <section>
            <h2 className="text-xs font-semibold uppercase tracking-wide mb-3" style={{ color: 'var(--ws-text-tertiary)' }}>Decision Loop</h2>
            <div className="rounded-lg border p-4" style={{ borderColor: 'var(--ws-border)', background: 'var(--ws-surface-1)' }}>
              <p className="text-sm font-medium" style={{ color: 'var(--ws-text)' }}>
                Same context, more than one output.
              </p>
              <p className="text-xs mt-1.5" style={{ color: 'var(--ws-text-secondary)' }}>
                Use the funding graph to pick the next move, then carry the same evidence into a brief, report, or story-ready surface.
              </p>
              <div className="mt-4 grid grid-cols-1 gap-2">
                {[
                  { href: '/power', label: 'See the field', desc: 'Read power, place, and market context before acting.' },
                  { href: '/tender-intelligence', label: 'Test the opportunity', desc: 'Check procurement pathways, suppliers, and decision packs.' },
                  { href: '/briefing', label: 'Build the brief', desc: 'Choose memo, pack, report, or story handoff from one working context.' },
                  { href: '/clarity', label: 'Prepare the story', desc: 'Keep the evidence chain clear for reporting and narrative work.' },
                ].map((item) => (
                  <Link
                    key={item.href}
                    href={item.href}
                    className="rounded-lg border px-3 py-3 transition-colors hover:border-[var(--ws-accent)]"
                    style={{ borderColor: 'var(--ws-border)', background: 'var(--ws-surface-0)' }}
                  >
                    <p className="text-sm font-medium" style={{ color: 'var(--ws-text)' }}>{item.label}</p>
                    <p className="text-[11px] mt-1 leading-5" style={{ color: 'var(--ws-text-secondary)' }}>{item.desc}</p>
                  </Link>
                ))}
              </div>
              <p className="text-[11px] mt-3" style={{ color: 'var(--ws-text-tertiary)' }}>
                Agents should scout, link, and draft from the same data, not force the team into separate tools.
              </p>
            </div>
          </section>

          {/* Quick navigation */}
          <section>
            <h2 className="text-xs font-semibold uppercase tracking-wide mb-3" style={{ color: 'var(--ws-text-tertiary)' }}>Quick Actions</h2>
            <div className="space-y-1">
              {[
                { href: '/grants', label: 'Search Grants', icon: '\uD83D\uDD0D', count: openGrantCount },
                { href: '/profile/matches', label: 'Matched Grants', icon: '\u2728' },
                { href: trackerHref, label: 'Grant Tracker', icon: '\uD83D\uDCCB' },
                { href: '/alerts', label: 'Grant Alerts', icon: '\uD83D\uDD14' },
                { href: '/foundations/tracker', label: 'Foundation Tracker', icon: '\uD83C\uDFDB\uFE0F' },
                { href: '/tender-intelligence', label: 'Tender Intelligence', icon: '\uD83D\uDCE6' },
                { href: '/power', label: 'Power Map', icon: '\u26A1' },
                { href: '/briefing', label: 'Briefing Hub', icon: '\uD83E\uDDFE' },
                { href: '/clarity', label: 'Data Clarity', icon: '\uD83E\uDDED' },
                { href: '/home/watchlist', label: 'Watchlist', icon: '\uD83D\uDC41\uFE0F' },
                { href: '/reports', label: 'Reports & Research', icon: '\uD83D\uDCCA' },
                { href: '/entities', label: 'Entity Graph', icon: '\uD83D\uDD17', count: entityCount },
                { href: '/home/api-keys', label: 'API Keys', icon: '\uD83D\uDD11' },
              ].map(item => (
                <Link
                  key={item.href}
                  href={item.href}
                  className="flex items-center gap-3 px-3 py-2.5 rounded-lg transition-colors hover:bg-[var(--ws-surface-2)]"
                >
                  <span className="text-base">{item.icon}</span>
                  <span className="text-sm font-medium flex-1" style={{ color: 'var(--ws-text)' }}>{item.label}</span>
                  {item.count != null && (
                    <span className="text-xs tabular-nums" style={{ color: 'var(--ws-text-tertiary)' }}>{item.count.toLocaleString()}</span>
                  )}
                </Link>
              ))}
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

                {alertLearning.length > 0 && (
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
                          href="/pricing"
                          className="rounded-lg border px-3 py-2 text-xs font-medium transition-colors"
                          style={{ borderColor: 'var(--ws-border)', color: 'var(--ws-text-secondary)' }}
                        >
                          View plans
                        </Link>
                      </div>
                    </div>
                  </div>
                )}

                {effectiveRecentAlertActivity.length === 0 ? (
                  <div className="rounded-lg border p-4" style={{ borderColor: 'var(--ws-border)', background: 'var(--ws-surface-1)' }}>
                    <p className="text-sm font-medium" style={{ color: 'var(--ws-text)' }}>Alerts are live</p>
                    <p className="text-xs mt-1.5" style={{ color: 'var(--ws-text-secondary)' }}>
                      New grant matches and recent deliveries will appear here as the scout runs.
                    </p>
                  </div>
                ) : (
                  <div className="rounded-lg border overflow-hidden" style={{ borderColor: 'var(--ws-border)', background: 'var(--ws-surface-1)' }}>
                    {effectiveRecentAlertActivity.map((activity, i) => (
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
