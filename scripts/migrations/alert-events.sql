CREATE TABLE IF NOT EXISTS alert_events (
  id BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  alert_preference_id BIGINT REFERENCES alert_preferences(id) ON DELETE SET NULL,
  notification_id UUID REFERENCES grant_notification_outbox(id) ON DELETE SET NULL,
  grant_id UUID REFERENCES grant_opportunities(id) ON DELETE SET NULL,
  event_type TEXT NOT NULL CHECK (
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
  ),
  metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_alert_events_user_created
  ON alert_events (user_id, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_alert_events_alert_created
  ON alert_events (alert_preference_id, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_alert_events_notification_created
  ON alert_events (notification_id, created_at DESC);

ALTER TABLE alert_events ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users see own alert events" ON alert_events;
CREATE POLICY "Users see own alert events"
  ON alert_events
  FOR SELECT
  USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "Service manages alert events" ON alert_events;
CREATE POLICY "Service manages alert events"
  ON alert_events
  FOR ALL
  USING (true)
  WITH CHECK (true);
