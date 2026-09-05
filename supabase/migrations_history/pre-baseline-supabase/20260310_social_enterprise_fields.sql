-- Add enriched fields to social_enterprises for Social Traders data
ALTER TABLE social_enterprises
  ADD COLUMN IF NOT EXISTS target_beneficiaries TEXT[],
  ADD COLUMN IF NOT EXISTS logo_url TEXT,
  ADD COLUMN IF NOT EXISTS business_model TEXT;

COMMENT ON COLUMN social_enterprises.target_beneficiaries IS 'Primary beneficiary groups (e.g. Aboriginal communities, people with disabilities)';
COMMENT ON COLUMN social_enterprises.logo_url IS 'Logo image URL from source directory';
COMMENT ON COLUMN social_enterprises.business_model IS 'Business model classification (e.g. Employment, Fee for Service)';
