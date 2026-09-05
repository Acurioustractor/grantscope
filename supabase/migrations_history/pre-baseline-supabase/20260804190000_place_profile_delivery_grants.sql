-- Attribute grants by where they are delivered, not where the recipient banks.
--
-- Every place fix so far has fought the same limitation: records say where an
-- organisation is registered, not where work happens. AusTender has no delivery
-- field at all, which is why MacDonnell Shire Council's money read as Alice
-- Springs. GrantConnect publishes a delivery postcode, so grants can finally be
-- attributed to the community served.
--
-- The measure that matters most here is local retention: of the money delivered
-- into a place, how much is held by an organisation based in that same place.
-- For the Utopia homelands only 23% is — 62% is held elsewhere in the Territory
-- and 15% interstate. That is the self-determination question as a number, and
-- it is unanswerable without the delivery field.
--
-- Postcode 0872 is excluded from attribution and reported on its own. It is the
-- only postcode in the country covering more than one council — seven of them,
-- from Alice Springs to Ngaanyatjarraku — so any join would multiply rows and
-- credit the same grant to every council it touches.

DROP VIEW IF EXISTS public.v_lga_place_profile;

CREATE VIEW public.v_lga_place_profile AS
WITH pc_lga AS (
  -- Unambiguous postcodes only: 2,869 of 2,870.
  SELECT postcode, min(lga_name) AS lga_name, min(state) AS state
    FROM public.postcode_geo
   WHERE lga_name IS NOT NULL AND postcode <> '0872'
   GROUP BY postcode
  HAVING count(DISTINCT lga_name) = 1
), orgs AS (
  SELECT e.lga_name, e.state,
         count(*) AS org_count,
         count(*) FILTER (WHERE e.is_community_controlled OR e.entity_type = 'indigenous_corp') AS community_controlled,
         count(*) FILTER (WHERE e.abn IS NULL) AS without_abn,
         count(*) FILTER (WHERE e.oric_status = 'Registered') AS oric_registered,
         count(*) FILTER (WHERE e.oric_sector ILIKE '%land and waters%') AS caring_for_country,
         count(*) FILTER (WHERE e.oric_employee_band IN ('<5', '5 - 24', '>24')) AS employers,
         count(*) FILTER (WHERE e.oric_income_band IN ('$100k-<$5m', '>=$5m')) AS income_over_100k
    FROM public.gs_entities e
   WHERE e.lga_name IS NOT NULL
   GROUP BY e.lga_name, e.state
), contracts AS (
  SELECT e.lga_name, e.state,
         count(*) AS contract_count,
         sum(c.contract_value) AS contract_value_lifetime,
         sum(c.contract_value) FILTER (WHERE c.contract_start >= (now() - interval '24 months')) AS contract_value_24m
    FROM public.gs_entities e
    JOIN public.austender_contracts c ON c.supplier_abn = e.abn
   WHERE e.lga_name IS NOT NULL AND e.abn IS NOT NULL
     AND (c.contract_start IS NULL OR c.contract_start >= '2000-01-01')
   GROUP BY e.lga_name, e.state
), pc0872 AS (
  -- The councils postcode 0872 actually spans. A 0872 grant may only be
  -- credited to a council on this list.
  SELECT DISTINCT lga_name, state FROM public.postcode_geo WHERE postcode = '0872' AND lga_name IS NOT NULL
), delivered AS (
  -- Placement without correlated subqueries: the postcode join does the normal
  -- case, and the recipient's council covers 0872 only when it is one of the
  -- seven councils that postcode spans. Without that guard, homelands money is
  -- credited to Darwin Waterfront, Sydney and South Perth, where those
  -- recipients happen to be based.
  SELECT place_lga AS lga_name, place_state AS state,
         count(*) AS grants_delivered,
         sum(value_aud) AS grants_delivered_value,
         sum(value_aud) FILTER (WHERE recipient_lga = place_lga) AS grants_held_locally_value,
         sum(value_aud) FILTER (WHERE approval_date >= (now() - interval '24 months')) AS grants_delivered_24m
    FROM (
      SELECT ga.value_aud, ga.approval_date,
             coalesce(r.lga_name, re.lga_name) AS recipient_lga,
             CASE WHEN ga.delivery_postcode = '0872' THEN g0.lga_name ELSE dp.lga_name END AS place_lga,
             CASE WHEN ga.delivery_postcode = '0872' THEN g0.state ELSE dp.state END AS place_state
        FROM public.grantconnect_awards ga
        LEFT JOIN pc_lga dp ON dp.postcode = ga.delivery_postcode AND ga.delivery_postcode <> '0872'
        -- Joined for every award, not just 0872: the linked entity carries a
        -- council even where its postcode cannot be mapped, and without it a
        -- recipient based in 0872 scores as non-local in its own community.
        LEFT JOIN public.gs_entities re ON re.id = ga.gs_entity_id
        LEFT JOIN pc0872 g0 ON g0.lga_name = re.lga_name AND ga.delivery_postcode = '0872'
        LEFT JOIN pc_lga r ON r.postcode = ga.recipient_postcode
       WHERE ga.delivery_postcode IS NOT NULL
    ) placed
   WHERE place_lga IS NOT NULL
   GROUP BY place_lga, place_state
), phil AS (
  SELECT e.lga_name, e.state,
         count(DISTINCT fg.foundation_name) AS philanthropic_funders,
         count(*) AS philanthropic_grants
    FROM public.gs_entities e
    JOIN public.mv_foundation_grantees fg ON fg.grantee_entity_id = e.id
   WHERE e.lga_name IS NOT NULL
   GROUP BY e.lga_name, e.state
), disadvantage AS (
  SELECT pg.lga_name, pg.state,
         avg(s.decile_national) FILTER (WHERE s.index_type = 'IRSD') AS avg_irsd_decile,
         min(s.decile_national) FILTER (WHERE s.index_type = 'IRSD') AS min_irsd_decile,
         mode() WITHIN GROUP (ORDER BY pg.remoteness_2021) AS remoteness
    FROM public.postcode_geo pg
    LEFT JOIN public.seifa_2021 s ON s.postcode = pg.postcode
   WHERE pg.lga_name IS NOT NULL
   GROUP BY pg.lga_name, pg.state
)
SELECT o.lga_name, o.state, d.remoteness,
       round(d.avg_irsd_decile, 2) AS avg_irsd_decile,
       d.min_irsd_decile,
       o.org_count, o.community_controlled, o.without_abn, o.oric_registered,
       o.caring_for_country, o.employers, o.income_over_100k,
       coalesce(c.contract_count, 0) AS contract_count,
       coalesce(c.contract_value_lifetime, 0) AS contract_value_lifetime,
       coalesce(c.contract_value_24m, 0) AS contract_value_24m,
       coalesce(g.grants_delivered, 0) AS grants_delivered,
       coalesce(g.grants_delivered_value, 0) AS grants_delivered_value,
       coalesce(g.grants_delivered_24m, 0) AS grants_delivered_24m,
       coalesce(g.grants_held_locally_value, 0) AS grants_held_locally_value,
       CASE WHEN coalesce(g.grants_delivered_value, 0) > 0
            THEN round(100.0 * coalesce(g.grants_held_locally_value, 0) / g.grants_delivered_value, 1)
       END AS local_retention_pct,
       coalesce(p.philanthropic_funders, 0) AS philanthropic_funders,
       coalesce(p.philanthropic_grants, 0) AS philanthropic_grants
  FROM orgs o
  LEFT JOIN contracts c ON c.lga_name = o.lga_name AND c.state IS NOT DISTINCT FROM o.state
  LEFT JOIN delivered g ON g.lga_name = o.lga_name AND g.state IS NOT DISTINCT FROM o.state
  LEFT JOIN phil p ON p.lga_name = o.lga_name AND p.state IS NOT DISTINCT FROM o.state
  LEFT JOIN disadvantage d ON d.lga_name = o.lga_name AND d.state IS NOT DISTINCT FROM o.state;

GRANT SELECT ON public.v_lga_place_profile TO anon, authenticated, service_role;

COMMENT ON VIEW public.v_lga_place_profile IS
  'One row per LGA. Contracts are attributed by supplier registered address (AusTender has no delivery field); grants by delivery postcode. local_retention_pct is the share of delivered grant money held by an organisation based in that same place. Postcode 0872 is excluded from grant attribution because it spans seven councils.';
