'use client';

import { useCallback, useEffect, useState } from 'react';
import Link from 'next/link';
import { trackProductEvent } from '@/lib/product-events-client';
import { startCheckoutForTier } from '@/lib/start-checkout';
import { createSupabaseBrowser } from '@/lib/supabase-browser';
import type { AlertFrequency, Tier } from '@/lib/subscription';

interface MatchingGrant {
  id: string;
  name: string;
  provider: string;
  amount_min: number | null;
  amount_max: number | null;
  closes_at: string | null;
  categories: string[];
  url: string | null;
}

interface Alert {
  id: string;
  name: string;
  frequency: string;
  categories: string[];
  focus_areas: string[];
  states: string[];
  min_amount: number | null;
  max_amount: number | null;
  keywords: string[];
  entity_types: string[];
  enabled: boolean;
  created_at: string;
  updated_at: string;
}

interface AlertActivity {
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

interface QueueSummary {
  queued: number;
  sent: number;
  failed: number;
  cancelled: number;
}

interface AlertEntitlements {
  maxAlerts: number;
  frequencies: AlertFrequency[];
  weeklyDigest: boolean;
}

interface AlertEventSummary {
  notificationsQueued: number;
  notificationsSent: number;
  notificationsFailed: number;
  digestsSent: number;
  emailOpens: number;
  grantClicks: number;
  scoutRuns: number;
  optimizationsApplied: number;
}

interface AlertPerformance {
  queued: number;
  sent: number;
  failed: number;
  digestsSent: number;
  opens: number;
  clicks: number;
  tracked: number;
  active: number;
  submitted: number;
  won: number;
  openRate: number | null;
  clickRate: number | null;
  trackRate: number | null;
  clickToTrackRate: number | null;
  submissionRate: number | null;
  winRate: number | null;
  lastEventAt: string | null;
  lastTrackedAt: string | null;
  lastOptimizedAt: string | null;
  lastOptimizationAction: string | null;
  opensAfterOptimization: number;
  sentAfterOptimization: number;
  clicksAfterOptimization: number;
  trackedAfterOptimization: number;
  optimizationComparison: {
    hasComparisonData: boolean;
    enoughComparisonData: boolean;
    before: {
      sent: number;
      opens: number;
      clicks: number;
      tracked: number;
      openRate: number | null;
      clickRate: number | null;
      trackRate: number | null;
    };
    after: {
      sent: number;
      opens: number;
      clicks: number;
      tracked: number;
      openRate: number | null;
      clickRate: number | null;
      trackRate: number | null;
    };
    delta: {
      openRate: number | null;
      clickRate: number | null;
      trackRate: number | null;
    };
  } | null;
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
}

interface AlertEvent {
  id: number;
  event_type: string;
  metadata: Record<string, unknown> | null;
  created_at: string;
}

type ActionFeedback = {
  tone: 'success' | 'error';
  message: string;
};

type AlertOptimizationAction = 'pause' | 'slow_down' | 'clone_tighter';

const FREQUENCIES = ['daily', 'weekly', 'monthly'];
const STATES = ['NSW', 'VIC', 'QLD', 'WA', 'SA', 'TAS', 'NT', 'ACT'];
const CATEGORIES = ['Education', 'Health', 'Environment', 'Arts & Culture', 'Community', 'Indigenous', 'Research', 'Social Services'];

const ALERT_STATUS_STYLES: Record<string, string> = {
  queued: 'bg-amber-50 text-amber-700 border-amber-200',
  sent: 'bg-green-100 text-green-700 border-green-200',
  failed: 'bg-red-50 text-red-600 border-red-200',
  cancelled: 'bg-gray-100 text-gray-500 border-gray-200',
};

function timeAgo(dateStr: string) {
  const diff = Date.now() - new Date(dateStr).getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 60) return `${Math.max(mins, 0)}m ago`;
  const hours = Math.floor(mins / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  return `${days}d ago`;
}

function daysUntil(dateStr: string | null) {
  if (!dateStr) return '—';
  const diff = new Date(dateStr).getTime() - Date.now();
  const days = Math.ceil(diff / (1000 * 60 * 60 * 24));
  if (days < 0) return 'Closed';
  if (days === 0) return 'Today';
  if (days === 1) return '1 day';
  return `${days} days`;
}

function formatMoney(n: number | null) {
  return n == null ? '—' : `$${n.toLocaleString()}`;
}

const EMPTY_QUEUE_SUMMARY: QueueSummary = {
  queued: 0,
  sent: 0,
  failed: 0,
  cancelled: 0,
};

const EMPTY_EVENT_SUMMARY: AlertEventSummary = {
  notificationsQueued: 0,
  notificationsSent: 0,
  notificationsFailed: 0,
  digestsSent: 0,
  emailOpens: 0,
  grantClicks: 0,
  scoutRuns: 0,
  optimizationsApplied: 0,
};

function formatOptimizationAction(action: string | null) {
  if (!action) return 'optimized';
  if (action === 'clone_tighter') return 'cloned tighter';
  if (action === 'slow_down') return 'slowed down';
  if (action === 'pause') return 'paused';
  return action.replace(/_/g, ' ');
}

function formatDelta(value: number | null) {
  if (value == null) return '—';
  if (value === 0) return '0 pts';
  return `${value > 0 ? '+' : ''}${value} pts`;
}

function renderEventDetail(event: AlertEvent) {
  if (event.event_type === 'optimization_applied') {
    const action = typeof event.metadata?.action === 'string' ? event.metadata.action : null;
    const recommendationTitle =
      typeof event.metadata?.recommendation_title === 'string' ? event.metadata.recommendation_title : null;
    const createdAlertName =
      typeof event.metadata?.created_alert_name === 'string' ? event.metadata.created_alert_name : null;

    if (action === 'clone_tighter' && createdAlertName) {
      return `Created tighter variant: ${createdAlertName}${recommendationTitle ? ` from ${recommendationTitle}` : ''}`;
    }

    return `${formatOptimizationAction(action)}${recommendationTitle ? ` from ${recommendationTitle}` : ''}`;
  }

  return Object.keys(event.metadata || {}).length > 0 ? JSON.stringify(event.metadata) : 'No extra metadata';
}

function nextLowerFrequency(current: string) {
  if (current === 'daily') return 'weekly';
  if (current === 'weekly') return 'monthly';
  return null;
}

function buildTighterVariantPayload(alert: Alert) {
  const trimmedKeywords = alert.keywords.filter(Boolean).slice(0, 2);
  const fallbackKeyword = trimmedKeywords.length > 0
    ? trimmedKeywords
    : alert.focus_areas[0]
      ? [alert.focus_areas[0]]
      : alert.categories[0]
        ? [alert.categories[0]]
        : [];

  return {
    name: `${alert.name} High Fit`,
    frequency: alert.frequency,
    categories: alert.categories.length > 1 ? alert.categories.slice(0, 1) : alert.categories,
    focus_areas: alert.focus_areas.length > 1 ? alert.focus_areas.slice(0, 1) : alert.focus_areas,
    states: alert.states.length > 1 ? alert.states.slice(0, 1) : alert.states,
    min_amount: alert.min_amount,
    max_amount: alert.max_amount,
    keywords: fallbackKeyword,
    entity_types: alert.entity_types,
  };
}

function getOptimizationActions(
  alert: Alert,
  performance: AlertPerformance,
  canClone: boolean
): Array<{ action: AlertOptimizationAction; label: string }> {
  if (
    performance.recommendation.key === 'keep_expand'
    || performance.recommendation.key === 'working_pipeline'
    || performance.recommendation.key === 'good_prospect_flow'
    || performance.recommendation.key === 'optimization_improving'
  ) {
    return canClone ? [{ action: 'clone_tighter', label: 'Clone High-Fit Variant' }] : [];
  }

  if (performance.recommendation.key === 'clicks_not_converting') {
    const actions: Array<{ action: AlertOptimizationAction; label: string }> = [];
    if (canClone) actions.push({ action: 'clone_tighter', label: 'Clone Tighter Variant' });
    actions.push({ action: 'pause', label: 'Pause Alert' });
    return actions;
  }

  if (performance.recommendation.key === 'low_engagement') {
    const nextFrequency = nextLowerFrequency(alert.frequency);
    return nextFrequency
      ? [{ action: 'slow_down', label: `Switch to ${nextFrequency}` }]
      : [{ action: 'pause', label: 'Pause Alert' }];
  }

  if (
    performance.recommendation.key === 'low_fit'
    || performance.recommendation.key === 'optimization_underperforming'
  ) {
    return [{ action: 'pause', label: 'Pause Alert' }];
  }

  return [];
}

export default function AlertsPage() {
  const [user, setUser] = useState<{ id: string } | null>(null);
  const [loading, setLoading] = useState(true);
  const [alerts, setAlerts] = useState<Alert[]>([]);
  const [recentActivity, setRecentActivity] = useState<AlertActivity[]>([]);
  const [recentEvents, setRecentEvents] = useState<AlertEvent[]>([]);
  const [queueSummary, setQueueSummary] = useState<QueueSummary>(EMPTY_QUEUE_SUMMARY);
  const [eventSummary, setEventSummary] = useState<AlertEventSummary>(EMPTY_EVENT_SUMMARY);
  const [alertPerformance, setAlertPerformance] = useState<Record<string, AlertPerformance>>({});
  const [performanceWindowDays, setPerformanceWindowDays] = useState(30);
  const [tier, setTier] = useState<Tier>('community');
  const [entitlements, setEntitlements] = useState<AlertEntitlements>({ maxAlerts: 1, frequencies: ['weekly'], weeklyDigest: false });
  const [usage, setUsage] = useState({ alerts: 0, activeAlerts: 0, remainingAlerts: 0 });
  const [showForm, setShowForm] = useState(false);
  const [saving, setSaving] = useState(false);
  const [scouting, setScouting] = useState(false);
  const [delivering, setDelivering] = useState(false);
  const [sendingDigest, setSendingDigest] = useState(false);
  const [startingUpgrade, setStartingUpgrade] = useState(false);
  const [feedback, setFeedback] = useState<ActionFeedback | null>(null);
  const [pendingOptimization, setPendingOptimization] = useState<{ id: string; action: AlertOptimizationAction } | null>(null);
  const [pendingToggleAlertId, setPendingToggleAlertId] = useState<string | null>(null);
  const [pendingDeleteAlertId, setPendingDeleteAlertId] = useState<string | null>(null);
  const [pendingTrackGrantId, setPendingTrackGrantId] = useState<string | null>(null);
  const [pendingNotificationAction, setPendingNotificationAction] = useState<{ id: string; action: 'retry' | 'cancel' } | null>(null);
  const [expandedAlert, setExpandedAlert] = useState<string | null>(null);
  const [alertMatches, setAlertMatches] = useState<Record<string, MatchingGrant[]>>({});
  const [matchLoading, setMatchLoading] = useState<string | null>(null);

  const [name, setName] = useState('');
  const [frequency, setFrequency] = useState('weekly');
  const [selectedCategories, setSelectedCategories] = useState<string[]>([]);
  const [selectedStates, setSelectedStates] = useState<string[]>([]);
  const [minAmount, setMinAmount] = useState('');
  const [maxAmount, setMaxAmount] = useState('');
  const [keywords, setKeywords] = useState('');

  const pipelineImpactSummary = Object.values(alertPerformance).reduce(
    (summary, performance) => {
      summary.tracked += performance.tracked;
      summary.active += performance.active;
      summary.submitted += performance.submitted;
      summary.won += performance.won;
      return summary;
    },
    { tracked: 0, active: 0, submitted: 0, won: 0 }
  );
  const showCommunityUpsell = tier === 'community';

  useEffect(() => {
    const supabase = createSupabaseBrowser();
    supabase.auth.getUser().then(({ data: { user: u } }) => {
      setUser(u);
      setLoading(false);
    });
  }, []);

  useEffect(() => {
    if (!feedback) return;
    const timeout = window.setTimeout(() => setFeedback(null), 4000);
    return () => window.clearTimeout(timeout);
  }, [feedback]);

  useEffect(() => {
    if (!user || !showCommunityUpsell) return;
    void trackProductEvent('upgrade_prompt_viewed', {
      source: 'alerts_page_upsell',
      metadata: {
        tier,
        max_alerts: entitlements.maxAlerts,
        weekly_digest: entitlements.weeklyDigest,
      },
      onceKey: 'alerts_page_upsell:viewed',
    });
  }, [user, showCommunityUpsell, tier, entitlements.maxAlerts, entitlements.weeklyDigest]);

  const fetchAlerts = useCallback(async () => {
    const res = await fetch('/api/alerts');
    const data = await res.json().catch(() => null);
    if (!res.ok) {
      setFeedback({
        tone: 'error',
        message: data?.error || 'Could not load alerts.',
      });
      return;
    }

    setAlerts(data?.alerts || []);
    setRecentActivity(data?.recentActivity || []);
    setAlertPerformance(data?.alertPerformance || {});
    setPerformanceWindowDays(Number(data?.performanceWindowDays || 30));
    setQueueSummary(data?.queueSummary || EMPTY_QUEUE_SUMMARY);
    setRecentEvents(data?.recentEvents || []);
    setEventSummary(data?.eventSummary || EMPTY_EVENT_SUMMARY);
    setTier(data?.tier || 'community');
    setEntitlements(data?.entitlements || { maxAlerts: 1, frequencies: ['weekly'], weeklyDigest: false });
    setUsage(data?.usage || { alerts: 0, activeAlerts: 0, remainingAlerts: 0 });
  }, []);

  useEffect(() => {
    if (user) {
      void fetchAlerts();
    }
  }, [user, fetchAlerts]);

  async function createAlert(e: React.FormEvent) {
    e.preventDefault();
    if (usage.alerts >= entitlements.maxAlerts) {
      setFeedback({ tone: 'error', message: 'You have reached your alert limit for this plan.' });
      return;
    }
    setSaving(true);

    try {
      const res = await fetch('/api/alerts', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: name || 'My Alert',
          frequency,
          categories: selectedCategories,
          states: selectedStates,
          min_amount: minAmount ? Number(minAmount) : null,
          max_amount: maxAmount ? Number(maxAmount) : null,
          keywords: keywords ? keywords.split(',').map(k => k.trim()).filter(Boolean) : [],
        }),
      });

      const data = await res.json().catch(() => null);
      if (!res.ok) {
        throw new Error(data?.error || 'Could not create alert.');
      }

      setShowForm(false);
      setName('');
      setFrequency('weekly');
      setSelectedCategories([]);
      setSelectedStates([]);
      setMinAmount('');
      setMaxAmount('');
      setKeywords('');
      setFeedback({ tone: 'success', message: 'Alert created.' });
      await fetchAlerts();
    } catch (error) {
      setFeedback({
        tone: 'error',
        message: error instanceof Error ? error.message : 'Could not create alert.',
      });
    } finally {
      setSaving(false);
    }
  }

  async function sendWeeklyDigest() {
    setSendingDigest(true);

    try {
      const res = await fetch('/api/alerts/digest', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ force: true }),
      });

      const data = await res.json().catch(() => null);
      if (!res.ok) {
        throw new Error(data?.error || 'Could not send weekly digest.');
      }

      setFeedback({
        tone: 'success',
        message: data?.digestsSent > 0
          ? `Sent ${data.digestsSent} weekly digest${data.digestsSent === 1 ? '' : 's'}.`
          : 'No weekly digest was due yet. Run the scout first if you expected new matches.',
      });
      await fetchAlerts();
    } catch (error) {
      setFeedback({
        tone: 'error',
        message: error instanceof Error ? error.message : 'Could not send weekly digest.',
      });
    } finally {
      setSendingDigest(false);
    }
  }

  async function toggleAlert(id: string, enabled: boolean) {
    setPendingToggleAlertId(id);

    try {
      const res = await fetch(`/api/alerts/${id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ enabled: !enabled }),
      });

      const data = await res.json().catch(() => null);
      if (!res.ok) {
        throw new Error(data?.error || 'Could not update alert.');
      }

      setFeedback({
        tone: 'success',
        message: enabled ? 'Alert paused.' : 'Alert enabled.',
      });
      await fetchAlerts();
    } catch (error) {
      setFeedback({
        tone: 'error',
        message: error instanceof Error ? error.message : 'Could not update alert.',
      });
    } finally {
      setPendingToggleAlertId(null);
    }
  }

  async function deleteAlert(id: string) {
    if (!confirm('Delete this alert?')) return;
    setPendingDeleteAlertId(id);

    try {
      const res = await fetch(`/api/alerts/${id}`, { method: 'DELETE' });
      const data = await res.json().catch(() => null);
      if (!res.ok) {
        throw new Error(data?.error || 'Could not delete alert.');
      }

      setFeedback({ tone: 'success', message: 'Alert deleted.' });
      if (expandedAlert === id) {
        setExpandedAlert(null);
      }
      await fetchAlerts();
    } catch (error) {
      setFeedback({
        tone: 'error',
        message: error instanceof Error ? error.message : 'Could not delete alert.',
      });
    } finally {
      setPendingDeleteAlertId(null);
    }
  }

  async function viewMatches(alertId: string) {
    if (expandedAlert === alertId) {
      setExpandedAlert(null);
      return;
    }

    setExpandedAlert(alertId);
    if (alertMatches[alertId]) return;

    setMatchLoading(alertId);
    try {
      const res = await fetch(`/api/alerts/matches?alertId=${alertId}`);
      const data = await res.json().catch(() => null);
      if (!res.ok) {
        throw new Error(data?.error || 'Could not load matches.');
      }
      setAlertMatches((prev) => ({ ...prev, [alertId]: data?.grants || [] }));
    } catch (error) {
      setFeedback({
        tone: 'error',
        message: error instanceof Error ? error.message : 'Could not load matches.',
      });
    } finally {
      setMatchLoading(null);
    }
  }

  async function trackGrant(grantId: string, options?: { alertId?: string | null; notificationId?: string | null }) {
    setPendingTrackGrantId(grantId);

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

      const data = await res.json().catch(() => null);
      if (!res.ok) {
        throw new Error(data?.error || 'Could not add grant to tracker.');
      }

      setFeedback({ tone: 'success', message: 'Grant added to your tracker.' });
    } catch (error) {
      setFeedback({
        tone: 'error',
        message: error instanceof Error ? error.message : 'Could not add grant to tracker.',
      });
    } finally {
      setPendingTrackGrantId(null);
    }
  }

  async function updateNotification(notificationId: string, action: 'retry' | 'cancel') {
    setPendingNotificationAction({ id: notificationId, action });

    try {
      const res = await fetch('/api/alerts/notifications', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ notificationId, action }),
      });

      const data = await res.json().catch(() => null);
      if (!res.ok) {
        throw new Error(data?.error || 'Could not update notification.');
      }

      setFeedback({
        tone: 'success',
        message: action === 'retry'
          ? 'Notification re-queued for delivery.'
          : 'Notification dismissed from the queue.',
      });
      await fetchAlerts();
    } catch (error) {
      setFeedback({
        tone: 'error',
        message: error instanceof Error ? error.message : 'Could not update notification.',
      });
    } finally {
      setPendingNotificationAction(null);
    }
  }

  async function deliverQueuedNow() {
    setDelivering(true);

    try {
      const res = await fetch('/api/alerts/deliver', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ limit: 25 }),
      });

      const data = await res.json().catch(() => null);
      if (!res.ok) {
        throw new Error(data?.error || 'Could not deliver queued notifications.');
      }

      const sent = Number(data?.sent || 0);
      const cancelled = Number(data?.cancelled || 0);
      setFeedback({
        tone: 'success',
        message: sent > 0
          ? `Delivered ${sent} queued notification${sent === 1 ? '' : 's'}.`
          : cancelled > 0
            ? `${cancelled} queued notification${cancelled === 1 ? '' : 's'} cancelled.`
            : 'No queued grant notifications were ready to send.',
      });
      await fetchAlerts();
    } catch (error) {
      setFeedback({
        tone: 'error',
        message: error instanceof Error ? error.message : 'Could not deliver queued notifications.',
      });
    } finally {
      setDelivering(false);
    }
  }

  async function runScoutNow() {
    setScouting(true);

    try {
      const res = await fetch('/api/alerts/scout', {
        method: 'POST',
      });

      const data = await res.json().catch(() => null);
      if (!res.ok) {
        throw new Error(data?.error || 'Could not run the grant scout.');
      }

      setFeedback({
        tone: 'success',
        message:
          `Scanned ${data?.profilesScanned || 0} profile${data?.profilesScanned === 1 ? '' : 's'}, `
          + `found ${data?.matchesFound || 0} match${data?.matchesFound === 1 ? '' : 'es'}, `
          + `added ${data?.grantsAdded || 0} grant${data?.grantsAdded === 1 ? '' : 's'} to the tracker, `
          + `and queued ${data?.notificationsQueued || 0} notification${data?.notificationsQueued === 1 ? '' : 's'}.`,
      });
      await fetchAlerts();
    } catch (error) {
      setFeedback({
        tone: 'error',
        message: error instanceof Error ? error.message : 'Could not run the grant scout.',
      });
    } finally {
      setScouting(false);
    }
  }

  async function applyOptimization(alert: Alert, performance: AlertPerformance, action: AlertOptimizationAction) {
    setPendingOptimization({ id: alert.id, action });

    try {
      if (action === 'pause') {
        const res = await fetch(`/api/alerts/${alert.id}`, {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            enabled: false,
            optimization_event: {
              action,
              recommendation_title: performance.recommendation.title,
              previous_frequency: alert.frequency,
              next_frequency: null,
            },
          }),
        });
        const data = await res.json().catch(() => null);
        if (!res.ok) {
          throw new Error(data?.error || 'Could not pause alert.');
        }
        setFeedback({ tone: 'success', message: 'Alert paused.' });
      }

      if (action === 'slow_down') {
        const frequency = nextLowerFrequency(alert.frequency);
        if (!frequency) {
          throw new Error('This alert is already at the slowest frequency.');
        }
        const res = await fetch(`/api/alerts/${alert.id}`, {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            frequency,
            optimization_event: {
              action,
              recommendation_title: performance.recommendation.title,
              previous_frequency: alert.frequency,
              next_frequency: frequency,
            },
          }),
        });
        const data = await res.json().catch(() => null);
        if (!res.ok) {
          throw new Error(data?.error || 'Could not update alert frequency.');
        }
        setFeedback({ tone: 'success', message: `Alert frequency changed to ${frequency}.` });
      }

      if (action === 'clone_tighter') {
        if (usage.alerts >= entitlements.maxAlerts) {
          throw new Error('You have reached your alert limit for this plan.');
        }

        const res = await fetch('/api/alerts', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            ...buildTighterVariantPayload(alert),
            optimization_source_alert_id: Number(alert.id),
            optimization_action: action,
            optimization_recommendation_title: performance.recommendation.title,
          }),
        });
        const data = await res.json().catch(() => null);
        if (!res.ok) {
          throw new Error(data?.error || 'Could not clone alert.');
        }
        setFeedback({
          tone: 'success',
          message:
            performance.recommendation.key === 'keep_expand'
              ? 'Created a high-fit variant from this winning alert.'
              : 'Created a tighter alert variant for higher-fit matches.',
        });
      }

      await fetchAlerts();
    } catch (error) {
      setFeedback({
        tone: 'error',
        message: error instanceof Error ? error.message : 'Could not apply alert optimization.',
      });
    } finally {
      setPendingOptimization(null);
    }
  }

  async function upgradeToProfessional() {
    setStartingUpgrade(true);
    const result = await startCheckoutForTier('professional', 'alerts_page_upsell');
    if (!result.ok) {
      setFeedback({ tone: 'error', message: result.error });
      setStartingUpgrade(false);
    }
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[40vh]">
        <div className="text-sm font-black text-bauhaus-muted uppercase tracking-widest">Loading...</div>
      </div>
    );
  }

  if (!user) {
    return (
      <div className="min-h-screen bg-white flex items-center justify-center">
        <div className="border-4 border-bauhaus-black p-12 text-center max-w-md">
          <h1 className="text-3xl font-black uppercase tracking-widest mb-4">Sign In Required</h1>
          <p className="text-bauhaus-muted mb-6">Create grant alerts and manage your delivery queue from one place.</p>
          <Link href="/login?next=/alerts" className="inline-block bg-bauhaus-black text-white px-8 py-3 font-bold uppercase tracking-wider hover:bg-bauhaus-red transition-colors">
            Sign In
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="max-w-5xl">
      <div className="flex items-start justify-between gap-4 flex-wrap mb-8">
        <div>
          <h1 className="text-4xl font-black uppercase tracking-widest">Grant Alerts</h1>
          <p className="text-bauhaus-muted mt-1">
            Build alerts, inspect the delivery queue, and send queued notifications without leaving the workspace.
          </p>
          <div className="mt-3 flex flex-wrap gap-2 text-[10px] font-black uppercase tracking-widest">
            <span className="px-2 py-1 border border-bauhaus-black text-bauhaus-black">{tier} plan</span>
            <span className="px-2 py-1 border border-bauhaus-black/20 text-bauhaus-muted">
              {usage.alerts}/{entitlements.maxAlerts} alerts used
            </span>
            <span className="px-2 py-1 border border-bauhaus-black/20 text-bauhaus-muted">
              {entitlements.frequencies.join(' / ')} frequencies
            </span>
            <span className={`px-2 py-1 border ${entitlements.weeklyDigest ? 'border-green-600 text-green-700' : 'border-bauhaus-black/20 text-bauhaus-muted'}`}>
              {entitlements.weeklyDigest ? 'Weekly digest included' : 'Weekly digest locked'}
            </span>
          </div>
        </div>
        <div className="flex gap-2 flex-wrap">
          <button
            type="button"
            onClick={() => void runScoutNow()}
            disabled={scouting}
            className="bg-bauhaus-red text-white px-5 py-3 font-bold uppercase tracking-wider hover:bg-red-700 transition-colors disabled:opacity-50"
          >
            {scouting ? 'Scouting...' : 'Run Scout Now'}
          </button>
          <button
            type="button"
            onClick={() => void deliverQueuedNow()}
            disabled={delivering || queueSummary.queued === 0}
            className="bg-bauhaus-blue text-white px-5 py-3 font-bold uppercase tracking-wider hover:bg-blue-700 transition-colors disabled:opacity-50"
          >
            {delivering ? 'Delivering...' : 'Deliver Queued Now'}
          </button>
          <button
            type="button"
            onClick={() => void sendWeeklyDigest()}
            disabled={sendingDigest || !entitlements.weeklyDigest}
            className="border-2 border-bauhaus-black px-5 py-3 font-bold uppercase tracking-wider hover:bg-gray-100 transition-colors disabled:opacity-50"
          >
            {sendingDigest ? 'Sending...' : 'Send Weekly Digest'}
          </button>
          <button
            type="button"
            onClick={() => setShowForm(!showForm)}
            disabled={!showForm && usage.alerts >= entitlements.maxAlerts}
            className="bg-bauhaus-black text-white px-6 py-3 font-bold uppercase tracking-wider hover:bg-bauhaus-red transition-colors disabled:opacity-50"
          >
            {showForm ? 'Cancel' : '+ New Alert'}
          </button>
        </div>
      </div>

      {!entitlements.weeklyDigest && (
        <div className="mb-6 border-2 border-bauhaus-black bg-bauhaus-yellow/10 px-4 py-3">
          <p className="text-sm font-bold text-bauhaus-black">
            Weekly grant digests unlock on Professional and above.
          </p>
          <div className="mt-2 flex gap-3 flex-wrap items-center">
            <button
              type="button"
              onClick={() => void upgradeToProfessional()}
              disabled={startingUpgrade}
              className="text-xs font-black uppercase tracking-widest text-bauhaus-blue hover:underline disabled:opacity-50"
            >
              {startingUpgrade ? 'Starting checkout…' : 'Upgrade to Professional'}
            </button>
            <Link href="/pricing" className="text-xs font-black uppercase tracking-widest text-bauhaus-blue hover:underline">
              Compare plans &rarr;
            </Link>
          </div>
        </div>
      )}

      {showCommunityUpsell && (
        <section className="mb-8 border-4 border-bauhaus-black bg-bauhaus-blue text-white p-6">
          <div className="flex items-start justify-between gap-4 flex-wrap">
            <div className="max-w-2xl">
              <div className="text-[10px] font-black uppercase tracking-[0.3em] text-white/70">Professional Alerting</div>
              <h2 className="mt-2 text-2xl font-black uppercase tracking-wider">Turn Alerts Into A Real Monitoring Product</h2>
              <p className="mt-3 text-sm text-white/80 leading-relaxed">
                Community gives you one weekly alert. Professional unlocks daily alerting, up to 10 saved alerts,
                weekly digest delivery, and a stronger prospecting loop for teams that need funding work to stay live.
              </p>
              <div className="mt-4 flex flex-wrap gap-2 text-[10px] font-black uppercase tracking-widest">
                <span className="border border-white/30 px-2 py-1">10 alerts</span>
                <span className="border border-white/30 px-2 py-1">Daily / Weekly / Monthly</span>
                <span className="border border-white/30 px-2 py-1">Weekly digest</span>
                <span className="border border-white/30 px-2 py-1">Advanced watchlists</span>
              </div>
            </div>
            <div className="flex gap-3 shrink-0">
              <button
                type="button"
                onClick={() => void upgradeToProfessional()}
                disabled={startingUpgrade}
                className="bg-white px-5 py-3 font-black uppercase tracking-wider text-bauhaus-blue transition-colors hover:bg-bauhaus-yellow disabled:opacity-50"
              >
                {startingUpgrade ? 'Starting…' : 'Upgrade Now'}
              </button>
              <Link
                href="/pricing"
                className="border-2 border-white px-5 py-3 font-black uppercase tracking-wider text-white transition-colors hover:bg-white hover:text-bauhaus-blue"
              >
                View Plans
              </Link>
            </div>
          </div>
        </section>
      )}

      {feedback && (
        <div
          className={`mb-6 border-2 px-4 py-3 text-sm font-bold rounded ${
            feedback.tone === 'error'
              ? 'border-red-500 bg-red-50 text-red-700'
              : 'border-green-600 bg-green-50 text-green-700'
          }`}
          role={feedback.tone === 'error' ? 'alert' : 'status'}
        >
          {feedback.message}
        </div>
      )}

      <div className="grid grid-cols-2 md:grid-cols-4 gap-0 mb-8 border-4 border-bauhaus-black">
        <div className="p-4 border-r-2 border-bauhaus-black/10 border-b-2 md:border-b-0 border-bauhaus-black/10">
          <div className="text-[10px] font-black text-bauhaus-muted uppercase tracking-widest mb-1">Active Alerts</div>
          <div className="text-2xl font-black text-bauhaus-black">{alerts.filter((alert) => alert.enabled).length}</div>
        </div>
        <div className="p-4 md:border-r-2 border-bauhaus-black/10 border-b-2 md:border-b-0 border-bauhaus-black/10">
          <div className="text-[10px] font-black text-bauhaus-muted uppercase tracking-widest mb-1">Queued</div>
          <div className="text-2xl font-black text-bauhaus-blue">{queueSummary.queued}</div>
        </div>
        <div className="p-4 border-r-2 border-bauhaus-black/10">
          <div className="text-[10px] font-black text-bauhaus-muted uppercase tracking-widest mb-1">Failed</div>
          <div className="text-2xl font-black text-bauhaus-red">{queueSummary.failed}</div>
        </div>
        <div className="p-4">
          <div className="text-[10px] font-black text-bauhaus-muted uppercase tracking-widest mb-1">Delivered</div>
          <div className="text-2xl font-black text-bauhaus-black">{queueSummary.sent}</div>
        </div>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-6 gap-0 mb-8 border-4 border-bauhaus-black">
        <div className="p-4 border-r-2 border-bauhaus-black/10 border-b-2 md:border-b-0 border-bauhaus-black/10">
          <div className="text-[10px] font-black text-bauhaus-muted uppercase tracking-widest mb-1">Queued This Week</div>
          <div className="text-2xl font-black text-bauhaus-blue">{eventSummary.notificationsQueued}</div>
        </div>
        <div className="p-4 border-r-2 border-bauhaus-black/10 border-b-2 md:border-b-0 border-bauhaus-black/10">
          <div className="text-[10px] font-black text-bauhaus-muted uppercase tracking-widest mb-1">Sent This Week</div>
          <div className="text-2xl font-black text-bauhaus-black">{eventSummary.notificationsSent}</div>
        </div>
        <div className="p-4 border-r-2 border-bauhaus-black/10 border-b-2 md:border-b-0 border-bauhaus-black/10">
          <div className="text-[10px] font-black text-bauhaus-muted uppercase tracking-widest mb-1">Failed This Week</div>
          <div className="text-2xl font-black text-bauhaus-red">{eventSummary.notificationsFailed}</div>
        </div>
        <div className="p-4 border-r-2 border-bauhaus-black/10">
          <div className="text-[10px] font-black text-bauhaus-muted uppercase tracking-widest mb-1">Digests Sent</div>
          <div className="text-2xl font-black text-bauhaus-black">{eventSummary.digestsSent}</div>
        </div>
        <div className="p-4 border-r-2 border-bauhaus-black/10">
          <div className="text-[10px] font-black text-bauhaus-muted uppercase tracking-widest mb-1">Email Opens</div>
          <div className="text-2xl font-black text-bauhaus-black">{eventSummary.emailOpens}</div>
        </div>
        <div className="p-4">
          <div className="text-[10px] font-black text-bauhaus-muted uppercase tracking-widest mb-1">Grant Clicks</div>
          <div className="text-2xl font-black text-bauhaus-blue">{eventSummary.grantClicks}</div>
        </div>
        <div className="p-4 col-span-1 md:col-span-3 border-t-2 border-bauhaus-black/10">
          <div className="text-[10px] font-black text-bauhaus-muted uppercase tracking-widest mb-1">Scout Runs</div>
          <div className="text-2xl font-black text-bauhaus-black">{eventSummary.scoutRuns}</div>
        </div>
        <div className="p-4 col-span-1 md:col-span-3 border-t-2 md:border-l-2 border-bauhaus-black/10">
          <div className="text-[10px] font-black text-bauhaus-muted uppercase tracking-widest mb-1">Optimizations</div>
          <div className="text-2xl font-black text-bauhaus-black">{eventSummary.optimizationsApplied}</div>
        </div>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-4 gap-0 mb-8 border-4 border-bauhaus-black">
        <div className="p-4 border-r-2 border-b-2 md:border-b-0 border-bauhaus-black/10">
          <div className="text-[10px] font-black text-bauhaus-muted uppercase tracking-widest mb-1">Tracked From Alerts</div>
          <div className="text-2xl font-black text-bauhaus-black">{pipelineImpactSummary.tracked}</div>
        </div>
        <div className="p-4 md:border-r-2 border-b-2 md:border-b-0 border-bauhaus-black/10">
          <div className="text-[10px] font-black text-bauhaus-muted uppercase tracking-widest mb-1">Active Pipeline</div>
          <div className="text-2xl font-black text-bauhaus-blue">{pipelineImpactSummary.active}</div>
        </div>
        <div className="p-4 border-r-2 border-bauhaus-black/10">
          <div className="text-[10px] font-black text-bauhaus-muted uppercase tracking-widest mb-1">Submitted</div>
          <div className="text-2xl font-black text-amber-700">{pipelineImpactSummary.submitted}</div>
        </div>
        <div className="p-4">
          <div className="text-[10px] font-black text-bauhaus-muted uppercase tracking-widest mb-1">Won</div>
          <div className="text-2xl font-black text-green-700">{pipelineImpactSummary.won}</div>
        </div>
      </div>

      <section className="border-4 border-bauhaus-black p-6 mb-8">
        <div className="flex items-start justify-between gap-4 flex-wrap">
          <div>
            <div className="text-[10px] font-black uppercase tracking-[0.3em] text-bauhaus-blue">Delivery Queue</div>
            <h2 className="text-xl font-black uppercase tracking-wider mt-2">Recent Alert Activity</h2>
            <p className="text-sm text-bauhaus-muted mt-2 max-w-2xl">
              See what has been queued, sent, or failed, then retry or dismiss specific items before the next automated delivery pass.
            </p>
          </div>
          <Link
            href="/home/watchlist"
            className="text-xs font-black uppercase tracking-widest text-bauhaus-muted hover:text-bauhaus-black transition-colors"
          >
            Open Watchlist &rarr;
          </Link>
        </div>

        {recentActivity.length === 0 ? (
          <div className="border-2 border-dashed border-bauhaus-black/20 p-6 mt-6">
            <p className="text-lg font-black uppercase tracking-widest text-gray-400 mb-2">No Queue Activity Yet</p>
            <p className="text-bauhaus-muted">
              Your alerts are ready. Once the scout queues grant matches, they will appear here with delivery status and actions.
            </p>
          </div>
        ) : (
          <div className="space-y-3 mt-6">
            {recentActivity.map((activity) => (
              <AlertActivityRow
                key={activity.id}
                activity={activity}
                onRetry={
                  activity.status === 'failed' || activity.status === 'cancelled'
                    ? () => void updateNotification(activity.id, 'retry')
                    : undefined
                }
                onDismiss={
                  activity.status === 'queued' || activity.status === 'failed'
                    ? () => void updateNotification(activity.id, 'cancel')
                    : undefined
                }
                retrying={pendingNotificationAction?.id === activity.id && pendingNotificationAction.action === 'retry'}
                dismissing={pendingNotificationAction?.id === activity.id && pendingNotificationAction.action === 'cancel'}
              />
            ))}
          </div>
        )}
      </section>

      {recentEvents.length > 0 && (
        <section className="border-4 border-bauhaus-black p-6 mb-8">
          <div className="text-[10px] font-black uppercase tracking-[0.3em] text-bauhaus-blue">System Events</div>
          <h2 className="text-xl font-black uppercase tracking-wider mt-2">Recent Alert Operations</h2>
          <div className="mt-4 space-y-2">
            {recentEvents.slice(0, 8).map((event) => (
              <div key={event.id} className="border-2 border-gray-200 px-3 py-2 flex items-center justify-between gap-4">
                <div>
                  <div className="text-[10px] font-black uppercase tracking-widest text-bauhaus-muted">
                    {event.event_type.replace(/_/g, ' ')}
                  </div>
                  <div className="text-sm text-bauhaus-black">
                    {renderEventDetail(event)}
                  </div>
                </div>
                <div className="text-xs text-bauhaus-muted">{timeAgo(event.created_at)}</div>
              </div>
            ))}
          </div>
        </section>
      )}

      {showForm && (
        <form onSubmit={createAlert} className="border-4 border-bauhaus-black p-6 mb-8">
          <h2 className="text-xl font-black uppercase tracking-wider mb-4">New Alert</h2>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-4">
            <div>
              <label className="block text-xs font-bold uppercase tracking-wider mb-1">Name</label>
              <input
                type="text"
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="e.g. Indigenous Health Grants"
                className="w-full border-2 border-bauhaus-black px-3 py-2"
              />
            </div>
            <div>
              <label className="block text-xs font-bold uppercase tracking-wider mb-1">Frequency</label>
              <select
                value={frequency}
                onChange={(e) => setFrequency(e.target.value)}
                className="w-full border-2 border-bauhaus-black px-3 py-2"
              >
                {FREQUENCIES.filter((item) => entitlements.frequencies.includes(item as AlertFrequency)).map((item) => (
                  <option key={item} value={item}>{item.charAt(0).toUpperCase() + item.slice(1)}</option>
                ))}
              </select>
            </div>
          </div>

          <div className="mb-4">
            <label className="block text-xs font-bold uppercase tracking-wider mb-1">Categories</label>
            <div className="flex flex-wrap gap-2">
              {CATEGORIES.map((category) => (
                <button
                  key={category}
                  type="button"
                  onClick={() => setSelectedCategories((prev) =>
                    prev.includes(category) ? prev.filter((value) => value !== category) : [...prev, category]
                  )}
                  className={`px-3 py-1 border-2 text-sm font-bold uppercase tracking-wider transition-colors ${
                    selectedCategories.includes(category)
                      ? 'border-bauhaus-red bg-bauhaus-red text-white'
                      : 'border-bauhaus-black hover:bg-gray-100'
                  }`}
                >
                  {category}
                </button>
              ))}
            </div>
          </div>

          <div className="mb-4">
            <label className="block text-xs font-bold uppercase tracking-wider mb-1">States</label>
            <div className="flex flex-wrap gap-2">
              {STATES.map((state) => (
                <button
                  key={state}
                  type="button"
                  onClick={() => setSelectedStates((prev) =>
                    prev.includes(state) ? prev.filter((value) => value !== state) : [...prev, state]
                  )}
                  className={`px-3 py-1 border-2 text-sm font-bold uppercase tracking-wider transition-colors ${
                    selectedStates.includes(state)
                      ? 'border-bauhaus-blue bg-bauhaus-blue text-white'
                      : 'border-bauhaus-black hover:bg-gray-100'
                  }`}
                >
                  {state}
                </button>
              ))}
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-4">
            <div>
              <label className="block text-xs font-bold uppercase tracking-wider mb-1">Min Amount</label>
              <input
                type="number"
                value={minAmount}
                onChange={(e) => setMinAmount(e.target.value)}
                placeholder="$0"
                className="w-full border-2 border-bauhaus-black px-3 py-2"
              />
            </div>
            <div>
              <label className="block text-xs font-bold uppercase tracking-wider mb-1">Max Amount</label>
              <input
                type="number"
                value={maxAmount}
                onChange={(e) => setMaxAmount(e.target.value)}
                placeholder="No limit"
                className="w-full border-2 border-bauhaus-black px-3 py-2"
              />
            </div>
            <div>
              <label className="block text-xs font-bold uppercase tracking-wider mb-1">Keywords</label>
              <input
                type="text"
                value={keywords}
                onChange={(e) => setKeywords(e.target.value)}
                placeholder="housing, climate, youth"
                className="w-full border-2 border-bauhaus-black px-3 py-2"
              />
            </div>
          </div>

          <button
            type="submit"
            disabled={saving}
            className="bg-bauhaus-red text-white px-6 py-3 font-bold uppercase tracking-wider hover:bg-red-700 transition-colors disabled:opacity-50"
          >
            {saving ? 'Creating...' : 'Create Alert'}
          </button>
        </form>
      )}

      {alerts.length === 0 ? (
        <div className="border-2 border-dashed border-bauhaus-black/20 p-8 text-center">
          <p className="text-2xl font-black uppercase tracking-widest text-gray-400 mb-2">No Alerts Yet</p>
          <p className="text-bauhaus-muted">Create your first alert to start receiving grant notifications.</p>
        </div>
      ) : (
        <div className="space-y-4">
          {alerts.map((alert) => (
            <div key={alert.id} className="border-2 border-bauhaus-black p-4">
              {(() => {
                const performance = alertPerformance[alert.id];
                const optimizationActions = performance
                  ? getOptimizationActions(alert, performance, usage.alerts < entitlements.maxAlerts)
                  : [];
                return (
              <div className="flex items-start justify-between gap-4 flex-wrap">
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-3 mb-2 flex-wrap">
                    <h3 className="text-lg font-black uppercase tracking-wider">{alert.name}</h3>
                    <span className={`px-2 py-0.5 text-xs font-bold uppercase ${
                      alert.enabled ? 'bg-green-100 text-green-800' : 'bg-gray-100 text-gray-500'
                    }`}>
                      {alert.enabled ? 'Active' : 'Paused'}
                    </span>
                    <span className="px-2 py-0.5 text-xs font-bold uppercase bg-bauhaus-blue text-white">
                      {alert.frequency}
                    </span>
                  </div>

                  <div className="flex flex-wrap gap-1 mb-2">
                    {alert.categories?.map((category) => (
                      <span key={category} className="px-2 py-0.5 text-xs border border-bauhaus-black">{category}</span>
                    ))}
                    {alert.states?.map((state) => (
                      <span key={state} className="px-2 py-0.5 text-xs border border-bauhaus-blue text-bauhaus-blue">{state}</span>
                    ))}
                    {alert.keywords?.map((keyword) => (
                      <span key={keyword} className="px-2 py-0.5 text-xs bg-gray-100">{keyword}</span>
                    ))}
                  </div>

                  {(alert.min_amount || alert.max_amount) && (
                    <p className="text-sm text-bauhaus-muted">
                      Amount: {alert.min_amount ? formatMoney(alert.min_amount) : '$0'}
                      {' — '}
                      {alert.max_amount ? formatMoney(alert.max_amount) : 'No limit'}
                    </p>
                  )}

                  <div className="mt-3 border-t-2 border-bauhaus-black/10 pt-3">
                    <div className="text-[10px] font-black uppercase tracking-[0.3em] text-bauhaus-muted">
                      Last {performanceWindowDays} Days
                    </div>
                    {performance ? (
                      <>
                        <div className="mt-2 flex flex-wrap gap-2">
                          <span className="px-2 py-1 text-[10px] font-black uppercase tracking-widest border border-bauhaus-blue/20 text-bauhaus-blue">
                            {performance.sent} sent
                          </span>
                          <span className="px-2 py-1 text-[10px] font-black uppercase tracking-widest border border-bauhaus-black/20 text-bauhaus-black">
                            {performance.opens} opens
                          </span>
                          <span className="px-2 py-1 text-[10px] font-black uppercase tracking-widest border border-bauhaus-black/20 text-bauhaus-black">
                            {performance.clicks} clicks
                          </span>
                          <span className="px-2 py-1 text-[10px] font-black uppercase tracking-widest border border-bauhaus-black/20 text-bauhaus-muted">
                            {performance.digestsSent} digests
                          </span>
                          {performance.failed > 0 ? (
                            <span className="px-2 py-1 text-[10px] font-black uppercase tracking-widest border border-red-200 text-red-600">
                              {performance.failed} failed
                            </span>
                          ) : null}
                        </div>
                        <div className="mt-2 flex flex-wrap gap-4 text-xs text-bauhaus-muted">
                          <span>
                            Open rate: <span className="font-black text-bauhaus-black">{performance.openRate != null ? `${performance.openRate}%` : '—'}</span>
                          </span>
                          <span>
                            Click rate: <span className="font-black text-bauhaus-black">{performance.clickRate != null ? `${performance.clickRate}%` : '—'}</span>
                          </span>
                          <span>
                            Track rate: <span className="font-black text-bauhaus-black">{performance.trackRate != null ? `${performance.trackRate}%` : '—'}</span>
                          </span>
                          <span>
                            Click→track: <span className="font-black text-bauhaus-black">{performance.clickToTrackRate != null ? `${performance.clickToTrackRate}%` : '—'}</span>
                          </span>
                          <span>
                            Submit rate: <span className="font-black text-bauhaus-black">{performance.submissionRate != null ? `${performance.submissionRate}%` : '—'}</span>
                          </span>
                          <span>
                            Win rate: <span className="font-black text-bauhaus-black">{performance.winRate != null ? `${performance.winRate}%` : '—'}</span>
                          </span>
                          {performance.lastEventAt ? (
                            <span>
                              Last activity: <span className="font-black text-bauhaus-black">{timeAgo(performance.lastEventAt)}</span>
                            </span>
                          ) : null}
                        </div>
                        <div className="mt-3 border-t border-bauhaus-black/10 pt-3">
                          <div className="text-[10px] font-black uppercase tracking-[0.3em] text-bauhaus-muted">
                            Pipeline Impact
                          </div>
                          <div className="mt-2 flex flex-wrap gap-2">
                            <span className="px-2 py-1 text-[10px] font-black uppercase tracking-widest border border-bauhaus-black/20 text-bauhaus-black">
                              {performance.tracked} tracked
                            </span>
                            <span className="px-2 py-1 text-[10px] font-black uppercase tracking-widest border border-bauhaus-blue/20 text-bauhaus-blue">
                              {performance.active} active
                            </span>
                            <span className="px-2 py-1 text-[10px] font-black uppercase tracking-widest border border-amber-300 text-amber-700">
                              {performance.submitted} submitted
                            </span>
                            <span className="px-2 py-1 text-[10px] font-black uppercase tracking-widest border border-green-300 text-green-700">
                              {performance.won} won
                            </span>
                          </div>
                          {performance.lastTrackedAt ? (
                            <div className="mt-2 text-xs text-bauhaus-muted">
                              Last tracked grant:{' '}
                              <span className="font-black text-bauhaus-black">{timeAgo(performance.lastTrackedAt)}</span>
                            </div>
                          ) : null}
                          {performance.lastOptimizedAt ? (
                            <div className="mt-2 text-xs text-bauhaus-muted">
                              Last optimized:{' '}
                              <span className="font-black text-bauhaus-black">
                                {timeAgo(performance.lastOptimizedAt)}
                              </span>
                              {performance.lastOptimizationAction ? (
                                <>
                                  {' '}via{' '}
                                  <span className="font-black text-bauhaus-black">
                                    {formatOptimizationAction(performance.lastOptimizationAction)}
                                  </span>
                                </>
                              ) : null}
                            </div>
                          ) : null}
                          {performance.lastOptimizedAt ? (
                            <div className="mt-2 flex flex-wrap gap-2">
                              <span className="px-2 py-1 text-[10px] font-black uppercase tracking-widest border border-bauhaus-black/20 text-bauhaus-black">
                                {performance.sentAfterOptimization} sent since
                              </span>
                              <span className="px-2 py-1 text-[10px] font-black uppercase tracking-widest border border-bauhaus-blue/20 text-bauhaus-blue">
                                {performance.clicksAfterOptimization} clicks since
                              </span>
                              <span className="px-2 py-1 text-[10px] font-black uppercase tracking-widest border border-green-300 text-green-700">
                                {performance.trackedAfterOptimization} tracked since
                              </span>
                            </div>
                          ) : null}
                          {performance.optimizationComparison ? (
                            <div className="mt-3 border-t border-bauhaus-black/10 pt-3">
                              <div className="text-[10px] font-black uppercase tracking-[0.3em] text-bauhaus-muted">
                                Before vs After
                              </div>
                              {performance.optimizationComparison.hasComparisonData ? (
                                <>
                                  {!performance.optimizationComparison.enoughComparisonData ? (
                                    <p className="mt-2 text-xs text-bauhaus-muted">
                                      Optimization was logged, but there is not enough send volume on both sides yet for a strong comparison.
                                    </p>
                                  ) : null}
                                  <div className="mt-2 grid grid-cols-1 md:grid-cols-3 gap-2 text-xs">
                                    <div className="border border-bauhaus-black/10 p-3">
                                      <div className="text-[10px] font-black uppercase tracking-widest text-bauhaus-muted">Open Rate</div>
                                      <div className="mt-1 font-black text-bauhaus-black">
                                        {performance.optimizationComparison.before.openRate != null ? `${performance.optimizationComparison.before.openRate}%` : '—'}
                                        {' → '}
                                        {performance.optimizationComparison.after.openRate != null ? `${performance.optimizationComparison.after.openRate}%` : '—'}
                                      </div>
                                      <div className={`mt-1 text-[10px] font-black uppercase tracking-widest ${
                                        (performance.optimizationComparison.delta.openRate ?? 0) > 0
                                          ? 'text-green-700'
                                          : (performance.optimizationComparison.delta.openRate ?? 0) < 0
                                            ? 'text-red-600'
                                            : 'text-bauhaus-muted'
                                      }`}>
                                        {formatDelta(performance.optimizationComparison.delta.openRate)}
                                      </div>
                                    </div>
                                    <div className="border border-bauhaus-black/10 p-3">
                                      <div className="text-[10px] font-black uppercase tracking-widest text-bauhaus-muted">Click Rate</div>
                                      <div className="mt-1 font-black text-bauhaus-black">
                                        {performance.optimizationComparison.before.clickRate != null ? `${performance.optimizationComparison.before.clickRate}%` : '—'}
                                        {' → '}
                                        {performance.optimizationComparison.after.clickRate != null ? `${performance.optimizationComparison.after.clickRate}%` : '—'}
                                      </div>
                                      <div className={`mt-1 text-[10px] font-black uppercase tracking-widest ${
                                        (performance.optimizationComparison.delta.clickRate ?? 0) > 0
                                          ? 'text-green-700'
                                          : (performance.optimizationComparison.delta.clickRate ?? 0) < 0
                                            ? 'text-red-600'
                                            : 'text-bauhaus-muted'
                                      }`}>
                                        {formatDelta(performance.optimizationComparison.delta.clickRate)}
                                      </div>
                                    </div>
                                    <div className="border border-bauhaus-black/10 p-3">
                                      <div className="text-[10px] font-black uppercase tracking-widest text-bauhaus-muted">Track Rate</div>
                                      <div className="mt-1 font-black text-bauhaus-black">
                                        {performance.optimizationComparison.before.trackRate != null ? `${performance.optimizationComparison.before.trackRate}%` : '—'}
                                        {' → '}
                                        {performance.optimizationComparison.after.trackRate != null ? `${performance.optimizationComparison.after.trackRate}%` : '—'}
                                      </div>
                                      <div className={`mt-1 text-[10px] font-black uppercase tracking-widest ${
                                        (performance.optimizationComparison.delta.trackRate ?? 0) > 0
                                          ? 'text-green-700'
                                          : (performance.optimizationComparison.delta.trackRate ?? 0) < 0
                                            ? 'text-red-600'
                                            : 'text-bauhaus-muted'
                                      }`}>
                                        {formatDelta(performance.optimizationComparison.delta.trackRate)}
                                      </div>
                                    </div>
                                  </div>
                                </>
                              ) : (
                                <p className="mt-2 text-xs text-bauhaus-muted">
                                  No post-optimization delivery or tracking activity yet.
                                </p>
                              )}
                            </div>
                          ) : null}
                          <div className="mt-3 border-t border-bauhaus-black/10 pt-3">
                            <div className="text-[10px] font-black uppercase tracking-[0.3em] text-bauhaus-muted">
                              Recommendation
                            </div>
                            <div className="mt-2 flex items-start gap-3 flex-wrap">
                              <span
                                className={`px-2 py-1 text-[10px] font-black uppercase tracking-widest border ${
                                  performance.recommendation.tone === 'success'
                                    ? 'border-green-300 text-green-700'
                                    : performance.recommendation.tone === 'info'
                                      ? 'border-bauhaus-blue/20 text-bauhaus-blue'
                                      : performance.recommendation.tone === 'warning'
                                        ? 'border-amber-300 text-amber-700'
                                        : 'border-bauhaus-black/20 text-bauhaus-muted'
                                }`}
                              >
                                {performance.recommendation.title}
                              </span>
                              <p className="text-xs text-bauhaus-muted max-w-2xl">
                                {performance.recommendation.detail}
                              </p>
                            </div>
                            {optimizationActions.length > 0 ? (
                              <div className="mt-3 flex flex-wrap gap-2">
                                {optimizationActions.map((item) => (
                                  <button
                                    key={item.action}
                                    type="button"
                                    onClick={() => void applyOptimization(alert, performance, item.action)}
                                    disabled={pendingOptimization?.id === alert.id}
                                    className="px-3 py-1 text-[10px] font-black uppercase tracking-wider border-2 border-bauhaus-black text-bauhaus-black hover:bg-gray-100 transition-colors disabled:opacity-50"
                                  >
                                    {pendingOptimization?.id === alert.id && pendingOptimization.action === item.action
                                      ? 'Applying...'
                                      : item.label}
                                  </button>
                                ))}
                              </div>
                            ) : null}
                          </div>
                        </div>
                      </>
                    ) : (
                      <p className="mt-2 text-xs text-bauhaus-muted">
                        No recent delivery or engagement yet for this alert.
                      </p>
                    )}
                    {showCommunityUpsell && performance.recommendation.key !== 'keep_expand' ? (
                      <div className="mt-4 border-t-2 border-bauhaus-black/10 pt-3">
                        <p className="text-xs text-bauhaus-muted">
                          Need more signal? Professional unlocks more alerts, daily frequency, and weekly digest delivery.
                        </p>
                        <div className="mt-2 flex gap-3 flex-wrap">
                          <button
                            type="button"
                            onClick={() => void upgradeToProfessional()}
                            disabled={startingUpgrade}
                            className="text-[11px] font-black uppercase tracking-widest text-bauhaus-blue hover:underline disabled:opacity-50"
                          >
                            {startingUpgrade ? 'Starting checkout…' : 'Upgrade'}
                          </button>
                          <Link href="/pricing" className="text-[11px] font-black uppercase tracking-widest text-bauhaus-muted hover:text-bauhaus-black">
                            Compare plans
                          </Link>
                        </div>
                      </div>
                    ) : null}
                  </div>
                </div>

                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={() => void viewMatches(alert.id)}
                    className={`px-3 py-1 text-xs font-bold uppercase tracking-wider border-2 transition-colors ${
                      expandedAlert === alert.id
                        ? 'border-bauhaus-blue bg-bauhaus-blue text-white'
                        : 'border-bauhaus-blue text-bauhaus-blue hover:bg-blue-50'
                    }`}
                  >
                    {expandedAlert === alert.id ? 'Hide' : 'View Matches'}
                  </button>
                  <button
                    type="button"
                    onClick={() => void toggleAlert(alert.id, alert.enabled)}
                    disabled={pendingToggleAlertId === alert.id}
                    className={`px-3 py-1 text-xs font-bold uppercase tracking-wider border-2 transition-colors disabled:opacity-50 ${
                      alert.enabled
                        ? 'border-gray-400 text-gray-600 hover:bg-gray-100'
                        : 'border-green-600 text-green-600 hover:bg-green-50'
                    }`}
                  >
                    {pendingToggleAlertId === alert.id ? 'Saving...' : alert.enabled ? 'Pause' : 'Enable'}
                  </button>
                  <button
                    type="button"
                    onClick={() => void deleteAlert(alert.id)}
                    disabled={pendingDeleteAlertId === alert.id}
                    className="px-3 py-1 text-xs font-bold uppercase tracking-wider border-2 border-red-500 text-red-500 hover:bg-red-50 transition-colors disabled:opacity-50"
                  >
                    {pendingDeleteAlertId === alert.id ? 'Deleting...' : 'Delete'}
                  </button>
                </div>
              </div>
                );
              })()}

              {expandedAlert === alert.id && (
                <div className="mt-3 border-t-2 border-bauhaus-black/10 pt-3">
                  {matchLoading === alert.id ? (
                    <p className="text-xs font-black text-bauhaus-muted uppercase tracking-widest">Loading matches...</p>
                  ) : (alertMatches[alert.id]?.length || 0) === 0 ? (
                    <p className="text-sm text-bauhaus-muted">No matching grants found for this alert&apos;s criteria.</p>
                  ) : (
                    <div className="space-y-2">
                      <p className="text-[10px] font-black uppercase tracking-wider text-bauhaus-muted mb-2">
                        {alertMatches[alert.id].length} Matching Grant{alertMatches[alert.id].length !== 1 ? 's' : ''}
                      </p>
                      {alertMatches[alert.id].map((grant) => (
                        <div key={grant.id} className="flex items-center justify-between gap-3 border-2 border-gray-200 px-3 py-2">
                          <div className="flex-1 min-w-0">
                            <Link href={`/grants/${grant.id}`} className="font-bold text-sm hover:text-bauhaus-blue truncate block">
                              {grant.name}
                            </Link>
                            <div className="text-xs text-bauhaus-muted flex items-center gap-2 flex-wrap">
                              <span>{grant.provider}</span>
                              {grant.amount_max && <span className="font-black tabular-nums">Up to {formatMoney(grant.amount_max)}</span>}
                              {grant.closes_at && <span>Closes {new Date(grant.closes_at).toLocaleDateString()}</span>}
                            </div>
                          </div>
                          <button
                            type="button"
                            onClick={() => void trackGrant(grant.id, { alertId: alert.id })}
                            disabled={pendingTrackGrantId === grant.id}
                            className="ml-3 px-3 py-1 text-[10px] font-black uppercase tracking-wider border-2 border-bauhaus-black hover:bg-bauhaus-black hover:text-white transition-colors disabled:opacity-50 flex-shrink-0"
                          >
                            {pendingTrackGrantId === grant.id ? 'Saving...' : 'Track'}
                          </button>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

function AlertActivityRow({
  activity,
  retrying,
  dismissing,
  onRetry,
  onDismiss,
}: {
  activity: AlertActivity;
  retrying?: boolean;
  dismissing?: boolean;
  onRetry?: () => void;
  onDismiss?: () => void;
}) {
  const statusLabel = activity.status === 'sent'
    ? 'Sent'
    : activity.status === 'failed'
      ? 'Failed'
      : activity.status === 'cancelled'
        ? 'Cancelled'
        : 'Queued';
  const activityTime = activity.sent_at || activity.queued_at;

  return (
    <div className="border-2 border-gray-200 p-4 hover:border-bauhaus-black transition-colors">
      <div className="flex items-start justify-between gap-4">
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2 flex-wrap">
            <span className={`text-[10px] px-2 py-0.5 font-bold uppercase rounded-sm border ${ALERT_STATUS_STYLES[activity.status] || ALERT_STATUS_STYLES.cancelled}`}>
              {statusLabel}
            </span>
            {activity.alert?.name ? (
              <span className="text-[10px] px-2 py-0.5 font-bold uppercase bg-bauhaus-black text-white rounded-sm">
                {activity.alert.name}
              </span>
            ) : null}
            {activity.match_score != null ? (
              <span className="text-[10px] px-2 py-0.5 font-bold uppercase bg-bauhaus-blue/10 text-bauhaus-blue rounded-sm">
                {activity.match_score}% match
              </span>
            ) : null}
          </div>

          <div className="mt-2">
            {activity.grant ? (
              <Link
                href={`/grants/${activity.grant.id}`}
                className="font-bold text-sm hover:text-bauhaus-red transition-colors line-clamp-1"
              >
                {activity.grant.name}
              </Link>
            ) : (
              <div className="font-bold text-sm line-clamp-1">{activity.subject || 'Grant alert activity'}</div>
            )}
            <div className="text-xs text-bauhaus-muted mt-1">
              {activity.alert?.name || 'Grant alert'}
              {(activity.grant?.provider || activity.subject) ? ` · ${activity.grant?.provider || activity.subject}` : ''}
            </div>
          </div>

          {activity.match_signals.length > 0 ? (
            <div className="flex gap-1 mt-2 flex-wrap">
              {activity.match_signals.slice(0, 4).map((signal) => (
                <span key={signal} className="text-[10px] px-1.5 py-0.5 bg-gray-100 text-gray-600 rounded">
                  {signal}
                </span>
              ))}
            </div>
          ) : null}

          {activity.last_error ? (
            <div className="mt-2 text-xs text-red-600">
              {activity.last_error}
            </div>
          ) : null}

          <div className="mt-3 flex gap-2 flex-wrap">
            {activity.grant?.id ? (
              <Link
                href={`/grants/${activity.grant.id}`}
                className="text-[10px] px-2.5 py-1 font-black uppercase tracking-widest border border-bauhaus-black text-bauhaus-black hover:bg-gray-100 transition-colors"
              >
                View Grant
              </Link>
            ) : null}
            {onRetry ? (
              <button
                type="button"
                onClick={onRetry}
                disabled={retrying}
                className="text-[10px] px-2.5 py-1 font-black uppercase tracking-widest border border-bauhaus-blue text-bauhaus-blue hover:bg-bauhaus-blue/5 transition-colors disabled:opacity-50"
              >
                {retrying ? 'Retrying...' : 'Retry Delivery'}
              </button>
            ) : null}
            {onDismiss ? (
              <button
                type="button"
                onClick={onDismiss}
                disabled={dismissing}
                className="text-[10px] px-2.5 py-1 font-black uppercase tracking-widest border border-bauhaus-black text-bauhaus-muted hover:text-bauhaus-black hover:bg-gray-100 transition-colors disabled:opacity-50"
              >
                {dismissing ? 'Dismissing...' : 'Dismiss'}
              </button>
            ) : null}
          </div>
        </div>

        <div className="shrink-0 text-right">
          <div className="text-xs text-bauhaus-muted">{timeAgo(activityTime)}</div>
          {activity.grant?.closes_at ? (
            <div className={`mt-1 text-xs font-bold ${daysUntil(activity.grant.closes_at) === 'Closed' ? 'text-red-500' : 'text-bauhaus-muted'}`}>
              {daysUntil(activity.grant.closes_at)}
            </div>
          ) : null}
        </div>
      </div>
    </div>
  );
}
