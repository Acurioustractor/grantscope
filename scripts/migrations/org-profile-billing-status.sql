ALTER TABLE org_profiles
  ADD COLUMN IF NOT EXISTS subscription_trial_end timestamp with time zone,
  ADD COLUMN IF NOT EXISTS subscription_current_period_end timestamp with time zone,
  ADD COLUMN IF NOT EXISTS subscription_cancel_at_period_end boolean NOT NULL DEFAULT false;

COMMENT ON COLUMN org_profiles.subscription_trial_end IS 'Stripe trial end timestamp for the current subscription, if applicable.';
COMMENT ON COLUMN org_profiles.subscription_current_period_end IS 'Stripe current billing period end or cancellation effective timestamp.';
COMMENT ON COLUMN org_profiles.subscription_cancel_at_period_end IS 'Whether the Stripe subscription is set to cancel at the current period end.';
