-- Make the jsonb indexes usable through the views that were built for them.
--
-- 20260921210000 created four partial expression indexes predicated on
-- `WHERE properties ? '<key>'`, and two views that expose the same keys as
-- plain columns. The two do not meet.
--
-- A caller going through the view writes:
--
--     SELECT ... FROM v_gs_relationships_typed WHERE role_type = 'director'
--
-- which the planner sees as `(properties ->> 'role_type') = 'director'`. That
-- does not imply `properties ? 'role_type'`, so the partial index is not
-- applicable and the plan is a Parallel Seq Scan over 3.0M rows.
--
-- Measured after 20260921210000:
--   WHERE properties ? 'role_type' AND properties->>'role_type' = 'director'
--     -> Index Scan using gs_relationships_props_role_type_idx
--   WHERE role_type = 'director'   (through the view, i.e. how it will be used)
--     -> Parallel Seq Scan on gs_relationships
--
-- The original post-check only ran the first form, which is the index's own
-- predicate written back at it. It proved the index existed and proved nothing
-- about the access path. Check the code path, not the object.
--
-- Fix: predicate the index on the same expression the caller filters on.
-- `(properties ->> 'key') IS NOT NULL` is implied by any equality on that
-- expression, so both the equality and the IS NOT NULL form can use it, and it
-- stays partial: ->> returns NULL when the key is absent, so the index still
-- covers only the rows that have the key.
--
-- One behavioural difference, deliberately accepted: a key present with a JSON
-- `null` value is indexed by `?` and not by `->> IS NOT NULL`. Neither table
-- stores JSON nulls in these keys, and a row whose value is null is not one any
-- of these queries wants.
--
-- Apply: scripts/db-apply.sh supabase/migrations/20260921220000_fix_jsonb_index_predicates.sql

BEGIN;

DROP INDEX IF EXISTS public.gs_relationships_props_role_type_idx;
CREATE INDEX gs_relationships_props_role_type_idx
  ON public.gs_relationships ((properties ->> 'role_type'))
  WHERE (properties ->> 'role_type') IS NOT NULL;

DROP INDEX IF EXISTS public.gs_relationships_props_procurement_method_idx;
CREATE INDEX gs_relationships_props_procurement_method_idx
  ON public.gs_relationships ((properties ->> 'procurement_method'))
  WHERE (properties ->> 'procurement_method') IS NOT NULL;

DROP INDEX IF EXISTS public.gs_relationships_props_buyer_name_idx;
CREATE INDEX gs_relationships_props_buyer_name_idx
  ON public.gs_relationships ((properties ->> 'buyer_name'))
  WHERE (properties ->> 'buyer_name') IS NOT NULL;

DROP INDEX IF EXISTS public.person_roles_props_charity_size_idx;
CREATE INDEX person_roles_props_charity_size_idx
  ON public.person_roles ((properties ->> 'charity_size'))
  WHERE (properties ->> 'charity_size') IS NOT NULL;

COMMIT;

-- Post-check, and run it THROUGH THE VIEW, which is the whole point:
--
--   EXPLAIN (COSTS OFF) SELECT count(*) FROM v_gs_relationships_typed
--    WHERE role_type = 'director';
--   -- expect: Index Scan using gs_relationships_props_role_type_idx
