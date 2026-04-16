ALTER TABLE saved_grants
  ADD COLUMN IF NOT EXISTS source_alert_preference_id BIGINT REFERENCES alert_preferences(id) ON DELETE SET NULL;

ALTER TABLE saved_grants
  ADD COLUMN IF NOT EXISTS source_notification_id UUID REFERENCES grant_notification_outbox(id) ON DELETE SET NULL;

ALTER TABLE saved_grants
  ADD COLUMN IF NOT EXISTS source_attribution_type TEXT;

ALTER TABLE saved_grants
  ADD COLUMN IF NOT EXISTS source_attributed_at TIMESTAMPTZ;

ALTER TABLE saved_grants
  DROP CONSTRAINT IF EXISTS saved_grants_source_attribution_type_check;

ALTER TABLE saved_grants
  ADD CONSTRAINT saved_grants_source_attribution_type_check
  CHECK (
    source_attribution_type IS NULL
    OR source_attribution_type IN (
      'notification_clicked',
      'digest_clicked',
      'scout_auto',
      'manual'
    )
  );

CREATE INDEX IF NOT EXISTS idx_saved_grants_source_alert
  ON saved_grants (user_id, source_alert_preference_id)
  WHERE source_alert_preference_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_saved_grants_source_notification
  ON saved_grants (source_notification_id)
  WHERE source_notification_id IS NOT NULL;
