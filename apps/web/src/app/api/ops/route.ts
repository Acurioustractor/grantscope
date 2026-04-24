import { NextResponse } from 'next/server';
import { requireAdminApi } from '@/lib/admin-auth';
import { PILOT_PAYMENT_INTENTS, PILOT_STAGES } from '@/lib/pilot-participants';
import { getServiceSupabase } from '@/lib/supabase';

export const dynamic = 'force-dynamic';

const PILOT_COHORTS = ['consultant', 'nonprofit', 'other'] as const;
const PILOT_THRESHOLDS = {
  profileReadyRate: 80,
  shortlistRate: 60,
  pipelineRate: 40,
  alertRate: 50,
  weeklyActiveRate: 70,
  paymentIntentRate: 30,
  paidOrCommittedRate: 20,
  seanEllisRate: 40,
} as const;
const DATA_REVIEW_THRESHOLDS = {
  grantPrecision: 70,
  foundationPrecision: 75,
  openNowTrust: 85,
  grantSample: 100,
  foundationSample: 50,
} as const;

function rate(numerator: number, denominator: number) {
  if (denominator <= 0) return 0;
  return Number(((numerator / denominator) * 100).toFixed(1));
}

function buildPilotCohortMetrics(rows: Array<{
  cohort: string;
  stage: string;
  payment_intent: string;
  sean_ellis_response: string;
  activation: {
    linkedAccount: boolean;
    weeklyActive: boolean;
    profileReady: boolean;
    shortlistStarted: boolean;
    pipelineStarted: boolean;
    alertCreated: boolean;
  };
}>) {
  const total = rows.length;
  const linkedAccounts = rows.filter((pilot) => pilot.activation.linkedAccount).length;
  const weeklyActive = rows.filter((pilot) => pilot.activation.weeklyActive).length;
  const profileReady = rows.filter((pilot) => pilot.activation.profileReady).length;
  const shortlistStarted = rows.filter((pilot) => pilot.activation.shortlistStarted).length;
  const pipelineStarted = rows.filter((pilot) => pilot.activation.pipelineStarted).length;
  const alertCreated = rows.filter((pilot) => pilot.activation.alertCreated).length;
  const strongYes = rows.filter((pilot) => pilot.payment_intent === 'strong_yes').length;
  const conditionalYes = rows.filter((pilot) => pilot.payment_intent === 'conditional_yes').length;
  const paid = rows.filter((pilot) => pilot.stage === 'paid').length;
  const paidOrCommitted = rows.filter((pilot) => pilot.stage === 'paid' || ['strong_yes', 'conditional_yes'].includes(pilot.payment_intent)).length;
  const veryDisappointed = rows.filter((pilot) => pilot.sean_ellis_response === 'very_disappointed').length;

  return {
    total,
    linkedAccounts,
    weeklyActive,
    profileReady,
    shortlistStarted,
    pipelineStarted,
    alertCreated,
    strongYes,
    conditionalYes,
    paid,
    paidOrCommitted,
    veryDisappointed,
    weeklyActiveRate: rate(weeklyActive, total),
    profileReadyRate: rate(profileReady, total),
    shortlistRate: rate(shortlistStarted, total),
    pipelineRate: rate(pipelineStarted, total),
    alertRate: rate(alertCreated, total),
    paymentIntentRate: rate(strongYes + conditionalYes, total),
    paidOrCommittedRate: rate(paidOrCommitted, total),
    paidRate: rate(paid, total),
    seanEllisRate: rate(veryDisappointed, total),
  };
}

function pickPilotAttention(pilot: {
  id: string;
  participant_name: string;
  organization_name: string | null;
  cohort: string;
  stage: string;
  payment_intent: string;
  updated_at: string;
  last_contact_at: string | null;
  closeout_at: string | null;
  activation: {
    linkedAccount: boolean;
    profileReady: boolean;
    shortlistStarted: boolean;
    pipelineStarted: boolean;
    alertCreated: boolean;
  };
}) {
  const lastTouch = pilot.last_contact_at || pilot.updated_at;
  const daysSinceTouch = Math.floor((Date.now() - new Date(lastTouch).getTime()) / (24 * 60 * 60 * 1000));

  if (['strong_yes', 'conditional_yes'].includes(pilot.payment_intent) && !['paid', 'declined'].includes(pilot.stage)) {
    return {
      pilotId: pilot.id,
      participant_name: pilot.participant_name,
      organization_name: pilot.organization_name,
      cohort: pilot.cohort,
      stage: pilot.stage,
      payment_intent: pilot.payment_intent,
      severity: 'high',
      reason: 'Commercial follow-up due',
      detail: 'Participant has positive payment intent but is not yet closed.',
      daysSinceTouch,
      updated_at: pilot.updated_at,
    };
  }

  if (['invited', 'scheduled', 'onboarded', 'active'].includes(pilot.stage) && !pilot.activation.linkedAccount) {
    return {
      pilotId: pilot.id,
      participant_name: pilot.participant_name,
      organization_name: pilot.organization_name,
      cohort: pilot.cohort,
      stage: pilot.stage,
      payment_intent: pilot.payment_intent,
      severity: 'high',
      reason: 'No linked product account',
      detail: 'Pilot has progressed beyond lead stage but does not map to a user account yet.',
      daysSinceTouch,
      updated_at: pilot.updated_at,
    };
  }

  if (['onboarded', 'active'].includes(pilot.stage) && !pilot.activation.profileReady) {
    return {
      pilotId: pilot.id,
      participant_name: pilot.participant_name,
      organization_name: pilot.organization_name,
      cohort: pilot.cohort,
      stage: pilot.stage,
      payment_intent: pilot.payment_intent,
      severity: 'high',
      reason: 'Onboarded but no profile',
      detail: 'Linked account exists but has not reached profile-ready.',
      daysSinceTouch,
      updated_at: pilot.updated_at,
    };
  }

  if (pilot.activation.profileReady && !pilot.activation.shortlistStarted) {
    return {
      pilotId: pilot.id,
      participant_name: pilot.participant_name,
      organization_name: pilot.organization_name,
      cohort: pilot.cohort,
      stage: pilot.stage,
      payment_intent: pilot.payment_intent,
      severity: 'medium',
      reason: 'Profile ready, no shortlist',
      detail: 'Participant got through setup but has not shortlisted a grant.',
      daysSinceTouch,
      updated_at: pilot.updated_at,
    };
  }

  if (pilot.activation.shortlistStarted && !pilot.activation.pipelineStarted) {
    return {
      pilotId: pilot.id,
      participant_name: pilot.participant_name,
      organization_name: pilot.organization_name,
      cohort: pilot.cohort,
      stage: pilot.stage,
      payment_intent: pilot.payment_intent,
      severity: 'medium',
      reason: 'Shortlisted, no pipeline movement',
      detail: 'Participant found grants but has not moved one into active work.',
      daysSinceTouch,
      updated_at: pilot.updated_at,
    };
  }

  if (pilot.activation.pipelineStarted && !pilot.activation.alertCreated) {
    return {
      pilotId: pilot.id,
      participant_name: pilot.participant_name,
      organization_name: pilot.organization_name,
      cohort: pilot.cohort,
      stage: pilot.stage,
      payment_intent: pilot.payment_intent,
      severity: 'medium',
      reason: 'Pipeline active, no alerts',
      detail: 'Participant is using the tracker but has not enabled ongoing monitoring.',
      daysSinceTouch,
      updated_at: pilot.updated_at,
    };
  }

  if (['completed', 'active'].includes(pilot.stage) && !pilot.closeout_at && daysSinceTouch >= 7) {
    return {
      pilotId: pilot.id,
      participant_name: pilot.participant_name,
      organization_name: pilot.organization_name,
      cohort: pilot.cohort,
      stage: pilot.stage,
      payment_intent: pilot.payment_intent,
      severity: 'low',
      reason: 'No recent follow-up',
      detail: 'Pilot may need a close-out or review check-in.',
      daysSinceTouch,
      updated_at: pilot.updated_at,
    };
  }

  return null;
}

export async function GET() {
  const auth = await requireAdminApi();
  if (auth.error) return auth.error;

  const db = getServiceSupabase();

  try {
    const [
      grantsTotal,
      grantsEmbedded,
      grantsEnriched,
      grantsOpen,
      foundationsTotal,
      foundationsProfiled,
      foundationsWithWebsite,
      communityOrgs,
      acncDistinctAbns,
      foundationPrograms,
      seTotal,
      seEnriched,
      paidProfiles,
      activeTrials,
      expiringTrials,
      atRiskProfiles,
      scheduledChurnProfiles,
      billingProfiles,
      pilotParticipants,
      validationReviews,
      recentRuns,
      recentProductEvents,
    ] = await Promise.all([
      db.from('grant_opportunities').select('*', { count: 'exact', head: true }),
      db.from('grant_opportunities').select('*', { count: 'exact', head: true }).not('embedding', 'is', null),
      db.from('grant_opportunities').select('*', { count: 'exact', head: true }).not('enriched_at', 'is', null),
      db.from('grant_opportunities').select('*', { count: 'exact', head: true })
        .gt('closes_at', new Date().toISOString()),
      db.from('foundations').select('*', { count: 'exact', head: true }),
      db.from('foundations').select('*', { count: 'exact', head: true }).not('last_scraped_at', 'is', null),
      db.from('foundations').select('*', { count: 'exact', head: true }).not('website', 'is', null),
      db.from('community_orgs').select('*', { count: 'exact', head: true }),
      db.from('acnc_ais').select('abn', { count: 'exact', head: true }),
      db.from('foundation_programs').select('*', { count: 'exact', head: true }),
      db.from('social_enterprises').select('*', { count: 'exact', head: true }),
      db.from('social_enterprises').select('*', { count: 'exact', head: true }).not('enriched_at', 'is', null),
      db.from('org_profiles').select('*', { count: 'exact', head: true }).neq('subscription_plan', 'community'),
      db.from('org_profiles').select('*', { count: 'exact', head: true }).eq('subscription_status', 'trialing'),
      db.from('org_profiles').select('*', { count: 'exact', head: true })
        .eq('subscription_status', 'trialing')
        .not('subscription_trial_end', 'is', null)
        .lte('subscription_trial_end', new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString())
        .gte('subscription_trial_end', new Date().toISOString()),
      db.from('org_profiles').select('*', { count: 'exact', head: true }).in('subscription_status', ['past_due', 'unpaid']),
      db.from('org_profiles').select('*', { count: 'exact', head: true }).eq('subscription_cancel_at_period_end', true),
      db.from('org_profiles')
        .select('id, name, subscription_plan, subscription_status, subscription_trial_end, subscription_current_period_end, subscription_cancel_at_period_end')
        .neq('subscription_plan', 'community')
        .order('subscription_trial_end', { ascending: true, nullsFirst: false })
        .order('subscription_current_period_end', { ascending: true, nullsFirst: false })
        .limit(50),
      db.from('pilot_participants')
        .select('*')
        .order('updated_at', { ascending: false })
        .limit(50),
      db.from('validation_reviews')
        .select('*')
        .gte('review_date', new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString().slice(0, 10))
        .order('review_date', { ascending: false })
        .limit(1000),
      db.from('agent_runs')
        .select('*')
        .order('completed_at', { ascending: false })
        .limit(20),
      db.from('product_events')
        .select('event_type, user_id, created_at, metadata')
        .gte('created_at', new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString()),
    ]);

    const productEventRows = recentProductEvents.data ?? [];
    const usersByEvent = productEventRows.reduce<Record<string, Set<string>>>((acc, row: { event_type: string; user_id: string }) => {
      if (!acc[row.event_type]) acc[row.event_type] = new Set();
      acc[row.event_type].add(row.user_id);
      return acc;
    }, {});
    const weeklyActiveUserIds = new Set(
      productEventRows
        .filter((row: { created_at: string }) => new Date(row.created_at).getTime() >= Date.now() - 7 * 24 * 60 * 60 * 1000)
        .map((row: { user_id: string }) => row.user_id)
    );

    const productFunnel = {
      windowDays: 30,
      profileReadyUsers: usersByEvent.profile_ready?.size ?? 0,
      firstShortlistUsers: usersByEvent.first_grant_shortlisted?.size ?? 0,
      pipelineStartedUsers: usersByEvent.pipeline_started?.size ?? 0,
      firstAlertUsers: usersByEvent.first_alert_created?.size ?? 0,
      alertClickUsers: usersByEvent.alert_clicked?.size ?? 0,
      checkoutStartedUsers: usersByEvent.checkout_started?.size ?? 0,
      trialStartedUsers: usersByEvent.subscription_trial_started?.size ?? 0,
      billingReminderUsers: usersByEvent.billing_reminder_sent?.size ?? 0,
      billingReminderClickUsers: usersByEvent.billing_reminder_clicked?.size ?? 0,
      billingPortalUsers: usersByEvent.billing_portal_opened?.size ?? 0,
      activatedUsers: usersByEvent.subscription_activated?.size ?? 0,
    };

    const pilotRows = (pilotParticipants.data ?? []) as Array<{
      id: string;
      participant_name: string;
      email: string;
      organization_name: string | null;
      role_title: string | null;
      cohort: string;
      stage: string;
      payment_intent: string;
      sean_ellis_response: string;
      pilot_source: string | null;
      funding_task: string | null;
      notes: string | null;
      linked_user_id: string | null;
      linked_org_profile_id: string | null;
      created_at: string;
      updated_at: string;
      last_contact_at: string | null;
      onboarding_at: string | null;
      observed_session_at: string | null;
      closeout_at: string | null;
    }>;

    const eventsByUser = productEventRows.reduce<Record<string, Set<string>>>((acc, row: { event_type: string; user_id: string }) => {
      if (!acc[row.user_id]) acc[row.user_id] = new Set();
      acc[row.user_id].add(row.event_type);
      return acc;
    }, {});

    const pilots = pilotRows.map((pilot) => {
      const userEvents = pilot.linked_user_id ? eventsByUser[pilot.linked_user_id] : undefined;
      const activation = {
        linkedAccount: Boolean(pilot.linked_user_id),
        weeklyActive: pilot.linked_user_id ? weeklyActiveUserIds.has(pilot.linked_user_id) : false,
        profileReady: userEvents?.has('profile_ready') ?? false,
        shortlistStarted: userEvents?.has('first_grant_shortlisted') ?? false,
        pipelineStarted: userEvents?.has('pipeline_started') ?? false,
        alertCreated: userEvents?.has('first_alert_created') ?? false,
        checkoutStarted: userEvents?.has('checkout_started') ?? false,
        activated: userEvents?.has('subscription_activated') ?? false,
      };
      return {
        ...pilot,
        activation,
      };
    });

    const pilotSummary = {
      total: pilots.length,
      consultants: pilots.filter((pilot) => pilot.cohort === 'consultant').length,
      nonprofits: pilots.filter((pilot) => pilot.cohort === 'nonprofit').length,
      active: pilots.filter((pilot) => ['onboarded', 'active'].includes(pilot.stage)).length,
      completed: pilots.filter((pilot) => ['completed', 'paid', 'declined'].includes(pilot.stage)).length,
      paid: pilots.filter((pilot) => pilot.stage === 'paid').length,
      strongYes: pilots.filter((pilot) => pilot.payment_intent === 'strong_yes').length,
      conditionalYes: pilots.filter((pilot) => pilot.payment_intent === 'conditional_yes').length,
      linkedAccounts: pilots.filter((pilot) => pilot.activation.linkedAccount).length,
      profileReady: pilots.filter((pilot) => pilot.activation.profileReady).length,
      shortlistStarted: pilots.filter((pilot) => pilot.activation.shortlistStarted).length,
      pipelineStarted: pilots.filter((pilot) => pilot.activation.pipelineStarted).length,
      alertCreated: pilots.filter((pilot) => pilot.activation.alertCreated).length,
      weeklyActive: pilots.filter((pilot) => pilot.activation.weeklyActive).length,
      veryDisappointed: pilots.filter((pilot) => pilot.sean_ellis_response === 'very_disappointed').length,
      paymentSignals: PILOT_PAYMENT_INTENTS.reduce<Record<string, number>>((acc, intent) => {
        acc[intent] = pilots.filter((pilot) => pilot.payment_intent === intent).length;
        return acc;
      }, {}),
      stageCounts: PILOT_STAGES.reduce<Record<string, number>>((acc, stage) => {
        acc[stage] = pilots.filter((pilot) => pilot.stage === stage).length;
        return acc;
      }, {}),
    };

    const pilotCohorts = PILOT_COHORTS.map((cohort) => {
      const rows = pilots.filter((pilot) => pilot.cohort === cohort);
      return {
        cohort,
        ...buildPilotCohortMetrics(rows),
      };
    });

    const overallPilotMetrics = buildPilotCohortMetrics(pilots);
    const pilotBenchmarks = [
      { key: 'weeklyActiveRate', label: 'Weekly active', current: overallPilotMetrics.weeklyActiveRate, target: PILOT_THRESHOLDS.weeklyActiveRate },
      { key: 'profileReadyRate', label: 'Profile ready', current: overallPilotMetrics.profileReadyRate, target: PILOT_THRESHOLDS.profileReadyRate },
      { key: 'shortlistRate', label: 'First shortlist', current: overallPilotMetrics.shortlistRate, target: PILOT_THRESHOLDS.shortlistRate },
      { key: 'pipelineRate', label: 'Pipeline started', current: overallPilotMetrics.pipelineRate, target: PILOT_THRESHOLDS.pipelineRate },
      { key: 'alertRate', label: 'First alert created', current: overallPilotMetrics.alertRate, target: PILOT_THRESHOLDS.alertRate },
      { key: 'paymentIntentRate', label: 'Payment intent', current: overallPilotMetrics.paymentIntentRate, target: PILOT_THRESHOLDS.paymentIntentRate },
      { key: 'paidOrCommittedRate', label: 'Paid or committed', current: overallPilotMetrics.paidOrCommittedRate, target: PILOT_THRESHOLDS.paidOrCommittedRate },
      { key: 'seanEllisRate', label: 'Sean Ellis', current: overallPilotMetrics.seanEllisRate, target: PILOT_THRESHOLDS.seanEllisRate },
    ].map((metric) => ({
      ...metric,
      passing: metric.current >= metric.target,
      gap: Number((metric.current - metric.target).toFixed(1)),
    }));

    const benchmarkPassCount = pilotBenchmarks.filter((metric) => metric.passing).length;
    const consultantMetrics = pilotCohorts.find((cohort) => cohort.cohort === 'consultant') ?? null;
    const nonprofitMetrics = pilotCohorts.find((cohort) => cohort.cohort === 'nonprofit') ?? null;
    const strongerCohort = consultantMetrics && nonprofitMetrics
      ? (
        consultantMetrics.total > 0 && nonprofitMetrics.total > 0
          ? (
            consultantMetrics.paidOrCommittedRate > nonprofitMetrics.paidOrCommittedRate + 10
              ? 'consultant'
              : nonprofitMetrics.paidOrCommittedRate > consultantMetrics.paidOrCommittedRate + 10
                ? 'nonprofit'
                : null
          )
          : null
      )
      : null;

    let pilotRecommendation = 'Add pilot participants to start measuring activation and willingness to pay.';
    let pilotDecisionStatus: 'insufficient_data' | 'pass' | 'mixed' | 'failing' = 'insufficient_data';

    if (pilots.length >= 3) {
      if (benchmarkPassCount >= 6) {
        pilotDecisionStatus = 'pass';
        pilotRecommendation = 'Pilot signal is strong enough to keep selling the current wedge. Focus on converting active users to paid.';
      } else if (benchmarkPassCount >= 3) {
        pilotDecisionStatus = 'mixed';
        pilotRecommendation = 'Pilot signal is mixed. Keep testing, but prioritize the weakest activation steps before broader rollout.';
      } else {
        pilotDecisionStatus = 'failing';
        pilotRecommendation = 'Pilot signal is weak. Fix trust and activation before pushing more top-of-funnel growth.';
      }

      if (strongerCohort === 'consultant') {
        pilotRecommendation += ' Consultants currently outperform nonprofits, so they should stay the primary wedge.';
      } else if (strongerCohort === 'nonprofit') {
        pilotRecommendation += ' Nonprofit funding teams currently outperform consultants, so review the ICP focus.';
      }
    }

    const pilotAttention = pilots
      .map((pilot) => pickPilotAttention(pilot))
      .filter(Boolean)
      .sort((a, b) => {
        const severityWeight = { high: 0, medium: 1, low: 2 };
        const severityDiff = severityWeight[a!.severity as keyof typeof severityWeight] - severityWeight[b!.severity as keyof typeof severityWeight];
        if (severityDiff !== 0) return severityDiff;
        return b!.daysSinceTouch - a!.daysSinceTouch;
      })
      .slice(0, 10);

    const reviewRows = (validationReviews.data ?? []) as Array<{
      review_date: string;
      record_type: 'grant' | 'foundation';
      status: 'correct' | 'usable_but_incomplete' | 'wrong_noisy';
      issue_type: string | null;
      source: string | null;
      open_now_correct: boolean | null;
    }>;

    const recentReviewDate = reviewRows[0]?.review_date ?? null;
    const grantRows = reviewRows.filter((row) => row.record_type === 'grant');
    const foundationRows = reviewRows.filter((row) => row.record_type === 'foundation');
    const positiveGrantRows = grantRows.filter((row) => row.status !== 'wrong_noisy').length;
    const positiveFoundationRows = foundationRows.filter((row) => row.status !== 'wrong_noisy').length;
    const openNowRows = grantRows.filter((row) => row.open_now_correct !== null);
    const openNowCorrect = openNowRows.filter((row) => row.open_now_correct === true).length;

    const issueCounts = reviewRows.reduce<Record<string, number>>((acc, row) => {
      const key = row.issue_type || 'none';
      acc[key] = (acc[key] || 0) + 1;
      return acc;
    }, {});

    const sourceNoiseCounts = reviewRows
      .filter((row) => row.status === 'wrong_noisy' && row.source)
      .reduce<Record<string, number>>((acc, row) => {
        const key = row.source as string;
        acc[key] = (acc[key] || 0) + 1;
        return acc;
      }, {});

    const dataReview = {
      windowDays: 30,
      reviewCount: reviewRows.length,
      recentReviewDate,
      grantRows: grantRows.length,
      foundationRows: foundationRows.length,
      grantPrecision: rate(positiveGrantRows, grantRows.length),
      foundationPrecision: rate(positiveFoundationRows, foundationRows.length),
      openNowTrust: rate(openNowCorrect, openNowRows.length),
      topIssues: Object.entries(issueCounts)
        .sort((a, b) => b[1] - a[1])
        .slice(0, 5)
        .map(([issue, count]) => ({ issue, count })),
      noisySources: Object.entries(sourceNoiseCounts)
        .sort((a, b) => b[1] - a[1])
        .slice(0, 5)
        .map(([source, count]) => ({ source, count })),
    };

    const dataReviewBenchmarks = [
      { key: 'grantPrecision', label: 'Grant precision', current: dataReview.grantPrecision, target: DATA_REVIEW_THRESHOLDS.grantPrecision, unit: '%' },
      { key: 'foundationPrecision', label: 'Foundation precision', current: dataReview.foundationPrecision, target: DATA_REVIEW_THRESHOLDS.foundationPrecision, unit: '%' },
      { key: 'openNowTrust', label: 'Open-now trust', current: dataReview.openNowTrust, target: DATA_REVIEW_THRESHOLDS.openNowTrust, unit: '%' },
      { key: 'grantSample', label: 'Grant review sample', current: dataReview.grantRows, target: DATA_REVIEW_THRESHOLDS.grantSample, unit: 'rows' },
      { key: 'foundationSample', label: 'Foundation review sample', current: dataReview.foundationRows, target: DATA_REVIEW_THRESHOLDS.foundationSample, unit: 'rows' },
    ].map((metric) => ({
      ...metric,
      passing: metric.current >= metric.target,
      gap: Number((metric.current - metric.target).toFixed(1)),
    }));

    const dataReviewBenchmarkPassCount = dataReviewBenchmarks.filter((metric) => metric.passing).length;
    const hasFullReviewSample = dataReview.grantRows >= DATA_REVIEW_THRESHOLDS.grantSample && dataReview.foundationRows >= DATA_REVIEW_THRESHOLDS.foundationSample;
    const hasAnyReviewData = dataReview.reviewCount > 0;
    const reviewIsStale = recentReviewDate
      ? (Date.now() - new Date(recentReviewDate).getTime()) > 14 * 24 * 60 * 60 * 1000
      : true;

    let dataReviewDecisionStatus: 'insufficient_data' | 'pass' | 'mixed' | 'failing' = 'insufficient_data';
    let dataReviewRecommendation = 'Import a reviewed scorecard to measure trust before making growth decisions.';

    if (hasAnyReviewData) {
      const trustFailing = dataReview.grantPrecision < DATA_REVIEW_THRESHOLDS.grantPrecision
        || dataReview.foundationPrecision < DATA_REVIEW_THRESHOLDS.foundationPrecision
        || dataReview.openNowTrust < DATA_REVIEW_THRESHOLDS.openNowTrust;

      if (trustFailing) {
        dataReviewDecisionStatus = 'failing';
        dataReviewRecommendation = 'Trust metrics are below threshold. Pause growth work and fix the highest-noise sources before scaling.';
      } else if (!hasFullReviewSample) {
        dataReviewDecisionStatus = 'mixed';
        dataReviewRecommendation = 'Trust metrics look positive, but the review sample is still too small. Finish the full weekly sample before treating this as proven.';
      } else if (reviewIsStale) {
        dataReviewDecisionStatus = 'mixed';
        dataReviewRecommendation = 'Trust metrics are currently passing, but the latest review is stale. Run a fresh weekly review before using this as a go-to-market signal.';
      } else {
        dataReviewDecisionStatus = 'pass';
        dataReviewRecommendation = 'Trust metrics are strong enough to support continued pilot and growth work. Keep monitoring the noisy sources table weekly.';
      }
    }

    const upgradeSourceCounts = productEventRows.reduce<Record<string, { viewed: number; clicked: number; started: number; activated: number }>>((acc, row: {
      event_type: string;
      metadata: Record<string, unknown> | null;
    }) => {
      const source = typeof row.metadata?.source === 'string' && row.metadata.source.length > 0
        ? row.metadata.source
        : 'unknown';
      if (!acc[source]) acc[source] = { viewed: 0, clicked: 0, started: 0, activated: 0 };
      if (row.event_type === 'upgrade_prompt_viewed') acc[source].viewed += 1;
      if (row.event_type === 'upgrade_cta_clicked') acc[source].clicked += 1;
      if (row.event_type === 'checkout_started') acc[source].started += 1;
      if (row.event_type === 'subscription_activated') acc[source].activated += 1;
      return acc;
    }, {});

    const now = Date.now();
    const trialWindowEnd = now + 7 * 24 * 60 * 60 * 1000;
    const upcomingBillingProfiles = (billingProfiles.data ?? [])
      .filter((profile: {
        subscription_status: string | null;
        subscription_trial_end: string | null;
        subscription_cancel_at_period_end: boolean | null;
      }) => {
        const trialEnd = profile.subscription_trial_end ? new Date(profile.subscription_trial_end).getTime() : null;
        const isExpiringTrial = profile.subscription_status === 'trialing' && trialEnd !== null && trialEnd >= now && trialEnd <= trialWindowEnd;
        return isExpiringTrial || profile.subscription_cancel_at_period_end || ['past_due', 'unpaid'].includes(profile.subscription_status || '');
      })
      .slice(0, 8);

    return NextResponse.json({
      health: {
        grants: {
          total: grantsTotal.count ?? 0,
          embedded: grantsEmbedded.count ?? 0,
          enriched: grantsEnriched.count ?? 0,
          open: grantsOpen.count ?? 0,
        },
        foundations: {
          total: foundationsTotal.count ?? 0,
          profiled: foundationsProfiled.count ?? 0,
          withWebsite: foundationsWithWebsite.count ?? 0,
          programs: foundationPrograms.count ?? 0,
        },
        community: {
          orgs: communityOrgs.count ?? 0,
          acncRecords: acncDistinctAbns.count ?? 0,
        },
        socialEnterprises: {
          total: seTotal.count ?? 0,
          enriched: seEnriched.count ?? 0,
        },
        billing: {
          paidProfiles: paidProfiles.count ?? 0,
          activeTrials: activeTrials.count ?? 0,
          expiringTrials: expiringTrials.count ?? 0,
          atRisk: atRiskProfiles.count ?? 0,
          scheduledChurn: scheduledChurnProfiles.count ?? 0,
          trialStarts30d: usersByEvent.subscription_trial_started?.size ?? 0,
          remindersSent30d: usersByEvent.billing_reminder_sent?.size ?? 0,
          reminderClicks30d: usersByEvent.billing_reminder_clicked?.size ?? 0,
          portalOpens30d: usersByEvent.billing_portal_opened?.size ?? 0,
        },
      },
      dataReview,
      dataReviewBenchmarks,
      dataReviewDecision: {
        status: dataReviewDecisionStatus,
        recommendation: dataReviewRecommendation,
        benchmarkPassCount: dataReviewBenchmarkPassCount,
        benchmarkTotal: dataReviewBenchmarks.length,
        reviewIsStale,
      },
      productFunnel,
      pilotSummary,
      pilotBenchmarks,
      pilotDecision: {
        status: pilotDecisionStatus,
        recommendation: pilotRecommendation,
        benchmarkPassCount,
        benchmarkTotal: pilotBenchmarks.length,
        strongerCohort,
      },
      pilotCohorts,
      pilotAttention,
      pilots,
      upgradeSources: upgradeSourceCounts,
      upcomingBillingProfiles,
      recentRuns: recentRuns.data ?? [],
      lastUpdated: new Date().toISOString(),
    });
  } catch (err) {
    console.error('[ops]', err);
    return NextResponse.json({ error: 'Failed to load ops data' }, { status: 500 });
  }
}
