-- funder_board_paths — introduction routes, keyed on resolved identity.
--
-- The route: someone sits on a funder's board and also on another
-- organisation's board. That is a real relationship and a possible warm
-- introduction.
--
-- It is also the most dangerous thing in this whole model, because a path is
-- not a statistic. It ends in a message to a named human being. A fabricated
-- path means approaching a stranger as though you have a connection, which
-- costs more than never finding them.
--
-- So paths are built on person_identities, never on raw names, and three gates
-- apply before any row is written:
--
--   1. Nominee blocks are excluded outright. 19,403 identities are trustee
--      nominee blocks — "The Trustee For ..." style rows that collapse many
--      unrelated people into one name, with clusters reaching 740 boards.
--      Traversing one invents thousands of relationships that do not exist.
--   2. Low confidence is excluded. Only high and medium survive.
--   3. Clusters above 10 are excluded, matching the cap the influence
--      leaderboard already uses. A person genuinely on 40 boards is rarer than
--      a name collision that looks like one.
--
-- What survives is still graded, and the grade is sobering: every path is
-- 'unverified', because a verified one is currently impossible.
--
-- Identity resolution has two methods. single-org-v1 is high confidence but, as
-- the name says, resolves people whose roles all sit at one organisation — it
-- can never produce a cross-board path. Every genuine path therefore comes from
-- codir-graph-v1, which is high confidence only for nominee blocks, and those
-- are excluded. So cross-organisation identity is medium confidence at best
-- until we hold a real person key such as an ASIC director ID.
--
-- Rather than leave a 'verified' grade nothing can ever reach, collision_risk
-- carries the useful signal: how many boards the identity spans, which is the
-- proxy for how likely it is to be two people wearing one name. Low risk is
-- worth acting on after a glance. High risk should be confirmed before anyone
-- uses the word "we know".
--
-- Cessation dates are respected at the funder end: a former board member is not
-- a current route.

DROP TABLE IF EXISTS public.funder_board_paths;

CREATE TABLE public.funder_board_paths (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  foundation_id uuid NOT NULL REFERENCES public.foundations(id) ON DELETE CASCADE,
  foundation_abn text,
  foundation_name text NOT NULL,

  person_name text NOT NULL,
  identity_key text NOT NULL,
  identity_confidence text NOT NULL,
  cluster_size integer,
  role_at_funder text,

  connected_entity_id uuid,
  connected_entity_name text,
  connected_entity_type text,
  connected_state text,
  connected_community_controlled boolean,
  role_at_connected text,

  path_grade text NOT NULL CHECK (path_grade IN ('verified','unverified')),
  -- Proxy for name-collision risk: how many boards this identity spans.
  collision_risk text NOT NULL CHECK (collision_risk IN ('low','medium','high')),
  computed_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (foundation_id, identity_key, connected_entity_id)
);

CREATE INDEX IF NOT EXISTS funder_board_paths_foundation_idx ON public.funder_board_paths (foundation_id);
CREATE INDEX IF NOT EXISTS funder_board_paths_connected_idx ON public.funder_board_paths (connected_entity_id);
CREATE INDEX IF NOT EXISTS funder_board_paths_grade_idx ON public.funder_board_paths (path_grade);
CREATE INDEX IF NOT EXISTS funder_board_paths_cc_idx ON public.funder_board_paths (connected_community_controlled)
  WHERE connected_community_controlled = true;

ALTER TABLE public.funder_board_paths ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Authenticated read funder board paths" ON public.funder_board_paths;
CREATE POLICY "Authenticated read funder board paths"
  ON public.funder_board_paths FOR SELECT TO authenticated USING (true);
DROP POLICY IF EXISTS "Service role manages funder board paths" ON public.funder_board_paths;
CREATE POLICY "Service role manages funder board paths"
  ON public.funder_board_paths FOR ALL TO service_role USING (true) WITH CHECK (true);
GRANT SELECT ON public.funder_board_paths TO authenticated;
GRANT ALL ON public.funder_board_paths TO service_role;

COMMENT ON TABLE public.funder_board_paths IS
  'Board-overlap introduction routes keyed on person_identities. Nominee blocks, low-confidence identities and clusters over 10 are excluded, because a fabricated path ends in a real approach to a real person.';
COMMENT ON COLUMN public.funder_board_paths.path_grade IS
  'Always unverified today. Cross-organisation identity cannot be verified without a real person key such as an ASIC director ID; the high-confidence resolution method only covers single-organisation people. The value is kept so a future identity source can raise it.';
COMMENT ON COLUMN public.funder_board_paths.collision_risk IS
  'How many boards the identity spans: low = 2, medium = 3-5, high = 6-10. The proxy for whether this is one person or several sharing a name.';

DROP FUNCTION IF EXISTS public.rebuild_funder_board_paths();

CREATE FUNCTION public.rebuild_funder_board_paths()
RETURNS TABLE(paths bigint, low_risk bigint, medium_risk bigint, high_risk bigint, funders_with_paths bigint)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public', 'pg_catalog'
AS $function$
BEGIN
  DELETE FROM funder_board_paths;

  INSERT INTO funder_board_paths (
    foundation_id, foundation_abn, foundation_name,
    person_name, identity_key, identity_confidence, cluster_size, role_at_funder,
    connected_entity_id, connected_entity_name, connected_entity_type,
    connected_state, connected_community_controlled, role_at_connected,
    path_grade, collision_risk, computed_at
  )
  SELECT DISTINCT ON (f.id, pi.identity_key, pr2.entity_id)
    f.id, f.acnc_abn, f.name,
    pr.person_name, pi.identity_key, pi.confidence, pi.cluster_size, pr.role_type,
    pr2.entity_id, e2.canonical_name, e2.entity_type,
    e2.state, e2.is_community_controlled, pr2.role_type,
    'unverified',
    CASE WHEN coalesce(pi.cluster_size, 1) <= 2 THEN 'low'
         WHEN coalesce(pi.cluster_size, 1) <= 5 THEN 'medium'
         ELSE 'high' END,
    now()
  FROM foundations f
  JOIN person_roles pr ON pr.entity_id = f.gs_entity_id AND pr.cessation_date IS NULL
  JOIN person_identities pi ON pi.role_id = pr.id
  JOIN person_identities pi2 ON pi2.identity_key = pi.identity_key
  JOIN person_roles pr2 ON pr2.id = pi2.role_id
  LEFT JOIN gs_entities e2 ON e2.id = pr2.entity_id
  WHERE pi.is_nominee_block = false
    AND pi.confidence IN ('high','medium')
    AND coalesce(pi.cluster_size, 1) <= 10
    AND pi2.is_nominee_block = false
    AND pr2.entity_id IS NOT NULL
    -- The other end must be a different organisation, or it is not a path.
    AND pr2.entity_id IS DISTINCT FROM f.gs_entity_id
  ORDER BY f.id, pi.identity_key, pr2.entity_id, pi.confidence DESC;

  RETURN QUERY
    SELECT count(*)::bigint,
           count(*) FILTER (WHERE collision_risk = 'low')::bigint,
           count(*) FILTER (WHERE collision_risk = 'medium')::bigint,
           count(*) FILTER (WHERE collision_risk = 'high')::bigint,
           count(DISTINCT foundation_id)::bigint
      FROM funder_board_paths;
END;
$function$;

COMMENT ON FUNCTION public.rebuild_funder_board_paths() IS
  'Rebuilds funder_board_paths from resolved identities. Full replace: a path that no longer holds must disappear rather than linger.';
