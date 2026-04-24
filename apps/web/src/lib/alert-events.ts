import { getServiceSupabase } from '@/lib/supabase';

export type AlertEventType =
  | 'alert_created'
  | 'alert_updated'
  | 'alert_deleted'
  | 'optimization_applied'
  | 'scout_run'
  | 'notification_queued'
  | 'notification_requeued'
  | 'notification_sent'
  | 'notification_failed'
  | 'notification_cancelled'
  | 'notification_opened'
  | 'notification_clicked'
  | 'digest_sent'
  | 'digest_failed'
  | 'digest_opened'
  | 'digest_clicked'
  | 'delivery_run';

type AlertEventInput = {
  userId: string;
  eventType: AlertEventType;
  alertPreferenceId?: number | null;
  notificationId?: string | null;
  grantId?: string | null;
  metadata?: Record<string, unknown>;
};

export async function recordAlertEvents(events: AlertEventInput[]) {
  if (events.length === 0) return;

  const db = getServiceSupabase();
  const rows = events.map((event) => ({
    user_id: event.userId,
    alert_preference_id: event.alertPreferenceId ?? null,
    notification_id: event.notificationId ?? null,
    grant_id: event.grantId ?? null,
    event_type: event.eventType,
    metadata: event.metadata ?? {},
  }));

  const { error } = await db
    .from('alert_events')
    .insert(rows);

  if (error) {
    console.error('[alert-events] insert failed:', error);
  }
}
