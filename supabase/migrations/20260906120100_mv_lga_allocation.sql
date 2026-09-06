-- 20260906120100_mv_lga_allocation.sql
-- Allocation Intelligence: disadvantage versus dollars, one row per council, keyed by lga_code.
--
-- Why a new matview instead of mv_funding_deserts: that view is keyed by lga_name from postcode_geo, which the
-- 2026-08 LGA rebuild found to be wrong nationally (grain 1,130 distinct names over 1,997 rows). gs_entities now
-- carries lga_code with a reason code in lga_source for every row, placed or not. This view stands on that.
--
-- What each block is:
--   need      SEIFA IRSD, weighted through abs_poa_lga_ratio (postcode share of the council) because SEIFA is held
--             per postcode. min_irsd_decile is the most disadvantaged postcode that touches the council.
--   people    abs_lga_population (ABS ERP 2023), the denominator for every per-head figure.
--   orgs      gs_entities placed in the council, and the charities among them.
--   acnc      the latest Annual Information Statement year (2023) for every charity placed here: total revenue,
--             revenue from government, donations and bequests, staff. This is the whole register, not a sample,
--             so it is the most complete "money reaching organisations in this place" measure held.
--   cw_grants grantconnect_awards by recipient entity (the recipient is placed; the delivery place may differ).
--   jf_grants justice_funding with the three mandatory filters (grant lane, not aggregate, real recipient name).
--   contracts austender_contracts by supplier ABN, lifetime and last 24 months.
--   gaps      entities that share the council's postcodes and could NOT be placed (unresolved multi-LGA postcode,
--             state conflict, postcode unmapped). Reported as a count so a reader can see how sure the row is.
--
-- Money is attributed to the council where the RECIPIENT is placed. A regional intermediary in a hub town
-- collects money that is spent in remote communities (see memory: remote funding intermediaries); this view
-- states the flow, and the page states that caveat.
BEGIN;

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
cw AS (
  SELECT e.lga_code,
         count(*) AS cw_grant_count,
         sum(g.value_aud) AS cw_grant_value,
         sum(g.value_aud) FILTER (WHERE g.approval_date >= (current_date - interval '2 years')) AS cw_grant_value_24m
  FROM grantconnect_awards g
  JOIN gs_entities e ON e.id = g.gs_entity_id AND e.lga_code IS NOT NULL
  GROUP BY e.lga_code
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
       coalesce(jf.jf_grant_count, 0)::int AS jf_grant_count,
       coalesce(jf.jf_grant_value, 0)::numeric AS jf_grant_value,
       coalesce(c.contract_count, 0)::int AS contract_count,
       coalesce(c.contract_value, 0)::numeric AS contract_value,
       coalesce(c.contract_value_24m, 0)::numeric AS contract_value_24m,
       coalesce(g.unplaced_sharing_postcodes, 0)::int AS unplaced_sharing_postcodes,
       -- per head, on ERP 2023
       round(coalesce(a.charity_gov_revenue, 0) / nullif(lga.population, 0), 0) AS gov_revenue_per_head,
       round(coalesce(a.charity_donations, 0) / nullif(lga.population, 0), 0) AS donations_per_head,
       round(coalesce(cw.cw_grant_value_24m, 0) / nullif(lga.population, 0), 0) AS cw_grants_24m_per_head,
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
LEFT JOIN jf ON jf.lga_code = lga.lga_code
LEFT JOIN contracts c ON c.lga_code = lga.lga_code
LEFT JOIN gaps g ON g.lga_code = lga.lga_code;

CREATE UNIQUE INDEX mv_lga_allocation_pk ON public.mv_lga_allocation (lga_code);
CREATE INDEX mv_lga_allocation_state ON public.mv_lga_allocation (state);
CREATE INDEX mv_lga_allocation_decile ON public.mv_lga_allocation (irsd_decile);

GRANT SELECT ON public.mv_lga_allocation TO anon, authenticated, service_role;

INSERT INTO public.mv_refresh_registry (mv_name, tier, enabled, force_non_concurrent, notes)
VALUES ('mv_lga_allocation', 'nightly', true, false, 'Allocation Intelligence per council (lga_code); reads abs_lga_population, abs_poa_lga_ratio, seifa_2021, gs_entities, acnc_ais 2023, grantconnect_awards, justice_funding (3 filters), austender_contracts; unique lga_code for concurrent refresh')
ON CONFLICT (mv_name) DO UPDATE SET tier = 'nightly', enabled = true, notes = EXCLUDED.notes;

INSERT INTO public.schema_ownership (object, owner, consumers, evidence, declared_on)
VALUES ('mv_lga_allocation', 'grantscope', '{grantscope}', 'read by /allocation', current_date)
ON CONFLICT (object) DO NOTHING;

COMMIT;
