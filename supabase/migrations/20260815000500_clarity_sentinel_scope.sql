-- Scope sentinels to the objects they actually guard.
--
-- Apply:
--   source .env && PGPASSWORD="$DATABASE_PASSWORD" psql -h aws-0-ap-southeast-2.pooler.supabase.com \
--     -p 5432 -U "postgres.tednluwflfhxyucgwigh" -d postgres \
--     -f supabase/migrations/20260815000500_clarity_sentinel_scope.sql
--
-- Rollback:
--   ALTER TABLE clarity_sentinel DROP COLUMN guards_objects;
--
-- Why this exists
--
-- The first runner pass blocked all three questions with all three sentinels. That was correct
-- behaviour against an incorrect model: applies_to = '{}' was seeded to mean "global", and global
-- was read as "blocks everything". But none of the three questions touch political_donations or
-- austender_contracts, and none reads a centrality score. A contamination in a table a question
-- never reads is not a reason to refuse the answer -- and a sentinel that blocks everything gets
-- switched off within a week, which is how a real defect ships unnoticed.
--
-- The spec already implied the right rule: category_node_hub blocks "any question READING
-- centrality". So a sentinel declares the objects it guards, and blocking is derived from the
-- question's own ingredient list. Add an ingredient, inherit its sentinels. Nothing to maintain
-- by hand, and no way to read a contaminated table without its guard.
--
-- Precedence, in the runner:
--   1. applies_to lists question slugs        -> blocks exactly those
--   2. guards_objects overlaps the question's ingredients -> blocks that question
--   3. neither set                            -> recorded on every answer, blocks nothing
-- Rule 3 is deliberate. An unscoped sentinel stays VISIBLE rather than becoming invisible or
-- becoming a blanket refusal.

BEGIN;

ALTER TABLE clarity_sentinel ADD COLUMN guards_objects text[] NOT NULL DEFAULT '{}';

COMMENT ON COLUMN clarity_sentinel.guards_objects IS
  'clarity_object.object_key values this sentinel protects. A question whose ingredients overlap '
  'this list inherits the sentinel. Empty + empty applies_to = recorded everywhere, blocks nothing.';

UPDATE clarity_sentinel SET guards_objects = ARRAY['public.political_donations']
 WHERE key = 'receipt_type_contamination';

UPDATE clarity_sentinel SET guards_objects = ARRAY['public.austender_contracts']
 WHERE key = 'contract_value_ceiling';

-- The graph objects. Any question whose ingredients include the relationship graph is reading
-- something the two category hubs distort.
UPDATE clarity_sentinel SET guards_objects = ARRAY['public.gs_relationships', 'public.mv_entity_power_index']
 WHERE key = 'category_node_hub';

COMMIT;

-- Verify: expects one guarded-object array per sentinel, none empty.
--   SELECT key, severity, applies_to, guards_objects FROM clarity_sentinel ORDER BY key;
