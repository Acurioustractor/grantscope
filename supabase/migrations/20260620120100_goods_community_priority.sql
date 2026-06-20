-- Goods Command Center — SEIFA disadvantage overlay + serve-next score.
--
-- Overlays ABS SEIFA 2021 IRSD (Index of Relative Socio-economic Disadvantage)
-- onto goods_communities by postcode, and derives a "serve next" score so the
-- Communities Hub can rank where to deploy beds next by REAL unmet demand,
-- amplified by how disadvantaged the place is.
--
-- IRSD decile: 1 = most disadvantaged, 10 = least. We join postcode -> decile.
-- index_type is stored uppercase ('IRSD'); a couple of legacy migrations wrote
-- lowercase, so we match case-insensitively to stay correct either way.
--
-- serve_next_score = unmet bed demand * (1 .. 2x disadvantage multiplier).
--   - A community with no unmet demand scores ~0 regardless of disadvantage
--     (you don't "serve next" where there's nothing to serve).
--   - Most-disadvantaged (decile 1) doubles the weight of its unmet demand.
--   - No SEIFA match -> multiplier 1.0 (ranks on demand alone, not penalised).
-- unmet_beds follows the Hub's existing convention (demand_beds vs the
-- assets_deployed counter), so the score lines up with the Beds (D / Demand)
-- column already on the page.
--
-- A VIEW (not materialized): request-time, always current, small. Exposes
-- community_id so it slots into the Hub's chunked .in('community_id', ...) fetch.
-- Read by goods-communities-hub.ts.

CREATE OR REPLACE VIEW v_goods_community_priority AS
WITH seifa AS (
  -- one decile per postcode; MIN = the most disadvantaged pocket in that postcode
  SELECT postcode, MIN(decile_national)::int AS irsd_decile
  FROM seifa_2021
  WHERE UPPER(index_type) = 'IRSD'
    AND decile_national IS NOT NULL
  GROUP BY postcode
)
SELECT
  gc.id                                                   AS community_id,
  gc.community_name,
  gc.state,
  gc.postcode,
  s.irsd_decile                                           AS seifa_irsd_decile,
  (s.irsd_decile IS NOT NULL)                             AS seifa_available,

  -- 0..100 disadvantage: decile 1 -> 100, decile 10 -> 0
  CASE WHEN s.irsd_decile IS NULL THEN NULL
       ELSE ROUND((10 - s.irsd_decile) * (100.0 / 9.0))::int
  END                                                     AS disadvantage_score,

  COALESCE(gc.demand_beds, 0)                             AS demand_beds,
  COALESCE(gc.assets_deployed, 0)                         AS assets_deployed,
  GREATEST(COALESCE(gc.demand_beds, 0) - COALESCE(gc.assets_deployed, 0), 0) AS unmet_beds,
  COALESCE(gc.indigenous_population_pct, 0)               AS indigenous_population_pct,

  -- serve-next: unmet bed demand, amplified up to 2x by disadvantage
  ROUND(
    GREATEST(COALESCE(gc.demand_beds, 0) - COALESCE(gc.assets_deployed, 0), 0)
    * (1 + COALESCE((10 - s.irsd_decile) / 9.0, 0))
  , 1)                                                    AS serve_next_score

FROM goods_communities gc
LEFT JOIN seifa s ON s.postcode = gc.postcode;

COMMENT ON VIEW v_goods_community_priority IS
  'SEIFA 2021 IRSD disadvantage (postcode-joined, decile 1=most disadvantaged) overlaid on goods_communities, with serve_next_score = unmet bed demand amplified up to 2x by disadvantage. Read by goods-communities-hub.ts.';
