-- foundation-trends.sql
-- Year-over-year foundation financial trends from ACNC AIS data
-- Only tracks foundations we know about (join on acnc_abn), not all 360K charities

DROP MATERIALIZED VIEW IF EXISTS mv_foundation_trends;
CREATE MATERIALIZED VIEW mv_foundation_trends AS
WITH foundation_years AS (
  SELECT
    f.id as foundation_id,
    f.name,
    f.acnc_abn,
    f.type,
    a.ais_year,
    a.grants_donations_au,
    a.total_revenue,
    a.total_expenses,
    a.donations_and_bequests,
    a.revenue_from_government,
    a.total_assets,
    a.net_assets_liabilities,
    a.staff_fte,
    a.staff_volunteers,
    a.charity_size
  FROM foundations f
  JOIN acnc_ais a ON a.abn = f.acnc_abn
  WHERE f.acnc_abn IS NOT NULL
),
with_lag AS (
  SELECT
    *,
    LAG(grants_donations_au) OVER (PARTITION BY acnc_abn ORDER BY ais_year) as prev_giving,
    LAG(total_revenue) OVER (PARTITION BY acnc_abn ORDER BY ais_year) as prev_revenue,
    LAG(total_assets) OVER (PARTITION BY acnc_abn ORDER BY ais_year) as prev_assets,
    LAG(staff_fte) OVER (PARTITION BY acnc_abn ORDER BY ais_year) as prev_fte
  FROM foundation_years
)
SELECT
  foundation_id,
  name,
  acnc_abn,
  type,
  ais_year,
  grants_donations_au::bigint as giving,
  total_revenue::bigint as revenue,
  total_expenses::bigint as expenses,
  donations_and_bequests::bigint as donations_received,
  revenue_from_government::bigint as govt_revenue,
  total_assets::bigint as assets,
  net_assets_liabilities::bigint as net_assets,
  staff_fte,
  staff_volunteers,
  charity_size,
  -- Year-over-year changes
  CASE WHEN prev_giving > 0 THEN ROUND(((grants_donations_au - prev_giving) / prev_giving * 100)::numeric, 1) END as giving_growth_pct,
  CASE WHEN prev_revenue > 0 THEN ROUND(((total_revenue - prev_revenue) / prev_revenue * 100)::numeric, 1) END as revenue_growth_pct,
  CASE WHEN prev_assets > 0 THEN ROUND(((total_assets - prev_assets) / prev_assets * 100)::numeric, 1) END as asset_growth_pct,
  -- Giving ratio (grants given / total expenses)
  CASE WHEN total_expenses > 0 THEN ROUND((grants_donations_au / total_expenses * 100)::numeric, 1) END as giving_ratio_pct,
  -- Self-sufficiency (non-govt revenue / total revenue)
  CASE WHEN total_revenue > 0 THEN ROUND(((total_revenue - COALESCE(revenue_from_government, 0)) / total_revenue * 100)::numeric, 1) END as self_sufficiency_pct
FROM with_lag
WHERE ais_year >= 2017;

CREATE UNIQUE INDEX ON mv_foundation_trends (acnc_abn, ais_year);
CREATE INDEX ON mv_foundation_trends (foundation_id);
CREATE INDEX ON mv_foundation_trends (ais_year);
CREATE INDEX ON mv_foundation_trends (giving DESC NULLS LAST);
