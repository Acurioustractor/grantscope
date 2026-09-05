-- v_org_funding_profile — one row per organisation, every money channel.
--
-- The place view answers "how much reaches this council". This answers "who is
-- here, and what do they hold", which is the list a community actually wants:
-- every organisation, its sector and size, and each channel money arrives
-- through, side by side.
--
-- The channels differ in what they can tell you, and the columns keep that
-- distinction rather than summing into one misleading total:
--
--   contracts        procurement, attributed by the supplier's registered
--                    address because AusTender publishes no delivery location
--   grants_received  GrantConnect awards where this organisation is the
--                    recipient, wherever the work happens
--   grants_delivered_here  awards delivered into this organisation's postcode,
--                    whoever holds them — the difference between the two is the
--                    money spent in a place but held somewhere else
--   philanthropy     ABN-resolved foundation grants only
--
-- Organisations with no ABN appear with zero money and that is a statement
-- about our matching, not their funding: a third of Aboriginal corporations in
-- NT and SA have no ABN, and ORIC size and sector are the only evidence of
-- them. Read oric_income_band before concluding a zero means inactive.

CREATE OR REPLACE VIEW public.v_org_funding_profile AS
SELECT e.id,
       e.gs_id,
       e.canonical_name,
       e.abn,
       e.entity_type,
       e.state,
       e.lga_name,
       e.postcode,
       e.lga_source,
       (e.is_community_controlled OR e.entity_type = 'indigenous_corp') AS community_controlled,
       e.oric_status,
       e.oric_sector,
       e.oric_size,
       e.oric_income_band,
       e.oric_employee_band,
       coalesce(c.n, 0) AS contract_count,
       coalesce(c.v, 0) AS contract_value,
       coalesce(gr.n, 0) AS grants_received_count,
       coalesce(gr.v, 0) AS grants_received_value,
       coalesce(gd.n, 0) AS grants_delivered_here_count,
       coalesce(gd.v, 0) AS grants_delivered_here_value,
       coalesce(jf.n, 0) AS other_govt_grant_count,
       coalesce(jf.v, 0) AS other_govt_grant_value,
       coalesce(ph.n, 0) AS philanthropic_grant_count,
       coalesce(c.v, 0) + coalesce(gr.v, 0) + coalesce(jf.v, 0) AS total_traceable_value
  FROM public.gs_entities e
  LEFT JOIN LATERAL (
    SELECT count(*) AS n, sum(ac.contract_value) AS v
      FROM public.austender_contracts ac
     WHERE e.abn IS NOT NULL AND ac.supplier_abn = e.abn
       AND (ac.contract_start IS NULL OR ac.contract_start >= '2000-01-01')
  ) c ON true
  LEFT JOIN LATERAL (
    SELECT count(*) AS n, sum(ga.value_aud) AS v
      FROM public.grantconnect_awards ga
     WHERE ga.gs_entity_id = e.id
  ) gr ON true
  LEFT JOIN LATERAL (
    SELECT count(*) AS n, sum(ga.value_aud) AS v
      FROM public.grantconnect_awards ga
     WHERE e.postcode IS NOT NULL AND ga.delivery_postcode = e.postcode
  ) gd ON true
  LEFT JOIN LATERAL (
    SELECT count(*) AS n, sum(j.amount_dollars) AS v
      FROM public.justice_funding j
     WHERE j.gs_entity_id = e.id
  ) jf ON true
  LEFT JOIN LATERAL (
    SELECT count(*) AS n
      FROM public.mv_foundation_grantees fg
     WHERE fg.grantee_entity_id = e.id
  ) ph ON true;

GRANT SELECT ON public.v_org_funding_profile TO anon, authenticated, service_role;

COMMENT ON VIEW public.v_org_funding_profile IS
  'One row per organisation with each funding channel kept separate. Contracts are by registered address; grants_received is what an organisation holds; grants_delivered_here is what is spent in its postcode by anyone. Zero money with an ORIC income band means unmatchable, not inactive.';
