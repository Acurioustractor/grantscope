-- ============================================================================
-- APPLIED to prod 2026-06-19 (Ben approved). Identity-keyed MVs for person
-- disambiguation — the leaderboard-changing step. Built mv_person_identity_network
-- (328,939 rows) + mv_person_identity_influence (237,815 identities, 65 nominee blocks).
-- App re-point in same commit: api/data/person leaderboard now reads
-- mv_person_identity_influence WHERE NOT is_nominee_block.
-- ============================================================================
--
-- Builds NEW identity-keyed MVs ALONGSIDE the existing name-keyed ones
-- (mv_person_influence / mv_person_entity_network are left untouched, so the
-- shipped leaderboards and the board-count guard keep working unchanged).
--
-- Grain change: name → identity_key (from person_identities). Names not in
-- person_identities (the ~237K non-megamerge names) map to identity_key = name,
-- is_nominee_block = false (COALESCE), so these MVs cover EVERYONE.
--
-- Two correctness fixes vs the existing MVs:
--   1. identity grain collapses trustee/nominee megamerges into one identity
--      and carries is_nominee_block so rankings can exclude them.
--   2. money is de-duped per (identity, entity) BEFORE summing — the existing
--      mv_person_influence double-counts money when a person holds >1 role_type
--      on the same entity (latent bug; preserved here only if you want parity).
--
-- App re-point (SEPARATE follow-up, not in this file): point the leaderboard /
-- ranking queries at mv_person_identity_influence WHERE NOT is_nominee_block.
-- ----------------------------------------------------------------------------

-- (identity_key, entity_id) → identity attributes. All roles of a (name,entity)
-- share one component by construction, so DISTINCT collapses cleanly.
DROP MATERIALIZED VIEW IF EXISTS mv_person_identity_network CASCADE;
CREATE MATERIALIZED VIEW mv_person_identity_network AS
WITH idmap AS (
  SELECT DISTINCT pr.person_name_normalised, pr.entity_id, pi.identity_key, pi.is_nominee_block
  FROM person_identities pi
  JOIN person_roles pr ON pr.id = pi.role_id
),
net AS (
  SELECT
    COALESCE(m.identity_key, n.person_name_normalised) AS identity_key,
    n.person_name_normalised,
    n.person_name_display,
    n.entity_id,
    n.entity_name,
    n.entity_abn,
    n.entity_type,
    n.source,
    n.is_community_controlled,
    COALESCE(m.is_nominee_block, false) AS is_nominee_block,
    n.procurement_dollars, n.contract_count,
    n.justice_dollars, n.justice_count,
    n.donation_dollars, n.donation_count
  FROM mv_person_entity_network n
  LEFT JOIN idmap m
    ON m.person_name_normalised = n.person_name_normalised
   AND m.entity_id = n.entity_id
)
-- one row per (identity, entity): money taken ONCE (max), not summed over role rows
SELECT
  identity_key,
  min(person_name_normalised) AS person_name_normalised,
  min(person_name_display)    AS person_name_display,
  entity_id,
  min(entity_name)            AS entity_name,
  min(entity_abn)             AS entity_abn,
  min(entity_type)            AS entity_type,
  bool_or(is_community_controlled) AS is_community_controlled,
  bool_or(is_nominee_block)        AS is_nominee_block,
  array_agg(DISTINCT source)  AS sources,
  max(procurement_dollars)    AS procurement_dollars,
  max(contract_count)         AS contract_count,
  max(justice_dollars)        AS justice_dollars,
  max(justice_count)          AS justice_count,
  max(donation_dollars)       AS donation_dollars,
  max(donation_count)         AS donation_count
FROM net
GROUP BY identity_key, entity_id;

CREATE UNIQUE INDEX mv_person_identity_network_pk
  ON mv_person_identity_network (identity_key, entity_id);
CREATE INDEX mv_person_identity_network_name_idx
  ON mv_person_identity_network (person_name_normalised);

-- Per-identity rollup — mirrors mv_person_influence columns + identity_key +
-- is_nominee_block. board_count and money are now correct per real identity.
DROP MATERIALIZED VIEW IF EXISTS mv_person_identity_influence CASCADE;
CREATE MATERIALIZED VIEW mv_person_identity_influence AS
SELECT
  identity_key,
  min(person_name_normalised) AS person_name_normalised,
  min(person_name_display)    AS person_name,
  bool_or(is_nominee_block)   AS is_nominee_block,
  count(*)                                              AS board_count,
  count(*) FILTER (WHERE is_community_controlled)       AS acco_boards,
  array_agg(DISTINCT entity_type)                       AS entity_types,
  sum(procurement_dollars) AS total_procurement,
  sum(contract_count)      AS total_contracts,
  sum(justice_dollars)     AS total_justice,
  sum(donation_dollars)    AS total_donations,
  (sum(procurement_dollars) > 0)::int
    + (sum(justice_dollars) > 0)::int
    + (sum(donation_dollars) > 0)::int                  AS financial_system_count,
  -- recomputed at identity grain (existing influence_score used name-level board_count)
  count(*)::numeric * (1 + ln(1 + sum(procurement_dollars) + sum(justice_dollars) + sum(donation_dollars)))
                                                        AS influence_score
FROM mv_person_identity_network
GROUP BY identity_key;

CREATE UNIQUE INDEX mv_person_identity_influence_pk
  ON mv_person_identity_influence (identity_key);
CREATE INDEX mv_person_identity_influence_rank_idx
  ON mv_person_identity_influence (financial_system_count DESC, total_justice DESC)
  WHERE NOT is_nominee_block;

-- Sanity after apply (run manually):
--   SELECT count(*) total, count(*) FILTER (WHERE is_nominee_block) nominees
--     FROM mv_person_identity_influence;
--   -- Mark Smith should show the SA justice person (~$3.45M) ranked, nominee block excluded:
--   SELECT person_name, board_count, total_justice, is_nominee_block
--     FROM mv_person_identity_influence
--    WHERE person_name_normalised='MARK SMITH' ORDER BY total_justice DESC NULLS LAST LIMIT 6;
