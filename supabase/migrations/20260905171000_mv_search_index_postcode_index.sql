-- 20260905171000_mv_search_index_postcode_index.sql
-- search_index_query took 2.8s while the same SQL with literal values took 124ms. Cause: the WHERE has four OR
-- branches, and one of them, `p.digits ~ '^\d{4}$' AND s.postcode = p.digits`, has no index on postcode. With literal
-- values the planner folds the regex to false and drops the branch; with function parameters it cannot fold, and one
-- unindexable OR branch forces a sequential scan of all 440k rows. An index on postcode lets the BitmapOr cover every
-- branch. (plan_cache_mode was tried first and changed nothing: it was never the generic plan.)
BEGIN;
CREATE INDEX IF NOT EXISTS mv_search_index_postcode ON public.mv_search_index (postcode) WHERE postcode IS NOT NULL;
COMMIT;
