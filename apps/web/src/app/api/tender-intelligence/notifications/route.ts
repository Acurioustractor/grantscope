import { NextRequest, NextResponse } from 'next/server';
import { requireModule } from '@/lib/api-auth';
import { getServiceSupabase } from '@/lib/supabase';
import {
  getProcurementContext,
  hasNotificationAccess,
} from '../_lib/procurement-workspace';

export async function PATCH(request: NextRequest) {
  const auth = await requireModule('procurement');
  if (auth.error) return auth.error;
  const { user } = auth;

  const body = await request.json();
  const notificationId = typeof body?.notificationId === 'string' ? body.notificationId : '';
  const action = body?.action === 'cancel' ? 'cancel' : 'retry';
  if (!notificationId) {
    return NextResponse.json({ error: 'notificationId is required' }, { status: 400 });
  }

  const serviceDb = getServiceSupabase();
  const context = await getProcurementContext(serviceDb, user.id);
  if (!context.orgProfileId) {
    return NextResponse.json({ error: 'No procurement workspace found.' }, { status: 404 });
  }
  if (!hasNotificationAccess(context.currentUserPermissions)) {
    return NextResponse.json({ error: 'Only procurement leads can retry outbound notifications.' }, { status: 403 });
  }

  const { data: notification, error: notificationError } = await serviceDb
    .from('procurement_notification_outbox')
    .select('id, status, queued_at, last_error, attempt_count')
    .eq('org_profile_id', context.orgProfileId)
    .eq('id', notificationId)
    .maybeSingle();

  if (notificationError) {
    return NextResponse.json({ error: notificationError.message }, { status: 500 });
  }
  if (!notification) {
    return NextResponse.json({ error: 'Notification not found.' }, { status: 404 });
  }
  if (notification.status === 'sent') {
    return NextResponse.json({ error: 'Sent notifications cannot be retried from the queue.' }, { status: 400 });
  }

  const queuedAt = new Date().toISOString();
  const { data: updatedNotification, error: updateError } = await serviceDb
    .from('procurement_notification_outbox')
    .update({
      status: action === 'cancel' ? 'cancelled' : 'queued',
      queued_at: action === 'cancel' ? notification.queued_at : queuedAt,
      sent_at: null,
      attempt_count: action === 'cancel' ? notification.attempt_count : 0,
      last_attempted_at: action === 'cancel' ? new Date().toISOString() : null,
      last_error: action === 'cancel' ? 'Cancelled by procurement lead' : null,
      external_message_id: action === 'cancel' ? null : null,
    })
    .eq('org_profile_id', context.orgProfileId)
    .eq('id', notificationId)
    .select('id, shortlist_id, pack_export_id, task_id, alert_id, recipient_user_id, recipient_label, notification_type, delivery_mode, status, subject, body, payload, queued_at, sent_at, attempt_count, last_attempted_at, last_error, external_message_id, created_at, updated_at')
    .single();

  if (updateError) {
    return NextResponse.json({ error: updateError.message }, { status: 500 });
  }

  return NextResponse.json({
    ok: true,
    action,
    notification: updatedNotification,
  });
}
