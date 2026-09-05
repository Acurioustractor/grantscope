-- duplicate_canonical_name: block → warn (Ben's decision, 2026-08-15)
--
-- Apply:
--   source .env && PGPASSWORD="$DATABASE_PASSWORD" psql -h aws-0-ap-southeast-2.pooler.supabase.com \
--     -p 5432 -U "postgres.tednluwflfhxyucgwigh" -d postgres \
--     -f supabase/migrations/20260815002200_clarity_duplicate_name_sentinel_warn.sql
--
-- The defect is real and unchanged: 9,607 canonical names cover 25,059 rows, 4.1% of gs_entities,
-- and they split organisations across nodes. Nothing about this migration says otherwise, and the
-- sentinel keeps firing, keeps its n, and keeps rendering on every card that reads the objects it
-- guards.
--
-- What changes is the consequence. At `block` it refused `evidence-gap` — the flagship question —
-- and would refuse every future question touching gs_entities, gs_relationships or
-- mv_entity_power_index, which is most of them. A guard that refuses most of the board is a guard
-- somebody switches off, and the thing that then gets switched off is the visibility, not the
-- defect. At `warn` the number renders with the contamination named beside it, which is a reader
-- who can see both.
--
-- The reverse is one line, and it is the right move the moment a question is registered whose
-- answer genuinely inverts under name collisions — a centrality ranking, a "most connected"
-- list. Those are exactly the questions this sentinel was written for, and none of them exists
-- yet.

BEGIN;

UPDATE clarity_sentinel
   SET severity = 'warn',
       description = description
         || ' Severity lowered from block to warn on 2026-08-15: the defect is real but it does '
         || 'not invert most answers, and at block it refused the flagship question and would '
         || 'have refused most of the board. Raise it back to block when a question is registered '
         || 'whose answer actually inverts under name collisions — a centrality ranking or a '
         || '"most connected" list.'
 WHERE key = 'duplicate_canonical_name'
   AND severity = 'block';

COMMIT;
