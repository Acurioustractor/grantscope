ALTER TABLE alert_events
  DROP CONSTRAINT IF EXISTS alert_events_event_type_check;

ALTER TABLE alert_events
  ADD CONSTRAINT alert_events_event_type_check
  CHECK (
    event_type IN (
      'alert_created',
      'alert_updated',
      'alert_deleted',
      'optimization_applied',
      'scout_run',
      'notification_queued',
      'notification_requeued',
      'notification_sent',
      'notification_failed',
      'notification_cancelled',
      'notification_opened',
      'notification_clicked',
      'digest_sent',
      'digest_failed',
      'digest_opened',
      'digest_clicked',
      'delivery_run'
    )
  );
