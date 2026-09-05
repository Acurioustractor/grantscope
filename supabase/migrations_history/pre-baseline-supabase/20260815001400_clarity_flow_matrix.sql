-- ===========================================================================
-- /clarity slice 4 — THE CROSS-SECTIONS, part 1: the flow matrix.
--
-- Apply (BUILD IS SLOW — see below):
--   source .env && PGPASSWORD="$DATABASE_PASSWORD" psql \
--     -h aws-0-ap-southeast-2.pooler.supabase.com -p 5432 \
--     -U "postgres.tednluwflfhxyucgwigh" -d postgres \
--     -f supabase/migrations/20260815001400_clarity_flow_matrix.sql
--
-- Spec: CLARITY-SPEC.md §3.7, §4.6 (graft G3).
--
-- This must be a matview and the reason is measured, not assumed: the live
-- GROUP BY over 3,429,184 edges joined twice to gs_entities was timed at
-- 91,257 ms on 2026-08-14 — 11x the 8-second PostgREST ceiling. Expect this
-- migration to sit for roughly that long. It is one statement doing one scan.
--
-- Bound by construction: 11 entity types x 11 x 10 relationship types = 1,210
-- rows maximum, 144 of them populated as measured. A matrix cannot degrade
-- into a hairball; it can only get denser.
-- ===========================================================================

DROP MATERIALIZED VIEW IF EXISTS mv_clarity_flow;

CREATE MATERIALIZED VIEW mv_clarity_flow AS
SELECT coalesce(s.entity_type, 'unknown')           AS source_type,
       coalesce(t.entity_type, 'unknown')           AS target_type,
       coalesce(r.relationship_type, 'unknown')     AS relationship_type,
       count(*)                                     AS edges,
       count(*) FILTER (WHERE r.amount IS NOT NULL) AS edges_with_amount,
       sum(r.amount)                                AS amount_recorded,
       count(*) FILTER (WHERE r.year IS NOT NULL)   AS edges_with_year,
       count(DISTINCT r.source_entity_id)           AS distinct_sources,
       count(DISTINCT r.target_entity_id)           AS distinct_targets,
       min(r.year)                                  AS year_min,
       max(r.year)                                  AS year_max
  FROM gs_relationships r
  JOIN gs_entities s ON s.id = r.source_entity_id
  JOIN gs_entities t ON t.id = r.target_entity_id
 GROUP BY 1, 2, 3;

-- CONCURRENTLY refresh needs this, and the grain is the whole point: one row
-- per (source type, target type, relationship type) and no other.
CREATE UNIQUE INDEX mv_clarity_flow_grain
  ON mv_clarity_flow (source_type, target_type, relationship_type);

REVOKE ALL ON mv_clarity_flow FROM PUBLIC, anon, authenticated;
GRANT SELECT ON mv_clarity_flow TO service_role;

COMMENT ON MATERIALIZED VIEW mv_clarity_flow IS
  'How kinds of organisation move money to kinds of organisation. edges is complete; '
  'amount_recorded is a FLOOR, not a total, because gs_relationships.amount is ~77% '
  'populated. edges_with_amount and edges_with_year exist so no cell can print a '
  'number that reads as complete when it is not.';

-- Registered, never hardcoded into a refresh list. The nightly tier is where a
-- 91-second rebuild belongs; putting it anywhere hotter would be a choice to
-- spend 91 seconds of somebody's page load.
INSERT INTO mv_refresh_registry (mv_name, tier, enabled, force_non_concurrent, notes)
VALUES ('mv_clarity_flow', 'nightly', true, false,
        'clarity slice 4 — the flow matrix behind /clarity/cross. ~91s full build.')
ON CONFLICT (mv_name) DO UPDATE
  SET tier = 'nightly', enabled = true,
      notes = EXCLUDED.notes, updated_at = now();
