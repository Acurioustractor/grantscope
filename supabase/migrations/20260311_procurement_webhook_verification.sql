ALTER TABLE procurement_notification_channels
  ADD COLUMN IF NOT EXISTS verification_token text,
  ADD COLUMN IF NOT EXISTS verification_status text NOT NULL DEFAULT 'untested',
  ADD COLUMN IF NOT EXISTS last_tested_at timestamptz,
  ADD COLUMN IF NOT EXISTS last_test_error text;

UPDATE procurement_notification_channels
SET verification_token = gen_random_uuid()::text
WHERE verification_token IS NULL;

ALTER TABLE procurement_notification_channels
  ALTER COLUMN verification_token SET DEFAULT gen_random_uuid()::text,
  ALTER COLUMN verification_token SET NOT NULL;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'procurement_notification_channels_verification_status_check'
  ) THEN
    ALTER TABLE procurement_notification_channels
      ADD CONSTRAINT procurement_notification_channels_verification_status_check
      CHECK (verification_status IN ('untested', 'passed', 'failed'));
  END IF;
END $$;

CREATE UNIQUE INDEX IF NOT EXISTS procurement_notification_channels_verification_token_idx
  ON procurement_notification_channels (verification_token);

CREATE TABLE IF NOT EXISTS procurement_webhook_receipts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  org_profile_id uuid NOT NULL REFERENCES org_profiles(id) ON DELETE CASCADE,
  channel_id uuid NOT NULL REFERENCES procurement_notification_channels(id) ON DELETE CASCADE,
  source text NOT NULL DEFAULT 'procurement_webhook_inspector',
  event_type text,
  signature_valid boolean,
  request_headers jsonb NOT NULL DEFAULT '{}'::jsonb,
  payload jsonb NOT NULL DEFAULT '{}'::jsonb,
  received_at timestamptz NOT NULL DEFAULT now(),
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS procurement_webhook_receipts_channel_idx
  ON procurement_webhook_receipts (channel_id, received_at DESC);

CREATE INDEX IF NOT EXISTS procurement_webhook_receipts_org_idx
  ON procurement_webhook_receipts (org_profile_id, received_at DESC);
