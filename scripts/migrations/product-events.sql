CREATE TABLE IF NOT EXISTS product_events (
  id BIGSERIAL PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  org_profile_id UUID NULL REFERENCES org_profiles(id) ON DELETE SET NULL,
  event_type TEXT NOT NULL,
  metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT product_events_event_type_check CHECK (
    event_type IN (
      'profile_ready',
      'first_grant_shortlisted',
      'pipeline_started',
      'first_alert_created',
      'alert_clicked',
      'upgrade_prompt_viewed',
      'upgrade_cta_clicked',
      'checkout_started',
      'subscription_trial_started',
      'subscription_activated',
      'subscription_changed',
      'subscription_cancelled',
      'billing_portal_opened',
      'billing_reminder_clicked',
      'billing_reminder_sent'
    )
  )
);

CREATE INDEX IF NOT EXISTS idx_product_events_user_created
  ON product_events (user_id, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_product_events_type_created
  ON product_events (event_type, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_product_events_org_created
  ON product_events (org_profile_id, created_at DESC);

ALTER TABLE product_events ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users see own product events" ON product_events;
CREATE POLICY "Users see own product events"
  ON product_events
  FOR SELECT
  TO authenticated
  USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "Service manages product events" ON product_events;
CREATE POLICY "Service manages product events"
  ON product_events
  FOR ALL
  TO service_role
  USING (true)
  WITH CHECK (true);
