-- 20260907090000_mv_lga_allocation_delivery_and_trajectory.sql
-- mv_lga_allocation, second cut: a delivery-postcode lane for Commonwealth grants, and per-council charity
-- trajectory rollups. Recreated in place (no view or matview depends on it; checked pg_depend 2026-09-07).
--
-- Delivery lane. grantconnect_awards carries delivery_postcode on 152,546 of 291,264 rows; 146,568 are a
-- four-digit postcode, 5,978 say 'Multiple', the rest are null. Those rows hold $51.3bn of $230.0bn. Money is
-- spread across councils by abs_poa_lga_ratio (a postcode's share of each council), so a straddling postcode
-- splits the award instead of picking a side. 220 of 2,708 distinct delivery postcodes are not in the ratio
-- table and are dropped from the lane; they are not in the disclosure columns either, which is why the
-- comparable base below is defined on the ratio JOIN, not on the postcode being present.
--
-- The recipient lane is untouched. The two are only comparable on the rows that have BOTH a placed recipient
-- and a mapped delivery postcode, so the view carries that base per council:
--   cw_recipient_24m_with_delivery   recipient-lane 24m value restricted to rows with a mapped delivery postcode
--   cw_delivery_stated_pct           that base as a share of the recipient lane 24m value (how sure)
--   cw_delivery_value_24m            what the delivery lane says was spent in this council over the same 24m
-- A council with a large recipient figure and a small delivery figure is a hub; the reverse is a community
-- served from somewhere else. Where cw_delivery_stated_pct is low the comparison is about the record.
--
-- Measured 2026-09-07 (dry run): nationally the comparable base is $3.36bn of a $30.55bn recipient lane over 24 months
-- (11%). Coverage is by agency, not by year: the Australian Research Council states a delivery postcode on 100% of
-- value, Employment 54%, Infrastructure 40%, Education 11%, Health, Disability and Ageing 2%, and the National
-- Indigenous Australians Agency ($3.84bn in 24 months) on NONE. Alice Springs has a 1% base. The lane therefore
-- cannot show the hub-versus-community gap for the agencies that create it; it shows where the record is silent.
--
-- Trajectory rollups read mv_charity_trajectory (nightly, refreshed first: mv_refresh_plan orders by pg_depend).
-- 'shrinking' requires revenue_last > 0, matching /charities/trajectories: a $0 latest year is dormant, not shrinking.
BEGIN;

DROP MATERIALIZED VIEW IF EXISTS public.mv_lga_allocation;

CREATE MATERIALIZED VIEW public.mv_lga_allocation AS
WITH lga AS (
  SELECT p.lga_code, p.lga_name, p.state, p.erp_2023 AS population, p.erp_2018, p.area_sqkm
  FROM abs_lga_population p
),
need AS (
  SELECT r.lga_code,
         round(sum(s.score * r.ratio) / nullif(sum(r.ratio) FILTER (WHERE s.score IS NOT NULL), 0), 0) AS irsd_score,
         round(sum(s.decile_national * r.ratio) / nullif(sum(r.ratio) FILTER (WHERE s.decile_national IS NOT NULL), 0), 1) AS irsd_decile,
         min(s.decile_national) AS min_irsd_decile,
         count(DISTINCT r.poa_code) AS postcode_count,
         count(DISTINCT r.poa_code) FILTER (WHERE s.score IS NOT NULL) AS postcodes_with_seifa
  FROM abs_poa_lga_ratio r
  LEFT JOIN seifa_2021 s ON s.postcode = r.poa_code AND s.index_type = 'IRSD'
  GROUP BY r.lga_code
),
remote AS (
  SELECT DISTINCT ON (r.lga_code) r.lga_code, g.remoteness_2021 AS remoteness
  FROM abs_poa_lga_ratio r
  JOIN (SELECT postcode, min(remoteness_2021) AS remoteness_2021 FROM postcode_geo
        WHERE remoteness_2021 IS NOT NULL AND remoteness_2021 <> '' GROUP BY postcode) g ON g.postcode = r.poa_code
  GROUP BY r.lga_code, g.remoteness_2021
  ORDER BY r.lga_code, sum(r.ratio) DESC
),
orgs AS (
  SELECT e.lga_code,
         count(*) AS org_count,
         count(*) FILTER (WHERE e.is_community_controlled OR e.entity_type = 'indigenous_corp') AS community_controlled,
         count(*) FILTER (WHERE e.entity_type = 'charity') AS charities
  FROM gs_entities e
  WHERE e.lga_code IS NOT NULL
  GROUP BY e.lga_code
),
acnc AS (
  SELECT e.lga_code,
         count(*) AS charities_reporting,
         sum(a.total_revenue) AS charity_revenue,
         sum(a.revenue_from_government) AS charity_gov_revenue,
         sum(a.donations_and_bequests) AS charity_donations,
         sum(a.staff_fte) AS charity_fte,
         sum(a.staff_volunteers) AS charity_volunteers
  FROM acnc_ais a
  JOIN gs_entities e ON e.abn = a.abn AND e.lga_code IS NOT NULL
  WHERE a.ais_year = 2023
  GROUP BY e.lga_code
),
mapped_dp AS (
  -- delivery postcodes the ratio table can place; the comparable base for both lanes
  SELECT DISTINCT poa_code FROM abs_poa_lga_ratio
),
cw AS (
  SELECT e.lga_code,
         count(*) AS cw_grant_count,
         sum(g.value_aud) AS cw_grant_value,
         sum(g.value_aud) FILTER (WHERE g.approval_date >= (current_date - interval '2 years')) AS cw_grant_value_24m,
         sum(g.value_aud) FILTER (WHERE g.approval_date >= (current_date - interval '2 years') AND m.poa_code IS NOT NULL) AS cw_recipient_24m_with_delivery
  FROM grantconnect_awards g
  JOIN gs_entities e ON e.id = g.gs_entity_id AND e.lga_code IS NOT NULL
  LEFT JOIN mapped_dp m ON m.poa_code = g.delivery_postcode
  GROUP BY e.lga_code
),
cw_deliv AS (
  SELECT r.lga_code,
         round(sum(r.ratio))::int AS cw_delivery_count,
         sum(g.value_aud * r.ratio) AS cw_delivery_value,
         sum(g.value_aud * r.ratio) FILTER (WHERE g.approval_date >= (current_date - interval '2 years')) AS cw_delivery_value_24m
  FROM grantconnect_awards g
  JOIN abs_poa_lga_ratio r ON r.poa_code = g.delivery_postcode
  GROUP BY r.lga_code
),
jf AS (
  SELECT e.lga_code,
         count(*) AS jf_grant_count,
         sum(j.amount_dollars) AS jf_grant_value
  FROM justice_funding j
  JOIN gs_entities e ON e.id = j.gs_entity_id AND e.lga_code IS NOT NULL
  WHERE j.measure_kind = 'grant'
    AND j.is_aggregate IS NOT TRUE
    AND lower(trim(j.recipient_name)) NOT IN ('total','totals','grand total','subtotal','sub-total','various','n/a','na','unknown','tbc','other')
  GROUP BY e.lga_code
),
contracts AS (
  SELECT e.lga_code,
         count(*) AS contract_count,
         sum(c.contract_value) AS contract_value,
         sum(c.contract_value) FILTER (WHERE c.contract_start >= (current_date - interval '2 years')) AS contract_value_24m
  FROM austender_contracts c
  JOIN gs_entities e ON e.abn = c.supplier_abn AND e.lga_code IS NOT NULL
  WHERE c.supplier_abn IS NOT NULL
  GROUP BY e.lga_code
),
traj AS (
  SELECT t.lga_code,
         count(*) AS charities_tracked,
         count(*) FILTER (WHERE t.trend = 'shrinking' AND t.revenue_last > 0) AS charities_shrinking,
         count(*) FILTER (WHERE t.trend = 'growing') AS charities_growing,
         count(*) FILTER (WHERE t.trend = 'lapsed') AS charities_lapsed,
         count(*) FILTER (WHERE t.gov_dependent) AS charities_gov_dependent,
         count(*) FILTER (WHERE t.three_year_deficit) AS charities_three_year_deficit,
         sum(t.revenue_first - t.revenue_last) FILTER (WHERE t.trend = 'shrinking' AND t.revenue_last > 0) AS shrinking_revenue_lost
  FROM mv_charity_trajectory t
  WHERE t.lga_code IS NOT NULL
  GROUP BY t.lga_code
),
gaps AS (
  SELECT r.lga_code, count(DISTINCT e.id) AS unplaced_sharing_postcodes
  FROM gs_entities e
  JOIN abs_poa_lga_ratio r ON r.poa_code = e.postcode
  WHERE e.lga_code IS NULL
    AND e.lga_source IN ('unresolved_multi_lga_postcode', 'state_conflict', 'postcode_unmapped_in_abs')
  GROUP BY r.lga_code
)
SELECT lga.lga_code, lga.lga_name, lga.state, rm.remoteness,
       lga.population, lga.erp_2018, lga.area_sqkm,
       n.irsd_score, n.irsd_decile, n.min_irsd_decile, n.postcode_count, n.postcodes_with_seifa,
       coalesce(o.org_count, 0)::int AS org_count,
       coalesce(o.community_controlled, 0)::int AS community_controlled,
       coalesce(o.charities, 0)::int AS charities,
       coalesce(a.charities_reporting, 0)::int AS charities_reporting,
       coalesce(a.charity_revenue, 0)::numeric AS charity_revenue,
       coalesce(a.charity_gov_revenue, 0)::numeric AS charity_gov_revenue,
       coalesce(a.charity_donations, 0)::numeric AS charity_donations,
       coalesce(a.charity_fte, 0)::numeric AS charity_fte,
       coalesce(a.charity_volunteers, 0)::bigint AS charity_volunteers,
       coalesce(cw.cw_grant_count, 0)::int AS cw_grant_count,
       coalesce(cw.cw_grant_value, 0)::numeric AS cw_grant_value,
       coalesce(cw.cw_grant_value_24m, 0)::numeric AS cw_grant_value_24m,
       -- delivery lane
       coalesce(cd.cw_delivery_count, 0)::int AS cw_delivery_count,
       coalesce(cd.cw_delivery_value, 0)::numeric AS cw_delivery_value,
       coalesce(cd.cw_delivery_value_24m, 0)::numeric AS cw_delivery_value_24m,
       coalesce(cw.cw_recipient_24m_with_delivery, 0)::numeric AS cw_recipient_24m_with_delivery,
       round(100.0 * coalesce(cw.cw_recipient_24m_with_delivery, 0) / nullif(cw.cw_grant_value_24m, 0), 0) AS cw_delivery_stated_pct,
       coalesce(jf.jf_grant_count, 0)::int AS jf_grant_count,
       coalesce(jf.jf_grant_value, 0)::numeric AS jf_grant_value,
       coalesce(c.contract_count, 0)::int AS contract_count,
       coalesce(c.contract_value, 0)::numeric AS contract_value,
       coalesce(c.contract_value_24m, 0)::numeric AS contract_value_24m,
       coalesce(g.unplaced_sharing_postcodes, 0)::int AS unplaced_sharing_postcodes,
       -- trajectory rollups
       coalesce(t.charities_tracked, 0)::int AS charities_tracked,
       coalesce(t.charities_shrinking, 0)::int AS charities_shrinking,
       coalesce(t.charities_growing, 0)::int AS charities_growing,
       coalesce(t.charities_lapsed, 0)::int AS charities_lapsed,
       coalesce(t.charities_gov_dependent, 0)::int AS charities_gov_dependent,
       coalesce(t.charities_three_year_deficit, 0)::int AS charities_three_year_deficit,
       coalesce(t.shrinking_revenue_lost, 0)::numeric AS shrinking_revenue_lost,
       round(100.0 * coalesce(t.charities_shrinking, 0) / nullif(t.charities_tracked, 0), 0) AS shrinking_share_pct,
       -- per head, on ERP 2023
       round(coalesce(a.charity_gov_revenue, 0) / nullif(lga.population, 0), 0) AS gov_revenue_per_head,
       round(coalesce(a.charity_donations, 0) / nullif(lga.population, 0), 0) AS donations_per_head,
       round(coalesce(cw.cw_grant_value_24m, 0) / nullif(lga.population, 0), 0) AS cw_grants_24m_per_head,
       round(coalesce(cd.cw_delivery_value_24m, 0) / nullif(lga.population, 0), 0) AS cw_delivery_24m_per_head,
       round(coalesce(o.org_count, 0) * 10000.0 / nullif(lga.population, 0), 1) AS orgs_per_10k,
       -- how sure: share of entities touching this council's postcodes that are actually placed
       round(100.0 * coalesce(o.org_count, 0) / nullif(coalesce(o.org_count, 0) + coalesce(g.unplaced_sharing_postcodes, 0), 0), 0) AS placed_share_pct,
       now() AS refreshed_at
FROM lga
LEFT JOIN need n ON n.lga_code = lga.lga_code
LEFT JOIN remote rm ON rm.lga_code = lga.lga_code
LEFT JOIN orgs o ON o.lga_code = lga.lga_code
LEFT JOIN acnc a ON a.lga_code = lga.lga_code
LEFT JOIN cw ON cw.lga_code = lga.lga_code
LEFT JOIN cw_deliv cd ON cd.lga_code = lga.lga_code
LEFT JOIN jf ON jf.lga_code = lga.lga_code
LEFT JOIN contracts c ON c.lga_code = lga.lga_code
LEFT JOIN traj t ON t.lga_code = lga.lga_code
LEFT JOIN gaps g ON g.lga_code = lga.lga_code;

CREATE UNIQUE INDEX mv_lga_allocation_pk ON public.mv_lga_allocation (lga_code);
CREATE INDEX mv_lga_allocation_state ON public.mv_lga_allocation (state);
CREATE INDEX mv_lga_allocation_decile ON public.mv_lga_allocation (irsd_decile);

GRANT SELECT ON public.mv_lga_allocation TO anon, authenticated, service_role;

UPDATE public.mv_refresh_registry
SET notes = 'Allocation Intelligence per council (lga_code); reads abs_lga_population, abs_poa_lga_ratio, seifa_2021, gs_entities, acnc_ais 2023, grantconnect_awards (recipient lane + delivery_postcode lane via abs_poa_lga_ratio), justice_funding (3 filters), austender_contracts, mv_charity_trajectory (must refresh first; pg_depend orders it); unique lga_code for concurrent refresh'
WHERE mv_name = 'mv_lga_allocation';

COMMIT;
