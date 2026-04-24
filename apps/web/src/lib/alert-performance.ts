export type AlertRecommendationKey =
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

export type AlertOptimizationComparison = {
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
};

export type AlertRecommendation = {
  key: AlertRecommendationKey;
  tone: 'success' | 'info' | 'warning' | 'neutral';
  title: string;
  detail: string;
};

export type AlertPerformanceEventRow = {
  alert_preference_id: number | null;
  event_type: string;
  created_at: string;
  metadata: Record<string, unknown> | null;
};

export type AttributedSavedGrantRow = {
  source_alert_preference_id: number | null;
  stage: string | null;
  created_at: string | null;
  updated_at: string | null;
  source_attributed_at: string | null;
};

type AlertPerformanceAccumulator = {
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
  lastEventAt: string | null;
  lastTrackedAt: string | null;
  lastOptimizedAt: string | null;
  lastOptimizationAction: string | null;
  opensAfterOptimization: number;
  sentAfterOptimization: number;
  clicksAfterOptimization: number;
  trackedAfterOptimization: number;
};

export type AlertPerformanceMetrics = AlertPerformanceAccumulator & {
  openRate: number | null;
  clickRate: number | null;
  trackRate: number | null;
  clickToTrackRate: number | null;
  submissionRate: number | null;
  winRate: number | null;
  optimizationComparison: AlertOptimizationComparison | null;
  recommendation: AlertRecommendation;
};

const ACTIVE_STAGES = new Set(['researching', 'pursuing', 'negotiating']);
const SUBMITTED_STAGES = new Set(['submitted']);
const WON_STAGES = new Set(['approved', 'successful', 'realized']);

function createAccumulator(): AlertPerformanceAccumulator {
  return {
    queued: 0,
    sent: 0,
    failed: 0,
    digestsSent: 0,
    opens: 0,
    clicks: 0,
    tracked: 0,
    active: 0,
    submitted: 0,
    won: 0,
    lastEventAt: null,
    lastTrackedAt: null,
    lastOptimizedAt: null,
    lastOptimizationAction: null,
    opensAfterOptimization: 0,
    sentAfterOptimization: 0,
    clicksAfterOptimization: 0,
    trackedAfterOptimization: 0,
  };
}

export function rate(numerator: number, denominator: number) {
  return denominator > 0 ? Math.round((numerator / denominator) * 100) : null;
}

export function describeOptimizationChange(comparison: AlertOptimizationComparison) {
  const parts: string[] = [];
  if (comparison.delta.clickRate != null && comparison.delta.clickRate !== 0) {
    parts.push(`click rate ${comparison.delta.clickRate > 0 ? 'up' : 'down'} ${Math.abs(comparison.delta.clickRate)} pts`);
  }
  if (comparison.delta.trackRate != null && comparison.delta.trackRate !== 0) {
    parts.push(`track rate ${comparison.delta.trackRate > 0 ? 'up' : 'down'} ${Math.abs(comparison.delta.trackRate)} pts`);
  }
  if (comparison.delta.openRate != null && comparison.delta.openRate !== 0) {
    parts.push(`open rate ${comparison.delta.openRate > 0 ? 'up' : 'down'} ${Math.abs(comparison.delta.openRate)} pts`);
  }
  return parts.slice(0, 2).join(', ');
}

export function buildAlertRecommendation(
  metrics: Pick<AlertPerformanceMetrics, 'sent' | 'opens' | 'clicks' | 'tracked' | 'submitted' | 'won'>,
  comparison: AlertOptimizationComparison | null
): AlertRecommendation {
  if (comparison?.enoughComparisonData) {
    const clickDelta = comparison.delta.clickRate ?? 0;
    const trackDelta = comparison.delta.trackRate ?? 0;
    const changeSummary = describeOptimizationChange(comparison);

    if (trackDelta >= 5 || clickDelta >= 10) {
      return {
        key: 'optimization_improving',
        tone: 'success',
        title: 'Optimization improving',
        detail: changeSummary
          ? `The last optimization is working: ${changeSummary}. Keep this version active and consider a tighter follow-on variant.`
          : 'The last optimization is improving engagement. Keep this version active and monitor submissions.',
      };
    }

    if (trackDelta <= -5 || clickDelta <= -10) {
      return {
        key: 'optimization_underperforming',
        tone: 'warning',
        title: 'Optimization underperforming',
        detail: changeSummary
          ? `The last optimization made results worse: ${changeSummary}. Pause this version or tighten the criteria again.`
          : 'The last optimization is underperforming. Pause this version or tighten the criteria again.',
      };
    }
  }

  if (metrics.won > 0) {
    return {
      key: 'keep_expand',
      tone: 'success',
      title: 'Keep and expand',
      detail: 'This alert has already produced wins. Keep it active and consider a tighter high-fit variant.',
    };
  }

  if (metrics.submitted > 0) {
    return {
      key: 'working_pipeline',
      tone: 'success',
      title: 'Working pipeline',
      detail: 'This alert is generating applications. Keep it active and watch the click-to-track rate.',
    };
  }

  if (metrics.tracked >= 3) {
    return {
      key: 'good_prospect_flow',
      tone: 'info',
      title: 'Good prospect flow',
      detail: 'People are tracking grants from this alert. Keep it active while you watch for submissions.',
    };
  }

  if (metrics.clicks >= 3 && metrics.tracked === 0) {
    return {
      key: 'clicks_not_converting',
      tone: 'warning',
      title: 'Clicks not converting',
      detail: 'Recipients are opening grant links but not tracking them. Tighten keywords, geography, or amount filters.',
    };
  }

  if (metrics.sent >= 8 && metrics.opens <= 1) {
    return {
      key: 'low_engagement',
      tone: 'warning',
      title: 'Low engagement',
      detail: 'This alert is sending often without opens. Lower frequency or rename it so it feels more distinct.',
    };
  }

  if (metrics.sent >= 8 && metrics.clicks <= 1) {
    return {
      key: 'low_fit',
      tone: 'warning',
      title: 'Low fit',
      detail: 'This alert is being delivered but rarely clicked. Tighten the criteria or pause it if it stays noisy.',
    };
  }

  if (metrics.sent === 0 && metrics.tracked === 0) {
    return {
      key: 'no_recent_activity',
      tone: 'neutral',
      title: 'No recent activity',
      detail: 'No recent sends or tracked grants in the last 30 days. Keep it active until more data accumulates.',
    };
  }

  return {
    key: 'monitor',
    tone: 'neutral',
    title: 'Monitor',
    detail: 'This alert needs a little more data before there is a strong recommendation.',
  };
}

function normalizeAccumulator(metrics: AlertPerformanceAccumulator): AlertPerformanceMetrics {
  const sentBeforeOptimization = Math.max(metrics.sent - metrics.sentAfterOptimization, 0);
  const opensBeforeOptimization = Math.max(metrics.opens - metrics.opensAfterOptimization, 0);
  const clicksBeforeOptimization = Math.max(metrics.clicks - metrics.clicksAfterOptimization, 0);
  const trackedBeforeOptimization = Math.max(metrics.tracked - metrics.trackedAfterOptimization, 0);

  const beforeOpenRate = rate(opensBeforeOptimization, sentBeforeOptimization);
  const afterOpenRate = rate(metrics.opensAfterOptimization, metrics.sentAfterOptimization);
  const beforeClickRate = rate(clicksBeforeOptimization, sentBeforeOptimization);
  const afterClickRate = rate(metrics.clicksAfterOptimization, metrics.sentAfterOptimization);
  const beforeTrackRate = rate(trackedBeforeOptimization, sentBeforeOptimization);
  const afterTrackRate = rate(metrics.trackedAfterOptimization, metrics.sentAfterOptimization);

  const hasOptimization = Boolean(metrics.lastOptimizedAt);
  const hasComparisonData = hasOptimization && (sentBeforeOptimization > 0 || metrics.sentAfterOptimization > 0);
  const enoughComparisonData = sentBeforeOptimization >= 3 && metrics.sentAfterOptimization >= 3;
  const optimizationComparison: AlertOptimizationComparison | null = hasOptimization
    ? {
      hasComparisonData,
      enoughComparisonData,
      before: {
        sent: sentBeforeOptimization,
        opens: opensBeforeOptimization,
        clicks: clicksBeforeOptimization,
        tracked: trackedBeforeOptimization,
        openRate: beforeOpenRate,
        clickRate: beforeClickRate,
        trackRate: beforeTrackRate,
      },
      after: {
        sent: metrics.sentAfterOptimization,
        opens: metrics.opensAfterOptimization,
        clicks: metrics.clicksAfterOptimization,
        tracked: metrics.trackedAfterOptimization,
        openRate: afterOpenRate,
        clickRate: afterClickRate,
        trackRate: afterTrackRate,
      },
      delta: {
        openRate:
          beforeOpenRate != null && afterOpenRate != null
            ? afterOpenRate - beforeOpenRate
            : null,
        clickRate:
          beforeClickRate != null && afterClickRate != null
            ? afterClickRate - beforeClickRate
            : null,
        trackRate:
          beforeTrackRate != null && afterTrackRate != null
            ? afterTrackRate - beforeTrackRate
            : null,
      },
    }
    : null;

  return {
    ...metrics,
    openRate: rate(metrics.opens, metrics.sent),
    clickRate: rate(metrics.clicks, metrics.sent),
    trackRate: rate(metrics.tracked, metrics.sent),
    clickToTrackRate: rate(metrics.tracked, metrics.clicks),
    submissionRate: rate(metrics.submitted, metrics.tracked),
    winRate: rate(metrics.won, metrics.submitted),
    optimizationComparison,
    recommendation: buildAlertRecommendation(metrics, optimizationComparison),
  };
}

export function createEmptyAlertPerformanceMetrics(): AlertPerformanceMetrics {
  return normalizeAccumulator(createAccumulator());
}

export function buildAlertPerformanceSnapshot({
  performanceEvents,
  attributedSavedGrants,
}: {
  performanceEvents: AlertPerformanceEventRow[];
  attributedSavedGrants: AttributedSavedGrantRow[];
}): Record<string, AlertPerformanceMetrics> {
  const alertPerformance = performanceEvents.reduce<Record<string, AlertPerformanceAccumulator>>((acc, event) => {
    if (event.alert_preference_id == null) {
      return acc;
    }

    const key = String(event.alert_preference_id);
    const existing = acc[key] || createAccumulator();

    if (event.event_type === 'notification_queued') existing.queued += 1;
    if (event.event_type === 'notification_sent') existing.sent += 1;
    if (event.event_type === 'notification_failed') existing.failed += 1;
    if (event.event_type === 'digest_sent') existing.digestsSent += 1;
    if (event.event_type === 'notification_opened' || event.event_type === 'digest_opened') existing.opens += 1;
    if (event.event_type === 'notification_clicked' || event.event_type === 'digest_clicked') existing.clicks += 1;
    if (event.event_type === 'optimization_applied') {
      if (!existing.lastOptimizedAt || event.created_at > existing.lastOptimizedAt) {
        existing.lastOptimizedAt = event.created_at;
        existing.lastOptimizationAction = typeof event.metadata?.action === 'string' ? event.metadata.action : null;
      }
    } else if (!existing.lastEventAt || event.created_at > existing.lastEventAt) {
      existing.lastEventAt = event.created_at;
    }

    acc[key] = existing;
    return acc;
  }, {});

  for (const savedGrant of attributedSavedGrants) {
    if (savedGrant.source_alert_preference_id == null) {
      continue;
    }

    const key = String(savedGrant.source_alert_preference_id);
    const existing = alertPerformance[key] || createAccumulator();

    existing.tracked += 1;
    if (savedGrant.stage && ACTIVE_STAGES.has(savedGrant.stage)) existing.active += 1;
    if (savedGrant.stage && SUBMITTED_STAGES.has(savedGrant.stage)) existing.submitted += 1;
    if (savedGrant.stage && WON_STAGES.has(savedGrant.stage)) existing.won += 1;

    const trackedAt = savedGrant.source_attributed_at || savedGrant.created_at || savedGrant.updated_at;
    if (trackedAt && (!existing.lastTrackedAt || trackedAt > existing.lastTrackedAt)) {
      existing.lastTrackedAt = trackedAt;
    }

    alertPerformance[key] = existing;
  }

  for (const event of performanceEvents) {
    if (event.alert_preference_id == null || event.event_type === 'optimization_applied') {
      continue;
    }

    const key = String(event.alert_preference_id);
    const existing = alertPerformance[key];
    if (!existing?.lastOptimizedAt || event.created_at <= existing.lastOptimizedAt) {
      continue;
    }

    if (event.event_type === 'notification_sent') existing.sentAfterOptimization += 1;
    if (event.event_type === 'notification_opened' || event.event_type === 'digest_opened') {
      existing.opensAfterOptimization += 1;
    }
    if (event.event_type === 'notification_clicked' || event.event_type === 'digest_clicked') {
      existing.clicksAfterOptimization += 1;
    }
  }

  for (const savedGrant of attributedSavedGrants) {
    if (savedGrant.source_alert_preference_id == null) {
      continue;
    }

    const key = String(savedGrant.source_alert_preference_id);
    const existing = alertPerformance[key];
    const trackedAt = savedGrant.source_attributed_at || savedGrant.created_at || savedGrant.updated_at;
    if (!existing?.lastOptimizedAt || !trackedAt || trackedAt <= existing.lastOptimizedAt) {
      continue;
    }

    existing.trackedAfterOptimization += 1;
  }

  return Object.fromEntries(
    Object.entries(alertPerformance).map(([alertId, metrics]) => [
      alertId,
      normalizeAccumulator(metrics),
    ])
  );
}
