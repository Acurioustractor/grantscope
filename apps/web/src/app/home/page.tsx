import { Suspense } from 'react';
import { redirect } from 'next/navigation';
import {
  buildAlertPerformanceSnapshot,
  createEmptyAlertPerformanceMetrics,
  type AlertPerformanceEventRow,
  type AttributedSavedGrantRow,
} from '@/lib/alert-performance';
import { getAlertEntitlements, resolveSubscriptionTier, TIER_LABELS } from '@/lib/subscription';
import { createSupabaseServer } from '@/lib/supabase-server';
import { getServiceSupabase } from '@/lib/supabase';
import { HomeClient } from './home-client';
import { IntakeClaimer } from './intake-claimer';
import type { GrantItem, FoundationItem, AgentRun, AlertActivityItem, AlertLearningItem } from './home-client';

export const dynamic = 'force-dynamic';

function safeNextPath(value: string | string[] | undefined) {
  const target = Array.isArray(value) ? value[0] : value;
  if (!target) return null;
  if (!target.startsWith('/') || target.startsWith('//')) return null;
  if (target === '/home' || target.startsWith('/home?')) return null;
  return target;
}

function daysUntil(dateStr: string): number {
  const diff = new Date(dateStr).getTime() - Date.now();
  return Math.max(0, Math.ceil(diff / (1000 * 60 * 60 * 24)));
}

function formatDate(dateStr: string | null | undefined): string | null {
  if (!dateStr) return null;
  const date = new Date(dateStr);
  if (Number.isNaN(date.getTime())) return null;
  return date.toLocaleDateString('en-AU', {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
  });
}

export default async function HomePage({
  searchParams,
}: {
  searchParams?: Promise<Record<string, string | string[] | undefined>>;
}) {
  const supabase = await createSupabaseServer();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return null;

  const params = searchParams ? await searchParams : {};
  const nextPath = safeNextPath(params.next);
  if (nextPath) redirect(nextPath);

  const db = getServiceSupabase();

  const [
    { data: savedGrants },
    { data: savedFoundations },
    { data: profile },
    { data: recentAgentRuns },
    { data: alerts },
    { data: recentAlertRows },
    { count: openGrantCount },
    { count: entityCount },
  ] = await Promise.all([
    db.from('saved_grants')
      .select('id, stage, grant:grant_opportunities(id, name, provider, amount_min, amount_max, closes_at, categories)')
      .eq('user_id', user.id)
      .order('updated_at', { ascending: false }),
    db.from('saved_foundations')
      .select('id, stage, foundation:foundation_id(id, name, total_giving_annual, thematic_focus, geographic_focus)')
      .eq('user_id', user.id)
      .order('updated_at', { ascending: false }),
    db.from('org_profiles')
      .select('id, name, abn, domains, geographic_focus, stripe_customer_id, subscription_plan, subscription_status, subscription_trial_end, subscription_current_period_end, subscription_cancel_at_period_end')
      .eq('user_id', user.id)
      .maybeSingle(),
    db.from('agent_runs')
      .select('id, agent_name, status, items_found, items_new, started_at, duration_ms')
      .order('started_at', { ascending: false })
      .limit(8),
    db.from('alert_preferences')
      .select('id, name, enabled, frequency, last_sent_at, match_count')
      .eq('user_id', user.id)
      .order('created_at', { ascending: false }),
    db.from('grant_notification_outbox')
      .select('id, grant_id, alert_preference_id, notification_type, status, subject, match_score, match_signals, queued_at, sent_at, last_error')
      .eq('user_id', user.id)
      .order('queued_at', { ascending: false })
      .limit(6),
    db.from('grant_opportunities')
      .select('*', { count: 'exact', head: true })
      .gt('closes_at', new Date().toISOString()),
    db.from('gs_entities')
      .select('*', { count: 'exact', head: true }),
  ]);

  const grants = (savedGrants || []) as unknown as GrantItem[];
  const foundations = (savedFoundations || []) as unknown as FoundationItem[];
  const agentRuns = (recentAgentRuns || []) as AgentRun[];
  const activeAlertCount = (alerts || []).filter((alert: { enabled: boolean }) => alert.enabled).length;
  const subscriptionTier = resolveSubscriptionTier(profile?.subscription_plan);
  const alertEntitlements = getAlertEntitlements(subscriptionTier);
  const trialEndLabel = formatDate(profile?.subscription_trial_end);
  const periodEndLabel = formatDate(profile?.subscription_current_period_end);
  const subscriptionStatus = (profile?.subscription_status || '').toLowerCase();
  const billingStatus =
    subscriptionStatus === 'trialing'
      ? {
          tone: 'warning' as const,
          title: trialEndLabel ? `${TIER_LABELS[subscriptionTier]} trial ends ${trialEndLabel}` : `${TIER_LABELS[subscriptionTier]} trial is live`,
          detail: trialEndLabel
            ? 'Add billing details before the trial ends to keep alerts and shared workflow running.'
            : 'Your paid trial is active.',
          primaryLabel: 'Manage billing',
          primaryHref: '/profile',
          secondaryLabel: 'View plans',
          secondaryHref: '/support',
        }
      : profile?.subscription_cancel_at_period_end
        ? {
            tone: 'error' as const,
            title: periodEndLabel ? `${TIER_LABELS[subscriptionTier]} ends ${periodEndLabel}` : `${TIER_LABELS[subscriptionTier]} is set to cancel`,
            detail: 'Your subscription is set to cancel at period end. Update billing if you want to keep access uninterrupted.',
            primaryLabel: 'Manage billing',
            primaryHref: '/profile',
            secondaryLabel: 'Compare plans',
            secondaryHref: '/support',
          }
        : ['past_due', 'unpaid'].includes(subscriptionStatus)
          ? {
              tone: 'error' as const,
              title: 'Billing needs attention',
              detail: 'Payment failed or is overdue. Update your billing details to keep access uninterrupted.',
              primaryLabel: 'Manage billing',
              primaryHref: '/profile',
              secondaryLabel: 'Open alerts',
              secondaryHref: '/alerts',
            }
          : subscriptionTier !== 'community' && periodEndLabel
            ? {
                tone: 'info' as const,
                title: `${TIER_LABELS[subscriptionTier]} renews ${periodEndLabel}`,
                detail: 'Your paid workspace is active. Keep monitoring alerts and pipeline performance from the dashboard.',
                primaryLabel: 'Manage billing',
                primaryHref: '/profile',
                secondaryLabel: 'Open alerts',
                secondaryHref: '/alerts',
              }
            : null;
  const alertPreferenceIds = (alerts || []).map((alert: { id: number | string }) => Number(alert.id)).filter(Number.isFinite);

  const alertIds = new Map(
    (alerts || []).map((alert: {
      id: string | number;
      name: string;
      frequency: string;
      enabled: boolean;
    }) => [
      String(alert.id),
      {
        id: String(alert.id),
        name: alert.name,
        frequency: alert.frequency,
        enabled: alert.enabled,
      },
    ])
  );

  const performanceWindowStart = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString();
  const [
    { data: performanceEvents },
    { data: attributedSavedGrants },
  ] = alertPreferenceIds.length > 0
    ? await Promise.all([
      db.from('alert_events')
        .select('alert_preference_id, event_type, created_at, metadata')
        .eq('user_id', user.id)
        .in('alert_preference_id', alertPreferenceIds)
        .gte('created_at', performanceWindowStart)
        .order('created_at', { ascending: false })
        .limit(500),
      db.from('saved_grants')
        .select('source_alert_preference_id, stage, created_at, updated_at, source_attributed_at')
        .eq('user_id', user.id)
        .in('source_alert_preference_id', alertPreferenceIds),
    ])
    : [{ data: [] }, { data: [] }];

  const alertPerformance = buildAlertPerformanceSnapshot({
    performanceEvents: (performanceEvents || []) as AlertPerformanceEventRow[],
    attributedSavedGrants: (attributedSavedGrants || []) as AttributedSavedGrantRow[],
  });

  const recommendationPriority = (key: AlertLearningItem['recommendation']['key']) => {
    switch (key) {
      case 'optimization_underperforming':
      case 'low_engagement':
      case 'low_fit':
      case 'clicks_not_converting':
        return 0;
      case 'optimization_improving':
      case 'keep_expand':
      case 'working_pipeline':
      case 'good_prospect_flow':
        return 1;
      case 'monitor':
      case 'no_recent_activity':
      default:
        return 2;
    }
  };

  const alertLearning = ((alerts || [])
    .filter((alert: { enabled: boolean }) => alert.enabled)
    .map((alert: {
      id: number | string;
      name: string;
      frequency: string;
      enabled: boolean;
      last_sent_at?: string | null;
      match_count?: number | null;
    }) => {
      const metrics = alertPerformance[String(alert.id)] || createEmptyAlertPerformanceMetrics();
      return {
        id: String(alert.id),
        name: alert.name,
        frequency: alert.frequency,
        enabled: alert.enabled,
        last_sent_at: alert.last_sent_at || null,
        match_count: alert.match_count ?? null,
        sent: metrics.sent,
        clicks: metrics.clicks,
        tracked: metrics.tracked,
        lastOptimizedAt: metrics.lastOptimizedAt,
        lastOptimizationAction: metrics.lastOptimizationAction,
        recommendation: metrics.recommendation,
        optimizationComparison: metrics.optimizationComparison,
      };
    })
    .sort((a, b) => {
      const priorityDelta = recommendationPriority(a.recommendation.key) - recommendationPriority(b.recommendation.key);
      if (priorityDelta !== 0) return priorityDelta;
      return a.name.localeCompare(b.name);
    })) as AlertLearningItem[];

  const alertLearningSummary = {
    improving: alertLearning.filter((alert) => alert.recommendation.key === 'optimization_improving').length,
    needsAttention: alertLearning.filter((alert) =>
      ['optimization_underperforming', 'low_engagement', 'low_fit', 'clicks_not_converting'].includes(alert.recommendation.key)
    ).length,
    stable: alertLearning.filter((alert) =>
      ['keep_expand', 'working_pipeline', 'good_prospect_flow', 'monitor', 'no_recent_activity'].includes(alert.recommendation.key)
    ).length,
  };

  const grantIds = [...new Set((recentAlertRows || []).map((row: { grant_id: string | null }) => row.grant_id).filter(Boolean))] as string[];
  const { data: alertGrants } = grantIds.length > 0
    ? await db
      .from('grant_opportunities')
      .select('id, name, provider, closes_at')
      .in('id', grantIds)
    : { data: [] };

  const grantsById = new Map(
    (alertGrants || []).map((grant: { id: string; name: string; provider: string | null; closes_at: string | null }) => [
      grant.id,
      grant,
    ])
  );

  const recentAlertActivity = ((recentAlertRows || []).map((row: {
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
    alert: row.alert_preference_id ? alertIds.get(String(row.alert_preference_id)) || null : null,
    grant: row.grant_id ? grantsById.get(row.grant_id) || null : null,
  }))) as AlertActivityItem[];

  // Pipeline counts
  const stageCounts: Record<string, number> = {};
  grants.forEach((g) => { stageCounts[g.stage] = (stageCounts[g.stage] || 0) + 1; });

  const discoveredCount = stageCounts['discovered'] || 0;
  const activeCount = (stageCounts['researching'] || 0) + (stageCounts['pursuing'] || 0) + (stageCounts['preparing'] || 0);
  const submittedCount = stageCounts['submitted'] || 0;
  const wonCount = (stageCounts['successful'] || 0) + (stageCounts['approved'] || 0) + (stageCounts['realized'] || 0);

  // Deadlines
  const allDeadlines = grants
    .filter((g) => g.grant?.closes_at && new Date(g.grant.closes_at) > new Date())
    .sort((a, b) => new Date(a.grant?.closes_at || 0).getTime() - new Date(b.grant?.closes_at || 0).getTime());

  const urgentDeadlines = allDeadlines.filter((g) => daysUntil(g.grant!.closes_at!) <= 7);
  const soonDeadlines = allDeadlines.filter((g) => {
    const d = daysUntil(g.grant!.closes_at!);
    return d > 7 && d <= 30;
  }).slice(0, 5);

  // Onboarding
  const hasProfile = !!profile?.name;
  const hasDomains = !!profile?.domains?.length;
  const hasGeography = !!profile?.geographic_focus?.length;
  const profileReady = hasProfile && hasDomains && hasGeography;
  const hasShortlistedGrants = grants.length > 0;
  const hasWorkedGrantPipeline = grants.some((grant) => grant.stage !== 'discovered');

  // Greeting
  const hour = new Date().getHours();
  const timeGreeting = hour < 12 ? 'Good morning' : hour < 17 ? 'Good afternoon' : 'Good evening';
  const firstName = profile?.name?.split(' ')[0] || profile?.name;
  const greeting = `${timeGreeting}${firstName ? `, ${firstName}` : ''}`;

  const contextLine = urgentDeadlines.length > 0
    ? `${urgentDeadlines.length} deadline${urgentDeadlines.length !== 1 ? 's' : ''} closing this week`
    : !hasProfile
      ? 'Start by completing your organisation profile to unlock better grant matches.'
      : !hasDomains || !hasGeography
        ? 'Add your domains and geography so CivicGraph can rank the right grants and funders for your work.'
        : !hasShortlistedGrants
          ? 'Your profile is ready. Review matched grants and save the strongest opportunities into your tracker.'
          : !hasWorkedGrantPipeline
            ? 'You have a shortlist. Move one strong grant beyond Discovered to start your live pipeline.'
    : grants.length > 0
      ? `${grants.length} grants tracked \u00B7 ${(openGrantCount || 0).toLocaleString()} open opportunities in the database`
      : 'Welcome to CivicGraph. Let\u2019s get your workspace set up.';

  return (
    <>
      <Suspense>
        <IntakeClaimer />
      </Suspense>
      <HomeClient
        greeting={greeting}
        contextLine={contextLine}
        profileReady={profileReady}
        hasShortlistedGrants={hasShortlistedGrants}
        hasWorkedGrantPipeline={hasWorkedGrantPipeline}
        grants={grants}
        foundations={foundations}
        agentRuns={agentRuns}
        activeAlertCount={activeAlertCount}
        recentAlertActivity={recentAlertActivity}
        alertLearning={alertLearning}
        alertLearningSummary={alertLearningSummary}
        subscriptionTier={subscriptionTier}
        alertEntitlements={alertEntitlements}
        billingStatus={billingStatus}
        openGrantCount={openGrantCount || 0}
        entityCount={entityCount || 0}
        urgentDeadlines={urgentDeadlines}
        soonDeadlines={soonDeadlines}
        discoveredCount={discoveredCount}
        activeCount={activeCount}
        submittedCount={submittedCount}
        wonCount={wonCount}
      />
    </>
  );
}
