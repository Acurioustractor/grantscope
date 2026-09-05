-- funder_intelligence — one durable row per funder.
--
-- Answering "which funders, on what theme, reachable through which board
-- member" previously meant hand-joining seven materialized views. This is the
-- one place to stand: persistent, rebuilt in place, and diffable week to week
-- because previous_rank_score is retained on rebuild.
--
-- Every claim carries a grade, for the same reason Ask GrantScope grades its
-- answers. A funder-intelligence row leads to a real conversation with a real
-- person, so a field we cannot evidence must read as unknown rather than as a
-- confident zero. The grades are deliberately per-field: giving can be solid
-- while reach is unproven and classification is worthless.
--
--   verified  — identity-resolved or from a registry
--   inferred  — derived from enrichment, not an authoritative source
--   missing   — no data
--   unverified— present but known to be unreliable (see foundations.type)

CREATE TABLE IF NOT EXISTS public.funder_intelligence (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  foundation_id uuid NOT NULL UNIQUE REFERENCES public.foundations(id) ON DELETE CASCADE,
  foundation_abn text,
  foundation_name text NOT NULL,

  -- Scale. From the ACNC annual information statement where present.
  total_giving_annual numeric,
  giving_grade text NOT NULL DEFAULT 'missing' CHECK (giving_grade IN ('verified','inferred','unverified','missing')),

  -- Demonstrated reach. Counted ONLY from ABN-resolved grant links, never from
  -- name similarity. A funder with no proven grants scores zero reach and is
  -- graded missing; that is a statement about our evidence, not about them.
  grantee_count integer NOT NULL DEFAULT 0,
  community_controlled_grantees integer NOT NULL DEFAULT 0,
  target_state_grantees integer NOT NULL DEFAULT 0,
  reach_grade text NOT NULL DEFAULT 'missing' CHECK (reach_grade IN ('verified','inferred','unverified','missing')),

  -- Thematics. Enrichment-derived, so inferred at best.
  thematic_focus text[],
  geographic_focus text[],
  theme_grade text NOT NULL DEFAULT 'missing' CHECK (theme_grade IN ('verified','inferred','unverified','missing')),

  -- People. board_members comes from the ACNC register at registry confidence.
  -- board_paths counts trustees who also sit on a grantee board — the warm
  -- introduction routes.
  board_member_count integer NOT NULL DEFAULT 0,
  board_path_count integer NOT NULL DEFAULT 0,
  board_grade text NOT NULL DEFAULT 'missing' CHECK (board_grade IN ('verified','inferred','unverified','missing')),

  -- Classification. Always unverified: abr_entity_type is null for every row
  -- and the ACNC payload carries no legal form.
  funder_type text,
  type_grade text NOT NULL DEFAULT 'unverified' CHECK (type_grade IN ('verified','inferred','unverified','missing')),

  -- 1 = proven grants, 2 = board data only, 3 = register presence only.
  -- Lets a reader sort by how much is actually known, not just by score.
  evidence_tier smallint NOT NULL DEFAULT 3 CHECK (evidence_tier BETWEEN 1 AND 3),
  rank_score numeric NOT NULL DEFAULT 0,
  previous_rank_score numeric,
  computed_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS funder_intelligence_rank_idx ON public.funder_intelligence (rank_score DESC);
CREATE INDEX IF NOT EXISTS funder_intelligence_tier_idx ON public.funder_intelligence (evidence_tier, rank_score DESC);
CREATE INDEX IF NOT EXISTS funder_intelligence_abn_idx ON public.funder_intelligence (foundation_abn);
CREATE INDEX IF NOT EXISTS funder_intelligence_theme_idx ON public.funder_intelligence USING gin (thematic_focus);

ALTER TABLE public.funder_intelligence ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Authenticated read funder intelligence" ON public.funder_intelligence;
CREATE POLICY "Authenticated read funder intelligence"
  ON public.funder_intelligence FOR SELECT TO authenticated USING (true);
DROP POLICY IF EXISTS "Service role manages funder intelligence" ON public.funder_intelligence;
CREATE POLICY "Service role manages funder intelligence"
  ON public.funder_intelligence FOR ALL TO service_role USING (true) WITH CHECK (true);
GRANT SELECT ON public.funder_intelligence TO authenticated;
GRANT ALL ON public.funder_intelligence TO service_role;

COMMENT ON TABLE public.funder_intelligence IS
  'One durable row per funder with per-field trust grades. Reach is counted only from ABN-resolved grant links; name-similarity attribution is never used.';
COMMENT ON COLUMN public.funder_intelligence.previous_rank_score IS
  'Rank score from the prior rebuild, so week-to-week movement is visible without a snapshot table.';

-- Rebuild in place. Set-based over ~11K funders.
--
-- rank_score is intentionally simple and explainable, because a score nobody
-- can reconstruct is a score nobody should act on:
--
--   community-controlled grantees x 3   proven delivery to community control
--   target-state grantees         x 1   proven reach into NT / WA / QLD / SA
--   board paths                   x 2   warm introduction routes that exist
--   log10(annual giving)          x 2   scale, dampened so size cannot dominate
--
-- Giving is logged deliberately: a $180M funder is not 360 times more relevant
-- than a $500K one, and linear dollars would bury every regional funder.
CREATE OR REPLACE FUNCTION public.rebuild_funder_intelligence()
RETURNS TABLE(rows_written bigint, tier1 bigint, tier2 bigint)
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
  ), boards AS (
    SELECT f.id AS foundation_id,
           count(DISTINCT pr.person_name_normalised) AS members
      FROM foundations f
      JOIN person_roles pr ON pr.entity_id = f.gs_entity_id
     WHERE pr.cessation_date IS NULL
     GROUP BY f.id
  ), paths AS (
    -- DISTINCT because the chain repeats a trustee per grant year.
    SELECT f.id AS foundation_id,
           count(*) AS path_count
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
           count(*) FILTER (WHERE evidence_tier = 2)::bigint
      FROM funder_intelligence;
END;
$function$;

COMMENT ON FUNCTION public.rebuild_funder_intelligence() IS
  'Rebuilds funder_intelligence in place, retaining prior rank_score as previous_rank_score so movement is visible.';
