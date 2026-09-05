-- 20260905180000_v_funding_opportunities.sql
-- Phase 5 of the 2026-09-05 platform review: one place to READ a fundable thing.
--
-- The review proposed replacing alma_funding_opportunities with a view. It cannot be one: eleven writers across three
-- repos touch it (two promotion jobs, three enrichment jobs, an ops triage route and the GHL handoff service in
-- CivicGraph; an admin route that inserts and updates, a matching library that deletes, and a scraper in JusticeHub;
-- a Xero backfill in act-global). A view is read-only, so all eleven would break. This is the read side instead:
-- every table stays exactly as it is and keeps its writers, and anything that only READS gets one shape to read.
--
-- WHAT A ROW IS. One fundable thing, once. Three origins, in precedence order:
--   1. grant_opportunities  (26,698) - the canonical rounds, including 1,665 already promoted from foundation programs
--   2. foundation_programs  (2,792 of 4,457 not yet promoted into grant_opportunities, joined by source_id)
--   3. alma_funding_opportunities - ONLY its own rows (58 of 13,102). The other 13,044 are promotions of the two
--      tables above and would double-count.
--
-- DEDUPLICATION IS BY NAME, because there is no key to use: alma_funding_opportunities.source_id is NULL on all
-- 13,102 rows, so a promoted row carries no link home. Measured 2026-09-05: lower(name) matches 6,609 of 6,642
-- promoted-from-grants rows and 6,402 of 6,402 promoted-from-foundation-programs rows, where source_url manages only
-- 4,987 of 6,642. Name matching is therefore the best available join, and it is used only to SUPPRESS duplicates and
-- to carry ALMA's verification back onto the canonical row, never to merge two records into one.
--
-- WHAT IT DOES NOT DO. It does not score, rank or filter for relevance. `relevance_score` is the column default 50 on
-- 26,659 of 26,698 grant rows and 0 on 13,100 of 13,102 alma rows, so ordering by it orders by a constant; the only
-- real scorer is act_grant_recommendations_current, which is ACT-project-specific and stays where it is.
--
-- security_invoker, so every reader sees exactly what its own role may see. Not granted to anon: grant_opportunities
-- is authenticated-read, and this view must not widen that.

BEGIN;

CREATE OR REPLACE VIEW public.v_funding_opportunities WITH (security_invoker = true) AS
WITH alma_enrichment AS (
  -- ALMA's verification of a round, keyed by name so it can ride along with the canonical row. One row per name:
  -- a name can carry several promoted copies, and the most recently touched one is the one to believe.
  SELECT DISTINCT ON (lower(trim(a.name)))
         lower(trim(a.name)) AS name_key,
         a.verification_status,
         a.opportunity_type,
         a.is_national,
         a.jurisdictions,
         a.eligible_org_types,
         a.requires_deductible_gift_recipient AS requires_dgr
  FROM public.alma_funding_opportunities a
  WHERE a.name IS NOT NULL
  ORDER BY lower(trim(a.name)), a.updated_at DESC NULLS LAST, a.created_at DESC NULLS LAST
),
rounds AS (
  SELECT
    'grant_opportunities'::text          AS origin,
    g.id::text                           AS origin_id,
    g.name,
    coalesce(g.provider, f.name)         AS funder,
    g.description,
    g.amount_min::numeric                AS amount_min,
    g.amount_max::numeric                AS amount_max,
    coalesce(g.closes_at, g.deadline)    AS closes_at,
    g.url,
    g.categories,
    g.focus_areas,
    g.source,
    g.grant_type,
    g.foundation_id,
    g.created_at,
    g.updated_at,
    '/grants/' || g.id::text             AS href
  FROM public.grant_opportunities g
  LEFT JOIN public.foundations f ON f.id = g.foundation_id
),
programs AS (
  -- Foundation programs that have not been promoted into grant_opportunities. The promoted ones are already above;
  -- the link is grant_opportunities.source = 'foundation_program' AND source_id = foundation_programs.id.
  SELECT
    'foundation_programs'::text          AS origin,
    p.id::text                           AS origin_id,
    p.name,
    f.name                               AS funder,
    p.description,
    p.amount_min,
    p.amount_max,
    p.deadline                           AS closes_at,
    p.url,
    p.categories,
    p.thematic_focus                     AS focus_areas,
    'foundation_program'::text           AS source,
    p.program_type                       AS grant_type,
    p.foundation_id,
    p.created_at,
    p.scraped_at                         AS updated_at,
    '/foundations/' || p.foundation_id::text AS href
  FROM public.foundation_programs p
  LEFT JOIN public.foundations f ON f.id = p.foundation_id
  WHERE NOT EXISTS (
    SELECT 1 FROM public.grant_opportunities g
    WHERE g.source = 'foundation_program' AND g.source_id = p.id::text
  )
),
alma_native AS (
  -- ALMA rows that are not promotions of the two tables above: 58 of 13,102 on 2026-09-05 (a manual seed, an oracle
  -- research run, two smoke rows, 26 unlabelled). Suppressed by name if the round is already present.
  SELECT
    'alma_funding_opportunities'::text   AS origin,
    a.id::text                           AS origin_id,
    a.name,
    a.funder_name                        AS funder,
    a.description,
    a.min_grant_amount                   AS amount_min,
    a.max_grant_amount                   AS amount_max,
    a.deadline                           AS closes_at,
    coalesce(a.application_url, a.source_url) AS url,
    NULL::text[]                         AS categories,
    a.focus_areas,
    coalesce(a.scrape_source, 'alma')    AS source,
    a.opportunity_type                   AS grant_type,
    NULL::uuid                           AS foundation_id,
    a.created_at,
    a.updated_at,
    NULL::text                           AS href
  FROM public.alma_funding_opportunities a
  WHERE coalesce(a.scrape_source, '') NOT IN ('promotion-from-grant_opportunities', 'promotion-from-foundation-programs')
    AND NOT EXISTS (SELECT 1 FROM public.grant_opportunities g WHERE lower(trim(g.name)) = lower(trim(a.name)))
    AND NOT EXISTS (SELECT 1 FROM public.foundation_programs p WHERE lower(trim(p.name)) = lower(trim(a.name)))
),
unified AS (
  SELECT * FROM rounds
  UNION ALL SELECT * FROM programs
  UNION ALL SELECT * FROM alma_native
)
SELECT
  u.origin,
  u.origin_id,
  u.origin || ':' || u.origin_id        AS opportunity_key,
  u.name,
  u.funder,
  u.description,
  u.amount_min,
  u.amount_max,
  u.closes_at,
  -- "open" means it has not closed. A round with no closing date is treated as open, which is how the ingest agents
  -- record ongoing programs; the caller can tell the two apart with closes_at IS NULL.
  (u.closes_at IS NULL OR u.closes_at >= current_date) AS is_open,
  u.url,
  u.categories,
  u.focus_areas,
  u.source,
  u.grant_type,
  u.foundation_id,
  e.verification_status,
  e.opportunity_type                    AS alma_opportunity_type,
  e.is_national,
  e.jurisdictions,
  e.eligible_org_types,
  e.requires_dgr,
  (e.name_key IS NOT NULL)              AS in_alma,
  u.created_at,
  u.updated_at,
  u.href
FROM unified u
LEFT JOIN alma_enrichment e ON e.name_key = lower(trim(u.name))
WHERE u.name IS NOT NULL AND length(trim(u.name)) > 1;

COMMENT ON VIEW public.v_funding_opportunities IS
  'One row per fundable thing across grant_opportunities, unpromoted foundation_programs and ALMA-native rows. Read-only; every source table keeps its own writers. Deduplicated by lower(name) because alma_funding_opportunities.source_id is NULL on every row. Does not rank: relevance_score is a constant in both tables.';

REVOKE ALL ON public.v_funding_opportunities FROM anon;
GRANT SELECT ON public.v_funding_opportunities TO authenticated, service_role;

INSERT INTO public.schema_ownership (object, owner, consumers, evidence, declared_on)
VALUES ('v_funding_opportunities', 'grantscope', '{grantscope,justicehub,act}',
        'Phase 5 unified read view over grant_opportunities + unpromoted foundation_programs + ALMA-native rows; read-only, security_invoker',
        current_date)
ON CONFLICT (object) DO NOTHING;

COMMIT;

-- Post-check:
--   SELECT origin, count(*), count(*) FILTER (WHERE is_open) AS open FROM v_funding_opportunities GROUP BY 1;
--   -- no round should appear twice under the same name and funder:
--   SELECT count(*) FROM (SELECT lower(trim(name)), coalesce(lower(trim(funder)),'') FROM v_funding_opportunities
--                         GROUP BY 1,2 HAVING count(*) > 1) d;
