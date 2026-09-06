-- 20260906120200_mv_charity_trajectory.sql
-- One row per charity: its financial trajectory across the ACNC Annual Information Statements 2017-2023.
--
-- Why: acnc_ais holds 360K statements over seven years and every page that reads it takes the latest year only
-- (mv_acnc_latest, mv_justice_charity_financial_health). Direction is the thing a funder or a council actually
-- wants: is this organisation growing, shrinking, living on one government contract, or running deficits three
-- years straight. Computing that per request over 360K rows is the RPC-generic-plan trap; it belongs here.
--
-- Definitions (all money is the statement's own figures, no filtering):
--   first/last      first and latest ais_year with a non-null total_revenue for the ABN
--   revenue_cagr    compound annual growth from first to last, only when both > 0 and span >= 2 years
--   gov_share       revenue_from_government / total_revenue for that year
--   donation_share  donations_and_bequests / total_revenue
--   margin          net_surplus_deficit / total_revenue
--   deficit_years_last3  statements in the last three reported years with net_surplus_deficit < 0
--   reserve_months  net_assets_liabilities / total_expenses * 12 (how long it could run with no income)
--   trend           'shrinking' revenue down >20% first->last, 'growing' up >20%, else 'steady'; 'single_year'
--                   when one statement only; 'lapsed' when the last statement is before 2022
BEGIN;

CREATE MATERIALIZED VIEW public.mv_charity_trajectory AS
WITH s AS (
  SELECT DISTINCT ON (abn, ais_year) abn, ais_year, charity_name, charity_size, total_revenue, total_expenses,
         revenue_from_government, donations_and_bequests, net_surplus_deficit, net_assets_liabilities,
         staff_fte, staff_volunteers, employee_expenses
  FROM acnc_ais
  WHERE total_revenue IS NOT NULL AND ais_year BETWEEN 2017 AND 2023
  ORDER BY abn, ais_year, date_ais_received DESC NULLS LAST
),
ranked AS (
  SELECT s.*,
         row_number() OVER (PARTITION BY abn ORDER BY ais_year) AS rn_asc,
         row_number() OVER (PARTITION BY abn ORDER BY ais_year DESC) AS rn_desc,
         count(*) OVER (PARTITION BY abn) AS years_reported
  FROM s
),
first AS (SELECT * FROM ranked WHERE rn_asc = 1),
last AS (SELECT * FROM ranked WHERE rn_desc = 1),
prev AS (SELECT * FROM ranked WHERE rn_desc = 2),
last3 AS (
  SELECT abn, count(*) FILTER (WHERE net_surplus_deficit < 0) AS deficit_years_last3
  FROM ranked WHERE rn_desc <= 3 GROUP BY abn
),
peak AS (SELECT abn, max(total_revenue) AS peak_revenue FROM ranked GROUP BY abn)
SELECT l.abn,
       l.charity_name,
       l.charity_size,
       c.state,
       e.lga_code,
       e.lga_name,
       e.gs_id,
       l.years_reported::int,
       f.ais_year AS first_year,
       l.ais_year AS last_year,
       f.total_revenue AS revenue_first,
       p.total_revenue AS revenue_prev,
       l.total_revenue AS revenue_last,
       pk.peak_revenue,
       CASE WHEN f.total_revenue > 0 AND l.total_revenue > 0 AND l.ais_year - f.ais_year >= 2
            THEN round((power(l.total_revenue / f.total_revenue, 1.0 / (l.ais_year - f.ais_year)) - 1) * 100, 1) END AS revenue_cagr_pct,
       CASE WHEN f.total_revenue > 0 THEN round((l.total_revenue - f.total_revenue) / f.total_revenue * 100, 1) END AS revenue_change_pct,
       CASE WHEN p.total_revenue > 0 THEN round((l.total_revenue - p.total_revenue) / p.total_revenue * 100, 1) END AS revenue_change_yoy_pct,
       CASE WHEN l.total_revenue > 0 THEN round(coalesce(l.revenue_from_government, 0) / l.total_revenue * 100, 1) END AS gov_share_last_pct,
       CASE WHEN f.total_revenue > 0 THEN round(coalesce(f.revenue_from_government, 0) / f.total_revenue * 100, 1) END AS gov_share_first_pct,
       CASE WHEN l.total_revenue > 0 THEN round(coalesce(l.donations_and_bequests, 0) / l.total_revenue * 100, 1) END AS donation_share_last_pct,
       CASE WHEN f.total_revenue > 0 THEN round(coalesce(f.donations_and_bequests, 0) / f.total_revenue * 100, 1) END AS donation_share_first_pct,
       l.revenue_from_government AS gov_revenue_last,
       l.donations_and_bequests AS donations_last,
       f.donations_and_bequests AS donations_first,
       CASE WHEN l.total_revenue > 0 THEN round(coalesce(l.net_surplus_deficit, 0) / l.total_revenue * 100, 1) END AS margin_last_pct,
       coalesce(d.deficit_years_last3, 0)::int AS deficit_years_last3,
       l.net_assets_liabilities AS net_assets_last,
       CASE WHEN l.total_expenses > 0 AND l.net_assets_liabilities IS NOT NULL
            THEN round(l.net_assets_liabilities / l.total_expenses * 12, 1) END AS reserve_months,
       f.staff_fte AS fte_first,
       l.staff_fte AS fte_last,
       l.staff_volunteers AS volunteers_last,
       CASE
         WHEN l.years_reported = 1 THEN 'single_year'
         WHEN l.ais_year < 2022 THEN 'lapsed'
         WHEN f.total_revenue > 0 AND (l.total_revenue - f.total_revenue) / f.total_revenue < -0.20 THEN 'shrinking'
         WHEN f.total_revenue > 0 AND (l.total_revenue - f.total_revenue) / f.total_revenue > 0.20 THEN 'growing'
         WHEN f.total_revenue = 0 AND l.total_revenue > 0 THEN 'growing'
         ELSE 'steady'
       END AS trend,
       (l.total_revenue > 0 AND coalesce(l.revenue_from_government, 0) / l.total_revenue >= 0.70) AS gov_dependent,
       (coalesce(d.deficit_years_last3, 0) >= 3) AS three_year_deficit,
       now() AS refreshed_at
FROM last l
JOIN first f ON f.abn = l.abn
LEFT JOIN prev p ON p.abn = l.abn
LEFT JOIN last3 d ON d.abn = l.abn
LEFT JOIN peak pk ON pk.abn = l.abn
LEFT JOIN acnc_charities c ON c.abn = l.abn
LEFT JOIN LATERAL (
  SELECT gs_id, lga_code, lga_name FROM gs_entities WHERE abn = l.abn ORDER BY (entity_type = 'charity') DESC, created_at LIMIT 1
) e ON true;

CREATE UNIQUE INDEX mv_charity_trajectory_pk ON public.mv_charity_trajectory (abn);
CREATE INDEX mv_charity_trajectory_trend ON public.mv_charity_trajectory (trend);
CREATE INDEX mv_charity_trajectory_lga ON public.mv_charity_trajectory (lga_code);
CREATE INDEX mv_charity_trajectory_state ON public.mv_charity_trajectory (state);
CREATE INDEX mv_charity_trajectory_rev ON public.mv_charity_trajectory (revenue_last DESC NULLS LAST);

GRANT SELECT ON public.mv_charity_trajectory TO anon, authenticated, service_role;

INSERT INTO public.mv_refresh_registry (mv_name, tier, enabled, force_non_concurrent, notes)
VALUES ('mv_charity_trajectory', 'nightly', true, false, 'Per-charity 2017-2023 trajectory from acnc_ais; unique abn for concurrent refresh; read by /charities/trajectories and /charities/[abn]')
ON CONFLICT (mv_name) DO UPDATE SET tier = 'nightly', enabled = true, notes = EXCLUDED.notes;

INSERT INTO public.schema_ownership (object, owner, consumers, evidence, declared_on)
VALUES ('mv_charity_trajectory', 'grantscope', '{grantscope}', 'read by /charities/trajectories', current_date)
ON CONFLICT (object) DO NOTHING;

COMMIT;
