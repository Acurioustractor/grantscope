-- v_lga_place_profile — one row per place, built for the overlay.
--
-- mv_funding_deserts cannot be used as it stands. It returns 1,988 rows for
-- 1,103 LGAs: Alice Springs appears four times with desert scores of 90 and
-- 73.1 and funding of both $39.5M and $598.3M, and one LGA appears twelve
-- times. Two independent causes multiply together:
--
--   mv_funding_by_lga groups by (lga_name, lga_code, state), and lga_code is
--   null for some entities of an LGA and populated for others, so a single
--   council is split across rows.
--
--   Its disadvantage CTE groups by remoteness_2021, and postcode_geo holds two
--   distinct remoteness values per LGA including null, doubling every row.
--
-- Deduplicating the output would mean choosing between conflicting totals with
-- no way to tell which is right, so this is built from the base tables instead,
-- grouped only on (lga_name, state). Nothing inherits the duplication.
--
-- Money carries a 24-month window as well as a lifetime total. The lifetime
-- figure for Central Australia is 25 years deep — 67% of it predates 2020 — so
-- presenting it as current activity would overstate the present by roughly
-- fourteen times.

CREATE OR REPLACE VIEW public.v_lga_place_profile AS
WITH orgs AS (
  SELECT e.lga_name, e.state,
         count(*) AS org_count,
         count(*) FILTER (WHERE e.is_community_controlled OR e.entity_type = 'indigenous_corp') AS community_controlled,
         count(*) FILTER (WHERE e.abn IS NULL) AS without_abn,
         count(*) FILTER (WHERE e.oric_status = 'Registered') AS oric_registered,
         count(*) FILTER (WHERE e.oric_sector ILIKE '%land and waters%') AS caring_for_country,
         count(*) FILTER (WHERE e.oric_employee_band IS NOT NULL) AS with_workforce_data,
         -- Bands, not counts. Employers are organisations reporting any staff.
         count(*) FILTER (WHERE e.oric_employee_band IN ('<5', '5 - 24', '>24')) AS employers,
         count(*) FILTER (WHERE e.oric_employee_band = '>24') AS employers_over_24,
         count(*) FILTER (WHERE e.oric_income_band IN ('$100k-<$5m', '>=$5m')) AS income_over_100k
    FROM public.gs_entities e
   WHERE e.lga_name IS NOT NULL
   GROUP BY e.lga_name, e.state
), contracts AS (
  SELECT e.lga_name, e.state,
         count(*) AS contract_count,
         sum(c.contract_value) AS contract_value_lifetime,
         count(*) FILTER (WHERE c.contract_start >= (now() - interval '24 months')) AS contract_count_24m,
         sum(c.contract_value) FILTER (WHERE c.contract_start >= (now() - interval '24 months')) AS contract_value_24m
    FROM public.gs_entities e
    JOIN public.austender_contracts c ON c.supplier_abn = e.abn
   WHERE e.lga_name IS NOT NULL AND e.abn IS NOT NULL
     -- Placeholder dates of 1900-01-01 would anchor any timeline at 1900.
     AND (c.contract_start IS NULL OR c.contract_start >= '2000-01-01')
   GROUP BY e.lga_name, e.state
), grants AS (
  SELECT e.lga_name, e.state,
         count(*) AS grant_count,
         sum(jf.amount_dollars) AS grant_value
    FROM public.gs_entities e
    JOIN public.justice_funding jf ON jf.gs_entity_id = e.id
   WHERE e.lga_name IS NOT NULL
   GROUP BY e.lga_name, e.state
), phil AS (
  SELECT e.lga_name, e.state,
         count(DISTINCT fg.foundation_name) AS philanthropic_funders,
         count(*) AS philanthropic_grants
    FROM public.gs_entities e
    JOIN public.mv_foundation_grantees fg ON fg.grantee_entity_id = e.id
   WHERE e.lga_name IS NOT NULL
   GROUP BY e.lga_name, e.state
), disadvantage AS (
  -- One row per LGA. Remoteness is taken as the most common value rather than
  -- grouped on, which is what split the rows in the first place.
  SELECT pg.lga_name, pg.state,
         avg(s.decile_national) FILTER (WHERE s.index_type = 'IRSD') AS avg_irsd_decile,
         min(s.decile_national) FILTER (WHERE s.index_type = 'IRSD') AS min_irsd_decile,
         mode() WITHIN GROUP (ORDER BY pg.remoteness_2021) AS remoteness
    FROM public.postcode_geo pg
    LEFT JOIN public.seifa_2021 s ON s.postcode = pg.postcode
   WHERE pg.lga_name IS NOT NULL
   GROUP BY pg.lga_name, pg.state
)
SELECT o.lga_name,
       o.state,
       d.remoteness,
       round(d.avg_irsd_decile, 2) AS avg_irsd_decile,
       d.min_irsd_decile,
       o.org_count,
       o.community_controlled,
       o.without_abn,
       o.oric_registered,
       o.caring_for_country,
       o.with_workforce_data,
       o.employers,
       o.employers_over_24,
       o.income_over_100k,
       coalesce(c.contract_count, 0) AS contract_count,
       coalesce(c.contract_value_lifetime, 0) AS contract_value_lifetime,
       coalesce(c.contract_count_24m, 0) AS contract_count_24m,
       coalesce(c.contract_value_24m, 0) AS contract_value_24m,
       coalesce(g.grant_count, 0) AS grant_count,
       coalesce(g.grant_value, 0) AS grant_value,
       coalesce(p.philanthropic_funders, 0) AS philanthropic_funders,
       coalesce(p.philanthropic_grants, 0) AS philanthropic_grants
  FROM orgs o
  LEFT JOIN contracts c ON c.lga_name = o.lga_name AND c.state IS NOT DISTINCT FROM o.state
  LEFT JOIN grants g ON g.lga_name = o.lga_name AND g.state IS NOT DISTINCT FROM o.state
  LEFT JOIN phil p ON p.lga_name = o.lga_name AND p.state IS NOT DISTINCT FROM o.state
  LEFT JOIN disadvantage d ON d.lga_name = o.lga_name AND d.state IS NOT DISTINCT FROM o.state;

GRANT SELECT ON public.v_lga_place_profile TO anon, authenticated, service_role;

COMMENT ON VIEW public.v_lga_place_profile IS
  'One row per LGA for place overlays. Built from base tables rather than mv_funding_deserts, which returns 1,988 rows for 1,103 LGAs with conflicting values. Money is given both lifetime and over 24 months; use the 24-month figure for anything described as current.';
