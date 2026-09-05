-- ===========================================================================
-- /clarity slice 4 — THE CROSS-SECTIONS, part 2: the duplicate-hub probe and
-- the join matrix.
--
-- Apply:
--   source .env && PGPASSWORD="$DATABASE_PASSWORD" psql \
--     -h aws-0-ap-southeast-2.pooler.supabase.com -p 5432 \
--     -U "postgres.tednluwflfhxyucgwigh" -d postgres \
--     -f supabase/migrations/20260815001500_clarity_cross_sentinels.sql
--
-- Spec: CLARITY-SPEC.md §3.7, graft G12.
--
-- category_node_hub already exists and already guards gs_relationships and
-- mv_entity_power_index. What slice 4 adds is its sibling: the same design
-- review that found the two AusTender category nodes also found
-- "Department of Defence" sitting in gs_entities TWICE. One defect inflates a
-- node that should not exist; the other splits a node that should be one.
-- Both corrupt centrality, and neither is visible on any screen today.
-- ===========================================================================

INSERT INTO clarity_sentinel (key, label, description, probe_sql, severity, applies_to, guards_objects)
VALUES (
  'duplicate_canonical_name',
  'Duplicate hub entities',
  'A canonical_name appearing on more than one high-degree gs_entities row splits one '
  'organisation across two nodes. Every centrality score, power ranking and "most connected" '
  'list then understates both halves and names neither correctly.',
  -- Deliberately does NOT count edges per duplicate. Measuring degree here would
  -- mean a correlated pass over 3.43M gs_relationships rows inside a probe that
  -- runs on every answer, and this repo has already been bitten by exactly that
  -- shape stalling the pooler. Existence of a split hub is enough to block;
  -- sizing it is triage work, not sentinel work.
  $probe$
  WITH dupes AS (
    SELECT lower(btrim(canonical_name)) AS name, count(*) AS rows_split
      FROM gs_entities
     WHERE canonical_name IS NOT NULL AND btrim(canonical_name) <> ''
     GROUP BY 1
    HAVING count(*) > 1
  )
  SELECT count(*) > 0 AS tripped, count(*) AS n,
         round(100.0 * sum(rows_split) / greatest((SELECT count(*) FROM gs_entities), 1), 4) AS share,
         jsonb_build_object(
           'worst_name',   (SELECT name FROM dupes ORDER BY rows_split DESC, name LIMIT 1),
           'worst_rows',   coalesce((SELECT max(rows_split) FROM dupes), 0),
           'rows_covered', coalesce(sum(rows_split), 0)) AS detail
    FROM dupes
  $probe$,
  'block',
  '{}',
  -- Prefixed, because guards_objects is compared against
  -- clarity_question_ingredient.object_key, which carries 'public.' — NOT against
  -- clarity_object.object_key, which does not. Two conventions, one comparison.
  ARRAY['public.gs_entities', 'public.gs_relationships', 'public.mv_entity_power_index']
)
ON CONFLICT (key) DO UPDATE
  SET label = EXCLUDED.label,
      description = EXCLUDED.description,
      probe_sql = EXCLUDED.probe_sql,
      severity = EXCLUDED.severity,
      guards_objects = EXCLUDED.guards_objects;

-- ---------------------------------------------------------------------------
-- The join matrix: how domains connect, and how well.
--
-- Today every match_rate in clarity_edge is NULL — 0 of 1,338 edges measured.
-- The view returns that honestly as measured_edges = 0 and best_match_rate
-- NULL, so the surface renders '+' with "no join rate measured yet" instead of
-- a 0% that would read as "these do not join". Measuring them is slice 5.
-- ---------------------------------------------------------------------------
CREATE OR REPLACE VIEW v_clarity_join_matrix WITH (security_invoker = true) AS
SELECT so.domain                                        AS src_domain,
       tobj.domain                                       AS tgt_domain,
       count(*)                                          AS edges,
       count(*) FILTER (WHERE e.declared)                AS declared_edges,
       count(e.match_rate)                               AS measured_edges,
       max(e.match_rate)                                 AS best_match_rate,
       min(e.match_rate)                                 AS worst_match_rate,
       sum(e.match_denominator)                          AS rows_at_stake
  FROM clarity_edge e
  JOIN clarity_object so   ON so.object_key   = e.src_object
  JOIN clarity_object tobj ON tobj.object_key = e.tgt_object
 WHERE so.domain IS NOT NULL AND tobj.domain IS NOT NULL
   AND coalesce(so.act_business, false) = false
   AND coalesce(tobj.act_business, false) = false
 GROUP BY 1, 2;
REVOKE ALL ON v_clarity_join_matrix FROM PUBLIC, anon, authenticated;
GRANT SELECT ON v_clarity_join_matrix TO service_role;
