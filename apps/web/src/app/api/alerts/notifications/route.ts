import { NextRequest, NextResponse } from 'next/server';
import { requireModule } from '@/lib/api-auth';
import { recordAlertEvents } from '@/lib/alert-events';
import { getServiceSupabase } from '@/lib/supabase';

type NotificationAction = 'retry' | 'cancel';

export async function PATCH(request: NextRequest) {
  const auth = await requireModule('grants');
  if (auth.error) return auth.error;
  const { user } = auth;

  const body = await request.json().catch(() => null);
  const notificationId = typeof body?.notificationId === 'string' ? body.notificationId : '';
  const action: NotificationAction = body?.action === 'cancel' ? 'cancel' : 'retry';

  if (!notificationId) {
    return NextResponse.json({ error: 'notificationId is required' }, { status: 400 });
  }

  const serviceDb = getServiceSupabase();
  const { data: notification, error: notificationError } = await serviceDb
    .from('grant_notification_outbox')
    .select('id, user_id, alert_preference_id, grant_id, status, queued_at, attempt_count')
    .eq('user_id', user.id)
    .eq('id', notificationId)
    .maybeSingle();

  if (notificationError) {
    return NextResponse.json({ error: notificationError.message }, { status: 500 });
  }

  if (!notification) {
    return NextResponse.json({ error: 'Notification not found.' }, { status: 404 });
  }

  if (notification.status === 'sent') {
    return NextResponse.json({ error: 'Sent notifications cannot be changed.' }, { status: 400 });
  }

  const now = new Date().toISOString();
  const nextState = action === 'cancel'
    ? {
        status: 'cancelled',
        queued_at: notification.queued_at,
        sent_at: null,
        last_attempted_at: now,
        last_error: 'Dismissed by user',
        external_message_id: null,
      }
    : {
        status: 'queued',
        queued_at: now,
        sent_at: null,
        attempt_count: 0,
        last_attempted_at: null,
        last_error: null,
        external_message_id: null,
      };

  const { data: updatedNotification, error: updateError } = await serviceDb
    .from('grant_notification_outbox')
    .update(nextState)
    .eq('user_id', user.id)
    .eq('id', notificationId)
    .select('id, grant_id, alert_preference_id, status, queued_at, sent_at, attempt_count, last_attempted_at, last_error, external_message_id')
    .single();

  if (updateError) {
    return NextResponse.json({ error: updateError.message }, { status: 500 });
  }

  await recordAlertEvents([
    {
      userId: user.id,
      alertPreferenceId: updatedNotification.alert_preference_id ?? notification.alert_preference_id ?? null,
      notificationId: updatedNotification.id,
      grantId: updatedNotification.grant_id ?? notification.grant_id ?? null,
      eventType: action === 'cancel' ? 'notification_cancelled' : 'notification_requeued',
      metadata: {
        action,
        status: updatedNotification.status,
      },
    },
  ]);

  return NextResponse.json({
    ok: true,
    action,
    notification: updatedNotification,
  });
}
