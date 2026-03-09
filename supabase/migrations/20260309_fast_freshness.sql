-- Fast freshness timestamps using max() aggregate
-- Returns most recent timestamp for each tracked table in one call
-- Uses existing indexes where available; max() on indexed columns is instant

-- First, add indexes on timestamp columns used for freshness queries
-- These make ORDER BY ... DESC LIMIT 1 and max() instant
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_justice_funding_updated_at ON justice_funding(updated_at DESC);
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_grant_opportunities_updated_at ON grant_opportunities(updated_at DESC);
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_foundations_updated_at ON foundations(updated_at DESC);
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_foundation_programs_scraped_at ON foundation_programs(scraped_at DESC);
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_acnc_charities_updated_at ON acnc_charities(updated_at DESC);
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_community_orgs_updated_at ON community_orgs(updated_at DESC);
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_social_enterprises_updated_at ON social_enterprises(updated_at DESC);
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_oric_corporations_updated_at ON oric_corporations(updated_at DESC);
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_austender_contracts_updated_at ON austender_contracts(updated_at DESC);
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_political_donations_created_at ON political_donations(created_at DESC);
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_gs_entities_updated_at ON gs_entities(updated_at DESC);
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_gs_relationships_created_at ON gs_relationships(created_at DESC);
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_asic_companies_updated_at ON asic_companies(updated_at DESC);
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_ato_tax_transparency_created_at ON ato_tax_transparency(created_at DESC);
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_rogs_justice_spending_created_at ON rogs_justice_spending(created_at DESC);
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_asx_companies_created_at ON asx_companies(created_at DESC);
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_alma_interventions_updated_at ON alma_interventions(updated_at DESC);
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_alma_outcomes_updated_at ON alma_outcomes(updated_at DESC);
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_alma_evidence_updated_at ON alma_evidence(updated_at DESC);

-- Single RPC that returns freshness for all tables at once
CREATE OR REPLACE FUNCTION get_table_freshness()
RETURNS jsonb
LANGUAGE sql
STABLE
SECURITY DEFINER
SET statement_timeout = '15s'
AS $$
  SELECT jsonb_build_object(
    'grant_opportunities', (SELECT max(updated_at) FROM grant_opportunities),
    'foundations', (SELECT max(updated_at) FROM foundations),
    'foundation_programs', (SELECT max(scraped_at) FROM foundation_programs),
    'acnc_charities', (SELECT max(updated_at) FROM acnc_charities),
    'community_orgs', (SELECT max(updated_at) FROM community_orgs),
    'social_enterprises', (SELECT max(updated_at) FROM social_enterprises),
    'oric_corporations', (SELECT max(updated_at) FROM oric_corporations),
    'austender_contracts', (SELECT max(updated_at) FROM austender_contracts),
    'political_donations', (SELECT max(created_at) FROM political_donations),
    'gs_entities', (SELECT max(updated_at) FROM gs_entities),
    'gs_relationships', (SELECT max(created_at) FROM gs_relationships),
    'asic_companies', (SELECT max(updated_at) FROM asic_companies),
    'ato_tax_transparency', (SELECT max(created_at) FROM ato_tax_transparency),
    'rogs_justice_spending', (SELECT max(created_at) FROM rogs_justice_spending),
    'asx_companies', (SELECT max(created_at) FROM asx_companies),
    'justice_funding', (SELECT max(updated_at) FROM justice_funding),
    'alma_interventions', (SELECT max(updated_at) FROM alma_interventions),
    'alma_outcomes', (SELECT max(updated_at) FROM alma_outcomes),
    'alma_evidence', (SELECT max(updated_at) FROM alma_evidence)
  );
$$;
