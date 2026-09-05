-- Derive funder thematics from what a funder actually funds.
--
-- foundations.thematic_focus is enrichment prose and it hides the best
-- funders. FRRR — 178 community-controlled grantees and 830 in NT/WA/QLD/SA,
-- the top-ranked funder in the table — is tagged only 'community', so filtering
-- for 'indigenous' or 'rural_remote' drops it entirely. Ian Potter, ranked
-- second, carries no themes at all.
--
-- Behaviour is the better evidence. A funder whose grantees are Aboriginal
-- community-controlled organisations in remote Australia funds that work,
-- whatever a profile page says about them. This is the same shift that fixed
-- opportunity ranking: rank on what is demonstrated, not on what is claimed.
--
-- Derived tags are graded 'verified' because every one is counted from
-- ABN-resolved grants to entities whose attributes come from the registry. The
-- evidence counts are stored alongside so any tag can be audited back to the
-- grantees that produced it.

ALTER TABLE public.funder_intelligence
  ADD COLUMN IF NOT EXISTS derived_thematics text[],
  ADD COLUMN IF NOT EXISTS derived_theme_evidence jsonb NOT NULL DEFAULT '{}'::jsonb,
  ADD COLUMN IF NOT EXISTS derived_theme_grade text NOT NULL DEFAULT 'missing'
    CHECK (derived_theme_grade IN ('verified','inferred','unverified','missing'));

CREATE INDEX IF NOT EXISTS funder_intelligence_derived_theme_idx
  ON public.funder_intelligence USING gin (derived_thematics);

COMMENT ON COLUMN public.funder_intelligence.derived_thematics IS
  'Themes derived from the attributes of ABN-resolved grantees. Prefer this over thematic_focus, which is enrichment prose and demonstrably incomplete.';
COMMENT ON COLUMN public.funder_intelligence.derived_theme_evidence IS
  'Grantee counts behind each derived tag, so every tag can be audited back to the grants that produced it.';

-- The signature gains a column, and Postgres will not replace a function whose
-- OUT parameters changed.
DROP FUNCTION IF EXISTS public.rebuild_funder_intelligence();

CREATE FUNCTION public.rebuild_funder_intelligence()
RETURNS TABLE(rows_written bigint, tier1 bigint, tier2 bigint, with_derived_themes bigint)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public', 'pg_catalog'
AS $function$
BEGIN
  WITH reach AS (
    SELECT fg.foundation_id,
           count(DISTINCT fg.grantee_entity_id) AS grantees,
           count(DISTINCT fg.grantee_entity_id) FILTER (WHERE fg.grantee_community_controlled) AS cc,
           count(DISTINCT fg.grantee_entity_id) FILTER (WHERE fg.grantee_state IN ('NT','WA','QLD','SA')) AS tgt
      FROM mv_foundation_grantees fg
     GROUP BY fg.foundation_id
  ), grantee_tags AS (
    -- One row per (funder, grantee, tag). DISTINCT on grantee so a funder that
    -- gave to the same organisation ten times does not count it ten times.
    SELECT DISTINCT fg.foundation_id, fg.grantee_entity_id, t.tag
      FROM mv_foundation_grantees fg
      JOIN gs_entities e ON e.id = fg.grantee_entity_id
      CROSS JOIN LATERAL (
        SELECT unnest(array_remove(ARRAY[
          -- Aboriginal community control is the strongest signal we hold, and
          -- it is a registry attribute rather than an inference.
          CASE WHEN e.entity_type = 'indigenous_corp' OR e.is_community_controlled
               OR lower(coalesce(e.sector,'')) LIKE '%indigenous%' THEN 'indigenous' END,
          CASE WHEN e.remoteness IN ('Outer Regional Australia','Remote Australia','Very Remote Australia')
               THEN 'rural_remote' END,
          -- SEIFA 1-3 is the most disadvantaged 30% of areas.
          CASE WHEN e.seifa_irsd_decile IS NOT NULL AND e.seifa_irsd_decile <= 3
               THEN 'disadvantage' END,
          CASE WHEN lower(coalesce(e.sector,'')) LIKE '%education%' THEN 'education' END,
          CASE WHEN lower(coalesce(e.sector,'')) LIKE '%health%' THEN 'health' END,
          CASE WHEN lower(coalesce(e.sector,'')) LIKE '%arts%' THEN 'arts' END,
          CASE WHEN lower(coalesce(e.sector,'')) LIKE '%social welfare%' THEN 'social-welfare' END,
          CASE WHEN lower(coalesce(e.sector,'')) LIKE '%communit%' THEN 'community' END,
          CASE WHEN lower(coalesce(e.sector,'')) LIKE '%environment%' THEN 'environment' END,
          CASE WHEN lower(coalesce(e.sector,'')) LIKE '%religion%' THEN 'religion' END
        ], NULL)) AS tag
      ) t
  ), tag_counts AS (
    SELECT gt.foundation_id, gt.tag, count(*) AS tagged
      FROM grantee_tags gt
     GROUP BY gt.foundation_id, gt.tag
  ), derived AS (
    -- A tag survives when it covers at least 10% of a funder's grantees and at
    -- least 3 of them. The floor stops a single grant from branding a funder;
    -- the share stops a large funder's long tail from acquiring every tag.
    SELECT tc.foundation_id,
           array_agg(tc.tag ORDER BY tc.tagged DESC)
             FILTER (WHERE tc.tagged >= 3 AND tc.tagged::numeric / r.grantees >= 0.10) AS tags,
           jsonb_object_agg(tc.tag, tc.tagged) AS evidence
      FROM tag_counts tc
      JOIN reach r ON r.foundation_id = tc.foundation_id
     GROUP BY tc.foundation_id
  ), boards AS (
    SELECT f.id AS foundation_id,
           count(DISTINCT pr.person_name_normalised) AS members
      FROM foundations f
      JOIN person_roles pr ON pr.entity_id = f.gs_entity_id
     WHERE pr.cessation_date IS NULL
     GROUP BY f.id
  ), paths AS (
    SELECT f.id AS foundation_id, count(*) AS path_count
      FROM foundations f
      JOIN (
        SELECT DISTINCT foundation_abn, trustee_name, grantee_abn
          FROM mv_trustee_grantee_chain
         WHERE trustee_on_grantee_board
      ) t ON t.foundation_abn = f.acnc_abn
     GROUP BY f.id
  )
  INSERT INTO funder_intelligence AS fi (
    foundation_id, foundation_abn, foundation_name,
    total_giving_annual, giving_grade,
    grantee_count, community_controlled_grantees, target_state_grantees, reach_grade,
    thematic_focus, geographic_focus, theme_grade,
    derived_thematics, derived_theme_evidence, derived_theme_grade,
    board_member_count, board_path_count, board_grade,
    funder_type, type_grade,
    evidence_tier, rank_score, computed_at
  )
  SELECT
    f.id, f.acnc_abn, f.name,
    f.total_giving_annual,
    CASE WHEN f.total_giving_annual IS NULL THEN 'missing' ELSE 'inferred' END,
    coalesce(r.grantees, 0), coalesce(r.cc, 0), coalesce(r.tgt, 0),
    CASE WHEN r.grantees IS NULL THEN 'missing' ELSE 'verified' END,
    f.thematic_focus, f.geographic_focus,
    CASE WHEN f.thematic_focus IS NULL OR cardinality(f.thematic_focus) = 0 THEN 'missing' ELSE 'inferred' END,
    d.tags, coalesce(d.evidence, '{}'::jsonb),
    CASE WHEN d.tags IS NULL OR cardinality(d.tags) = 0 THEN 'missing' ELSE 'verified' END,
    coalesce(b.members, 0), coalesce(p.path_count, 0),
    CASE WHEN b.members IS NULL THEN 'missing' ELSE 'verified' END,
    f.type, 'unverified',
    CASE WHEN coalesce(r.grantees,0) > 0 THEN 1
         WHEN coalesce(b.members,0) > 0 THEN 2
         ELSE 3 END,
    round(
      coalesce(r.cc, 0) * 3
      + coalesce(r.tgt, 0) * 1
      + coalesce(p.path_count, 0) * 2
      + CASE WHEN coalesce(f.total_giving_annual, 0) > 0
             THEN log(10, f.total_giving_annual) * 2 ELSE 0 END
    , 2),
    now()
  FROM foundations f
  LEFT JOIN reach r ON r.foundation_id = f.id
  LEFT JOIN derived d ON d.foundation_id = f.id
  LEFT JOIN boards b ON b.foundation_id = f.id
  LEFT JOIN paths p ON p.foundation_id = f.id
  ON CONFLICT (foundation_id) DO UPDATE SET
    foundation_abn = EXCLUDED.foundation_abn,
    foundation_name = EXCLUDED.foundation_name,
    total_giving_annual = EXCLUDED.total_giving_annual,
    giving_grade = EXCLUDED.giving_grade,
    grantee_count = EXCLUDED.grantee_count,
    community_controlled_grantees = EXCLUDED.community_controlled_grantees,
    target_state_grantees = EXCLUDED.target_state_grantees,
    reach_grade = EXCLUDED.reach_grade,
    thematic_focus = EXCLUDED.thematic_focus,
    geographic_focus = EXCLUDED.geographic_focus,
    theme_grade = EXCLUDED.theme_grade,
    derived_thematics = EXCLUDED.derived_thematics,
    derived_theme_evidence = EXCLUDED.derived_theme_evidence,
    derived_theme_grade = EXCLUDED.derived_theme_grade,
    board_member_count = EXCLUDED.board_member_count,
    board_path_count = EXCLUDED.board_path_count,
    board_grade = EXCLUDED.board_grade,
    funder_type = EXCLUDED.funder_type,
    type_grade = EXCLUDED.type_grade,
    evidence_tier = EXCLUDED.evidence_tier,
    previous_rank_score = fi.rank_score,
    rank_score = EXCLUDED.rank_score,
    computed_at = EXCLUDED.computed_at;

  RETURN QUERY
    SELECT count(*)::bigint,
           count(*) FILTER (WHERE evidence_tier = 1)::bigint,
           count(*) FILTER (WHERE evidence_tier = 2)::bigint,
           count(*) FILTER (WHERE derived_theme_grade = 'verified')::bigint
      FROM funder_intelligence;
END;
$function$;
