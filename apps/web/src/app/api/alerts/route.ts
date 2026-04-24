import { NextRequest, NextResponse } from 'next/server';
import { requireModule } from '@/lib/api-auth';
import { recordProductEvents } from '@/lib/product-events';
import {
  buildAlertPerformanceSnapshot,
  type AlertPerformanceEventRow,
  type AttributedSavedGrantRow,
} from '@/lib/alert-performance';
import { recordAlertEvents } from '@/lib/alert-events';
import { getAlertEntitlements } from '@/lib/subscription';
import { getServiceSupabase } from '@/lib/supabase';

/**
 * GET /api/alerts — list user's alert preferences
 * POST /api/alerts — create new alert
 */

export async function GET() {
  const auth = await requireModule('grants');
  if (auth.error) return auth.error;
  const { user, tier } = auth;

  const db = getServiceSupabase();
  const performanceWindowDays = 30;
  const performanceWindowStart = new Date(Date.now() - performanceWindowDays * 24 * 60 * 60 * 1000).toISOString();
  const [
    { data: alerts, error: alertsError },
    { data: recentAlertRows, error: recentAlertsError },
    { count: queuedCount, error: queuedCountError },
    { count: sentCount, error: sentCountError },
    { count: failedCount, error: failedCountError },
    { count: cancelledCount, error: cancelledCountError },
    { data: recentEvents, error: recentEventsError },
    { data: performanceEvents, error: performanceEventsError },
    { data: attributedSavedGrants, error: attributedSavedGrantsError },
  ] = await Promise.all([
    db.from('alert_preferences')
      .select('*')
      .eq('user_id', user.id)
      .order('created_at', { ascending: false }),
    db.from('grant_notification_outbox')
      .select('id, grant_id, alert_preference_id, notification_type, status, subject, match_score, match_signals, queued_at, sent_at, last_error')
      .eq('user_id', user.id)
      .order('queued_at', { ascending: false })
      .limit(20),
    db.from('grant_notification_outbox')
      .select('id', { count: 'exact', head: true })
      .eq('user_id', user.id)
      .eq('status', 'queued'),
    db.from('grant_notification_outbox')
      .select('id', { count: 'exact', head: true })
      .eq('user_id', user.id)
      .eq('status', 'sent'),
    db.from('grant_notification_outbox')
      .select('id', { count: 'exact', head: true })
      .eq('user_id', user.id)
      .eq('status', 'failed'),
    db.from('grant_notification_outbox')
      .select('id', { count: 'exact', head: true })
      .eq('user_id', user.id)
      .eq('status', 'cancelled'),
    db.from('alert_events')
      .select('id, event_type, metadata, created_at')
      .eq('user_id', user.id)
      .gte('created_at', new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString())
      .order('created_at', { ascending: false })
      .limit(50),
    db.from('alert_events')
      .select('alert_preference_id, event_type, created_at, metadata')
      .eq('user_id', user.id)
      .not('alert_preference_id', 'is', null)
      .gte('created_at', performanceWindowStart)
      .order('created_at', { ascending: false })
      .limit(500),
    db.from('saved_grants')
      .select('source_alert_preference_id, stage, created_at, updated_at, source_attributed_at')
      .eq('user_id', user.id)
      .not('source_alert_preference_id', 'is', null),
  ]);

  const firstError =
    alertsError
    || recentAlertsError
    || queuedCountError
    || sentCountError
    || failedCountError
    || cancelledCountError
    || recentEventsError
    || performanceEventsError
    || attributedSavedGrantsError;

  if (firstError) {
    return NextResponse.json({ error: firstError.message }, { status: 500 });
  }

  const grantIds = [...new Set((recentAlertRows || []).map((row: { grant_id: string | null }) => row.grant_id).filter(Boolean))] as string[];

  const { data: alertGrants, error: alertGrantsError } = grantIds.length > 0
    ? await db
      .from('grant_opportunities')
      .select('id, name, provider, closes_at')
      .in('id', grantIds)
    : { data: [], error: null };

  if (alertGrantsError) {
    return NextResponse.json({ error: alertGrantsError.message }, { status: 500 });
  }

  const alertsById = new Map(
    (alerts || []).map((alert: { id: string | number; name: string; frequency: string; enabled: boolean }) => [
      String(alert.id),
      { id: String(alert.id), name: alert.name, frequency: alert.frequency, enabled: alert.enabled },
    ])
  );

  const grantsById = new Map(
    (alertGrants || []).map((grant: { id: string; name: string; provider: string | null; closes_at: string | null }) => [
      grant.id,
      grant,
    ])
  );

  const recentActivity = (recentAlertRows || []).map((row: {
    id: string;
    grant_id: string | null;
    alert_preference_id: string | number | null;
    notification_type: string;
    status: string;
    subject: string | null;
    match_score: number | null;
    match_signals: string[] | null;
    queued_at: string;
    sent_at: string | null;
    last_error: string | null;
  }) => ({
    id: row.id,
    notification_type: row.notification_type,
    status: row.status,
    subject: row.subject,
    match_score: row.match_score,
    match_signals: row.match_signals || [],
    queued_at: row.queued_at,
    sent_at: row.sent_at,
    last_error: row.last_error,
    alert: row.alert_preference_id ? alertsById.get(String(row.alert_preference_id)) || null : null,
    grant: row.grant_id ? grantsById.get(row.grant_id) || null : null,
  }));

  const entitlements = getAlertEntitlements(tier);
  const eventRows = (recentEvents || []) as Array<{
    id: number;
    event_type: string;
    metadata: Record<string, unknown> | null;
    created_at: string;
  }>;
  const eventSummary = eventRows.reduce(
    (summary, event) => {
      if (event.event_type === 'notification_queued') summary.notificationsQueued += 1;
      if (event.event_type === 'notification_sent') summary.notificationsSent += 1;
      if (event.event_type === 'notification_failed') summary.notificationsFailed += 1;
      if (event.event_type === 'digest_sent') summary.digestsSent += 1;
      if (event.event_type === 'notification_opened' || event.event_type === 'digest_opened') summary.emailOpens += 1;
      if (event.event_type === 'notification_clicked' || event.event_type === 'digest_clicked') summary.grantClicks += 1;
      if (event.event_type === 'scout_run') summary.scoutRuns += 1;
      if (event.event_type === 'optimization_applied') summary.optimizationsApplied += 1;
      return summary;
    },
    {
      notificationsQueued: 0,
      notificationsSent: 0,
      notificationsFailed: 0,
      digestsSent: 0,
      emailOpens: 0,
      grantClicks: 0,
      scoutRuns: 0,
      optimizationsApplied: 0,
    }
  );

  const normalizedAlertPerformance = buildAlertPerformanceSnapshot({
    performanceEvents: (performanceEvents || []) as AlertPerformanceEventRow[],
    attributedSavedGrants: (attributedSavedGrants || []) as AttributedSavedGrantRow[],
  });

  return NextResponse.json({
    alerts: alerts || [],
    recentActivity,
    alertPerformance: normalizedAlertPerformance,
    performanceWindowDays,
    tier,
    entitlements,
    usage: {
      alerts: alerts?.length || 0,
      activeAlerts: alerts?.filter((alert: { enabled: boolean }) => alert.enabled).length || 0,
      remainingAlerts: Math.max(entitlements.maxAlerts - (alerts?.length || 0), 0),
    },
    queueSummary: {
      queued: queuedCount || 0,
      sent: sentCount || 0,
      failed: failedCount || 0,
      cancelled: cancelledCount || 0,
    },
    eventSummary,
    recentEvents: eventRows,
  });
}

export async function POST(request: NextRequest) {
  const auth = await requireModule('grants');
  if (auth.error) return auth.error;
  const { user, tier } = auth;

  const body = await request.json();
  const { name, frequency, categories, focus_areas, states, min_amount, max_amount, keywords, entity_types } = body;
  const optimizationSourceAlertId = body.optimization_source_alert_id != null ? Number(body.optimization_source_alert_id) : null;
  const optimizationAction = typeof body.optimization_action === 'string' ? body.optimization_action : null;
  const optimizationRecommendationTitle = typeof body.optimization_recommendation_title === 'string'
    ? body.optimization_recommendation_title
    : null;
  const entitlements = getAlertEntitlements(tier);
  const requestedFrequency = frequency || 'weekly';

  if (!entitlements.frequencies.includes(requestedFrequency)) {
    return NextResponse.json(
      {
        error: 'This alert frequency is not available on your current plan.',
        tier,
        allowed_frequencies: entitlements.frequencies,
        upgrade_url: '/support',
      },
      { status: 403 }
    );
  }

  const db = getServiceSupabase();
  const { count: alertCount, error: alertCountError } = await db
    .from('alert_preferences')
    .select('id', { count: 'exact', head: true })
    .eq('user_id', user.id);

  if (alertCountError) return NextResponse.json({ error: alertCountError.message }, { status: 500 });

  if ((alertCount || 0) >= entitlements.maxAlerts) {
    return NextResponse.json(
      {
        error: 'You have reached your alert limit for this plan.',
        tier,
        max_alerts: entitlements.maxAlerts,
        upgrade_url: '/support',
      },
      { status: 403 }
    );
  }

  const { data, error } = await db
    .from('alert_preferences')
    .insert({
      user_id: user.id,
      name: name || 'My Alert',
      frequency: requestedFrequency,
      categories: categories || [],
      focus_areas: focus_areas || [],
      states: states || [],
      min_amount: min_amount || null,
      max_amount: max_amount || null,
      keywords: keywords || [],
      entity_types: entity_types || [],
    })
    .select()
    .single();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  await recordAlertEvents([
    {
      userId: user.id,
      alertPreferenceId: data.id,
      eventType: 'alert_created',
      metadata: {
        frequency: data.frequency,
        tier,
      },
    },
    ...(optimizationSourceAlertId
      ? [{
        userId: user.id,
        alertPreferenceId: optimizationSourceAlertId,
        eventType: 'optimization_applied' as const,
        metadata: {
          action: optimizationAction || 'clone_tighter',
          recommendation_title: optimizationRecommendationTitle,
          created_alert_id: data.id,
          created_alert_name: data.name,
          result: 'created_variant',
        },
      }]
      : []),
  ]);

  if ((alertCount || 0) === 0) {
    await recordProductEvents([
      {
        userId: user.id,
        eventType: 'first_alert_created',
        metadata: {
          alert_id: data.id,
          frequency: data.frequency,
          tier,
        },
      },
    ]);
  }

  return NextResponse.json({ alert: data }, { status: 201 });
}
