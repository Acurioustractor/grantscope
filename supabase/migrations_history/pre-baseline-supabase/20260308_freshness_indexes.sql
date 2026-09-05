-- Indexes for health dashboard freshness queries
-- These speed up ORDER BY ... DESC LIMIT 1 from 5-8s to <100ms on large tables

CREATE INDEX IF NOT EXISTS idx_political_donations_created_at ON political_donations (created_at DESC);
CREATE INDEX IF NOT EXISTS idx_acnc_charities_updated_at ON acnc_charities (updated_at DESC);
CREATE INDEX IF NOT EXISTS idx_austender_contracts_updated_at ON austender_contracts (updated_at DESC);
CREATE INDEX IF NOT EXISTS idx_gs_entities_updated_at ON gs_entities (updated_at DESC);
CREATE INDEX IF NOT EXISTS idx_gs_relationships_created_at ON gs_relationships (created_at DESC);
CREATE INDEX IF NOT EXISTS idx_asic_companies_updated_at ON asic_companies (updated_at DESC);
CREATE INDEX IF NOT EXISTS idx_foundations_updated_at ON foundations (updated_at DESC);
