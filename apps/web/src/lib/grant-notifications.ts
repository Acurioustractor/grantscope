import { buildAlertTrackClickUrl, buildAlertTrackOpenUrl } from '@/lib/alert-link-tracking';
import { sendEmail } from '@/lib/gmail';
import { recordAlertEvents } from '@/lib/alert-events';
import { getServiceSupabase } from '@/lib/supabase';

export const MAX_GRANT_NOTIFICATION_ATTEMPTS = 5;

type DeliverGrantNotificationsOptions = {
  limit?: number;
  userId?: string;
};

type OutboxRow = {
  id: string;
  user_id: string;
  grant_id: string;
  alert_preference_id: number | null;
  subject: string;
  body: string | null;
  match_score: number | null;
  match_signals: string[] | null;
  attempt_count: number;
};

type GrantRow = {
  id: string;
  name: string;
  provider: string | null;
  closes_at: string | null;
  url: string | null;
};

function formatNotificationDeadline(date: string | null) {
  return date ? new Date(date).toLocaleDateString('en-AU') : 'No deadline';
}

export async function deliverQueuedGrantNotifications({
  limit = 50,
  userId,
}: DeliverGrantNotificationsOptions = {}) {
  const serviceDb = getServiceSupabase();
  const requestedLimit = Math.min(Math.max(Math.floor(limit), 1), 100);

  let query = serviceDb
    .from('grant_notification_outbox')
    .select('id, user_id, grant_id, alert_preference_id, subject, body, match_score, match_signals, attempt_count')
    .eq('status', 'queued')
    .lt('attempt_count', MAX_GRANT_NOTIFICATION_ATTEMPTS)
    .order('queued_at', { ascending: true })
    .limit(requestedLimit);

  if (userId) {
    query = query.eq('user_id', userId);
  }

  const { data: queued, error } = await query;
  if (error) {
    throw new Error(error.message);
  }

  const rows = (queued || []) as OutboxRow[];
  if (rows.length === 0) {
    return { queued: 0, sent: 0, failed: 0, cancelled: 0 };
  }

  const grantIds = [...new Set(rows.map((row) => row.grant_id))];
  const { data: grants, error: grantsError } = await serviceDb
    .from('grant_opportunities')
    .select('id, name, provider, closes_at, url')
    .in('id', grantIds);

  if (grantsError) {
    throw new Error(grantsError.message);
  }

  const grantsById = new Map((grants || []).map((grant) => [grant.id, grant as GrantRow]));

  const userIds = [...new Set(rows.map((row) => row.user_id))];
  const emailMap = new Map<string, string>();

  for (const recipientUserId of userIds) {
    const { data, error: userError } = await serviceDb.auth.admin.getUserById(recipientUserId);
    if (userError) {
      throw new Error(userError.message);
    }
    if (data?.user?.email) {
      emailMap.set(recipientUserId, data.user.email);
    }
  }

  let sent = 0;
  let failed = 0;
  let cancelled = 0;
  const recordedEvents: Array<Parameters<typeof recordAlertEvents>[0][number]> = [];

  for (const row of rows) {
    const email = emailMap.get(row.user_id);
    const attemptCount = (row.attempt_count || 0) + 1;
    const attemptedAt = new Date().toISOString();

    if (!email) {
      const { error: cancelError } = await serviceDb
        .from('grant_notification_outbox')
        .update({
          status: 'cancelled',
          attempt_count: attemptCount,
          last_attempted_at: attemptedAt,
          last_error: 'No recipient email found',
        })
        .eq('id', row.id);

      if (cancelError) {
        throw new Error(cancelError.message);
      }

      cancelled++;
      recordedEvents.push({
        userId: row.user_id,
        alertPreferenceId: row.alert_preference_id,
        notificationId: row.id,
        grantId: row.grant_id,
        eventType: 'notification_cancelled',
        metadata: {
          reason: 'missing_email',
        },
      });
      continue;
    }

    try {
      const grant = grantsById.get(row.grant_id);
      const trackedGrantUrl = buildAlertTrackClickUrl({
        source: 'notification',
        notificationId: row.id,
        alertPreferenceId: row.alert_preference_id,
        grantId: row.grant_id,
        targetPath: `/grants/${row.grant_id}`,
      });
      const trackingPixelUrl = buildAlertTrackOpenUrl({
        source: 'notification',
        notificationId: row.id,
        alertPreferenceId: row.alert_preference_id,
        grantId: row.grant_id,
      });
      const body = [
        `Grant: ${grant?.name || row.subject || 'Grant match'}`,
        row.match_score != null ? `Match score: ${row.match_score}%` : null,
        row.match_signals?.length ? `Signals: ${row.match_signals.join(', ')}` : null,
        grant?.closes_at ? `Deadline: ${formatNotificationDeadline(grant.closes_at)}` : null,
        grant?.url ? `Source page: ${grant.url}` : null,
        '',
        `Open in CivicGraph: ${trackedGrantUrl}`,
      ].filter(Boolean).join('\n');
      const html = `
        <div style="max-width:640px;margin:0 auto;font-family:Helvetica,Arial,sans-serif;color:#141414;">
          <div style="background:#141414;padding:16px 20px;margin-bottom:24px;">
            <div style="color:#f2ce1e;font-weight:900;font-size:11px;letter-spacing:0.15em;text-transform:uppercase;">CivicGraph Grant Alert</div>
          </div>
          <div style="padding:0 20px 24px;">
            <div style="font-weight:900;font-size:18px;line-height:1.3;">
              <a href="${trackedGrantUrl}" style="color:#141414;text-decoration:none;">
                ${grant?.name || row.subject || 'Grant match'}
              </a>
            </div>
            <div style="font-size:12px;color:#6b6b6b;margin-top:6px;">
              ${grant?.provider || 'CivicGraph match'}
            </div>
            <div style="margin-top:16px;display:flex;gap:12px;flex-wrap:wrap;">
              ${row.match_score != null ? `<div style="border:2px solid #141414;padding:8px 10px;font-size:11px;font-weight:900;text-transform:uppercase;">${row.match_score}% match</div>` : ''}
              ${grant?.closes_at ? `<div style="border:2px solid #141414;padding:8px 10px;font-size:11px;font-weight:700;">Deadline ${formatNotificationDeadline(grant.closes_at)}</div>` : ''}
            </div>
            ${row.match_signals?.length ? `
              <div style="margin-top:16px;">
                ${row.match_signals.slice(0, 4).map((signal) => `
                  <span style="display:inline-block;margin:0 6px 6px 0;padding:4px 6px;background:#f3f4f6;color:#4b5563;font-size:10px;border-radius:4px;">
                    ${signal}
                  </span>
                `).join('')}
              </div>
            ` : ''}
            <div style="margin-top:20px;">
              <a href="${trackedGrantUrl}" style="display:inline-block;padding:10px 20px;background:#141414;color:#fff;text-decoration:none;font-weight:900;font-size:11px;text-transform:uppercase;letter-spacing:0.1em;">
                Open In CivicGraph
              </a>
            </div>
            ${grant?.url ? `
              <div style="margin-top:12px;font-size:11px;color:#6b6b6b;">
                Source page: <a href="${grant.url}" style="color:#1c47d1;">${grant.url}</a>
              </div>
            ` : ''}
          </div>
          <img src="${trackingPixelUrl}" alt="" width="1" height="1" style="display:none;width:1px;height:1px;" />
        </div>
      `;

      const result = await sendEmail({
        to: email,
        subject: `[CivicGraph] ${row.subject}`,
        body,
        html,
        senderName: 'CivicGraph Grants',
      });

      const { error: sentError } = await serviceDb
        .from('grant_notification_outbox')
        .update({
          status: 'sent',
          sent_at: attemptedAt,
          attempt_count: attemptCount,
          last_attempted_at: attemptedAt,
          last_error: null,
          external_message_id: result.id,
        })
        .eq('id', row.id);

      if (sentError) {
        throw new Error(sentError.message);
      }

      if (row.alert_preference_id) {
        const { error: alertError } = await serviceDb
          .from('alert_preferences')
          .update({
            last_sent_at: attemptedAt,
            updated_at: attemptedAt,
          })
          .eq('id', row.alert_preference_id);

        if (alertError) {
          throw new Error(alertError.message);
        }
      }

      sent++;
      recordedEvents.push({
        userId: row.user_id,
        alertPreferenceId: row.alert_preference_id,
        notificationId: row.id,
        grantId: row.grant_id,
        eventType: 'notification_sent',
        metadata: {
          attemptCount,
          scopedUser: userId || null,
        },
      });
    } catch (error) {
      const lastError = error instanceof Error ? error.message : 'Delivery failed';
      const { error: failedUpdateError } = await serviceDb
        .from('grant_notification_outbox')
        .update({
          status: attemptCount >= MAX_GRANT_NOTIFICATION_ATTEMPTS ? 'failed' : 'queued',
          attempt_count: attemptCount,
          last_attempted_at: attemptedAt,
          last_error: lastError,
        })
        .eq('id', row.id);

      if (failedUpdateError) {
        throw new Error(failedUpdateError.message);
      }

      failed++;
      recordedEvents.push({
        userId: row.user_id,
        alertPreferenceId: row.alert_preference_id,
        notificationId: row.id,
        grantId: row.grant_id,
        eventType: 'notification_failed',
        metadata: {
          attemptCount,
          error: lastError,
          scopedUser: userId || null,
        },
      });
    }
  }

  const summaryEvents = userId
    ? [{
        userId,
        eventType: 'delivery_run' as const,
        metadata: {
          scopedUser: userId,
          queued: rows.length,
          sent,
          failed,
          cancelled,
        },
      }]
    : [...new Set(rows.map((row) => row.user_id))].map((recipientUserId) => ({
        userId: recipientUserId,
        eventType: 'delivery_run' as const,
        metadata: {
          scopedUser: null,
          queued: rows.filter((row) => row.user_id === recipientUserId).length,
          sent: recordedEvents.filter((event) => event.userId === recipientUserId && event.eventType === 'notification_sent').length,
          failed: recordedEvents.filter((event) => event.userId === recipientUserId && event.eventType === 'notification_failed').length,
          cancelled: recordedEvents.filter((event) => event.userId === recipientUserId && event.eventType === 'notification_cancelled').length,
        },
      }));

  await recordAlertEvents([
    ...recordedEvents,
    ...summaryEvents,
  ]);

  return {
    queued: rows.length,
    sent,
    failed,
    cancelled,
  };
}
