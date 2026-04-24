'use client';

import { useEffect, useState, useTransition } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { DEFAULT_PROFILE_ALERT_NAME } from '@/lib/profile-alerts';

// ── Types ─────────────────────────────────────────────────────────

interface SavedGrant {
  id: string;
  stage: string;
  stars: number;
  color: string;
  notes: string | null;
  updated_at: string;
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

interface SavedFoundation {
  id: string;
  stage: string;
  stars: number;
  notes: string | null;
  updated_at: string;
  foundation: {
    id: string;
    name: string;
    total_giving_annual: number | null;
    thematic_focus: string[];
    geographic_focus: string[];
  } | null;
}

interface EntityWatch {
  id: string;
  entity_id: string;
  gs_id: string;
  canonical_name: string | null;
  watch_types: string[];
  notes: string | null;
  last_change_at: string | null;
  change_summary: Record<string, unknown> | null;
  created_at: string;
}

interface Alert {
  id: string;
  name: string;
  enabled: boolean;
  frequency: string;
  categories: string[];
  focus_areas: string[];
  states: string[];
  min_amount: number | null;
  max_amount: number | null;
  keywords: string[];
  match_count: number | null;
  last_matched_at: string | null;
  last_sent_at: string | null;
  created_at: string;
}

interface Discovery {
  id: string;
  title: string;
  description: string;
  severity: string;
  discovery_type: string;
  entity_ids: string[];
  created_at: string;
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

type ActionFeedback = {
  tone: 'success' | 'error';
  message: string;
};

type NotificationOverride = {
  status?: string;
  last_error?: string | null;
};

type Tab = 'grants' | 'foundations' | 'entities' | 'alerts' | 'feed';

interface Props {
  savedGrants: SavedGrant[];
  savedFoundations: SavedFoundation[];
  entityWatches: EntityWatch[];
  alerts: Alert[];
  recentDiscoveries: Discovery[];
  recentAlertActivity: AlertActivity[];
}

// ── Helpers ───────────────────────────────────────────────────────

function fmtMoney(n: number | null | undefined): string {
  if (n == null) return '—';
  if (n >= 1e9) return `$${(n / 1e9).toFixed(1)}B`;
  if (n >= 1e6) return `$${(n / 1e6).toFixed(1)}M`;
  if (n >= 1e3) return `$${(n / 1e3).toFixed(0)}K`;
  return `$${n.toLocaleString()}`;
}

function daysUntil(dateStr: string | null): string {
  if (!dateStr) return '—';
  const diff = new Date(dateStr).getTime() - Date.now();
  const days = Math.ceil(diff / (1000 * 60 * 60 * 24));
  if (days < 0) return 'Closed';
  if (days === 0) return 'Today';
  if (days === 1) return '1 day';
  return `${days} days`;
}

function timeAgo(dateStr: string): string {
  const diff = Date.now() - new Date(dateStr).getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 60) return `${mins}m ago`;
  const hours = Math.floor(mins / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  return `${days}d ago`;
}

const STAGE_LABELS: Record<string, string> = {
  discovered: 'Discovered',
  researching: 'Researching',
  preparing: 'Preparing',
  submitted: 'Submitted',
  shortlisted: 'Shortlisted',
  awarded: 'Awarded',
  declined: 'Declined',
  realized: 'Realized',
  connected: 'Connected',
  active_relationship: 'Active',
};

const STAGE_COLORS: Record<string, string> = {
  discovered: 'bg-gray-100 text-gray-600',
  researching: 'bg-blue-50 text-blue-600',
  preparing: 'bg-amber-50 text-amber-600',
  submitted: 'bg-purple-50 text-purple-600',
  shortlisted: 'bg-emerald-50 text-emerald-600',
  awarded: 'bg-green-100 text-green-700',
  declined: 'bg-red-50 text-red-500',
  realized: 'bg-green-100 text-green-700',
  connected: 'bg-blue-50 text-blue-600',
  active_relationship: 'bg-green-100 text-green-700',
};

const ALERT_STATUS_STYLES: Record<string, string> = {
  queued: 'bg-amber-50 text-amber-700',
  sent: 'bg-green-100 text-green-700',
  failed: 'bg-red-50 text-red-600',
  cancelled: 'bg-gray-100 text-gray-500',
};

// ── Component ─────────────────────────────────────────────────────

export function WatchlistClient({
  savedGrants,
  savedFoundations,
  entityWatches,
  alerts,
  recentDiscoveries,
  recentAlertActivity,
}: Props) {
  const router = useRouter();
  const [activeTab, setActiveTab] = useState<Tab>('feed');
  const [watchGsId, setWatchGsId] = useState('');
  const [watches, setWatches] = useState(entityWatches);
  const [adding, setAdding] = useState(false);
  const [pendingTrackGrantId, setPendingTrackGrantId] = useState<string | null>(null);
  const [pendingPauseAlertId, setPendingPauseAlertId] = useState<string | null>(null);
  const [pendingNotificationAction, setPendingNotificationAction] = useState<{ id: string; action: 'retry' | 'cancel' } | null>(null);
  const [optimisticTrackedGrantIds, setOptimisticTrackedGrantIds] = useState<string[]>([]);
  const [optimisticPausedAlertIds, setOptimisticPausedAlertIds] = useState<string[]>([]);
  const [notificationOverrides, setNotificationOverrides] = useState<Record<string, NotificationOverride>>({});
  const [feedback, setFeedback] = useState<ActionFeedback | null>(null);
  const [isRefreshing, startRefresh] = useTransition();

  // Filter discoveries to those matching watched entity IDs
  const watchedEntityIds = new Set(watches.map(w => w.entity_id));
  const watchedDiscoveries = recentDiscoveries.filter(d =>
    d.entity_ids?.some(eid => watchedEntityIds.has(eid))
  );
  // Also show all discoveries if no watches yet (onboarding)
  const feedDiscoveries = watches.length > 0 ? watchedDiscoveries : recentDiscoveries.slice(0, 20);
  const pausedAlertIds = new Set(optimisticPausedAlertIds);
  const trackedGrantIds = new Set([
    ...savedGrants.map(item => item.grant?.id).filter(Boolean),
    ...optimisticTrackedGrantIds,
  ]);
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
  const recentFeedAlerts = effectiveRecentAlertActivity.slice(0, 3);
  const sentAlertCount = effectiveRecentAlertActivity.filter(activity => activity.status === 'sent').length;
  const queuedAlertCount = effectiveRecentAlertActivity.filter(activity => activity.status === 'queued').length;

  const tabs: { key: Tab; label: string; count: number }[] = [
    { key: 'feed', label: 'Feed', count: feedDiscoveries.length },
    { key: 'entities', label: 'Entities', count: watches.length },
    { key: 'grants', label: 'Grants', count: savedGrants.length },
    { key: 'foundations', label: 'Foundations', count: savedFoundations.length },
    { key: 'alerts', label: 'Alerts', count: alerts.length },
  ];
  const defaultProfileAlert = alerts.find(alert => alert.name === DEFAULT_PROFILE_ALERT_NAME);

  useEffect(() => {
    if (!feedback) return;
    const timeout = window.setTimeout(() => setFeedback(null), 4000);
    return () => window.clearTimeout(timeout);
  }, [feedback]);

  async function addWatch() {
    if (!watchGsId.trim()) return;
    setAdding(true);
    try {
      const res = await fetch('/api/watches', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ gs_id: watchGsId.trim() }),
      });
      if (res.ok) {
        const { watch } = await res.json();
        setWatches([watch, ...watches]);
        setWatchGsId('');
      }
    } finally {
      setAdding(false);
    }
  }

  async function removeWatch(watchId: string) {
    await fetch(`/api/watches/${watchId}`, { method: 'DELETE' });
    setWatches(watches.filter(w => w.id !== watchId));
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

  return (
    <div>
      {feedback && (
        <div
          className="mb-6 border-2 px-4 py-3 text-sm font-bold rounded"
          role={feedback.tone === 'error' ? 'alert' : 'status'}
          style={{
            borderColor: feedback.tone === 'error' ? 'rgb(220 38 38)' : 'rgb(22 163 74)',
            background: feedback.tone === 'error' ? 'rgb(254 242 242)' : 'rgb(240 253 244)',
            color: feedback.tone === 'error' ? 'rgb(153 27 27)' : 'rgb(22 101 52)',
          }}
        >
          {feedback.message}
        </div>
      )}

      {/* Tabs */}
      <div className="flex gap-0 border-b-4 border-bauhaus-black mb-6">
        {tabs.map(tab => (
          <button
            key={tab.key}
            onClick={() => setActiveTab(tab.key)}
            className={`px-4 py-3 text-xs font-black uppercase tracking-widest transition-colors ${
              activeTab === tab.key
                ? 'bg-bauhaus-black text-white'
                : 'bg-white text-bauhaus-muted hover:bg-gray-100'
            }`}
          >
            {tab.label}
            <span className="ml-2 text-[10px]">({tab.count})</span>
          </button>
        ))}
      </div>

      {/* Feed tab */}
      {activeTab === 'feed' && (
        <div>
          {recentFeedAlerts.length > 0 ? (
            <div className="mb-6 border-4 border-bauhaus-black bg-bauhaus-blue/5 p-4">
              <div className="flex items-start justify-between gap-4 flex-wrap">
                <div>
                  <div className="text-[10px] font-black uppercase tracking-[0.3em] text-bauhaus-blue">Recent Alert Activity</div>
                  <p className="mt-2 text-sm text-bauhaus-black/80">
                    Your grant alerts have recent activity. Open the alerts tab for the full queue and delivery history.
                  </p>
                </div>
                <div className="flex gap-2">
                  <span className="text-[10px] px-2 py-1 font-black uppercase bg-green-100 text-green-700 rounded-sm">
                    {sentAlertCount} sent
                  </span>
                  <span className="text-[10px] px-2 py-1 font-black uppercase bg-amber-50 text-amber-700 rounded-sm">
                    {queuedAlertCount} queued
                  </span>
                </div>
              </div>
              <div className="mt-4 space-y-2">
                {recentFeedAlerts.map(activity => (
                  <AlertActivityRow
                    key={activity.id}
                    activity={activity}
                    compact
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
            </div>
          ) : alerts.length > 0 ? (
            <div className="mb-6 border-2 border-dashed border-bauhaus-black/20 p-4">
              <div className="text-[10px] font-black uppercase tracking-[0.3em] text-bauhaus-muted">Alert Activity</div>
              <p className="mt-2 text-sm text-bauhaus-muted">
                Your alerts are active. Recent grant matches and deliveries will appear here once the scout queues them.
              </p>
            </div>
          ) : null}

          {feedDiscoveries.length === 0 ? (
            <EmptyState
              icon="📡"
              title="No recent discoveries"
              description={watches.length > 0
                ? 'No changes detected for your watched entities this week.'
                : 'Watch entities to see their discoveries here. Platform-wide discoveries will show when you have no watches.'}
              cta={watches.length === 0 ? { label: 'Browse Entities', href: '/entities' } : undefined}
            />
          ) : (
            <div className="space-y-2">
              {feedDiscoveries.map(d => {
                const severityStyles: Record<string, string> = {
                  critical: 'border-l-4 border-l-bauhaus-red bg-error-light',
                  significant: 'border-l-4 border-l-orange-500 bg-orange-50',
                  notable: 'border-l-4 border-l-bauhaus-blue bg-link-light',
                  info: 'border-l-4 border-l-gray-300',
                };
                return (
                  <div key={d.id} className={`border-2 border-gray-200 p-4 ${severityStyles[d.severity] || ''}`}>
                    <div className="flex items-start justify-between gap-4">
                      <div className="min-w-0 flex-1">
                        <div className="font-bold text-sm">{d.title}</div>
                        <div className="text-xs text-bauhaus-muted mt-1 line-clamp-2">{d.description}</div>
                        <div className="flex gap-2 mt-2 flex-wrap">
                          <span className={`text-[10px] px-1.5 py-0.5 font-bold uppercase ${
                            d.severity === 'critical' ? 'bg-bauhaus-red text-white' :
                            d.severity === 'significant' ? 'bg-orange-500 text-white' :
                            d.severity === 'notable' ? 'bg-bauhaus-blue text-white' :
                            'bg-gray-200 text-gray-600'
                          }`}>
                            {d.severity}
                          </span>
                          <span className="text-[10px] px-1.5 py-0.5 bg-gray-100 text-gray-600">
                            {d.discovery_type.replace(/_/g, ' ')}
                          </span>
                        </div>
                      </div>
                      <span className="text-xs text-bauhaus-muted shrink-0">{timeAgo(d.created_at)}</span>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}

      {/* Grants tab */}
      {activeTab === 'grants' && (
        <div className="space-y-2">
          {savedGrants.length === 0 ? (
            <EmptyState
              icon="🎯"
              title="No saved grants"
              description="Save grants from the grant search to track them here."
              cta={{ label: 'Search Grants', href: '/grants' }}
            />
          ) : (
            savedGrants.map(sg => (
              <div key={sg.id} className="border-2 border-gray-200 p-4 hover:border-bauhaus-black transition-colors">
                <div className="flex items-start justify-between gap-4">
                  <div className="min-w-0 flex-1">
                    <Link
                      href={sg.grant ? `/grants/${sg.grant.id}` : '#'}
                      className="font-bold text-sm hover:text-bauhaus-red transition-colors line-clamp-1"
                    >
                      {sg.grant?.name || 'Unknown Grant'}
                    </Link>
                    <div className="text-xs text-bauhaus-muted mt-1">
                      {sg.grant?.provider || '—'}
                    </div>
                    {sg.notes && (
                      <div className="text-xs text-gray-500 mt-1 italic line-clamp-1">{sg.notes}</div>
                    )}
                  </div>
                  <div className="flex items-center gap-3 shrink-0">
                    {sg.grant?.closes_at && (
                      <div className={`text-xs font-bold ${daysUntil(sg.grant.closes_at) === 'Closed' ? 'text-red-500' : 'text-bauhaus-muted'}`}>
                        {daysUntil(sg.grant.closes_at)}
                      </div>
                    )}
                    {sg.grant?.amount_max && (
                      <div className="text-xs font-bold text-bauhaus-black">
                        {fmtMoney(sg.grant.amount_max)}
                      </div>
                    )}
                    <span className={`text-[10px] px-2 py-0.5 font-bold uppercase rounded-sm ${STAGE_COLORS[sg.stage] || STAGE_COLORS.discovered}`}>
                      {STAGE_LABELS[sg.stage] || sg.stage}
                    </span>
                    {'⭐'.repeat(sg.stars || 0)}
                  </div>
                </div>
              </div>
            ))
          )}
        </div>
      )}

      {/* Foundations tab */}
      {activeTab === 'foundations' && (
        <div className="space-y-2">
          {savedFoundations.length === 0 ? (
            <EmptyState
              icon="🏛️"
              title="No saved foundations"
              description="Save foundations to track relationships and giving patterns."
              cta={{ label: 'Browse Foundations', href: '/foundations' }}
            />
          ) : (
            savedFoundations.map(sf => (
              <div key={sf.id} className="border-2 border-gray-200 p-4 hover:border-bauhaus-black transition-colors">
                <div className="flex items-start justify-between gap-4">
                  <div className="min-w-0 flex-1">
                    <Link
                      href={sf.foundation ? `/foundations/${sf.foundation.id}` : '#'}
                      className="font-bold text-sm hover:text-bauhaus-red transition-colors line-clamp-1"
                    >
                      {sf.foundation?.name || 'Unknown Foundation'}
                    </Link>
                    <div className="flex gap-2 mt-1 flex-wrap">
                      {sf.foundation?.thematic_focus?.slice(0, 4).map(t => (
                        <span key={t} className="text-[10px] px-1.5 py-0.5 bg-gray-100 text-gray-600 rounded">
                          {t}
                        </span>
                      ))}
                    </div>
                  </div>
                  <div className="flex items-center gap-3 shrink-0">
                    {sf.foundation?.total_giving_annual && (
                      <div className="text-xs font-bold text-bauhaus-black">
                        {fmtMoney(sf.foundation.total_giving_annual)}/yr
                      </div>
                    )}
                    <span className={`text-[10px] px-2 py-0.5 font-bold uppercase rounded-sm ${STAGE_COLORS[sf.stage] || STAGE_COLORS.discovered}`}>
                      {STAGE_LABELS[sf.stage] || sf.stage}
                    </span>
                  </div>
                </div>
              </div>
            ))
          )}
        </div>
      )}

      {/* Entities tab */}
      {activeTab === 'entities' && (
        <div>
          {/* Add entity watch form */}
          <div className="flex gap-2 mb-4">
            <input
              type="text"
              value={watchGsId}
              onChange={e => setWatchGsId(e.target.value)}
              placeholder="Enter GS ID (e.g. AU-ABN-49018049971)"
              className="flex-1 px-3 py-2 border-2 border-gray-200 text-sm focus:border-bauhaus-black outline-none"
              onKeyDown={e => e.key === 'Enter' && addWatch()}
            />
            <button
              onClick={addWatch}
              disabled={adding || !watchGsId.trim()}
              className="px-4 py-2 bg-bauhaus-black text-white text-xs font-black uppercase tracking-widest hover:bg-bauhaus-red transition-colors disabled:opacity-50"
            >
              {adding ? 'Adding...' : 'Watch'}
            </button>
          </div>

          {watches.length === 0 ? (
            <EmptyState
              icon="👁️"
              title="No entity watches"
              description="Watch specific entities to get notified when they receive new contracts, grants, or relationships."
            />
          ) : (
            <div className="space-y-2">
              {watches.map(w => (
                <div key={w.id} className="border-2 border-gray-200 p-4 hover:border-bauhaus-black transition-colors">
                  <div className="flex items-start justify-between gap-4">
                    <div className="min-w-0 flex-1">
                      <Link
                        href={`/entities/${w.gs_id}`}
                        className="font-bold text-sm hover:text-bauhaus-red transition-colors"
                      >
                        {w.canonical_name || w.gs_id}
                      </Link>
                      <div className="text-xs text-bauhaus-muted mt-1">
                        {w.gs_id}
                      </div>
                      <div className="flex gap-1 mt-2">
                        {w.watch_types.map(t => (
                          <span key={t} className="text-[10px] px-1.5 py-0.5 bg-blue-50 text-blue-600 rounded">
                            {t}
                          </span>
                        ))}
                      </div>
                    </div>
                    <div className="flex items-center gap-3 shrink-0">
                      <span className="text-xs text-bauhaus-muted">{timeAgo(w.created_at)}</span>
                      <button
                        onClick={() => removeWatch(w.id)}
                        className="text-xs text-red-500 hover:text-red-700 font-bold"
                      >
                        Remove
                      </button>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* Alerts tab */}
      {activeTab === 'alerts' && (
        <div>
          <div className="flex justify-between items-center mb-4">
            <p className="text-xs text-bauhaus-muted">
              Alerts notify you when new grants match your criteria and update as the scout runs.
            </p>
            <Link
              href="/alerts"
              className="text-xs font-black uppercase tracking-widest text-bauhaus-black hover:text-bauhaus-red"
            >
              Manage Alerts &rarr;
            </Link>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-0 border-4 border-bauhaus-black mb-6">
            <div className="p-4 border-b-2 md:border-b-0 md:border-r-2 border-bauhaus-black/10">
              <div className="text-[10px] font-black text-bauhaus-muted uppercase tracking-widest mb-1">Recent Activity</div>
              <div className="text-2xl font-black text-bauhaus-black">{recentAlertActivity.length}</div>
            </div>
            <div className="p-4 border-b-2 md:border-b-0 md:border-r-2 border-bauhaus-black/10">
              <div className="text-[10px] font-black text-bauhaus-muted uppercase tracking-widest mb-1">Queued</div>
              <div className="text-2xl font-black text-bauhaus-black">{queuedAlertCount}</div>
            </div>
            <div className="p-4">
              <div className="text-[10px] font-black text-bauhaus-muted uppercase tracking-widest mb-1">Sent</div>
              <div className="text-2xl font-black text-bauhaus-black">{sentAlertCount}</div>
            </div>
          </div>

          {defaultProfileAlert && (
            <div className="mb-4 border-4 border-bauhaus-blue bg-bauhaus-blue/5 p-4">
              <div className="text-[10px] font-black uppercase tracking-[0.3em] text-bauhaus-blue">Auto From Profile</div>
              <p className="mt-2 text-sm text-bauhaus-black/80">
                <span className="font-black">{defaultProfileAlert.name}</span> stays in sync with your profile domains and geography, so your
                core grant alert keeps improving as you refine your organisation profile.
              </p>
            </div>
          )}

          {alerts.length === 0 ? (
            <EmptyState
              icon="🔔"
              title="No alerts configured"
              description="Complete your profile to auto-create a default grant alert, or build custom alerts for specific funding themes."
              cta={{ label: 'Open Alerts', href: '/alerts' }}
            />
          ) : (
            <div className="space-y-2">
              {alerts.map(a => {
                const alertEnabled = a.enabled && !pausedAlertIds.has(a.id);
                return (
                  <div key={a.id} className="border-2 border-gray-200 p-4 hover:border-bauhaus-black transition-colors">
                  <div className="flex items-start justify-between gap-4">
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-2 flex-wrap">
                        <div className="font-bold text-sm">{a.name}</div>
                        {a.name === DEFAULT_PROFILE_ALERT_NAME && (
                          <span className="text-[10px] px-1.5 py-0.5 font-bold uppercase bg-bauhaus-blue text-white rounded">
                            Auto
                          </span>
                        )}
                      </div>
                      <div className="flex gap-1 mt-2 flex-wrap">
                        {a.categories?.map(c => (
                          <span key={c} className="text-[10px] px-1.5 py-0.5 bg-gray-100 text-gray-600 rounded">{c}</span>
                        ))}
                        {a.states?.map(s => (
                          <span key={s} className="text-[10px] px-1.5 py-0.5 bg-blue-50 text-blue-600 rounded">{s}</span>
                        ))}
                        {a.keywords?.map(k => (
                          <span key={k} className="text-[10px] px-1.5 py-0.5 bg-amber-50 text-amber-600 rounded">&quot;{k}&quot;</span>
                        ))}
                      </div>
                      {a.min_amount || a.max_amount ? (
                        <div className="text-xs text-bauhaus-muted mt-1">
                          Amount: {fmtMoney(a.min_amount)} — {fmtMoney(a.max_amount)}
                        </div>
                      ) : null}
                    </div>
                    <div className="flex flex-col items-end gap-1 shrink-0">
                      <span className={`text-[10px] px-2 py-0.5 font-bold uppercase rounded-sm ${alertEnabled ? 'bg-green-100 text-green-700' : 'bg-gray-100 text-gray-400'}`}>
                        {alertEnabled ? 'Active' : 'Paused'}
                      </span>
                      <span className="text-[10px] text-bauhaus-muted">{a.frequency}</span>
                      {a.match_count != null && (
                        <span className="text-[10px] text-bauhaus-muted">{a.match_count} matches</span>
                      )}
                    </div>
                  </div>
                  </div>
                );
              })}
            </div>
          )}

          <div className="mt-8">
            <div className="flex items-center justify-between gap-4 mb-4 flex-wrap">
              <div>
                <h2 className="text-lg font-black uppercase tracking-widest text-bauhaus-black">Recent Alert Activity</h2>
                <p className="text-xs text-bauhaus-muted mt-1">
                  Queued and delivered grant notifications for your current alerts.
                </p>
              </div>
              <Link
                href="/grants"
                className="text-xs font-black uppercase tracking-widest text-bauhaus-black hover:text-bauhaus-red"
              >
                Browse Grants &rarr;
              </Link>
            </div>

            {effectiveRecentAlertActivity.length === 0 ? (
              <EmptyState
                icon="🔔"
                title="No alert activity yet"
                description="Your alerts are configured. Once the scout queues new grant matches or deliveries, they will appear here with score and status."
                cta={{ label: 'Open Alerts', href: '/alerts' }}
              />
            ) : (
              <div className="space-y-2">
                {effectiveRecentAlertActivity.map(activity => (
                  <AlertActivityRow
                    key={activity.id}
                    activity={activity}
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
        </div>
      )}
    </div>
  );
}

// ── Empty State ───────────────────────────────────────────────────

function EmptyState({ icon, title, description, cta }: {
  icon: string;
  title: string;
  description: string;
  cta?: { label: string; href: string };
}) {
  return (
    <div className="border-4 border-dashed border-bauhaus-black/20 p-12 text-center">
      <div className="text-3xl mb-3">{icon}</div>
      <div className="font-bold text-lg mb-1">{title}</div>
      <p className="text-sm text-bauhaus-muted max-w-md mx-auto">{description}</p>
      {cta && (
        <Link
          href={cta.href}
          className="inline-block mt-4 px-5 py-2.5 bg-bauhaus-black text-white text-xs font-black uppercase tracking-widest hover:bg-bauhaus-red transition-colors"
        >
          {cta.label}
        </Link>
      )}
    </div>
  );
}

function AlertActivityRow({
  activity,
  compact = false,
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
  activity: AlertActivity;
  compact?: boolean;
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
  const statusLabel = activity.status === 'sent'
    ? 'Sent'
    : activity.status === 'failed'
      ? 'Failed'
      : activity.status === 'cancelled'
        ? 'Cancelled'
        : 'Queued';
  const activityTime = activity.sent_at || activity.queued_at;

  return (
    <div className={`border-2 border-gray-200 p-4 hover:border-bauhaus-black transition-colors ${compact ? 'bg-white' : ''}`}>
      <div className="flex items-start justify-between gap-4">
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2 flex-wrap">
            <span className={`text-[10px] px-2 py-0.5 font-bold uppercase rounded-sm ${ALERT_STATUS_STYLES[activity.status] || 'bg-gray-100 text-gray-500'}`}>
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
              {activity.grant?.provider || activity.subject || 'Grant alert'}
            </div>
          </div>

          {activity.match_signals.length > 0 ? (
            <div className="flex gap-1 mt-2 flex-wrap">
              {activity.match_signals.slice(0, compact ? 2 : 4).map(signal => (
                <span key={signal} className="text-[10px] px-1.5 py-0.5 bg-gray-100 text-gray-600 rounded">
                  {signal}
                </span>
              ))}
            </div>
          ) : null}

          {!compact && activity.last_error ? (
            <div className="mt-2 text-xs text-red-600">
              {activity.last_error}
            </div>
          ) : null}

          <div className="mt-3 flex gap-2 flex-wrap">
            {activity.grant?.id ? (
              tracked ? (
                <Link
                  href="/tracker"
                  className="text-[10px] px-2.5 py-1 font-black uppercase tracking-widest border border-bauhaus-black text-bauhaus-black hover:bg-gray-100 transition-colors"
                >
                  In Tracker
                </Link>
              ) : (
                <button
                  type="button"
                  onClick={onTrackGrant}
                  disabled={!onTrackGrant || tracking || disabled}
                  className="text-[10px] px-2.5 py-1 font-black uppercase tracking-widest bg-bauhaus-black text-white hover:bg-bauhaus-red transition-colors disabled:opacity-50"
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
                className="text-[10px] px-2.5 py-1 font-black uppercase tracking-widest border border-bauhaus-black text-bauhaus-muted hover:text-bauhaus-black hover:bg-gray-100 transition-colors disabled:opacity-50"
              >
                {pausing ? 'Pausing...' : 'Pause Alert'}
              </button>
            ) : null}
            {onRetry ? (
              <button
                type="button"
                onClick={onRetry}
                disabled={retrying || disabled}
                className="text-[10px] px-2.5 py-1 font-black uppercase tracking-widest border border-bauhaus-blue text-bauhaus-blue hover:bg-bauhaus-blue/5 transition-colors disabled:opacity-50"
              >
                {retrying ? 'Retrying...' : 'Retry Delivery'}
              </button>
            ) : null}
            {onDismiss ? (
              <button
                type="button"
                onClick={onDismiss}
                disabled={dismissing || disabled}
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
