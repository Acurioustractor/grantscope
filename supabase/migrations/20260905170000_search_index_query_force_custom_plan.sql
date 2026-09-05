-- 20260905170000_search_index_query_force_custom_plan.sql
-- The query is fast; the plan cache was not. Measured 2026-09-05, same SQL:
--   run as a plain statement          131 ms  (BitmapOr over the trigram and tsvector GIN indexes, ~1,035 candidates)
--   run through search_index_query()  2,300-3,400 ms
-- After five executions Postgres switches a parameterised SQL function to a GENERIC plan, which cannot know that
-- `name % q` is selective for this particular q, so it stops using the GIN indexes. force_custom_plan makes it re-plan
-- per call, which costs 0.05 ms of planning and returns the index scans. Same trap as the browse RPCs (see the memory
-- note on RPC generic plans); the fix belongs on every search-shaped function that takes the query text as a parameter.
BEGIN;
ALTER FUNCTION public.search_index_query(text, text[], text, integer) SET plan_cache_mode = 'force_custom_plan';
COMMIT;
-- Post-check: six consecutive calls should all be ~150 ms, not the first five fast and the rest slow.
