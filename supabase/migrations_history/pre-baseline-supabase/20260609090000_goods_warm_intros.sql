-- Goods Command Center — Warm-Intro Engine (Phase 2.5, the connective spine).
--
-- For every entity-linked Goods relationship (funder/foundation/buyer/...), find
-- the board members who can open that door, and — the killer signal — whether
-- each connector ALSO sits on the board of another org Goods is already engaged
-- with (bridges_to_goods) or a community-controlled org.
--
-- Data-quality gate FIRST (per the "verify before scoring" rule): the board
-- interlock graph collapses by normalised name, so generic names ("JOHN SMITH")
-- false-interlock across dozens of unrelated boards. We bound board_count to
-- 2..15 — real interlocks live here; >15 is dominated by name collisions. The
-- view returns board_count so the UI can band confidence and stay honest.
--
-- A VIEW (not materialized): request-time, always current, small once filtered
-- to the ~92 Goods entities. Read by the service-role client.

CREATE OR REPLACE VIEW v_goods_warm_intros AS
WITH goods AS (
  SELECT gr.id AS rel_id, gr.entity_id, gr.display_name, gr.relationship_type,
         gr.warmth_display::int AS warmth_display
  FROM goods_relationships gr
  WHERE gr.entity_id IS NOT NULL
),
conn AS (
  SELECT
    g.rel_id, g.display_name AS target_name, g.relationship_type, g.warmth_display,
    bi.person_name_display AS person, pen.role_type,
    bi.board_count, bi.interlock_score, bi.connects_community_controlled,
    bi.organisations, bi.entity_ids
  FROM goods g
  JOIN mv_person_entity_network pen ON pen.entity_id = g.entity_id
  JOIN mv_board_interlocks bi ON bi.person_name_normalised = pen.person_name_normalised
  -- collision gate: real board interlocks; exclude generic-name noise
  WHERE bi.board_count BETWEEN 2 AND 15
)
SELECT
  c.rel_id,
  c.target_name,
  c.relationship_type,
  c.warmth_display,
  c.person,
  c.role_type,
  c.board_count,
  c.interlock_score,
  c.connects_community_controlled,
  -- up to 4 other orgs this person bridges to (excluding the target itself)
  (SELECT array_agg(o) FROM (
      SELECT DISTINCT o FROM unnest(c.organisations) o
      WHERE o IS DISTINCT FROM c.target_name
      ORDER BY o LIMIT 4
   ) s) AS other_orgs,
  -- the warmest OTHER Goods org this connector also boards — the strongest intro
  (SELECT g2.display_name FROM goods g2
     WHERE g2.entity_id = ANY(c.entity_ids) AND g2.rel_id <> c.rel_id
     ORDER BY g2.warmth_display DESC LIMIT 1) AS bridges_to_goods
FROM conn c;

COMMENT ON VIEW v_goods_warm_intros IS
  'Warm-intro engine: board-member connectors into each entity-linked Goods relationship, with collision gate (board_count 2..15) and bridges_to_goods cross-link. Read by goods-warm-intros.ts.';
