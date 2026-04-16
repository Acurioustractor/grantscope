ALTER TABLE product_events
  DROP CONSTRAINT IF EXISTS product_events_event_type_check;

ALTER TABLE product_events
  ADD CONSTRAINT product_events_event_type_check
  CHECK (
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
  );
