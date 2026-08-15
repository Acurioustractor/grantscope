-- Fold the ingredient list into the board view.
--
-- Apply:
--   source .env && PGPASSWORD="$DATABASE_PASSWORD" psql -h aws-0-ap-southeast-2.pooler.supabase.com \
--     -p 5432 -U "postgres.tednluwflfhxyucgwigh" -d postgres \
--     -f supabase/migrations/20260815000900_clarity_board_ingredients.sql
--
-- Rollback: re-apply 20260815000600_clarity_board_cards.sql, which defines the view without
-- the ingredients column.
--
-- Why
--
-- The worked-answer page made two sequential PostgREST calls: one for the card, one for the
-- ingredients. Under pool pressure the second one loses its connection and the page 500s with
-- "Timed out acquiring connection from connection pool" -- observed repeatedly on 15 Aug while
-- the shared pooler was saturated. Two round trips for data that always travels together is a
-- failure mode we do not need to own. One query, one connection, one consistent snapshot.

BEGIN;

-- DROP rather than CREATE OR REPLACE: a replace cannot insert a column mid-list
-- ("cannot change name of view column"). Nothing depends on this view yet.
DROP VIEW IF EXISTS v_clarity_board_cards;

CREATE VIEW v_clarity_board_cards
WITH (security_invoker = true) AS
SELECT
  b.*,
  (SELECT count(*) FROM clarity_question_ingredient i WHERE i.question_slug = b.slug)
    AS ingredient_count,
  (SELECT i.object_key FROM clarity_question_ingredient i
    WHERE i.question_slug = b.slug AND i.is_binding LIMIT 1)
    AS binding_object,
  (SELECT i.measured_pct FROM clarity_question_ingredient i
    WHERE i.question_slug = b.slug AND i.is_binding LIMIT 1)
    AS binding_pct,
  -- the full list, binding first, so the answer page needs no second round trip
  (SELECT jsonb_agg(jsonb_build_object(
            'object_key', i.object_key, 'join_key', i.join_key, 'role', i.role,
            'is_binding', i.is_binding, 'measured_pct', i.measured_pct)
          ORDER BY i.is_binding DESC, i.object_key)
     FROM clarity_question_ingredient i WHERE i.question_slug = b.slug)
    AS ingredients,
  (SELECT min(o.last_write_at) FROM clarity_question_ingredient i
     JOIN clarity_object o ON o.object_key = i.object_key
    WHERE i.question_slug = b.slug)
    AS oldest_ingredient_write,
  (SELECT jsonb_agg(jsonb_build_object('at', x.computed_at, 'h', x.headline, 'n', x.headline_num)
                    ORDER BY x.computed_at)
     FROM (SELECT * FROM clarity_answer y
            WHERE y.question_slug = b.slug AND y.ok
            ORDER BY y.computed_at DESC LIMIT 6) x)
    AS spark,
  (SELECT count(*) FROM clarity_answer y WHERE y.question_slug = b.slug) AS run_count,
  (SELECT y.row_count FROM clarity_answer y
    WHERE y.question_slug = b.slug ORDER BY y.computed_at DESC LIMIT 1) AS row_count
FROM v_clarity_board b;

GRANT SELECT ON v_clarity_board_cards TO service_role;

COMMIT;

-- PostgREST caches the schema. Without this the app 404s on the new column.
NOTIFY pgrst, 'reload schema';
