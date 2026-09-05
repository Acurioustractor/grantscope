-- GrantScope Entity Graph
-- Phase 1: Unified entity registry + relationship graph
-- Inspired by OCCRP Follow The Money, OpenSanctions, BODS

-- Enable trigram extension if not already
CREATE EXTENSION IF NOT EXISTS pg_trgm;

--------------------------------------------------------------------------------
-- gs_entities: Unified entity registry
-- Every organisation across all datasets gets ONE canonical record
--------------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS gs_entities (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

  -- Identity
  entity_type TEXT NOT NULL CHECK (entity_type IN (
    'company', 'charity', 'foundation', 'government_body',
    'indigenous_corp', 'political_party', 'person',
    'social_enterprise', 'trust', 'unknown'
  )),
  canonical_name TEXT NOT NULL,
  abn TEXT,
  acn TEXT,

  -- GrantScope canonical ID (deterministic, format: AU-ABN-12345678901)
  gs_id TEXT UNIQUE NOT NULL,

  -- Descriptive
  description TEXT,
  website TEXT,
  state TEXT,
  postcode TEXT,

  -- Classification
  sector TEXT,
  sub_sector TEXT,
  tags TEXT[] DEFAULT '{}',

  -- Data quality
  source_datasets TEXT[] NOT NULL DEFAULT '{}',
  source_count INT DEFAULT 1,
  confidence TEXT DEFAULT 'medium' CHECK (confidence IN (
    'registry', 'verified', 'reported', 'inferred', 'unverified'
  )),

  -- Financials (denormalised for fast queries)
  latest_revenue NUMERIC,
  latest_assets NUMERIC,
  latest_tax_payable NUMERIC,
  financial_year TEXT,

  -- Timestamps
  first_seen TIMESTAMPTZ DEFAULT NOW(),
  last_seen TIMESTAMPTZ DEFAULT NOW(),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Indexes
CREATE INDEX IF NOT EXISTS idx_gs_entities_abn ON gs_entities(abn) WHERE abn IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_gs_entities_acn ON gs_entities(acn) WHERE acn IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_gs_entities_type ON gs_entities(entity_type);
CREATE INDEX IF NOT EXISTS idx_gs_entities_name_trgm ON gs_entities USING gin(canonical_name gin_trgm_ops);
CREATE INDEX IF NOT EXISTS idx_gs_entities_source ON gs_entities USING gin(source_datasets);
CREATE INDEX IF NOT EXISTS idx_gs_entities_confidence ON gs_entities(confidence);
CREATE INDEX IF NOT EXISTS idx_gs_entities_state ON gs_entities(state) WHERE state IS NOT NULL;

-- Updated_at trigger
CREATE OR REPLACE FUNCTION gs_update_timestamp()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER gs_entities_updated_at
  BEFORE UPDATE ON gs_entities
  FOR EACH ROW EXECUTE FUNCTION gs_update_timestamp();

--------------------------------------------------------------------------------
-- gs_relationships: The graph edges
-- Every connection between entities is a first-class record
--------------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS gs_relationships (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

  -- The connection
  source_entity_id UUID NOT NULL REFERENCES gs_entities(id) ON DELETE CASCADE,
  target_entity_id UUID NOT NULL REFERENCES gs_entities(id) ON DELETE CASCADE,
  relationship_type TEXT NOT NULL CHECK (relationship_type IN (
    'donation', 'contract', 'grant', 'directorship', 'ownership',
    'charity_link', 'program_funding', 'tax_record', 'registered_as',
    'listed_as', 'subsidiary_of', 'member_of', 'lobbies_for'
  )),

  -- Properties
  amount NUMERIC,
  currency TEXT DEFAULT 'AUD',
  year INT,

  -- Temporal
  start_date DATE,
  end_date DATE,

  -- Provenance
  dataset TEXT NOT NULL,
  source_record_id TEXT,
  source_url TEXT,
  confidence TEXT DEFAULT 'registry' CHECK (confidence IN (
    'registry', 'verified', 'reported', 'inferred', 'unverified'
  )),

  -- Timestamps
  first_seen TIMESTAMPTZ DEFAULT NOW(),
  last_seen TIMESTAMPTZ DEFAULT NOW(),
  created_at TIMESTAMPTZ DEFAULT NOW(),

  -- Type-specific metadata
  properties JSONB DEFAULT '{}'
);

-- Indexes
CREATE INDEX IF NOT EXISTS idx_gs_rel_source ON gs_relationships(source_entity_id);
CREATE INDEX IF NOT EXISTS idx_gs_rel_target ON gs_relationships(target_entity_id);
CREATE INDEX IF NOT EXISTS idx_gs_rel_type ON gs_relationships(relationship_type);
CREATE INDEX IF NOT EXISTS idx_gs_rel_dataset ON gs_relationships(dataset);
CREATE INDEX IF NOT EXISTS idx_gs_rel_year ON gs_relationships(year) WHERE year IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_gs_rel_amount ON gs_relationships(amount DESC) WHERE amount IS NOT NULL;

-- Composite indexes for common query patterns
CREATE INDEX IF NOT EXISTS idx_gs_rel_source_type ON gs_relationships(source_entity_id, relationship_type);
CREATE INDEX IF NOT EXISTS idx_gs_rel_target_type ON gs_relationships(target_entity_id, relationship_type);

-- Prevent exact duplicate relationships
CREATE UNIQUE INDEX IF NOT EXISTS idx_gs_rel_dedup
  ON gs_relationships(source_entity_id, target_entity_id, relationship_type, dataset, COALESCE(source_record_id, ''));

--------------------------------------------------------------------------------
-- gs_entity_aliases: Multiple names/identifiers per entity
--------------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS gs_entity_aliases (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  entity_id UUID NOT NULL REFERENCES gs_entities(id) ON DELETE CASCADE,
  alias_type TEXT NOT NULL, -- 'name', 'trading_name', 'former_name', 'abn', 'acn', 'icn', 'asx_code'
  alias_value TEXT NOT NULL,
  source TEXT NOT NULL,     -- 'acnc', 'asic', 'aec', 'oric', etc.
  is_primary BOOLEAN DEFAULT false,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_gs_aliases_entity ON gs_entity_aliases(entity_id);
CREATE INDEX IF NOT EXISTS idx_gs_aliases_value ON gs_entity_aliases USING gin(alias_value gin_trgm_ops);
CREATE INDEX IF NOT EXISTS idx_gs_aliases_type ON gs_entity_aliases(alias_type);

--------------------------------------------------------------------------------
-- Materialised view: Donor-Contractors (the flagship stat)
--------------------------------------------------------------------------------
CREATE MATERIALIZED VIEW IF NOT EXISTS mv_gs_donor_contractors AS
SELECT
  e.id,
  e.gs_id,
  e.canonical_name,
  e.entity_type,
  e.abn,
  e.sector,
  e.state,
  d.total_donated,
  d.donation_count,
  d.parties_donated_to,
  d.donation_years,
  c.total_contract_value,
  c.contract_count,
  c.government_buyers,
  c.contract_years
FROM gs_entities e
INNER JOIN (
  SELECT
    source_entity_id,
    SUM(amount) AS total_donated,
    COUNT(*) AS donation_count,
    ARRAY_AGG(DISTINCT t.canonical_name) AS parties_donated_to,
    ARRAY_AGG(DISTINCT r.year ORDER BY r.year) FILTER (WHERE r.year IS NOT NULL) AS donation_years
  FROM gs_relationships r
  JOIN gs_entities t ON r.target_entity_id = t.id
  WHERE r.relationship_type = 'donation' AND r.amount > 0
  GROUP BY source_entity_id
) d ON e.id = d.source_entity_id
INNER JOIN (
  SELECT
    target_entity_id,
    SUM(amount) AS total_contract_value,
    COUNT(*) AS contract_count,
    ARRAY_AGG(DISTINCT s.canonical_name) AS government_buyers,
    ARRAY_AGG(DISTINCT r.year ORDER BY r.year) FILTER (WHERE r.year IS NOT NULL) AS contract_years
  FROM gs_relationships r
  JOIN gs_entities s ON r.source_entity_id = s.id
  WHERE r.relationship_type = 'contract' AND r.amount > 0
  GROUP BY target_entity_id
) c ON e.id = c.target_entity_id
ORDER BY d.total_donated DESC;

-- Unique index for concurrent refresh
CREATE UNIQUE INDEX IF NOT EXISTS idx_mv_gs_dc_id ON mv_gs_donor_contractors(id);

--------------------------------------------------------------------------------
-- Materialised view: Entity network stats
--------------------------------------------------------------------------------
CREATE MATERIALIZED VIEW IF NOT EXISTS mv_gs_entity_stats AS
SELECT
  e.id,
  e.gs_id,
  e.canonical_name,
  e.entity_type,
  e.abn,
  e.source_count,
  COALESCE(out_r.outbound_count, 0) AS outbound_relationships,
  COALESCE(in_r.inbound_count, 0) AS inbound_relationships,
  COALESCE(out_r.outbound_count, 0) + COALESCE(in_r.inbound_count, 0) AS total_relationships,
  COALESCE(out_r.total_outbound_amount, 0) AS total_outbound_amount,
  COALESCE(in_r.total_inbound_amount, 0) AS total_inbound_amount,
  out_r.outbound_types,
  in_r.inbound_types
FROM gs_entities e
LEFT JOIN (
  SELECT
    source_entity_id,
    COUNT(*) AS outbound_count,
    SUM(amount) AS total_outbound_amount,
    ARRAY_AGG(DISTINCT relationship_type) AS outbound_types
  FROM gs_relationships
  GROUP BY source_entity_id
) out_r ON e.id = out_r.source_entity_id
LEFT JOIN (
  SELECT
    target_entity_id,
    COUNT(*) AS inbound_count,
    SUM(amount) AS total_inbound_amount,
    ARRAY_AGG(DISTINCT relationship_type) AS inbound_types
  FROM gs_relationships
  GROUP BY target_entity_id
) in_r ON e.id = in_r.target_entity_id
WHERE COALESCE(out_r.outbound_count, 0) + COALESCE(in_r.inbound_count, 0) > 0
ORDER BY total_relationships DESC;

CREATE UNIQUE INDEX IF NOT EXISTS idx_mv_gs_es_id ON mv_gs_entity_stats(id);

--------------------------------------------------------------------------------
-- Helper function: Generate gs_id from best available identifier
--------------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION gs_make_id(
  p_abn TEXT DEFAULT NULL,
  p_acn TEXT DEFAULT NULL,
  p_icn TEXT DEFAULT NULL,
  p_asx_code TEXT DEFAULT NULL,
  p_buyer_id TEXT DEFAULT NULL,
  p_fallback_name TEXT DEFAULT NULL
) RETURNS TEXT AS $$
BEGIN
  IF p_abn IS NOT NULL AND p_abn != '' THEN
    RETURN 'AU-ABN-' || REPLACE(p_abn, ' ', '');
  ELSIF p_acn IS NOT NULL AND p_acn != '' THEN
    RETURN 'AU-ACN-' || REPLACE(p_acn, ' ', '');
  ELSIF p_icn IS NOT NULL AND p_icn != '' THEN
    RETURN 'AU-ORIC-' || p_icn;
  ELSIF p_asx_code IS NOT NULL AND p_asx_code != '' THEN
    RETURN 'AU-ASX-' || UPPER(p_asx_code);
  ELSIF p_buyer_id IS NOT NULL AND p_buyer_id != '' THEN
    RETURN 'AU-GOV-' || p_buyer_id;
  ELSIF p_fallback_name IS NOT NULL AND p_fallback_name != '' THEN
    RETURN 'AU-NAME-' || MD5(UPPER(TRIM(p_fallback_name)));
  ELSE
    RETURN 'AU-UNK-' || gen_random_uuid()::text;
  END IF;
END;
$$ LANGUAGE plpgsql IMMUTABLE;

COMMENT ON TABLE gs_entities IS 'Unified entity registry — every organisation across all GrantScope datasets';
COMMENT ON TABLE gs_relationships IS 'Entity graph edges — every connection (donation, contract, grant, etc.) between entities';
COMMENT ON TABLE gs_entity_aliases IS 'Multiple names/identifiers per entity for resolution';
COMMENT ON MATERIALIZED VIEW mv_gs_donor_contractors IS 'Entities that both donate to political parties AND hold government contracts';
COMMENT ON MATERIALIZED VIEW mv_gs_entity_stats IS 'Relationship counts and amounts per entity';
