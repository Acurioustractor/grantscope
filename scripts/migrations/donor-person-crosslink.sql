-- Donor→Person Crosslink: political donors matched to board positions
-- Links individual political donors (no ABN) to person_roles by normalised name
-- Reveals: "This charity director donated $X to party Y"

DROP MATERIALIZED VIEW IF EXISTS mv_donor_person_crosslink CASCADE;

CREATE MATERIALIZED VIEW mv_donor_person_crosslink AS
WITH donor_totals AS (
  -- Individual donors (no ABN) aggregated
  SELECT
    UPPER(TRIM(regexp_replace(donor_name, '\s+', ' ', 'g'))) AS person_name_normalised,
    donor_name,
    COUNT(*) AS donation_count,
    COUNT(DISTINCT donation_to) AS parties_count,
    SUM(amount)::bigint AS total_donated,
    array_agg(DISTINCT donation_to) AS parties,
    array_agg(DISTINCT financial_year) AS donation_years,
    MIN(donation_date) AS first_donation,
    MAX(donation_date) AS last_donation
  FROM political_donations
  WHERE donor_abn IS NULL
    AND amount > 0
    AND donor_name IS NOT NULL
  GROUP BY UPPER(TRIM(regexp_replace(donor_name, '\s+', ' ', 'g'))), donor_name
)
SELECT
  dt.person_name_normalised,
  dt.donor_name,
  dt.donation_count,
  dt.parties_count,
  dt.total_donated,
  dt.parties,
  dt.donation_years,
  dt.first_donation,
  dt.last_donation,
  -- Board positions
  pd.board_count,
  pd.org_abns,
  pd.sources AS board_sources,
  -- Is this person also a foundation trustee?
  pd.is_foundation_trustee,
  -- Is this person a politician?
  pd.is_politician,
  -- Contract dollars through their orgs
  pd.total_contract_value,
  -- Justice funding through their orgs
  pd.total_justice_funding,
  -- Power score from person network
  pd.power_score,
  pd.system_count
FROM donor_totals dt
JOIN mv_person_network pd ON pd.person_name_normalised = dt.person_name_normalised;

CREATE INDEX idx_donor_person_name ON mv_donor_person_crosslink (person_name_normalised);
CREATE INDEX idx_donor_person_donated ON mv_donor_person_crosslink (total_donated DESC);
CREATE INDEX idx_donor_person_power ON mv_donor_person_crosslink (power_score DESC);
CREATE INDEX idx_donor_person_trustee ON mv_donor_person_crosslink (is_foundation_trustee) WHERE is_foundation_trustee = true;
CREATE INDEX idx_donor_person_politician ON mv_donor_person_crosslink (is_politician) WHERE is_politician = true;


-- ============================================================
-- Foundation Grantee Linkage: connect foundations to who they fund
-- Uses justice_funding + gs_relationships to build foundation→grantee edges
-- ============================================================

DROP MATERIALIZED VIEW IF EXISTS mv_foundation_grantees CASCADE;

CREATE MATERIALIZED VIEW mv_foundation_grantees AS

-- Method 1: Foundations linked via gs_relationships (foundation_grantees dataset)
SELECT
  f.id AS foundation_id,
  f.name AS foundation_name,
  f.acnc_abn AS foundation_abn,
  f.total_giving_annual,
  ge_grantee.id AS grantee_entity_id,
  ge_grantee.gs_id AS grantee_gs_id,
  ge_grantee.canonical_name AS grantee_name,
  ge_grantee.abn AS grantee_abn,
  ge_grantee.entity_type AS grantee_type,
  ge_grantee.state AS grantee_state,
  ge_grantee.is_community_controlled AS grantee_community_controlled,
  r.amount AS grant_amount,
  r.year::text AS grant_year,
  r.dataset AS source_dataset,
  'relationship' AS link_method
FROM foundations f
JOIN gs_entities ge_fdn ON ge_fdn.abn = f.acnc_abn
JOIN gs_relationships r ON r.source_entity_id = ge_fdn.id
JOIN gs_entities ge_grantee ON ge_grantee.id = r.target_entity_id
WHERE r.relationship_type IN ('grant', 'funds', 'grants_to', 'gave_grant_to')
  AND r.source_entity_id != r.target_entity_id
  AND f.acnc_abn IS NOT NULL

UNION ALL

-- Method 2: Foundations linked via justice_funding (foundation as funder)
SELECT DISTINCT
  f.id,
  f.name,
  f.acnc_abn,
  f.total_giving_annual,
  ge_recip.id,
  ge_recip.gs_id,
  ge_recip.canonical_name,
  ge_recip.abn,
  ge_recip.entity_type,
  ge_recip.state,
  ge_recip.is_community_controlled,
  jf.amount_dollars::bigint,
  jf.financial_year,
  'justice_funding',
  'justice_funding'
FROM foundations f
JOIN justice_funding jf ON UPPER(jf.program_name) LIKE '%' || UPPER(split_part(f.name, ' ', 1)) || '%'
  AND UPPER(jf.program_name) LIKE '%FOUNDATION%'
JOIN gs_entities ge_recip ON ge_recip.id = jf.gs_entity_id
WHERE f.acnc_abn IS NOT NULL
  AND jf.gs_entity_id IS NOT NULL
  AND jf.amount_dollars > 0
  AND length(split_part(f.name, ' ', 1)) > 3;

CREATE INDEX idx_fdn_grantee_foundation ON mv_foundation_grantees (foundation_id);
CREATE INDEX idx_fdn_grantee_grantee ON mv_foundation_grantees (grantee_entity_id);
CREATE INDEX idx_fdn_grantee_abn ON mv_foundation_grantees (foundation_abn);
CREATE INDEX idx_fdn_grantee_amount ON mv_foundation_grantees (grant_amount DESC NULLS LAST);
CREATE INDEX idx_fdn_grantee_community ON mv_foundation_grantees (grantee_community_controlled) WHERE grantee_community_controlled = true;
