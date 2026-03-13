-- GrantScope: foundation power profiles
-- Persists a cleaner classification of philanthropic capital holders vs operators

CREATE TABLE IF NOT EXISTS foundation_power_profiles (
  foundation_id UUID PRIMARY KEY REFERENCES foundations(id) ON DELETE CASCADE,
  capital_holder_class TEXT NOT NULL,
  capital_source_class TEXT NOT NULL,
  reportable_in_power_map BOOLEAN NOT NULL DEFAULT false,
  public_grant_surface BOOLEAN NOT NULL DEFAULT false,
  openness_score NUMERIC(5,2) NOT NULL DEFAULT 0,
  approachability_score NUMERIC(5,2) NOT NULL DEFAULT 0,
  gatekeeping_score NUMERIC(5,2) NOT NULL DEFAULT 0,
  capital_power_score NUMERIC(5,2) NOT NULL DEFAULT 0,
  classification_confidence TEXT NOT NULL DEFAULT 'low',
  classifier_version TEXT NOT NULL DEFAULT 'v1',
  reasons TEXT[] NOT NULL DEFAULT ARRAY[]::TEXT[],
  evidence JSONB NOT NULL DEFAULT '{}'::JSONB,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT foundation_power_profiles_class_check CHECK (
    capital_holder_class IN (
      'philanthropic_capital_holder',
      'intermediary_grantmaker',
      'service_operator',
      'institutional_operator',
      'religious_operator',
      'unclear'
    )
  ),
  CONSTRAINT foundation_power_profiles_source_check CHECK (
    capital_source_class IN (
      'ancillary_fund',
      'corporate_foundation',
      'family_trust',
      'community_foundation',
      'institutional_endowment',
      'service_revenue',
      'religious_network',
      'mixed',
      'unknown'
    )
  ),
  CONSTRAINT foundation_power_profiles_confidence_check CHECK (
    classification_confidence IN ('low', 'medium', 'high')
  )
);

CREATE INDEX IF NOT EXISTS idx_foundation_power_profiles_reportable
  ON foundation_power_profiles(reportable_in_power_map)
  WHERE reportable_in_power_map = true;

CREATE INDEX IF NOT EXISTS idx_foundation_power_profiles_class
  ON foundation_power_profiles(capital_holder_class);

CREATE INDEX IF NOT EXISTS idx_foundation_power_profiles_source
  ON foundation_power_profiles(capital_source_class);

CREATE INDEX IF NOT EXISTS idx_foundation_power_profiles_gatekeeping
  ON foundation_power_profiles(gatekeeping_score DESC);

DROP TRIGGER IF EXISTS foundation_power_profiles_updated_at ON foundation_power_profiles;

CREATE TRIGGER foundation_power_profiles_updated_at
  BEFORE UPDATE ON foundation_power_profiles
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();
