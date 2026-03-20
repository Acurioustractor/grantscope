-- create-funding-deserts.sql
-- Funding desert analysis: cross-references disadvantage (SEIFA) and remoteness
-- with actual funding flows across all systems.
-- Shows which areas have high need but low multi-system investment.

DROP MATERIALIZED VIEW IF EXISTS mv_funding_deserts CASCADE;

CREATE MATERIALIZED VIEW mv_funding_deserts AS
WITH
-- LGA-level funding from power index entities
lga_power AS (
  SELECT
    lga_name,
    state,
    COUNT(*) as entity_count,
    COUNT(*) FILTER (WHERE is_community_controlled) as community_controlled_count,
    AVG(system_count) as avg_system_count,
    AVG(power_score) as avg_power_score,
    MAX(system_count) as max_system_count,
    SUM(procurement_dollars) as total_procurement,
    SUM(justice_dollars) as total_justice,
    SUM(donation_dollars) as total_donations,
    SUM(total_dollar_flow) as total_flow,
    COUNT(*) FILTER (WHERE in_procurement = 1) as procurement_entities,
    COUNT(*) FILTER (WHERE in_justice_funding = 1) as justice_entities,
    COUNT(*) FILTER (WHERE in_political_donations = 1) as donation_entities,
    COUNT(*) FILTER (WHERE in_foundation = 1) as foundation_entities,
    COUNT(*) FILTER (WHERE in_alma_evidence = 1) as alma_entities,
    COUNT(*) FILTER (WHERE system_count >= 3) as multi_system_entities
  FROM mv_entity_power_index
  WHERE lga_name IS NOT NULL
  GROUP BY lga_name, state
),

-- LGA-level disadvantage from SEIFA via postcode_geo
lga_disadvantage AS (
  SELECT
    pg.lga_name,
    pg.state,
    pg.remoteness_2021 as remoteness,
    AVG(s.score) FILTER (WHERE s.index_type = 'IRSD') as avg_irsd_score,
    MIN(s.decile_national) FILTER (WHERE s.index_type = 'IRSD') as min_irsd_decile,
    AVG(s.decile_national) FILTER (WHERE s.index_type = 'IRSD') as avg_irsd_decile,
    COUNT(DISTINCT pg.postcode) as postcode_count
  FROM postcode_geo pg
  LEFT JOIN seifa_2021 s ON s.postcode = pg.postcode
  WHERE pg.lga_name IS NOT NULL
  GROUP BY pg.lga_name, pg.state, pg.remoteness_2021
),

-- LGA-level funding from the existing MV (broader than power index)
lga_funding AS (
  SELECT
    lga_name,
    state,
    total_funding,
    entity_count as funding_entity_count
  FROM mv_funding_by_lga
)

SELECT
  COALESCE(d.lga_name, p.lga_name) as lga_name,
  COALESCE(d.state, p.state) as state,
  d.remoteness,
  d.avg_irsd_score,
  d.min_irsd_decile,
  d.avg_irsd_decile,
  d.postcode_count,

  -- Entity presence
  COALESCE(p.entity_count, 0) as indexed_entities,
  COALESCE(p.community_controlled_count, 0) as community_controlled_entities,
  COALESCE(p.multi_system_entities, 0) as multi_system_entities,

  -- System coverage
  COALESCE(p.procurement_entities, 0) as procurement_entities,
  COALESCE(p.justice_entities, 0) as justice_entities,
  COALESCE(p.donation_entities, 0) as donation_entities,
  COALESCE(p.foundation_entities, 0) as foundation_entities,
  COALESCE(p.alma_entities, 0) as alma_entities,

  -- Dollar flows
  COALESCE(p.total_procurement, 0) as procurement_dollars,
  COALESCE(p.total_justice, 0) as justice_dollars,
  COALESCE(p.total_donations, 0) as donation_dollars,
  COALESCE(p.total_flow, 0) as total_dollar_flow,
  COALESCE(f.total_funding, 0) as total_funding_all_sources,

  -- Power metrics
  COALESCE(p.avg_system_count, 0) as avg_system_count,
  COALESCE(p.avg_power_score, 0) as avg_power_score,

  -- Desert score: high disadvantage + low funding = high desert score
  -- IRSD decile 1 = most disadvantaged. Invert so higher = worse.
  CASE WHEN d.avg_irsd_decile IS NOT NULL THEN
    ROUND((
      (11 - COALESCE(d.avg_irsd_decile, 5)) * 10 +                    -- disadvantage component (0-100)
      CASE d.remoteness
        WHEN 'Major Cities of Australia' THEN 0
        WHEN 'Inner Regional Australia' THEN 10
        WHEN 'Outer Regional Australia' THEN 20
        WHEN 'Remote Australia' THEN 30
        WHEN 'Very Remote Australia' THEN 40
        ELSE 10
      END +                                                              -- remoteness component (0-40)
      CASE WHEN COALESCE(p.entity_count, 0) = 0 THEN 30
           WHEN COALESCE(p.multi_system_entities, 0) = 0 THEN 20
           WHEN COALESCE(p.avg_system_count, 0) < 1.5 THEN 10
           ELSE 0
      END +                                                              -- coverage gap component (0-30)
      CASE WHEN COALESCE(p.total_flow, 0) = 0 THEN 20
           WHEN COALESCE(p.total_flow, 0) < 1000000 THEN 10
           ELSE 0
      END                                                                -- funding gap component (0-20)
    )::numeric, 1)
  END as desert_score

FROM lga_disadvantage d
FULL OUTER JOIN lga_power p ON p.lga_name = d.lga_name AND p.state = d.state
LEFT JOIN lga_funding f ON f.lga_name = COALESCE(d.lga_name, p.lga_name) AND f.state = COALESCE(d.state, p.state)
WHERE COALESCE(d.lga_name, p.lga_name) IS NOT NULL;

-- Indexes
CREATE INDEX idx_funding_deserts_desert_score ON mv_funding_deserts (desert_score DESC NULLS LAST);
CREATE INDEX idx_funding_deserts_state ON mv_funding_deserts (state);
CREATE INDEX idx_funding_deserts_remoteness ON mv_funding_deserts (remoteness);
CREATE INDEX idx_funding_deserts_lga ON mv_funding_deserts (lga_name);
