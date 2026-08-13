CREATE OR REPLACE FUNCTION public.dashboard_sector_distribution()
RETURNS TABLE(sector text, count bigint, total_giving numeric)
LANGUAGE sql
STABLE
AS $$
  SELECT
    initcap(replace(focus.sector, '_', ' ')) AS sector,
    count(*) AS count,
    coalesce(sum(f.total_giving_annual), 0)::numeric AS total_giving
  FROM public.foundations f
  CROSS JOIN LATERAL unnest(f.thematic_focus) AS focus(sector)
  WHERE f.thematic_focus IS NOT NULL
    AND f.total_giving_annual IS NOT NULL
  GROUP BY focus.sector
  ORDER BY total_giving DESC
  LIMIT 24;
$$;

CREATE OR REPLACE FUNCTION public.dashboard_geographic_distribution()
RETURNS TABLE(geo text, count bigint, total_giving numeric)
LANGUAGE sql
STABLE
AS $$
  WITH mapped AS (
    SELECT
      CASE focus.geo
        WHEN 'AU-National' THEN 'National (AU)'
        WHEN 'AU-NSW' THEN 'New South Wales'
        WHEN 'AU-VIC' THEN 'Victoria'
        WHEN 'AU-QLD' THEN 'Queensland'
        WHEN 'AU-WA' THEN 'Western Australia'
        WHEN 'AU-SA' THEN 'South Australia'
        WHEN 'AU-TAS' THEN 'Tasmania'
        WHEN 'AU-NT' THEN 'Northern Territory'
        WHEN 'AU-ACT' THEN 'ACT'
        WHEN 'NZ-National' THEN 'New Zealand'
        ELSE initcap(focus.geo)
      END AS geo,
      f.total_giving_annual
    FROM public.foundations f
    CROSS JOIN LATERAL unnest(f.geographic_focus) AS focus(geo)
    WHERE f.geographic_focus IS NOT NULL
      AND f.total_giving_annual IS NOT NULL
  ),
  grouped AS (
    SELECT geo, count(*) AS count, coalesce(sum(total_giving_annual), 0)::numeric AS total_giving
    FROM mapped
    GROUP BY geo
  ),
  ranked AS (
    SELECT *, row_number() OVER (ORDER BY total_giving DESC) AS rn
    FROM grouped
  )
  SELECT geo, count, total_giving
  FROM ranked
  WHERE rn <= 10
  UNION ALL
  SELECT
    'Other (' || count(*)::text || ')' AS geo,
    coalesce(sum(count), 0)::bigint AS count,
    coalesce(sum(total_giving), 0)::numeric AS total_giving
  FROM ranked
  WHERE rn > 10
  HAVING count(*) > 0
  ORDER BY total_giving DESC;
$$;

CREATE OR REPLACE FUNCTION public.dashboard_foundation_tiers()
RETURNS TABLE(tier text, count bigint, avg_giving numeric, total_giving numeric, color text)
LANGUAGE sql
STABLE
AS $$
  WITH tiered AS (
    SELECT
      CASE
        WHEN total_giving_annual >= 5000000 THEN 'Major ($5M+)'
        WHEN total_giving_annual >= 1000000 THEN 'Large ($1-5M)'
        WHEN total_giving_annual >= 250000 THEN 'Medium ($250K-1M)'
        WHEN total_giving_annual >= 50000 THEN 'Small ($50-250K)'
        ELSE 'Micro (<$50K)'
      END AS tier,
      CASE
        WHEN total_giving_annual >= 5000000 THEN 5000000
        WHEN total_giving_annual >= 1000000 THEN 1000000
        WHEN total_giving_annual >= 250000 THEN 250000
        WHEN total_giving_annual >= 50000 THEN 50000
        ELSE 0
      END AS min_value,
      CASE
        WHEN total_giving_annual >= 5000000 THEN '#059669'
        WHEN total_giving_annual >= 1000000 THEN '#7c3aed'
        WHEN total_giving_annual >= 250000 THEN '#F0C020'
        WHEN total_giving_annual >= 50000 THEN '#f97316'
        ELSE '#777777'
      END AS color,
      total_giving_annual
    FROM public.foundations
    WHERE total_giving_annual IS NOT NULL
  )
  SELECT
    tier,
    count(*) AS count,
    round(avg(total_giving_annual))::numeric AS avg_giving,
    round(sum(total_giving_annual))::numeric AS total_giving,
    color
  FROM tiered
  GROUP BY tier, min_value, color
  ORDER BY min_value DESC;
$$;

DROP FUNCTION IF EXISTS public.dashboard_source_coverage();

CREATE OR REPLACE FUNCTION public.dashboard_source_coverage()
RETURNS TABLE(source text, count bigint, total_funding numeric, type text)
LANGUAGE sql
STABLE
AS $$
  WITH grouped AS (
    SELECT
      coalesce(source, 'Unknown') AS source,
      count(*) AS count,
      coalesce(sum(amount_max), 0)::numeric AS total_funding
    FROM public.grant_opportunities
    WHERE status IS NULL OR status <> 'duplicate'
    GROUP BY coalesce(source, 'Unknown')
  )
  SELECT
    source,
    count,
    total_funding,
    CASE WHEN lower(source) LIKE '%foundation%' THEN 'philanthropy' ELSE 'government' END AS type
  FROM grouped
  ORDER BY total_funding DESC;
$$;

CREATE OR REPLACE FUNCTION public.dashboard_foundation_total_giving()
RETURNS numeric
LANGUAGE sql
STABLE
AS $$
  SELECT coalesce(sum(total_giving_annual), 0)::numeric
  FROM public.foundations
  WHERE total_giving_annual IS NOT NULL;
$$;

DROP FUNCTION IF EXISTS public.get_pipeline_stats();

CREATE OR REPLACE FUNCTION public.get_pipeline_stats()
RETURNS TABLE(
  grants_total bigint,
  grants_embedded bigint,
  grants_described bigint,
  grants_expired bigint,
  grants_no_close bigint,
  foundations_total bigint,
  foundations_enriched bigint,
  foundations_unenriched bigint,
  foundations_high bigint,
  foundations_medium bigint,
  foundations_low bigint,
  foundations_recent_7d bigint,
  foundations_recent_30d bigint,
  se_total bigint,
  se_enriched bigint,
  se_indigenous bigint,
  community_orgs bigint,
  foundation_programs bigint,
  acnc_records bigint
)
LANGUAGE sql
STABLE
AS $$
  SELECT
    (SELECT count(*) FROM public.grant_opportunities) AS grants_total,
    (SELECT count(*) FROM public.grant_opportunities WHERE embedding IS NOT NULL) AS grants_embedded,
    (SELECT count(*) FROM public.grant_opportunities WHERE description IS NOT NULL) AS grants_described,
    (SELECT count(*) FROM public.grant_opportunities WHERE closes_at < current_date) AS grants_expired,
    (SELECT count(*) FROM public.grant_opportunities WHERE closes_at IS NULL) AS grants_no_close,
    (SELECT count(*) FROM public.foundations) AS foundations_total,
    (SELECT count(*) FROM public.foundations WHERE enriched_at IS NOT NULL) AS foundations_enriched,
    (SELECT count(*) FROM public.foundations WHERE website IS NOT NULL AND enriched_at IS NULL) AS foundations_unenriched,
    (SELECT count(*) FROM public.foundations WHERE profile_confidence = 'high') AS foundations_high,
    (SELECT count(*) FROM public.foundations WHERE profile_confidence = 'medium') AS foundations_medium,
    (SELECT count(*) FROM public.foundations WHERE profile_confidence = 'low') AS foundations_low,
    (SELECT count(*) FROM public.foundations WHERE enriched_at >= now() - interval '7 days') AS foundations_recent_7d,
    (SELECT count(*) FROM public.foundations WHERE enriched_at >= now() - interval '30 days') AS foundations_recent_30d,
    (SELECT count(*) FROM public.social_enterprises) AS se_total,
    (SELECT count(*) FROM public.social_enterprises WHERE enriched_at IS NOT NULL) AS se_enriched,
    (SELECT count(*) FROM public.social_enterprises WHERE org_type = 'indigenous_business') AS se_indigenous,
    (SELECT count(*) FROM public.community_orgs) AS community_orgs,
    (SELECT count(*) FROM public.foundation_programs WHERE status IN ('open', 'closed')) AS foundation_programs,
    (SELECT count(*) FROM public.acnc_ais) AS acnc_records;
$$;

CREATE OR REPLACE FUNCTION public.closing_the_gap_state_summary()
RETURNS TABLE(
  state text,
  indigenous_entities bigint,
  indigenous_corps bigint,
  community_controlled bigint,
  justice_funding_total numeric,
  justice_funding_indigenous numeric,
  alma_interventions bigint,
  alma_jr_interventions bigint,
  alma_linked bigint,
  avg_seifa numeric
)
LANGUAGE sql
STABLE
AS $$
  WITH states AS (
    SELECT unnest(ARRAY['NSW', 'VIC', 'QLD', 'WA', 'SA', 'TAS', 'NT', 'ACT', 'National']) AS state
  ),
  indigenous_entities AS (
    SELECT coalesce(state, 'Unknown') AS state, count(*) AS indigenous_entities, count(*) AS indigenous_corps
    FROM public.gs_entities
    WHERE entity_type = 'indigenous_corp'
    GROUP BY coalesce(state, 'Unknown')
  ),
  indigenous_entities_national AS (
    SELECT count(*) AS indigenous_entities, count(*) AS indigenous_corps
    FROM public.gs_entities
    WHERE entity_type = 'indigenous_corp'
  ),
  community_controlled AS (
    SELECT coalesce(state, 'Unknown') AS state, count(*) AS community_controlled
    FROM public.gs_entities
    WHERE is_community_controlled IS TRUE
    GROUP BY coalesce(state, 'Unknown')
  ),
  community_controlled_national AS (
    SELECT count(*) AS community_controlled
    FROM public.gs_entities
    WHERE is_community_controlled IS TRUE
  ),
  justice_funding_by_state AS (
    SELECT coalesce(state, 'Unknown') AS state, coalesce(sum(amount_dollars), 0)::numeric AS justice_funding_total
    FROM public.justice_funding
    GROUP BY coalesce(state, 'Unknown')
  ),
  justice_funding_national AS (
    SELECT coalesce(sum(amount_dollars), 0)::numeric AS justice_funding_total
    FROM public.justice_funding
  ),
  indigenous_funding_by_state AS (
    SELECT coalesce(jf.state, 'Unknown') AS state, coalesce(sum(jf.amount_dollars), 0)::numeric AS justice_funding_indigenous
    FROM public.justice_funding jf
    WHERE EXISTS (
      SELECT 1
      FROM public.gs_entities ge
      WHERE ge.abn = jf.recipient_abn
        AND ge.abn IS NOT NULL
        AND ge.entity_type = 'indigenous_corp'
    )
    GROUP BY coalesce(jf.state, 'Unknown')
  ),
  indigenous_funding_national AS (
    SELECT coalesce(sum(jf.amount_dollars), 0)::numeric AS justice_funding_indigenous
    FROM public.justice_funding jf
    WHERE EXISTS (
      SELECT 1
      FROM public.gs_entities ge
      WHERE ge.abn = jf.recipient_abn
        AND ge.abn IS NOT NULL
        AND ge.entity_type = 'indigenous_corp'
    )
  ),
  alma_by_state AS (
    SELECT
      geo.state,
      count(*) AS alma_interventions,
      count(*) FILTER (WHERE geo.type = 'Justice Reinvestment') AS alma_jr_interventions,
      count(*) FILTER (WHERE geo.gs_entity_id IS NOT NULL) AS alma_linked
    FROM (
      SELECT g.state, ai.type, ai.gs_entity_id
      FROM public.alma_interventions ai
      CROSS JOIN LATERAL unnest(ai.geography) AS g(state)
      WHERE g.state = ANY (ARRAY['NSW', 'VIC', 'QLD', 'WA', 'SA', 'TAS', 'NT', 'ACT'])
    ) geo
    GROUP BY geo.state
  ),
  alma_national AS (
    SELECT
      count(*) AS alma_interventions,
      count(*) FILTER (WHERE type = 'Justice Reinvestment') AS alma_jr_interventions,
      count(*) FILTER (WHERE gs_entity_id IS NOT NULL) AS alma_linked
    FROM public.alma_interventions
  )
  SELECT
    s.state,
    CASE WHEN s.state = 'National' THEN ien.indigenous_entities ELSE coalesce(ie.indigenous_entities, 0) END AS indigenous_entities,
    CASE WHEN s.state = 'National' THEN ien.indigenous_corps ELSE coalesce(ie.indigenous_corps, 0) END AS indigenous_corps,
    CASE WHEN s.state = 'National' THEN ccn.community_controlled ELSE coalesce(cc.community_controlled, 0) END AS community_controlled,
    CASE WHEN s.state = 'National' THEN jfn.justice_funding_total ELSE coalesce(jf.justice_funding_total, 0) END AS justice_funding_total,
    CASE WHEN s.state = 'National' THEN ifn.justice_funding_indigenous ELSE coalesce(indf.justice_funding_indigenous, 0) END AS justice_funding_indigenous,
    CASE WHEN s.state = 'National' THEN an.alma_interventions ELSE coalesce(ab.alma_interventions, 0) END AS alma_interventions,
    CASE WHEN s.state = 'National' THEN an.alma_jr_interventions ELSE coalesce(ab.alma_jr_interventions, 0) END AS alma_jr_interventions,
    CASE WHEN s.state = 'National' THEN an.alma_linked ELSE coalesce(ab.alma_linked, 0) END AS alma_linked,
    NULL::numeric AS avg_seifa
  FROM states s
  LEFT JOIN indigenous_entities ie ON ie.state = s.state
  CROSS JOIN indigenous_entities_national ien
  LEFT JOIN community_controlled cc ON cc.state = s.state
  CROSS JOIN community_controlled_national ccn
  LEFT JOIN justice_funding_by_state jf ON jf.state = s.state
  CROSS JOIN justice_funding_national jfn
  LEFT JOIN indigenous_funding_by_state indf ON indf.state = s.state
  CROSS JOIN indigenous_funding_national ifn
  LEFT JOIN alma_by_state ab ON ab.state = s.state
  CROSS JOIN alma_national an
  ORDER BY array_position(ARRAY['NSW', 'VIC', 'QLD', 'WA', 'SA', 'TAS', 'NT', 'ACT', 'National'], s.state);
$$;

DROP MATERIALIZED VIEW IF EXISTS public.mv_closing_the_gap_state_summary;

CREATE MATERIALIZED VIEW public.mv_closing_the_gap_state_summary AS
SELECT *
FROM public.closing_the_gap_state_summary();

CREATE UNIQUE INDEX IF NOT EXISTS idx_mv_closing_the_gap_state_summary_state
  ON public.mv_closing_the_gap_state_summary(state);

CREATE OR REPLACE FUNCTION public.closing_the_gap_state_summary()
RETURNS TABLE(
  state text,
  indigenous_entities bigint,
  indigenous_corps bigint,
  community_controlled bigint,
  justice_funding_total numeric,
  justice_funding_indigenous numeric,
  alma_interventions bigint,
  alma_jr_interventions bigint,
  alma_linked bigint,
  avg_seifa numeric
)
LANGUAGE sql
STABLE
AS $$
  SELECT
    state,
    indigenous_entities,
    indigenous_corps,
    community_controlled,
    justice_funding_total,
    justice_funding_indigenous,
    alma_interventions,
    alma_jr_interventions,
    alma_linked,
    avg_seifa
  FROM public.mv_closing_the_gap_state_summary
  ORDER BY array_position(ARRAY['NSW', 'VIC', 'QLD', 'WA', 'SA', 'TAS', 'NT', 'ACT', 'National'], state);
$$;
