-- Add billing columns to org_profiles
ALTER TABLE org_profiles
  ADD COLUMN IF NOT EXISTS stripe_customer_id TEXT,
  ADD COLUMN IF NOT EXISTS subscription_plan TEXT DEFAULT 'community',
  ADD COLUMN IF NOT EXISTS subscription_status TEXT DEFAULT 'active';

CREATE INDEX IF NOT EXISTS idx_org_profiles_stripe ON org_profiles(stripe_customer_id);
