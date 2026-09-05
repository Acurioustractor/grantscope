-- 20260905181000_v_funding_opportunities_dedupe_by_name.sql
-- Follow-up within the hour. The first build left 13 rounds appearing twice: a foundation program whose name matches
-- a stored grant round while carrying no source_id link to it. Suppress those by name as well, the same way the
-- ALMA-native rows already are.
--
-- The other 87 duplicate name+funder groups the view surfaces are NOT introduced here: they already exist inside
-- grant_opportunities, mostly as case-varying names ("Rio Tinto Community Giving Program" vs "...program"), which the
-- three unique indexes do not catch because they are case-sensitive. They are left visible rather than hidden, because
-- merging two stored rounds is a human call (the same rule the write contract follows).
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
  -- and not promoted under a different link either: 13 programs match a stored round by name while carrying no
  -- source_id link to it, and would otherwise appear twice.
  AND NOT EXISTS (
    SELECT 1 FROM public.grant_opportunities g WHERE lower(trim(g.name)) = lower(trim(p.name))
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

COMMIT;
