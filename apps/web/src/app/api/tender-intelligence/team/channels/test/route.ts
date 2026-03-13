import { createHmac } from 'node:crypto';
import { NextRequest, NextResponse } from 'next/server';
import { requireModule } from '@/lib/api-auth';
import { getServiceSupabase } from '@/lib/supabase';
import {
  getProcurementContext,
  hasGovernanceAdminAccess,
  hasNotificationAccess,
} from '../../../_lib/procurement-workspace';

function buildTestPayload(params: {
  orgProfileId: string;
  orgName: string | null;
  channelId: string;
  eventType: string;
}) {
  return {
    source: 'procurement_notifications_test',
    event_type: params.eventType,
    organization: {
      id: params.orgProfileId,
      name: params.orgName,
    },
    notification: {
      id: `test:${params.channelId}`,
      shortlist_id: null,
      pack_export_id: null,
      task_id: null,
      alert_id: null,
      recipient_user_id: null,
      recipient_label: 'Webhook test',
      delivery_mode: 'immediate',
      status: 'queued',
      subject: 'CivicGraph outbound webhook test',
      body: 'This is a test event from Tender Intelligence webhook delivery.',
      payload: {
        test: true,
      },
      queued_at: new Date().toISOString(),
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
      source: 'procurement_notifications_test',
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
    console.error('[procurement-webhook-test-log]', error.message);
  }
}

export async function POST(request: NextRequest) {
  const auth = await requireModule('procurement');
  if (auth.error) return auth.error;
  const { user } = auth;

  const body = await request.json();
  const channelId = typeof body?.channelId === 'string' ? body.channelId : '';
  if (!channelId) {
    return NextResponse.json({ error: 'channelId is required' }, { status: 400 });
  }

  const serviceDb = getServiceSupabase();
  const context = await getProcurementContext(serviceDb, user.id);
  if (!context.orgProfileId) {
    return NextResponse.json({ error: 'No procurement workspace found.' }, { status: 404 });
  }
  if (!hasNotificationAccess(context.currentUserPermissions) && !hasGovernanceAdminAccess(context.currentUserPermissions)) {
    return NextResponse.json({ error: 'You do not have permission to send outbound tests.' }, { status: 403 });
  }

  const { data: channel, error: channelError } = await serviceDb
    .from('procurement_notification_channels')
    .select('id, channel_name, endpoint_url, signing_secret, enabled, event_types')
    .eq('org_profile_id', context.orgProfileId)
    .eq('id', channelId)
    .maybeSingle();

  if (channelError) {
    return NextResponse.json({ error: channelError.message }, { status: 500 });
  }
  if (!channel) {
    return NextResponse.json({ error: 'Notification channel not found.' }, { status: 404 });
  }

  const eventType = Array.isArray(channel.event_types) && channel.event_types.length > 0
    ? String(channel.event_types[0])
    : 'signoff_submitted';

  const payload = buildTestPayload({
    orgProfileId: context.orgProfileId,
    orgName: context.profile?.name || null,
    channelId: channel.id,
    eventType,
  });
  const rawBody = JSON.stringify(payload);
  const headers: Record<string, string> = {
    'content-type': 'application/json',
    'x-civicgraph-event': eventType,
    'x-civicgraph-notification-id': `test:${channel.id}`,
    'x-civicgraph-channel-name': channel.channel_name,
    'x-civicgraph-test': 'true',
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
        eventType,
        status: 'failed',
        payload,
        headers,
        errorMessage,
      });
      await serviceDb
        .from('procurement_notification_channels')
        .update({
          verification_status: 'failed',
          last_tested_at: new Date().toISOString(),
          last_test_error: errorMessage,
        })
        .eq('org_profile_id', context.orgProfileId)
        .eq('id', channel.id);
      return NextResponse.json({
        error: errorMessage,
        channelId: channel.id,
        channelName: channel.channel_name,
      }, { status: 502 });
    }

    await logWebhookDelivery(serviceDb, {
      channelId: channel.id,
      eventType,
      status: 'processed',
      payload,
      headers,
    });
    await serviceDb
      .from('procurement_notification_channels')
      .update({
        verification_status: 'passed',
        last_tested_at: new Date().toISOString(),
        last_test_error: null,
      })
      .eq('org_profile_id', context.orgProfileId)
      .eq('id', channel.id);

    return NextResponse.json({
      ok: true,
      channelId: channel.id,
      channelName: channel.channel_name,
      endpointUrl: channel.endpoint_url,
      enabled: channel.enabled,
      eventType,
    });
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'Unable to deliver webhook test';
    await logWebhookDelivery(serviceDb, {
      channelId: channel.id,
      eventType,
      status: 'failed',
      payload,
      headers,
      errorMessage,
    });
    await serviceDb
      .from('procurement_notification_channels')
      .update({
        verification_status: 'failed',
        last_tested_at: new Date().toISOString(),
        last_test_error: errorMessage,
      })
      .eq('org_profile_id', context.orgProfileId)
      .eq('id', channel.id);
    return NextResponse.json({
      error: errorMessage,
      channelId: channel.id,
      channelName: channel.channel_name,
    }, { status: 502 });
  }
}
