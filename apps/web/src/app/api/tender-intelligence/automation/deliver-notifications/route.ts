import { createHmac } from 'node:crypto';
import { NextRequest, NextResponse } from 'next/server';
import { requireModule } from '@/lib/api-auth';
import { getServiceSupabase } from '@/lib/supabase';
import { sendEmail } from '@/lib/gmail';
import {
  getProcurementContext,
  hasNotificationAccess,
  ProcurementNotificationChannelRow,
} from '../../_lib/procurement-workspace';

type DeliveryMode = 'immediate' | 'daily_digest' | 'all';
type OutboxRow = {
  id: string;
  org_profile_id: string;
  shortlist_id: string | null;
  pack_export_id: string | null;
  task_id: string | null;
  alert_id: string | null;
  recipient_user_id: string | null;
  recipient_label: string | null;
  notification_type: 'task_due' | 'task_escalated' | 'signoff_submitted' | 'signoff_approved' | 'signoff_changes_requested';
  delivery_mode: 'immediate' | 'daily_digest';
  status: 'queued' | 'sent' | 'cancelled';
  subject: string;
  body: string | null;
  payload: Record<string, unknown> | null;
  queued_at: string;
  sent_at: string | null;
  attempt_count: number;
  last_attempted_at: string | null;
  last_error: string | null;
  external_message_id: string | null;
};

type WebhookDeliveryStats = {
  deliveredRows: number;
  deliveredAttempts: number;
  failedAttempts: number;
};

const MAX_ATTEMPTS = 5;

function isAuthorizedAutomationRequest(request: NextRequest) {
  const expectedSecret =
    process.env.CRON_SECRET
    || process.env.TENDER_INTELLIGENCE_CRON_SECRET
    || process.env.API_SECRET_KEY;
  if (!expectedSecret) return false;
  return request.headers.get('authorization') === `Bearer ${expectedSecret}`;
}

function currentBrisbaneHour() {
  return Number(new Intl.DateTimeFormat('en-AU', {
    hour: 'numeric',
    hour12: false,
    timeZone: 'Australia/Brisbane',
  }).format(new Date()));
}

function buildImmediateEmail(row: OutboxRow, orgName: string | null) {
  const intro = orgName ? `${orgName} procurement workspace` : 'CivicGraph procurement workspace';
  return {
    subject: `[CivicGraph] ${row.subject}`,
    body: [
      `Hi ${row.recipient_label || 'there'},`,
      '',
      `You have a new procurement workflow notification from ${intro}.`,
      '',
      row.subject,
      ...(row.body ? ['', row.body] : []),
      '',
      'Open Tender Intelligence to review the latest shortlist, task, or sign-off activity.',
      'https://civicgraph.au/tender-intelligence',
      '',
      'CivicGraph',
    ].join('\n'),
  };
}

function buildDigestEmail(rows: OutboxRow[], orgName: string | null, recipientLabel: string | null) {
  const heading = orgName ? `${orgName} procurement digest` : 'CivicGraph procurement digest';
  const lines = rows.flatMap((row, index) => [
    `${index + 1}. ${row.subject}`,
    ...(row.body ? [`   ${row.body}`] : []),
    `   Type: ${row.notification_type.replace(/_/g, ' ')}`,
    `   Queued: ${new Date(row.queued_at).toLocaleString('en-AU', { dateStyle: 'medium', timeStyle: 'short' })}`,
    '',
  ]);

  return {
    subject: `[CivicGraph] ${heading}`,
    body: [
      `Hi ${recipientLabel || 'there'},`,
      '',
      `Here is your latest ${heading}.`,
      '',
      ...lines,
      'Open Tender Intelligence to review the latest shortlist, task, or sign-off activity.',
      'https://civicgraph.au/tender-intelligence',
      '',
      'CivicGraph',
    ].join('\n'),
  };
}

async function getRecipientEmails(
  serviceDb: ReturnType<typeof getServiceSupabase>,
  userIds: string[],
) {
  const uniqueUserIds = [...new Set(userIds.filter(Boolean))];
  if (uniqueUserIds.length === 0) {
    return new Map<string, string | null>();
  }

  const { data: profiles, error } = await serviceDb
    .from('profiles')
    .select('id, email')
    .in('id', uniqueUserIds);

  if (error) throw error;

  const emailByUserId = new Map<string, string | null>((profiles || []).map((profile) => [profile.id, profile.email || null]));
  for (const userId of uniqueUserIds) {
    if (emailByUserId.get(userId)) continue;
    const { data } = await serviceDb.auth.admin.getUserById(userId);
    emailByUserId.set(userId, data.user?.email || null);
  }

  return emailByUserId;
}

async function updateOutboxRows(
  serviceDb: ReturnType<typeof getServiceSupabase>,
  rowIds: string[],
  updates: Partial<OutboxRow>,
) {
  if (rowIds.length === 0) return;
  const { error } = await serviceDb
    .from('procurement_notification_outbox')
    .update(updates)
    .in('id', rowIds);
  if (error) throw error;
}

function buildWebhookPayload(row: OutboxRow, orgName: string | null) {
  return {
    source: 'procurement_notifications',
    event_type: row.notification_type,
    organization: {
      id: row.org_profile_id,
      name: orgName,
    },
    notification: {
      id: row.id,
      shortlist_id: row.shortlist_id,
      pack_export_id: row.pack_export_id,
      task_id: row.task_id,
      alert_id: row.alert_id,
      recipient_user_id: row.recipient_user_id,
      recipient_label: row.recipient_label,
      delivery_mode: row.delivery_mode,
      status: row.status,
      subject: row.subject,
      body: row.body,
      payload: row.payload || {},
      queued_at: row.queued_at,
    },
  };
}

async function logWebhookDelivery(
  serviceDb: ReturnType<typeof getServiceSupabase>,
  params: {
    channelId: string;
    eventType: string;
    status: 'processed' | 'failed';
    payload: Record<string, unknown>;
    headers: Record<string, string>;
    errorMessage?: string | null;
  },
) {
  const { error } = await serviceDb
    .from('webhook_delivery_log')
    .insert({
      source: 'procurement_notifications',
      webhook_id: params.channelId,
      event_type: params.eventType,
      status: params.status,
      error_message: params.errorMessage || null,
      raw_headers: params.headers,
      raw_body: params.payload,
      retry_count: 0,
      processed_at: new Date().toISOString(),
      received_at: new Date().toISOString(),
      error: params.errorMessage || null,
    });

  if (error) {
    console.error('[procurement-webhook-log]', error.message);
  }
}

async function deliverWebhookNotifications(
  serviceDb: ReturnType<typeof getServiceSupabase>,
  rows: OutboxRow[],
  channelsByOrgId: Map<string, ProcurementNotificationChannelRow[]>,
  orgNameById: Map<string, string | null>,
) {
  const deliveredRowIds = new Set<string>();
  let deliveredAttempts = 0;
  let failedAttempts = 0;

  for (const row of rows) {
    const channels = (channelsByOrgId.get(row.org_profile_id) || []).filter((channel) => {
      if (!channel.enabled) return false;
      if (!channel.event_types || channel.event_types.length === 0) return true;
      return channel.event_types.includes(row.notification_type);
    });

    if (channels.length === 0) continue;

    const payload = buildWebhookPayload(row, orgNameById.get(row.org_profile_id) || null);
    const rawBody = JSON.stringify(payload);

    for (const channel of channels) {
      const headers: Record<string, string> = {
        'content-type': 'application/json',
        'x-civicgraph-event': row.notification_type,
        'x-civicgraph-notification-id': row.id,
        'x-civicgraph-channel-name': channel.channel_name,
      };

      if (channel.signing_secret) {
        headers['x-civicgraph-signature'] = createHmac('sha256', channel.signing_secret)
          .update(rawBody)
          .digest('hex');
      }

      try {
        const response = await fetch(channel.endpoint_url, {
          method: 'POST',
          headers,
          body: rawBody,
        });

        if (!response.ok) {
          const errorMessage = `Webhook ${channel.channel_name} returned ${response.status}`;
          await logWebhookDelivery(serviceDb, {
            channelId: channel.id,
            eventType: row.notification_type,
            status: 'failed',
            payload,
            headers,
            errorMessage,
          });
          failedAttempts += 1;
          continue;
        }

        await logWebhookDelivery(serviceDb, {
          channelId: channel.id,
          eventType: row.notification_type,
          status: 'processed',
          payload,
          headers,
        });
        deliveredRowIds.add(row.id);
        deliveredAttempts += 1;
      } catch (error) {
        await logWebhookDelivery(serviceDb, {
          channelId: channel.id,
          eventType: row.notification_type,
          status: 'failed',
          payload,
          headers,
          errorMessage: error instanceof Error ? error.message : 'Webhook delivery failed',
        });
        failedAttempts += 1;
      }
    }
  }

  if (deliveredRowIds.size > 0) {
    await updateOutboxRows(serviceDb, [...deliveredRowIds], {
      status: 'sent',
      sent_at: new Date().toISOString(),
      last_error: null,
    });
  }

  return {
    deliveredRows: deliveredRowIds.size,
    deliveredAttempts,
    failedAttempts,
  } satisfies WebhookDeliveryStats;
}

async function deliverImmediateNotifications(
  serviceDb: ReturnType<typeof getServiceSupabase>,
  rows: OutboxRow[],
  orgNameById: Map<string, string | null>,
) {
  let sent = 0;
  let cancelled = 0;
  let failed = 0;

  const emailByUserId = await getRecipientEmails(
    serviceDb,
    rows.map((row) => row.recipient_user_id).filter((value): value is string => !!value),
  );

  for (const row of rows) {
    const attemptedAt = new Date().toISOString();
    const nextAttemptCount = (row.attempt_count || 0) + 1;
    const recipientEmail = row.recipient_user_id ? emailByUserId.get(row.recipient_user_id) || null : null;
    if (!recipientEmail) {
      await updateOutboxRows(serviceDb, [row.id], {
        status: 'cancelled',
        attempt_count: nextAttemptCount,
        last_attempted_at: attemptedAt,
        last_error: 'No recipient email found',
      });
      cancelled += 1;
      continue;
    }

    try {
      const email = buildImmediateEmail(row, orgNameById.get(row.org_profile_id) || null);
      const result = await sendEmail({
        to: recipientEmail,
        subject: email.subject,
        body: email.body,
        senderName: 'CivicGraph Procurement',
      });
      await updateOutboxRows(serviceDb, [row.id], {
        status: 'sent',
        sent_at: attemptedAt,
        attempt_count: nextAttemptCount,
        last_attempted_at: attemptedAt,
        last_error: null,
        external_message_id: result.id,
      });
      sent += 1;
    } catch (error) {
      await updateOutboxRows(serviceDb, [row.id], {
        status: nextAttemptCount >= MAX_ATTEMPTS ? 'cancelled' : 'queued',
        attempt_count: nextAttemptCount,
        last_attempted_at: attemptedAt,
        last_error: error instanceof Error ? error.message : 'Notification delivery failed',
      });
      failed += 1;
    }
  }

  return { sent, cancelled, failed };
}

async function deliverDigestNotifications(
  serviceDb: ReturnType<typeof getServiceSupabase>,
  rows: OutboxRow[],
  orgNameById: Map<string, string | null>,
) {
  let sent = 0;
  let cancelled = 0;
  let failed = 0;
  const missingRecipientRows = rows.filter((row) => !row.recipient_user_id);
  if (missingRecipientRows.length > 0) {
    await Promise.all(
      missingRecipientRows.map((row) => updateOutboxRows(serviceDb, [row.id], {
        status: 'cancelled',
        last_attempted_at: new Date().toISOString(),
        last_error: 'No recipient user found',
        attempt_count: (row.attempt_count || 0) + 1,
      })),
    );
    cancelled += missingRecipientRows.length;
  }

  const grouped = new Map<string, OutboxRow[]>();
  for (const row of rows) {
    if (!row.recipient_user_id) continue;
    const key = `${row.org_profile_id}:${row.recipient_user_id}`;
    const existing = grouped.get(key) || [];
    existing.push(row);
    grouped.set(key, existing);
  }

  const emailByUserId = await getRecipientEmails(
    serviceDb,
    [...grouped.values()].flatMap((group) => group.map((row) => row.recipient_user_id).filter((value): value is string => !!value)),
  );

  for (const group of grouped.values()) {
    const attemptedAt = new Date().toISOString();
    const recipientUserId = group[0]?.recipient_user_id;
    const recipientEmail = recipientUserId ? emailByUserId.get(recipientUserId) || null : null;
    const rowIds = group.map((row) => row.id);
    const attemptCount = Math.max(...group.map((row) => row.attempt_count || 0)) + 1;

    if (!recipientEmail) {
      await updateOutboxRows(serviceDb, rowIds, {
        status: 'cancelled',
        attempt_count: attemptCount,
        last_attempted_at: attemptedAt,
        last_error: 'No recipient email found',
      });
      cancelled += rowIds.length;
      continue;
    }

    try {
      const email = buildDigestEmail(
        group,
        orgNameById.get(group[0].org_profile_id) || null,
        group[0].recipient_label || null,
      );
      const result = await sendEmail({
        to: recipientEmail,
        subject: email.subject,
        body: email.body,
        senderName: 'CivicGraph Procurement',
      });
      await updateOutboxRows(serviceDb, rowIds, {
        status: 'sent',
        sent_at: attemptedAt,
        attempt_count: attemptCount,
        last_attempted_at: attemptedAt,
        last_error: null,
        external_message_id: result.id,
      });
      sent += rowIds.length;
    } catch (error) {
      await updateOutboxRows(serviceDb, rowIds, {
        status: attemptCount >= MAX_ATTEMPTS ? 'cancelled' : 'queued',
        attempt_count: attemptCount,
        last_attempted_at: attemptedAt,
        last_error: error instanceof Error ? error.message : 'Digest delivery failed',
      });
      failed += rowIds.length;
    }
  }

  return { sent, cancelled, failed };
}

async function runDelivery(mode: DeliveryMode, orgProfileId?: string | null) {
  const serviceDb = getServiceSupabase();
  let queuedQuery = serviceDb
    .from('procurement_notification_outbox')
    .select('id, org_profile_id, shortlist_id, pack_export_id, task_id, alert_id, recipient_user_id, recipient_label, notification_type, delivery_mode, status, subject, body, payload, queued_at, sent_at, attempt_count, last_attempted_at, last_error, external_message_id')
    .eq('status', 'queued')
    .lt('attempt_count', MAX_ATTEMPTS)
    .order('queued_at', { ascending: true })
    .limit(200);

  if (orgProfileId) {
    queuedQuery = queuedQuery.eq('org_profile_id', orgProfileId);
  }

  const { data: queuedRows, error } = await queuedQuery;

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  const rows = (queuedRows || []) as OutboxRow[];
  const deliveryRows = rows.filter((row) => mode === 'all' || row.delivery_mode === mode);
  const orgIds = [...new Set(deliveryRows.map((row) => row.org_profile_id))];
  const { data: orgProfiles, error: orgError } = orgIds.length > 0
    ? await serviceDb.from('org_profiles').select('id, name').in('id', orgIds)
    : { data: [], error: null };

  if (orgError) {
    return NextResponse.json({ error: orgError.message }, { status: 500 });
  }

  const orgNameById = new Map((orgProfiles || []).map((profile) => [profile.id, profile.name || null]));
  const { data: webhookChannels, error: webhookChannelsError } = orgIds.length > 0
    ? await serviceDb
        .from('procurement_notification_channels')
        .select('id, org_profile_id, channel_name, channel_type, endpoint_url, signing_secret, enabled, event_types, verification_token, verification_status, last_tested_at, last_test_error, created_at, updated_at')
        .in('org_profile_id', orgIds)
        .eq('enabled', true)
    : { data: [], error: null };

  if (webhookChannelsError) {
    return NextResponse.json({ error: webhookChannelsError.message }, { status: 500 });
  }

  const channelsByOrgId = new Map<string, ProcurementNotificationChannelRow[]>();
  for (const channel of (webhookChannels || []) as ProcurementNotificationChannelRow[]) {
    const existing = channelsByOrgId.get(channel.org_profile_id) || [];
    existing.push(channel);
    channelsByOrgId.set(channel.org_profile_id, existing);
  }

  const emailEnabled = !!process.env.GOOGLE_SERVICE_ACCOUNT_KEY && !!process.env.GOOGLE_DELEGATED_USER;
  const webhookEnabled = (webhookChannels || []).length > 0;
  if (!emailEnabled && !webhookEnabled) {
    return NextResponse.json(
      { error: 'Outbound delivery is not configured on this environment.' },
      { status: 503 },
    );
  }

  const immediateRows = deliveryRows.filter((row) => row.delivery_mode === 'immediate');
  const digestRows = deliveryRows.filter((row) => row.delivery_mode === 'daily_digest');

  const immediate = emailEnabled
    ? await deliverImmediateNotifications(serviceDb, immediateRows, orgNameById)
    : { sent: 0, cancelled: 0, failed: 0 };
  const digest = emailEnabled
    ? await deliverDigestNotifications(serviceDb, digestRows, orgNameById)
    : { sent: 0, cancelled: 0, failed: 0 };
  const webhook = webhookEnabled
    ? await deliverWebhookNotifications(serviceDb, deliveryRows, channelsByOrgId, orgNameById)
    : { deliveredRows: 0, deliveredAttempts: 0, failedAttempts: 0 };

  const { data: finalRows, error: finalRowsError } = deliveryRows.length > 0
    ? await serviceDb
        .from('procurement_notification_outbox')
        .select('id, status')
        .in('id', deliveryRows.map((row) => row.id))
    : { data: [], error: null };

  if (finalRowsError) {
    return NextResponse.json({ error: finalRowsError.message }, { status: 500 });
  }

  const finalSent = (finalRows || []).filter((row) => row.status === 'sent').length;
  const finalCancelled = (finalRows || []).filter((row) => row.status === 'cancelled').length;
  const finalQueued = Math.max(deliveryRows.length - finalSent - finalCancelled, 0);

  return NextResponse.json({
    mode,
    queued: deliveryRows.length,
    sent: finalSent,
    cancelled: finalCancelled,
    failed: finalQueued,
    immediate,
    dailyDigest: digest,
    webhook,
  });
}

export async function GET(request: NextRequest) {
  if (!isAuthorizedAutomationRequest(request)) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const mode: DeliveryMode = currentBrisbaneHour() === 7 ? 'all' : 'immediate';
  return runDelivery(mode);
}

export async function POST(request: NextRequest) {
  const isAutomationTrigger = isAuthorizedAutomationRequest(request);
  let orgProfileId: string | null | undefined;
  if (!isAutomationTrigger) {
    const auth = await requireModule('procurement');
    if (auth.error) return auth.error;
    const serviceDb = getServiceSupabase();
    const context = await getProcurementContext(serviceDb, auth.user.id);
    if (!context.orgProfileId) {
      return NextResponse.json({ error: 'No procurement workspace found.' }, { status: 404 });
    }
    if (!hasNotificationAccess(context.currentUserPermissions)) {
      return NextResponse.json({ error: 'Only procurement leads can send outbound notifications manually.' }, { status: 403 });
    }
    orgProfileId = context.orgProfileId;
  }

  const body = await request.json().catch(() => ({}));
  const mode: DeliveryMode =
    body?.mode === 'immediate' || body?.mode === 'daily_digest' || body?.mode === 'all'
      ? body.mode
      : 'all';

  return runDelivery(mode, orgProfileId);
}
