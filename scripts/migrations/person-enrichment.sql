-- Person Enrichment: name dedup + entity crosslink
-- 1. Backfill entity_id where company_abn matches gs_entities
-- 2. MV for deduplicated people across sources
-- 3. MV for person→entity crosswalk (people linked to all entities they touch)

BEGIN;

-- ============================================================
-- Step 1: Backfill entity_id from company_abn → gs_entities
-- ============================================================
UPDATE person_roles pr
SET entity_id = ge.id
FROM gs_entities ge
WHERE pr.entity_id IS NULL
  AND pr.company_abn IS NOT NULL
  AND ge.abn = pr.company_abn;

COMMIT;

-- ============================================================
-- Step 2: Deduplicated person directory
-- Merges same-name people across sources, aggregating orgs/roles
-- ============================================================
DROP MATERIALIZED VIEW IF EXISTS mv_person_directory CASCADE;

CREATE MATERIALIZED VIEW mv_person_directory AS
WITH person_agg AS (
  SELECT
    person_name_normalised,
    -- Pick best display name (longest version, likely most complete)
    (array_agg(person_name ORDER BY length(person_name) DESC))[1] AS display_name,
    COUNT(*) AS role_count,
    COUNT(DISTINCT company_abn) FILTER (WHERE company_abn IS NOT NULL) AS org_count,
    array_agg(DISTINCT source) AS sources,
    COUNT(DISTINCT source) AS source_count,
    array_agg(DISTINCT company_abn) FILTER (WHERE company_abn IS NOT NULL) AS org_abns,
    array_agg(DISTINCT company_name) FILTER (WHERE company_name IS NOT NULL) AS org_names,
    array_agg(DISTINCT role_type) AS role_types,
    MIN(appointment_date) AS earliest_appointment,
    MAX(cessation_date) AS latest_cessation,
    bool_or(cessation_date IS NULL) AS currently_active,
    -- Entity linkage
    array_agg(DISTINCT entity_id) FILTER (WHERE entity_id IS NOT NULL) AS entity_ids,
    COUNT(DISTINCT entity_id) FILTER (WHERE entity_id IS NOT NULL) AS linked_entity_count
  FROM person_roles
  WHERE person_name_normalised IS NOT NULL
    AND person_name_normalised != ''
    AND length(person_name_normalised) > 2  -- skip initials-only
  GROUP BY person_name_normalised
)
SELECT
  person_name_normalised,
  display_name,
  role_count,
  org_count,
  sources,
  source_count,
  org_abns,
  org_names,
  role_types,
  earliest_appointment,
  latest_cessation,
  currently_active,
  entity_ids,
  linked_entity_count,
  -- Flag potential duplicates: common names with 1 org each across different sources
  -- These are likely the same person if they share an org
  CASE
    WHEN source_count > 1 THEN 'cross_source_match'
    WHEN org_count > 3 THEN 'high_board_count'
    ELSE 'single_source'
  END AS match_quality
FROM person_agg;

CREATE INDEX idx_person_dir_name ON mv_person_directory (person_name_normalised);
CREATE INDEX idx_person_dir_sources ON mv_person_directory (source_count DESC);
CREATE INDEX idx_person_dir_orgs ON mv_person_directory (org_count DESC);
CREATE INDEX idx_person_dir_quality ON mv_person_directory (match_quality);
CREATE INDEX idx_person_dir_active ON mv_person_directory (currently_active) WHERE currently_active = true;

-- ============================================================
-- Step 3: Person → Entity crosswalk
-- Links people to all gs_entities they connect to via their orgs
-- Plus cross-system dollar flows through those entities
-- ============================================================
DROP MATERIALIZED VIEW IF EXISTS mv_person_entity_crosswalk CASCADE;

CREATE MATERIALIZED VIEW mv_person_entity_crosswalk AS
WITH person_orgs AS (
  -- Each person's org ABNs (deduplicated)
  SELECT
    person_name_normalised,
    company_abn,
    array_agg(DISTINCT source) AS sources,
    array_agg(DISTINCT role_type) AS roles
  FROM person_roles
  WHERE person_name_normalised IS NOT NULL
    AND company_abn IS NOT NULL
  GROUP BY person_name_normalised, company_abn
),
person_entities AS (
  -- Link to gs_entities
  SELECT
    po.person_name_normalised,
    po.company_abn,
    po.sources,
    po.roles,
    ge.id AS entity_id,
    ge.gs_id,
    ge.canonical_name,
    ge.entity_type,
    ge.sector,
    ge.state,
    ge.is_community_controlled
  FROM person_orgs po
  JOIN gs_entities ge ON ge.abn = po.company_abn
)
SELECT
  pe.person_name_normalised,
  pe.company_abn,
  pe.sources AS role_sources,
  pe.roles,
  pe.entity_id,
  pe.gs_id,
  pe.canonical_name,
  pe.entity_type,
  pe.sector,
  pe.state,
  pe.is_community_controlled,
  -- Contract dollars through this entity
  COALESCE(ac.contract_total, 0) AS contract_dollars,
  COALESCE(ac.contract_count, 0) AS contract_count,
  -- Justice funding through this entity
  COALESCE(jf.justice_total, 0) AS justice_dollars,
  COALESCE(jf.justice_count, 0) AS justice_count,
  -- Donations from/to this entity
  COALESCE(pd.donation_total, 0) AS donation_dollars,
  COALESCE(pd.donation_count, 0) AS donation_count
FROM person_entities pe
LEFT JOIN LATERAL (
  SELECT SUM(contract_value)::bigint AS contract_total, COUNT(*) AS contract_count
  FROM austender_contracts WHERE supplier_abn = pe.company_abn
) ac ON true
LEFT JOIN LATERAL (
  SELECT SUM(amount_dollars)::bigint AS justice_total, COUNT(*) AS justice_count
  FROM justice_funding WHERE recipient_abn = pe.company_abn
) jf ON true
LEFT JOIN LATERAL (
  SELECT SUM(amount)::bigint AS donation_total, COUNT(*) AS donation_count
  FROM political_donations WHERE donor_abn = pe.company_abn
) pd ON true;

CREATE INDEX idx_person_xwalk_name ON mv_person_entity_crosswalk (person_name_normalised);
CREATE INDEX idx_person_xwalk_entity ON mv_person_entity_crosswalk (entity_id);
CREATE INDEX idx_person_xwalk_abn ON mv_person_entity_crosswalk (company_abn);
CREATE INDEX idx_person_xwalk_contracts ON mv_person_entity_crosswalk (contract_dollars DESC) WHERE contract_dollars > 0;
CREATE INDEX idx_person_xwalk_justice ON mv_person_entity_crosswalk (justice_dollars DESC) WHERE justice_dollars > 0;
CREATE INDEX idx_person_xwalk_community ON mv_person_entity_crosswalk (is_community_controlled) WHERE is_community_controlled = true;
