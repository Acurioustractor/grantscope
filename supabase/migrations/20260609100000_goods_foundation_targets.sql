-- Goods Command Center — Foundation Target List.
--
-- Rank the 11K foundations as NEXT philanthropy targets for Goods: theme-fit
-- (thematic_focus overlap with the Goods wheelhouse) + board-bridge (a board
-- member shared with an org Goods is already engaged with — reuses the warm-
-- intro spine) + DGR + giving capacity. Excludes foundations already in the
-- warmth registry (these are NET-NEW targets).
--
-- Same collision gate as the warm-intro engine (board_count 2..15).
-- A VIEW: request-time, always current. Read by goods-foundation-targets.ts.

CREATE OR REPLACE VIEW v_goods_foundation_targets AS
WITH themes AS (
  SELECT ARRAY['indigenous','aboriginal','rural_remote','social-enterprise','housing',
               'employment','economic_development','regenerative','agriculture']::text[] AS arr
),
goods_rel AS (
  SELECT DISTINCT entity_id, display_name, warmth_display::int AS warmth
  FROM goods_relationships WHERE entity_id IS NOT NULL
),
goods_ent AS (SELECT DISTINCT entity_id FROM goods_rel),
-- people who sit on a Goods-engaged org's board (and the warmest such org)
goods_people AS (
  SELECT DISTINCT ON (pen.person_name_normalised)
    pen.person_name_normalised, pen.person_name_display,
    gr.display_name AS goods_org, gr.warmth
  FROM mv_person_entity_network pen
  JOIN goods_rel gr ON gr.entity_id = pen.entity_id
  WHERE pen.board_count BETWEEN 2 AND 15
  ORDER BY pen.person_name_normalised, gr.warmth DESC
),
-- for any entity, the strongest Goods-person who also boards it = a warm bridge
bridge AS (
  SELECT DISTINCT ON (pen.entity_id)
    pen.entity_id AS cand_entity,
    gp.person_name_display AS connector,
    gp.goods_org AS bridged_org,
    gp.warmth AS bridged_warmth
  FROM mv_person_entity_network pen
  JOIN goods_people gp ON gp.person_name_normalised = pen.person_name_normalised
  WHERE pen.board_count BETWEEN 2 AND 15
  ORDER BY pen.entity_id, gp.warmth DESC
),
cand AS (
  SELECT
    f.id, f.name, f.gs_entity_id, f.total_giving_annual, f.avg_grant_size,
    f.grant_range_min, f.grant_range_max, f.has_dgr, f.geographic_focus,
    cardinality(ARRAY(SELECT unnest(f.thematic_focus) INTERSECT SELECT unnest((SELECT arr FROM themes)))) AS theme_hits,
    ARRAY(SELECT unnest(f.thematic_focus) INTERSECT SELECT unnest((SELECT arr FROM themes))) AS matched_themes
  FROM foundations f
  WHERE f.thematic_focus && (SELECT arr FROM themes)
    AND f.gs_entity_id IS NOT NULL
    AND f.gs_entity_id NOT IN (SELECT entity_id FROM goods_ent)
)
SELECT
  c.id, c.name, c.gs_entity_id,
  c.total_giving_annual, c.avg_grant_size, c.grant_range_min, c.grant_range_max,
  c.has_dgr, c.theme_hits, c.matched_themes, c.geographic_focus,
  b.connector, b.bridged_org, b.bridged_warmth,
  (b.connector IS NOT NULL) AS has_bridge,
  -- composite priority: a warm bridge dominates, then theme fit, DGR, giving capacity
  ROUND(
    (CASE WHEN b.connector IS NOT NULL THEN 1000 ELSE 0 END)
    + c.theme_hits * 100
    + (CASE WHEN c.has_dgr THEN 50 ELSE 0 END)
    + LEAST(50, COALESCE(c.total_giving_annual, 0) / 1000000.0 * 10)
  )::int AS priority_score
FROM cand c
LEFT JOIN bridge b ON b.cand_entity = c.gs_entity_id;

COMMENT ON VIEW v_goods_foundation_targets IS
  'Next-philanthropy-target ranking: theme-fit + board-bridge (warm-intro spine) + DGR + giving, excluding already-engaged foundations. Read by goods-foundation-targets.ts.';
