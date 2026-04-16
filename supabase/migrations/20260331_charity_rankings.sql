-- Charity Rankings: 6-dimension composite scoring for 42K+ charities
-- Dimensions: Revenue(25%), Growth(25%), Leverage(15%), Efficiency(10%), Network(15%), Health(10%)

-- Step 1: Helper view for network connections per entity (shared directors)
CREATE MATERIALIZED VIEW IF NOT EXISTS mv_charity_network AS
SELECT
  e.abn,
  COUNT(DISTINCT r.target_entity_id) FILTER (WHERE r.source_entity_id = e.id) +
  COUNT(DISTINCT r.source_entity_id) FILTER (WHERE r.target_entity_id = e.id) AS network_connections
FROM gs_entities e
LEFT JOIN gs_relationships r
  ON (r.source_entity_id = e.id OR r.target_entity_id = e.id)
  AND r.relationship_type = 'shared_director'
WHERE e.abn IS NOT NULL
GROUP BY e.abn, e.id;

CREATE UNIQUE INDEX IF NOT EXISTS idx_charity_network_abn ON mv_charity_network (abn);

-- Step 2: Main charity rankings materialized view
CREATE MATERIALIZED VIEW IF NOT EXISTS mv_charity_rankings AS
WITH latest AS (
  SELECT
    a.abn,
    a.charity_name AS name,
    a.charity_size,
    a.total_gross_income AS revenue,
    a.total_expenses AS expenses,
    a.total_assets AS assets,
    a.net_surplus_deficit AS surplus,
    a.staff_fte AS fte,
    a.staff_volunteers AS volunteers,
    CASE WHEN NULLIF(a.staff_fte, 0) > 0
      THEN a.staff_volunteers::numeric / a.staff_fte
      ELSE 0
    END AS vol_fte_ratio,
    CASE WHEN NULLIF(a.staff_fte, 0) > 0
      THEN a.total_gross_income / a.staff_fte
      ELSE 0
    END AS rev_per_fte
  FROM acnc_ais a
  WHERE a.ais_year = 2023 AND a.total_gross_income > 0
),
growth AS (
  SELECT
    curr.abn,
    CASE
      WHEN base.total_gross_income > 0 AND curr.total_gross_income > 0
      THEN (POWER(curr.total_gross_income::float / base.total_gross_income, 1.0 / 5) - 1) * 100
      ELSE 0
    END AS cagr
  FROM acnc_ais curr
  JOIN acnc_ais base ON curr.abn = base.abn AND base.ais_year = 2018
  WHERE curr.ais_year = 2023 AND curr.total_gross_income > 0
),
maxvals AS (
  SELECT MAX(revenue) AS max_revenue FROM latest WHERE revenue > 0
),
scored AS (
  SELECT
    l.abn,
    l.name,
    e.gs_id,
    e.id AS entity_id,
    e.entity_type,
    e.sector,
    e.state,
    e.is_community_controlled,
    l.charity_size,
    l.revenue,
    l.expenses,
    l.assets,
    l.surplus,
    l.fte,
    l.volunteers,
    l.vol_fte_ratio,
    l.rev_per_fte,
    COALESCE(g.cagr, 0) AS cagr,
    COALESCE(n.network_connections, 0) AS network_connections,
    -- Individual dimension scores (0-100)
    LEAST(100, CASE WHEN l.revenue > 0 AND m.max_revenue > 0
      THEN LOG(l.revenue) / LOG(m.max_revenue) * 100 ELSE 0 END
    ) AS score_revenue,
    LEAST(100, GREATEST(0, COALESCE(g.cagr, 0) * 2.5)) AS score_growth,
    LEAST(100, l.vol_fte_ratio * 2) AS score_leverage,
    LEAST(100, l.rev_per_fte / 500000 * 100) AS score_efficiency,
    LEAST(100, COALESCE(n.network_connections, 0) * 5) AS score_network,
    LEAST(100, GREATEST(0,
      CASE WHEN NULLIF(l.revenue, 0) > 0
        THEN (l.surplus / l.revenue + 0.1) * 200
        ELSE 0
      END
    )) AS score_health
  FROM latest l
  CROSS JOIN maxvals m
  JOIN gs_entities e ON e.abn = l.abn
  LEFT JOIN growth g ON g.abn = l.abn
  LEFT JOIN mv_charity_network n ON n.abn = l.abn
  WHERE e.entity_type IN ('charity', 'foundation', 'social_enterprise', 'company', 'trust', 'association', 'cooperative')
)
SELECT
  s.*,
  -- Composite score (weighted)
  ROUND((
    s.score_revenue * 0.25 +
    s.score_growth * 0.25 +
    s.score_leverage * 0.15 +
    s.score_efficiency * 0.10 +
    s.score_network * 0.15 +
    s.score_health * 0.10
  )::numeric, 1) AS score_composite,
  -- Ranks (computed in outer query)
  RANK() OVER (ORDER BY (
    s.score_revenue * 0.25 + s.score_growth * 0.25 + s.score_leverage * 0.15 +
    s.score_efficiency * 0.10 + s.score_network * 0.15 + s.score_health * 0.10
  ) DESC) AS rank_composite,
  RANK() OVER (ORDER BY s.revenue DESC NULLS LAST) AS rank_revenue,
  RANK() OVER (ORDER BY s.cagr DESC NULLS LAST) AS rank_growth,
  RANK() OVER (ORDER BY s.vol_fte_ratio DESC NULLS LAST) AS rank_leverage,
  RANK() OVER (ORDER BY s.network_connections DESC NULLS LAST) AS rank_network,
  RANK() OVER (ORDER BY s.fte DESC NULLS LAST) AS rank_fte,
  RANK() OVER (ORDER BY s.volunteers DESC NULLS LAST) AS rank_volunteers,
  -- Total count for percentile calculation
  COUNT(*) OVER () AS total_ranked
FROM scored s;

-- Indexes for fast lookups and sorting
CREATE UNIQUE INDEX IF NOT EXISTS idx_charity_rankings_abn ON mv_charity_rankings (abn);
CREATE INDEX IF NOT EXISTS idx_charity_rankings_gsid ON mv_charity_rankings (gs_id);
CREATE INDEX IF NOT EXISTS idx_charity_rankings_entity_id ON mv_charity_rankings (entity_id);
CREATE INDEX IF NOT EXISTS idx_charity_rankings_composite ON mv_charity_rankings (score_composite DESC);
CREATE INDEX IF NOT EXISTS idx_charity_rankings_revenue ON mv_charity_rankings (revenue DESC NULLS LAST);
CREATE INDEX IF NOT EXISTS idx_charity_rankings_cagr ON mv_charity_rankings (cagr DESC NULLS LAST);
CREATE INDEX IF NOT EXISTS idx_charity_rankings_state ON mv_charity_rankings (state);
CREATE INDEX IF NOT EXISTS idx_charity_rankings_type ON mv_charity_rankings (entity_type);
CREATE INDEX IF NOT EXISTS idx_charity_rankings_size ON mv_charity_rankings (charity_size);

-- Step 3: Board power rankings materialized view
CREATE MATERIALIZED VIEW IF NOT EXISTS mv_board_power AS
WITH board_counts AS (
  SELECT
    pr.person_name,
    COUNT(DISTINCT pr.company_abn) AS board_seats,
    ARRAY_AGG(DISTINCT e.canonical_name ORDER BY e.canonical_name) AS organizations,
    ARRAY_AGG(DISTINCT e.sector) FILTER (WHERE e.sector IS NOT NULL) AS sectors,
    ARRAY_AGG(DISTINCT e.state) FILTER (WHERE e.state IS NOT NULL) AS states
  FROM person_roles pr
  JOIN gs_entities e ON e.abn = pr.company_abn
  WHERE pr.cessation_date IS NULL
    AND pr.person_name IS NOT NULL
    AND pr.person_name != ''
  GROUP BY pr.person_name
  HAVING COUNT(DISTINCT pr.company_abn) >= 2
),
financials AS (
  SELECT
    pr.person_name,
    SUM(a.total_gross_income) AS total_org_revenue,
    SUM(a.total_assets) AS total_org_assets,
    SUM(a.staff_fte) AS total_org_fte
  FROM person_roles pr
  JOIN acnc_ais a ON a.abn = pr.company_abn AND a.ais_year = 2023
  WHERE pr.cessation_date IS NULL
    AND pr.person_name IS NOT NULL
  GROUP BY pr.person_name
)
SELECT
  bc.person_name,
  bc.board_seats,
  COALESCE(f.total_org_revenue, 0) AS total_org_revenue,
  COALESCE(f.total_org_assets, 0) AS total_org_assets,
  COALESCE(f.total_org_fte, 0) AS total_org_fte,
  bc.organizations,
  bc.sectors,
  bc.states,
  RANK() OVER (ORDER BY bc.board_seats DESC, COALESCE(f.total_org_revenue, 0) DESC) AS rank_seats,
  RANK() OVER (ORDER BY COALESCE(f.total_org_revenue, 0) DESC, bc.board_seats DESC) AS rank_revenue
FROM board_counts bc
LEFT JOIN financials f ON f.person_name = bc.person_name;

CREATE INDEX IF NOT EXISTS idx_board_power_seats ON mv_board_power (board_seats DESC);
CREATE INDEX IF NOT EXISTS idx_board_power_revenue ON mv_board_power (total_org_revenue DESC);
CREATE INDEX IF NOT EXISTS idx_board_power_name ON mv_board_power (person_name);
