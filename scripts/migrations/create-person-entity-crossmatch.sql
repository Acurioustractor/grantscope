-- Person-Entity Cross-Match
-- Links people (from person_roles) to entities they're connected to
-- via board membership, then finds those entities' contract/funding/donation footprint.
-- This replaces the OpenCorporates dependency by using ACNC data directly.

-- Step 1: Create a materialized view of people with multi-entity connections
DROP MATERIALIZED VIEW IF EXISTS mv_person_entity_network CASCADE;

CREATE MATERIALIZED VIEW mv_person_entity_network AS
WITH person_boards AS (
  -- Each person and the entities they serve on
  SELECT
    pr.person_name_normalised,
    MIN(pr.person_name) as person_name_display,
    pr.entity_id,
    e.canonical_name as entity_name,
    e.abn as entity_abn,
    e.entity_type,
    e.is_community_controlled,
    pr.role_type,
    pr.source,
    pr.appointment_date,
    pr.cessation_date
  FROM person_roles pr
  JOIN gs_entities e ON e.id = pr.entity_id
  WHERE pr.entity_id IS NOT NULL
    AND pr.cessation_date IS NULL  -- currently active
  GROUP BY pr.person_name_normalised, pr.entity_id, e.canonical_name, e.abn,
           e.entity_type, e.is_community_controlled, pr.role_type, pr.source,
           pr.appointment_date, pr.cessation_date
),
person_entity_count AS (
  -- How many distinct entities each person serves
  SELECT
    person_name_normalised,
    COUNT(DISTINCT entity_id) as board_count
  FROM person_boards
  GROUP BY person_name_normalised
),
entity_financial AS (
  -- Financial footprint of each entity
  SELECT
    e.id as entity_id,
    COALESCE(ac.contract_total, 0) as procurement_dollars,
    COALESCE(ac.contract_count, 0) as contract_count,
    COALESCE(jf.justice_total, 0) as justice_dollars,
    COALESCE(jf.justice_count, 0) as justice_count,
    COALESCE(pd.donation_total, 0) as donation_dollars,
    COALESCE(pd.donation_count, 0) as donation_count
  FROM gs_entities e
  LEFT JOIN LATERAL (
    SELECT SUM(contract_value) as contract_total, COUNT(*) as contract_count
    FROM austender_contracts WHERE supplier_abn = e.abn AND e.abn IS NOT NULL
  ) ac ON true
  LEFT JOIN LATERAL (
    SELECT SUM(amount_dollars) as justice_total, COUNT(*) as justice_count
    FROM justice_funding WHERE gs_entity_id = e.id
  ) jf ON true
  LEFT JOIN LATERAL (
    SELECT SUM(amount) as donation_total, COUNT(*) as donation_count
    FROM political_donations WHERE donor_abn = e.abn AND e.abn IS NOT NULL
  ) pd ON true
  WHERE e.id IN (SELECT DISTINCT entity_id FROM person_boards)
)
SELECT
  pb.person_name_normalised,
  pb.person_name_display,
  pb.entity_id,
  pb.entity_name,
  pb.entity_abn,
  pb.entity_type,
  pb.is_community_controlled,
  pb.role_type,
  pb.source,
  pb.appointment_date,
  pec.board_count,
  ef.procurement_dollars,
  ef.contract_count,
  ef.justice_dollars,
  ef.justice_count,
  ef.donation_dollars,
  ef.donation_count,
  -- Influence score: boards * (log of total financial footprint)
  pec.board_count * (1 + LN(1 + ef.procurement_dollars + ef.justice_dollars + ef.donation_dollars)) as influence_score
FROM person_boards pb
JOIN person_entity_count pec ON pec.person_name_normalised = pb.person_name_normalised
JOIN entity_financial ef ON ef.entity_id = pb.entity_id
WHERE pec.board_count >= 1  -- all people with at least 1 board seat
ORDER BY influence_score DESC;

-- Index for fast lookups
CREATE UNIQUE INDEX idx_pen_person_entity
  ON mv_person_entity_network (person_name_normalised, entity_id);
CREATE INDEX idx_pen_board_count
  ON mv_person_entity_network (board_count DESC);
CREATE INDEX idx_pen_influence
  ON mv_person_entity_network (influence_score DESC);
CREATE INDEX idx_pen_entity
  ON mv_person_entity_network (entity_id);

-- Summary view: one row per person with aggregate stats
DROP MATERIALIZED VIEW IF EXISTS mv_person_influence CASCADE;

CREATE MATERIALIZED VIEW mv_person_influence AS
SELECT
  person_name_normalised,
  MIN(person_name_display) as person_name,
  COUNT(DISTINCT entity_id) as board_count,
  COUNT(DISTINCT entity_id) FILTER (WHERE is_community_controlled) as acco_boards,
  ARRAY_AGG(DISTINCT entity_type) as entity_types,
  ARRAY_AGG(DISTINCT source) as data_sources,
  SUM(procurement_dollars) as total_procurement,
  SUM(contract_count) as total_contracts,
  SUM(justice_dollars) as total_justice,
  SUM(donation_dollars) as total_donations,
  MAX(influence_score) as max_influence_score,
  -- Cross-system: person touches entities with contracts AND justice AND donations
  (SUM(procurement_dollars) > 0)::int +
  (SUM(justice_dollars) > 0)::int +
  (SUM(donation_dollars) > 0)::int as financial_system_count
FROM mv_person_entity_network
GROUP BY person_name_normalised
ORDER BY max_influence_score DESC;

CREATE UNIQUE INDEX idx_pi_person ON mv_person_influence (person_name_normalised);
CREATE INDEX idx_pi_influence ON mv_person_influence (max_influence_score DESC);
CREATE INDEX idx_pi_board_count ON mv_person_influence (board_count DESC);
CREATE INDEX idx_pi_financial_systems ON mv_person_influence (financial_system_count DESC);
