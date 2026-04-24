import {
  buildAlertPerformanceSnapshot,
  createEmptyAlertPerformanceMetrics,
  type AlertPerformanceEventRow,
  type AttributedSavedGrantRow,
} from '@/lib/alert-performance';
import { buildAlertTrackClickUrl, buildAlertTrackOpenUrl } from '@/lib/alert-link-tracking';
import { sendEmail } from '@/lib/gmail';
import { recordAlertEvents } from '@/lib/alert-events';
import { getAlertEntitlements, resolveSubscriptionTier } from '@/lib/subscription';
import { getServiceSupabase } from '@/lib/supabase';

type DigestOptions = {
  userId?: string;
  dryRun?: boolean;
  force?: boolean;
};

type OrgProfileRow = {
  id: string;
  user_id: string;
  name: string | null;
  notify_email: boolean | null;
  subscription_plan: string | null;
};

type AlertRow = {
  id: number;
  name: string;
  frequency: 'daily' | 'weekly' | 'monthly';
  enabled: boolean;
};

type OutboxRow = {
  id: string;
  grant_id: string;
  alert_preference_id: number | null;
  status: string;
  subject: string | null;
  match_score: number | null;
  match_signals: string[] | null;
  created_at: string;
  queued_at: string;
  sent_at: string | null;
  last_error: string | null;
};

type GrantRow = {
  id: string;
  name: string;
  provider: string | null;
  closes_at: string | null;
};

type DigestAlertInsight = {
  alertName: string;
  recommendationTitle: string;
  recommendationDetail: string;
  frequency: 'daily' | 'weekly' | 'monthly';
};

export type GrantAlertDigestResult = {
  profilesConsidered: number;
  profilesEligible: number;
  digestsSent: number;
  alertsIncluded: number;
  grantsIncluded: number;
  skippedNoProfile: number;
  skippedTier: number;
  skippedNoAlerts: number;
  skippedNoChanges: number;
  dryRun: boolean;
};

function fmtDate(date: string | null) {
  return date ? new Date(date).toLocaleDateString('en-AU') : 'No deadline';
}

function timeAgo(date: string) {
  const diff = Date.now() - new Date(date).getTime();
  const days = Math.floor(diff / (1000 * 60 * 60 * 24));
  if (days <= 0) return 'today';
  if (days === 1) return '1 day ago';
  return `${days} days ago`;
}

function escapeHtml(value: string) {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}

function buildDigestEmail({
  profileName,
  items,
  alertInsights,
  periodStart,
  periodEnd,
  trackingPixels,
}: {
  profileName: string;
  items: Array<{
    grantName: string;
    provider: string | null;
    alertName: string | null;
    alertId: number | null;
    score: number | null;
    signals: string[];
    closesAt: string | null;
    createdAt: string;
    status: string;
    grantId: string;
    trackedGrantUrl: string;
  }>;
  alertInsights: DigestAlertInsight[];
  periodStart: string;
  periodEnd: string;
  trackingPixels: string[];
}) {
  const itemHtml = items.slice(0, 12).map((item) => `
    <div style="border:2px solid #141414;padding:12px;margin-bottom:12px;">
      <div style="display:flex;justify-content:space-between;gap:12px;align-items:flex-start;">
        <div>
          <div style="font-weight:900;font-size:14px;line-height:1.3;">
            <a href="${item.trackedGrantUrl}" style="color:#141414;text-decoration:none;">
              ${escapeHtml(item.grantName)}
            </a>
          </div>
          <div style="font-size:11px;color:#6b6b6b;margin-top:4px;">
            ${escapeHtml(item.alertName || 'Grant match')}
            ${item.provider ? ` · ${escapeHtml(item.provider)}` : ''}
          </div>
        </div>
        ${item.score != null ? `
          <div style="background:#1c47d1;color:#fff;padding:4px 8px;font-size:10px;font-weight:900;letter-spacing:0.1em;text-transform:uppercase;">
            ${item.score}% match
          </div>
        ` : ''}
      </div>
      ${item.signals.length > 0 ? `
        <div style="margin-top:8px;">
          ${item.signals.slice(0, 4).map((signal) => `
            <span style="display:inline-block;margin:0 6px 6px 0;padding:4px 6px;background:#f3f4f6;color:#4b5563;font-size:10px;border-radius:4px;">
              ${escapeHtml(signal)}
            </span>
          `).join('')}
        </div>
      ` : ''}
      <div style="margin-top:8px;font-size:11px;color:#6b6b6b;">
        Deadline: ${escapeHtml(fmtDate(item.closesAt))} · Added ${escapeHtml(timeAgo(item.createdAt))} · Queue status: ${escapeHtml(item.status)}
      </div>
    </div>
  `).join('');

  const alertInsightHtml = alertInsights.length > 0
    ? `
      <div style="margin-bottom:20px;">
        <div style="font-size:10px;font-weight:900;letter-spacing:0.1em;text-transform:uppercase;color:#6b6b6b;margin-bottom:10px;">
          Alert Watch
        </div>
        ${alertInsights.map((insight) => `
          <div style="border-left:4px solid #141414;padding:8px 0 8px 12px;margin-bottom:10px;">
            <div style="font-size:13px;font-weight:800;">
              ${escapeHtml(insight.alertName)} · ${escapeHtml(insight.recommendationTitle)}
            </div>
            <div style="font-size:11px;color:#6b6b6b;margin-top:4px;">
              ${escapeHtml(insight.recommendationDetail)}
            </div>
          </div>
        `).join('')}
      </div>
    `
    : '';

  const body = [
    `Weekly grant digest for ${profileName}`,
    '',
    `${items.length} grant match${items.length === 1 ? '' : 'es'} changed between ${new Date(periodStart).toLocaleDateString('en-AU')} and ${new Date(periodEnd).toLocaleDateString('en-AU')}.`,
    ...(alertInsights.length > 0
      ? [
        '',
        'Alert watch:',
        ...alertInsights.map((insight) => `- ${insight.alertName} — ${insight.recommendationTitle}. ${insight.recommendationDetail}`),
      ]
      : []),
    '',
    ...items.slice(0, 12).flatMap((item, index) => ([
      `${index + 1}. ${item.grantName}${item.provider ? ` — ${item.provider}` : ''}${item.score != null ? ` (${item.score}% match)` : ''}`,
      `   Open: ${item.trackedGrantUrl}`,
    ])),
    '',
    'Open CivicGraph to review the full alert queue and tracker.',
  ].join('\n');

  const html = `
    <div style="max-width:640px;margin:0 auto;font-family:Helvetica,Arial,sans-serif;color:#141414;">
      <div style="background:#141414;padding:16px 20px;margin-bottom:24px;">
        <div style="color:#f2ce1e;font-weight:900;font-size:11px;letter-spacing:0.15em;text-transform:uppercase;">CivicGraph Weekly Grant Digest</div>
      </div>
      <div style="padding:0 20px 24px;">
        <p style="font-size:14px;margin-bottom:8px;">Hi ${escapeHtml(profileName)},</p>
        <p style="font-size:14px;margin-bottom:20px;">
          Here are the grant matches that changed across your weekly alerts this week.
        </p>
        <div style="display:flex;gap:12px;flex-wrap:wrap;margin-bottom:20px;">
          <div style="border:2px solid #141414;padding:10px 12px;min-width:160px;">
            <div style="font-size:10px;font-weight:900;letter-spacing:0.1em;text-transform:uppercase;color:#6b6b6b;">Matches In Digest</div>
            <div style="font-size:28px;font-weight:900;margin-top:4px;">${items.length}</div>
          </div>
          <div style="border:2px solid #141414;padding:10px 12px;min-width:160px;">
            <div style="font-size:10px;font-weight:900;letter-spacing:0.1em;text-transform:uppercase;color:#6b6b6b;">Period</div>
            <div style="font-size:13px;font-weight:700;margin-top:6px;">
              ${escapeHtml(new Date(periodStart).toLocaleDateString('en-AU'))} - ${escapeHtml(new Date(periodEnd).toLocaleDateString('en-AU'))}
            </div>
          </div>
        </div>
        ${alertInsightHtml}
        ${itemHtml}
        <div style="margin-top:24px;padding-top:16px;border-top:3px solid #141414;">
          <a href="https://civicgraph.au/alerts" style="display:inline-block;padding:10px 20px;background:#141414;color:#fff;text-decoration:none;font-weight:900;font-size:11px;text-transform:uppercase;letter-spacing:0.1em;">
            Open Grant Alerts
          </a>
        </div>
      </div>
      ${trackingPixels.map((src) => `<img src="${src}" alt="" width="1" height="1" style="display:none;width:1px;height:1px;" />`).join('')}
    </div>
  `;

  return {
    subject: `CivicGraph Weekly Grant Digest — ${items.length} match${items.length === 1 ? '' : 'es'}`,
    body,
    html,
  };
}

export async function sendGrantAlertDigests({
  userId,
  dryRun = false,
  force = false,
}: DigestOptions = {}): Promise<GrantAlertDigestResult> {
  const db = getServiceSupabase();
  let profileQuery = db
    .from('org_profiles')
    .select('id, user_id, name, notify_email, subscription_plan');

  if (userId) {
    profileQuery = profileQuery.eq('user_id', userId);
  } else {
    profileQuery = profileQuery.eq('notify_email', true);
  }

  const { data: profiles, error: profileError } = await profileQuery;
  if (profileError) {
    throw new Error(profileError.message);
  }

  if (!profiles?.length) {
    return {
      profilesConsidered: 0,
      profilesEligible: 0,
      digestsSent: 0,
      alertsIncluded: 0,
      grantsIncluded: 0,
      skippedNoProfile: 0,
      skippedTier: 0,
      skippedNoAlerts: 0,
      skippedNoChanges: 0,
      dryRun,
    };
  }

  const periodEnd = new Date().toISOString();
  const periodStart = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString();
  const performanceWindowStart = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString();

  let profilesEligible = 0;
  let digestsSent = 0;
  let alertsIncluded = 0;
  let grantsIncluded = 0;
  let skippedTier = 0;
  let skippedNoAlerts = 0;
  let skippedNoChanges = 0;

  for (const profile of profiles as OrgProfileRow[]) {
    const tier = resolveSubscriptionTier(profile.subscription_plan);
    const entitlements = getAlertEntitlements(tier);

    if (!entitlements.weeklyDigest) {
      skippedTier++;
      continue;
    }

    const { data: alerts, error: alertsError } = await db
      .from('alert_preferences')
      .select('id, name, frequency, enabled')
      .eq('user_id', profile.user_id)
      .eq('enabled', true)
      .eq('frequency', 'weekly');

    if (alertsError) {
      throw new Error(alertsError.message);
    }

    if (!alerts?.length) {
      skippedNoAlerts++;
      continue;
    }

    const weeklyAlerts = alerts as AlertRow[];
    const alertIds = weeklyAlerts.map((alert) => alert.id);
    profilesEligible++;

    const { data: recentDigestRows, error: recentDigestError } = await db
      .from('alert_notifications')
      .select('alert_id, sent_at, email_status')
      .in('alert_id', alertIds)
      .gte('sent_at', periodStart);

    if (recentDigestError) {
      throw new Error(recentDigestError.message);
    }

    const sentThisWeek = new Set(
      (recentDigestRows || [])
        .filter((row: { email_status: string }) => row.email_status === 'sent')
        .map((row: { alert_id: number | null }) => row.alert_id)
        .filter((value): value is number => typeof value === 'number')
    );

    const dueAlerts = force
      ? weeklyAlerts
      : weeklyAlerts.filter((alert) => !sentThisWeek.has(alert.id));

    if (dueAlerts.length === 0) {
      continue;
    }

    const dueAlertIds = dueAlerts.map((alert) => alert.id);

    const [
      { data: performanceEvents, error: performanceEventsError },
      { data: attributedSavedGrants, error: attributedSavedGrantsError },
    ] = await Promise.all([
      db.from('alert_events')
        .select('alert_preference_id, event_type, created_at, metadata')
        .eq('user_id', profile.user_id)
        .in('alert_preference_id', dueAlertIds)
        .gte('created_at', performanceWindowStart)
        .order('created_at', { ascending: false })
        .limit(500),
      db.from('saved_grants')
        .select('source_alert_preference_id, stage, created_at, updated_at, source_attributed_at')
        .eq('user_id', profile.user_id)
        .in('source_alert_preference_id', dueAlertIds),
    ]);

    if (performanceEventsError) {
      throw new Error(performanceEventsError.message);
    }

    if (attributedSavedGrantsError) {
      throw new Error(attributedSavedGrantsError.message);
    }

    const alertPerformance = buildAlertPerformanceSnapshot({
      performanceEvents: (performanceEvents || []) as AlertPerformanceEventRow[],
      attributedSavedGrants: (attributedSavedGrants || []) as AttributedSavedGrantRow[],
    });

    const { data: outboxRows, error: outboxError } = await db
      .from('grant_notification_outbox')
      .select('id, grant_id, alert_preference_id, status, subject, match_score, match_signals, created_at, queued_at, sent_at, last_error')
      .eq('user_id', profile.user_id)
      .gte('created_at', periodStart)
      .order('created_at', { ascending: false })
      .limit(100);

    if (outboxError) {
      throw new Error(outboxError.message);
    }

    const rows = ((outboxRows || []) as OutboxRow[]).filter((row) =>
      row.alert_preference_id == null || dueAlertIds.includes(row.alert_preference_id)
    );

    if (rows.length === 0) {
      skippedNoChanges++;
      continue;
    }

    const grantIds = [...new Set(rows.map((row) => row.grant_id))];
    const { data: grants, error: grantsError } = await db
      .from('grant_opportunities')
      .select('id, name, provider, closes_at')
      .in('id', grantIds);

    if (grantsError) {
      throw new Error(grantsError.message);
    }

    const grantMap = new Map((grants || []).map((grant) => [grant.id, grant as GrantRow]));
    const alertMap = new Map(dueAlerts.map((alert) => [alert.id, alert]));
    const recommendationPriority = (title: string) => {
      switch (title) {
        case 'Optimization underperforming':
        case 'Low engagement':
        case 'Low fit':
        case 'Clicks not converting':
          return 0;
        case 'Optimization improving':
        case 'Keep and expand':
        case 'Working pipeline':
        case 'Good prospect flow':
          return 1;
        default:
          return 2;
      }
    };

    const items = rows.map((row) => {
      const grant = grantMap.get(row.grant_id);
      const alert = row.alert_preference_id ? alertMap.get(row.alert_preference_id) : null;
      return {
        grantName: grant?.name || row.subject || 'Grant match',
        provider: grant?.provider || null,
        alertName: alert?.name || null,
        alertId: alert?.id ?? row.alert_preference_id ?? null,
        score: row.match_score,
        signals: row.match_signals || [],
        closesAt: grant?.closes_at || null,
        createdAt: row.created_at,
        status: row.status,
        grantId: row.grant_id,
        trackedGrantUrl: buildAlertTrackClickUrl({
          source: 'digest',
          userId: profile.user_id,
          alertPreferenceId: alert?.id ?? row.alert_preference_id ?? null,
          grantId: row.grant_id,
          targetPath: `/grants/${row.grant_id}`,
        }),
      };
    });

    const alertInsights = dueAlerts
      .map((alert) => {
        const metrics = alertPerformance[String(alert.id)] || createEmptyAlertPerformanceMetrics();
        return {
          alertName: alert.name,
          recommendationTitle: metrics.recommendation.title,
          recommendationDetail: metrics.recommendation.detail,
          frequency: alert.frequency,
        };
      })
      .sort((a, b) => {
        const priorityDelta = recommendationPriority(a.recommendationTitle) - recommendationPriority(b.recommendationTitle);
        if (priorityDelta !== 0) return priorityDelta;
        return a.alertName.localeCompare(b.alertName);
      })
      .slice(0, 3);

    const digestEmail = buildDigestEmail({
      profileName: profile.name || 'there',
      items,
      alertInsights,
      periodStart,
      periodEnd,
      trackingPixels: [...new Set(dueAlerts.map((alert) => buildAlertTrackOpenUrl({
        source: 'digest',
        userId: profile.user_id,
        alertPreferenceId: alert.id,
      })))],
    });

    const digestSentAt = new Date().toISOString();

    if (!dryRun) {
      const { data: authUser, error: authUserError } = await db.auth.admin.getUserById(profile.user_id);
      if (authUserError) {
        throw new Error(authUserError.message);
      }

      const recipientEmail = authUser.user?.email;
      if (!recipientEmail) {
        skippedNoChanges++;
        continue;
      }

      try {
        await sendEmail({
          to: recipientEmail,
          subject: digestEmail.subject,
          body: digestEmail.body,
          html: digestEmail.html,
          senderName: 'CivicGraph Alerts',
        });

        const alertNotificationRows = dueAlerts.map((alert) => ({
          user_id: profile.user_id,
          alert_id: alert.id,
          grant_ids: items
            .filter((item) => item.alertName === alert.name)
            .map((item) => item.grantId),
          match_count: items.filter((item) => item.alertName === alert.name).length,
          sent_at: digestSentAt,
          email_status: 'sent',
        }));

        if (alertNotificationRows.length > 0) {
          const { error: notificationLogError } = await db
            .from('alert_notifications')
            .insert(alertNotificationRows);

          if (notificationLogError) {
            throw new Error(notificationLogError.message);
          }
        }

        const { error: alertUpdateError } = await db
          .from('alert_preferences')
          .update({
            last_sent_at: digestSentAt,
            updated_at: digestSentAt,
          })
          .in('id', dueAlertIds);

        if (alertUpdateError) {
          throw new Error(alertUpdateError.message);
        }

        await recordAlertEvents(dueAlerts.map((alert) => ({
          userId: profile.user_id,
          alertPreferenceId: alert.id,
          eventType: 'digest_sent',
          metadata: {
            tier,
            grantCount: items.filter((item) => item.alertName === alert.name).length,
            periodStart,
            periodEnd,
          },
        })));
      } catch (error) {
        const digestError = error instanceof Error ? error.message : 'Digest delivery failed';

        await db
          .from('alert_notifications')
          .insert(dueAlerts.map((alert) => ({
            user_id: profile.user_id,
            alert_id: alert.id,
            grant_ids: [],
            match_count: 0,
            sent_at: digestSentAt,
            email_status: 'failed',
          })));

        await recordAlertEvents(dueAlerts.map((alert) => ({
          userId: profile.user_id,
          alertPreferenceId: alert.id,
          eventType: 'digest_failed',
          metadata: {
            tier,
            periodStart,
            periodEnd,
            error: digestError,
          },
        })));

        throw error;
      }
    }

    digestsSent++;
    alertsIncluded += dueAlerts.length;
    grantsIncluded += items.length;
  }

  return {
    profilesConsidered: profiles.length,
    profilesEligible,
    digestsSent,
    alertsIncluded,
    grantsIncluded,
    skippedNoProfile: 0,
    skippedTier,
    skippedNoAlerts,
    skippedNoChanges,
    dryRun,
  };
}
