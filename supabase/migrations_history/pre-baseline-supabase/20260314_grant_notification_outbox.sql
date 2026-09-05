-- Grant notification outbox — clones procurement_notification_outbox pattern
-- for grant alert delivery

CREATE TABLE IF NOT EXISTS grant_notification_outbox (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  org_profile_id uuid REFERENCES org_profiles(id) ON DELETE SET NULL,
  grant_id uuid NOT NULL REFERENCES grant_opportunities(id) ON DELETE CASCADE,
  alert_preference_id bigint REFERENCES alert_preferences(id) ON DELETE SET NULL,
  notification_type text NOT NULL DEFAULT 'grant_match',
  status text NOT NULL DEFAULT 'queued',
  subject text NOT NULL,
  body text,
  match_score int,
  match_signals text[],
  payload jsonb NOT NULL DEFAULT '{}'::jsonb,
  queued_at timestamptz NOT NULL DEFAULT now(),
  sent_at timestamptz,
  attempt_count int NOT NULL DEFAULT 0,
  last_attempted_at timestamptz,
  last_error text,
  external_message_id text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT grant_notification_outbox_type_check
    CHECK (notification_type IN ('grant_match', 'grant_closing_soon', 'grant_digest')),
  CONSTRAINT grant_notification_outbox_status_check
    CHECK (status IN ('queued', 'sent', 'cancelled', 'failed'))
);

CREATE INDEX IF NOT EXISTS idx_grant_notification_outbox_user
  ON grant_notification_outbox(user_id, status, queued_at DESC);

CREATE INDEX IF NOT EXISTS idx_grant_notification_outbox_status
  ON grant_notification_outbox(status, queued_at ASC)
  WHERE status = 'queued';

-- Prevent duplicate notifications for same user+grant
CREATE UNIQUE INDEX IF NOT EXISTS idx_grant_notification_outbox_dedup
  ON grant_notification_outbox(user_id, grant_id, notification_type)
  WHERE status IN ('queued', 'sent');

ALTER TABLE grant_notification_outbox ENABLE ROW LEVEL SECURITY;

CREATE POLICY "users_own_grant_notifications" ON grant_notification_outbox
  FOR SELECT
  USING (user_id = auth.uid());
