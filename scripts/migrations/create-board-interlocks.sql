-- Board Interlocks Materialized View
-- Identifies people who sit on multiple charity/organisation boards
-- and the cross-system connections those interlocks create.

-- Drop existing if any
DROP MATERIALIZED VIEW IF EXISTS mv_board_interlocks;

-- Create the MV: one row per person with 2+ board seats
CREATE MATERIALIZED VIEW mv_board_interlocks AS
WITH multi_board_persons AS (
  SELECT person_name_normalised
  FROM person_roles
  WHERE person_name_normalised IS NOT NULL
    AND person_name_normalised != ''
    AND company_abn IS NOT NULL
  GROUP BY person_name_normalised
  HAVING COUNT(DISTINCT company_abn) >= 2
),
person_summary AS (
  SELECT
    pr.person_name_normalised,
    MIN(pr.person_name) as person_name_display,
    COUNT(DISTINCT pr.company_abn) as board_count,
    array_agg(DISTINCT pr.company_name ORDER BY pr.company_name) as organisations,
    array_agg(DISTINCT pr.company_abn ORDER BY pr.company_abn) as organisation_abns,
    array_agg(DISTINCT pr.entity_id) FILTER (WHERE pr.entity_id IS NOT NULL) as entity_ids,
    array_agg(DISTINCT pr.role_type ORDER BY pr.role_type) as role_types,
    array_agg(DISTINCT pr.source ORDER BY pr.source) as sources
  FROM person_roles pr
  JOIN multi_board_persons mb ON mb.person_name_normalised = pr.person_name_normalised
  WHERE pr.company_abn IS NOT NULL
  GROUP BY pr.person_name_normalised
)
SELECT
  ps.*,
  -- Cross-system enrichment: do any of the linked entities appear in other systems?
  COALESCE(pi_agg.total_procurement_dollars, 0) as total_procurement_dollars,
  COALESCE(pi_agg.total_justice_dollars, 0) as total_justice_dollars,
  COALESCE(pi_agg.total_donation_dollars, 0) as total_donation_dollars,
  COALESCE(pi_agg.max_system_count, 0) as max_entity_system_count,
  COALESCE(pi_agg.sum_power_score, 0) as total_power_score,
  COALESCE(pi_agg.has_community_controlled, false) as connects_community_controlled,
  -- Interlock score: boards * log(dollars + 1) * system diversity
  (ps.board_count *
   LN(GREATEST(COALESCE(pi_agg.total_procurement_dollars, 0) + COALESCE(pi_agg.total_justice_dollars, 0) + COALESCE(pi_agg.total_donation_dollars, 0), 0) + 1) *
   GREATEST(COALESCE(pi_agg.max_system_count, 1), 1)
  )::numeric(12,2) as interlock_score
FROM person_summary ps
LEFT JOIN LATERAL (
  SELECT
    SUM(pi.procurement_dollars) as total_procurement_dollars,
    SUM(pi.justice_dollars) as total_justice_dollars,
    SUM(pi.donation_dollars) as total_donation_dollars,
    MAX(pi.system_count) as max_system_count,
    SUM(pi.power_score) as sum_power_score,
    bool_or(pi.is_community_controlled) as has_community_controlled
  FROM mv_entity_power_index pi
  WHERE pi.id = ANY(ps.entity_ids)
) pi_agg ON true
ORDER BY interlock_score DESC NULLS LAST;

-- Unique index for CONCURRENTLY refresh
CREATE UNIQUE INDEX idx_mv_board_interlocks_person
  ON mv_board_interlocks (person_name_normalised);

-- Performance indexes
CREATE INDEX idx_mv_board_interlocks_score
  ON mv_board_interlocks (interlock_score DESC NULLS LAST);
CREATE INDEX idx_mv_board_interlocks_board_count
  ON mv_board_interlocks (board_count DESC);

-- RLS: public read
ALTER MATERIALIZED VIEW mv_board_interlocks OWNER TO postgres;

-- Stats
SELECT
  COUNT(*) as total_interlockers,
  COUNT(*) FILTER (WHERE board_count >= 3) as three_plus_boards,
  COUNT(*) FILTER (WHERE board_count >= 5) as five_plus_boards,
  COUNT(*) FILTER (WHERE max_entity_system_count >= 2) as cross_system,
  COUNT(*) FILTER (WHERE connects_community_controlled) as community_connected,
  ROUND(AVG(board_count), 1) as avg_boards,
  MAX(board_count) as max_boards,
  ROUND(AVG(interlock_score), 1) as avg_score,
  MAX(interlock_score) as max_score
FROM mv_board_interlocks;
