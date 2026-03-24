-- Optimized mv_person_entity_network — avoids LATERAL JOINs that crash Supabase
-- Uses pre-aggregated financial data instead

CREATE MATERIALIZED VIEW IF NOT EXISTS mv_person_entity_network AS
WITH person_boards AS (
  SELECT pr.person_name_normalised, MIN(pr.person_name) as person_name_display, pr.entity_id,
    e.canonical_name as entity_name, e.abn as entity_abn, e.entity_type, e.is_community_controlled,
    pr.role_type, pr.source, pr.appointment_date, pr.cessation_date
  FROM person_roles pr JOIN gs_entities e ON e.id = pr.entity_id
  WHERE pr.entity_id IS NOT NULL AND pr.cessation_date IS NULL
  GROUP BY pr.person_name_normalised, pr.entity_id, e.canonical_name, e.abn,
           e.entity_type, e.is_community_controlled, pr.role_type, pr.source, pr.appointment_date, pr.cessation_date
),
relevant_entities AS (
  SELECT DISTINCT entity_id FROM person_boards
),
person_entity_count AS (
  SELECT person_name_normalised, COUNT(DISTINCT entity_id) as board_count
  FROM person_boards GROUP BY person_name_normalised
),
-- Pre-aggregate financials for relevant entities only (no LATERAL)
procurement_agg AS (
  SELECT e.id as entity_id, SUM(ac.contract_value) as contract_total, COUNT(*) as contract_count
  FROM austender_contracts ac
  JOIN gs_entities e ON e.abn = ac.supplier_abn
  WHERE ac.supplier_abn IS NOT NULL AND e.id IN (SELECT entity_id FROM relevant_entities)
  GROUP BY e.id
),
justice_agg AS (
  SELECT gs_entity_id as entity_id, SUM(amount_dollars) as justice_total, COUNT(*) as justice_count
  FROM justice_funding
  WHERE gs_entity_id IN (SELECT entity_id FROM relevant_entities)
  GROUP BY gs_entity_id
),
donation_agg AS (
  SELECT e.id as entity_id, SUM(pd.amount) as donation_total, COUNT(*) as donation_count
  FROM political_donations pd
  JOIN gs_entities e ON e.abn = pd.donor_abn
  WHERE pd.donor_abn IS NOT NULL AND e.id IN (SELECT entity_id FROM relevant_entities)
  GROUP BY e.id
)
SELECT pb.person_name_normalised, pb.person_name_display, pb.entity_id, pb.entity_name, pb.entity_abn,
  pb.entity_type, pb.is_community_controlled, pb.role_type, pb.source, pb.appointment_date, pec.board_count,
  COALESCE(pa.contract_total, 0) as procurement_dollars,
  COALESCE(pa.contract_count, 0) as contract_count,
  COALESCE(ja.justice_total, 0) as justice_dollars,
  COALESCE(ja.justice_count, 0) as justice_count,
  COALESCE(da.donation_total, 0) as donation_dollars,
  COALESCE(da.donation_count, 0) as donation_count,
  pec.board_count * (1 + LN(1 + COALESCE(pa.contract_total, 0) + COALESCE(ja.justice_total, 0) + COALESCE(da.donation_total, 0))) as influence_score
FROM person_boards pb
JOIN person_entity_count pec ON pec.person_name_normalised = pb.person_name_normalised
LEFT JOIN procurement_agg pa ON pa.entity_id = pb.entity_id
LEFT JOIN justice_agg ja ON ja.entity_id = pb.entity_id
LEFT JOIN donation_agg da ON da.entity_id = pb.entity_id
WHERE pec.board_count >= 1
ORDER BY influence_score DESC;

CREATE UNIQUE INDEX IF NOT EXISTS idx_pen_person_entity ON mv_person_entity_network (person_name_normalised, entity_id);
CREATE INDEX IF NOT EXISTS idx_pen_board_count ON mv_person_entity_network (board_count DESC);
CREATE INDEX IF NOT EXISTS idx_pen_influence ON mv_person_entity_network (influence_score DESC);
CREATE INDEX IF NOT EXISTS idx_pen_entity ON mv_person_entity_network (entity_id);
