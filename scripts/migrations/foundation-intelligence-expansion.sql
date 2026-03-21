-- foundation-intelligence-expansion.sql
-- 1. Create synthetic entities for 12 corporate foundations
-- 2. Create mv_trustee_grantee_chain (trustee→foundation→grantee revolving door)
-- 3. Create mv_foundation_need_alignment (giving vs disadvantage)
-- 4. Create mv_evidence_backed_funding (foundation $ → ALMA-tracked programs)

-- ============================================================
-- PART 1: Corporate foundation entities
-- ============================================================

INSERT INTO gs_entities (gs_id, entity_type, canonical_name, description, sector, source_datasets, source_count, confidence, metadata)
SELECT
  'GS-SYNTH-' || lower(replace(replace(v.name, ' ', '-'), '''', '')),
  'foundation', v.name, v.description, 'philanthropy', '{enrichment}', 1, 'inferred',
  jsonb_build_object('parent_company', v.parent_company, 'asx_code', v.asx_code, 'annual_giving', v.annual_giving, 'synthetic', true)
FROM (VALUES
  ('BHP Foundation', 'Corporate foundation of BHP Group. Focuses on Indigenous partnerships, education, and governance.', 'BHP', 'BHP', 195100000),
  ('Rio Tinto Foundation', 'Corporate foundation of Rio Tinto Limited. Focuses on Indigenous communities and STEM education.', 'Rio Tinto Limited', 'RIO', 153700000),
  ('Coles Group Foundation', 'Corporate foundation of Coles Group. Focuses on food rescue and community resilience.', 'Coles Group', 'COL', 132700000),
  ('Fortescue Foundation', 'Corporate foundation of Fortescue Ltd. Indigenous employment and economic development.', 'Fortescue Ltd', 'FMG', 54900000),
  ('CSL Foundation', 'Corporate foundation of CSL Limited. Focuses on medical research and blood-related health.', 'CSL Limited', 'CSL', 54000000),
  ('Lowy Foundation', 'Private family foundation of the Lowy family. Supports research, arts, and Jewish causes.', NULL, NULL, 50000000),
  ('Wesfarmers Foundation', 'Corporate foundation of Wesfarmers Limited. Focuses on education and community development.', 'Wesfarmers Limited', 'WES', 45300000),
  ('Macquarie Group Foundation', 'Corporate foundation of Macquarie Group. Matched giving and community grants.', 'Macquarie Group', 'MQG', 37500000),
  ('Kinghorn Foundation', 'Private family foundation of John Kinghorn. Managed by Perpetual. Medical research focus.', NULL, NULL, 31000000),
  ('Geoffrey Cumming Foundation', 'Private foundation focused on medical research and health innovation.', NULL, NULL, 250000000),
  ('QBE Foundation', 'Corporate foundation of QBE Insurance Group. Climate resilience and community inclusion.', 'QBE Insurance (Australia) Ltd.', 'QBE', 12400000),
  ('Suncorp Foundation', 'Corporate foundation of Suncorp Group. Natural disaster resilience and community rebuilding.', 'Suncorp Group', 'SUN', 9000000)
) AS v(name, description, parent_company, asx_code, annual_giving)
WHERE NOT EXISTS (
  SELECT 1 FROM gs_entities e WHERE e.canonical_name = v.name AND e.entity_type = 'foundation'
);

-- ============================================================
-- PART 2: mv_trustee_grantee_chain
-- Person (trustee/board) → foundation → grantee org
-- ============================================================

DROP MATERIALIZED VIEW IF EXISTS mv_trustee_grantee_chain;
CREATE MATERIALIZED VIEW mv_trustee_grantee_chain AS
WITH foundation_trustees AS (
  SELECT DISTINCT
    pec.person_name_normalised,
    pec.company_abn as foundation_abn,
    pec.canonical_name as foundation_name,
    pec.roles,
    pec.role_sources
  FROM mv_person_entity_crosswalk pec
  WHERE pec.entity_type = 'foundation'
),
foundation_grantees AS (
  SELECT DISTINCT
    fg.foundation_name,
    fg.foundation_abn,
    fg.grantee_name,
    fg.grantee_abn,
    fg.link_method,
    fg.grant_year
  FROM mv_foundation_grantees fg
)
SELECT
  ft.person_name_normalised as trustee_name,
  ft.foundation_name,
  ft.foundation_abn,
  ft.roles as trustee_roles,
  fg.grantee_name,
  fg.grantee_abn,
  fg.link_method,
  fg.grant_year,
  EXISTS (
    SELECT 1 FROM mv_person_entity_crosswalk pec2
    WHERE pec2.person_name_normalised = ft.person_name_normalised
    AND pec2.company_abn = fg.grantee_abn
  ) as trustee_on_grantee_board
FROM foundation_trustees ft
JOIN foundation_grantees fg ON fg.foundation_abn = ft.foundation_abn;

CREATE UNIQUE INDEX ON mv_trustee_grantee_chain (trustee_name, foundation_abn, grantee_abn, grant_year);

-- ============================================================
-- PART 3: mv_foundation_need_alignment (recreate — previous run had dup key)
-- ============================================================

DROP MATERIALIZED VIEW IF EXISTS mv_foundation_need_alignment;
CREATE MATERIALIZED VIEW mv_foundation_need_alignment AS
WITH grantee_locations AS (
  SELECT
    fg.foundation_name,
    fg.foundation_abn,
    fg.grantee_name,
    fg.grantee_abn,
    e.lga_name,
    e.lga_code,
    e.state,
    e.remoteness,
    e.seifa_irsd_decile,
    e.is_community_controlled
  FROM mv_foundation_grantees fg
  JOIN gs_entities e ON e.abn = fg.grantee_abn
  WHERE e.lga_name IS NOT NULL
)
SELECT
  gl.foundation_name,
  gl.foundation_abn,
  gl.lga_name,
  gl.state,
  gl.remoteness,
  COUNT(DISTINCT gl.grantee_abn) as grantee_count,
  COALESCE(fd.desert_score, 0) as desert_score,
  COALESCE(fd.avg_irsd_decile, 0) as avg_lga_disadvantage,
  COALESCE(fd.total_funding_all_sources, 0) as existing_funding,
  COUNT(DISTINCT gl.grantee_abn) FILTER (WHERE gl.is_community_controlled) as community_controlled_count,
  AVG(gl.seifa_irsd_decile) as avg_grantee_disadvantage_decile
FROM grantee_locations gl
LEFT JOIN mv_funding_deserts fd ON fd.lga_name = gl.lga_name
GROUP BY gl.foundation_name, gl.foundation_abn, gl.lga_name, gl.state, gl.remoteness,
  fd.desert_score, fd.avg_irsd_decile, fd.total_funding_all_sources;

-- Use non-unique index since multiple foundations can fund same LGA
CREATE INDEX ON mv_foundation_need_alignment (foundation_abn, lga_name);
CREATE INDEX ON mv_foundation_need_alignment (desert_score DESC);

-- ============================================================
-- PART 4: mv_evidence_backed_funding (already created with 257 rows, recreate clean)
-- ============================================================

DROP MATERIALIZED VIEW IF EXISTS mv_evidence_backed_funding;
CREATE MATERIALIZED VIEW mv_evidence_backed_funding AS
WITH foundation_orgs AS (
  SELECT DISTINCT
    fg.foundation_name,
    fg.foundation_abn,
    fg.grantee_name,
    fg.grantee_abn
  FROM mv_foundation_grantees fg
),
alma_orgs AS (
  SELECT DISTINCT
    ai.gs_entity_id,
    e.abn as org_abn,
    e.canonical_name as org_name,
    ai.name as intervention_name,
    ai.type as intervention_type,
    ai.evidence_level,
    ai.cultural_authority,
    ai.portfolio_score
  FROM alma_interventions ai
  JOIN gs_entities e ON e.id = ai.gs_entity_id
  WHERE ai.gs_entity_id IS NOT NULL
    AND e.abn IS NOT NULL
)
SELECT
  fo.foundation_name,
  fo.foundation_abn,
  fo.grantee_name,
  fo.grantee_abn,
  ao.intervention_name,
  ao.intervention_type,
  ao.evidence_level,
  ao.cultural_authority,
  ao.portfolio_score
FROM foundation_orgs fo
JOIN alma_orgs ao ON ao.org_abn = fo.grantee_abn;

CREATE UNIQUE INDEX ON mv_evidence_backed_funding (foundation_abn, grantee_abn, intervention_name);
CREATE INDEX ON mv_evidence_backed_funding (evidence_level);
