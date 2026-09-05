-- The board's read model.
--
-- Apply:
--   source .env && PGPASSWORD="$DATABASE_PASSWORD" psql -h aws-0-ap-southeast-2.pooler.supabase.com \
--     -p 5432 -U "postgres.tednluwflfhxyucgwigh" -d postgres \
--     -f supabase/migrations/20260815000600_clarity_board_cards.sql
--
-- Rollback:
--   DROP VIEW IF EXISTS v_clarity_board_cards;
--
-- Why a view and not SQL in the app
--
-- The card needs a LATERAL join for the last answer, two correlated aggregates over the
-- ingredient list, and a small run-history array. PostgREST cannot express any of that, and the
-- alternative is SQL string-building in the page, which is how the app ends up owning queries
-- nobody can test from psql. The whole thing reads only registry tables -- no source data is
-- touched -- so it is cheap regardless of how large the questions themselves are.
--
-- security_invoker matches v_clarity_board: this view must not become a definer-view hole. That
-- class of leak is exactly what a table-level RLS sweep cannot see, and it is how 1,618 bank
-- transactions stayed public through a sweep that closed 48 policies (see
-- migrations/2026-08-15-close-bank-statement-view-leak.sql).

BEGIN;

CREATE OR REPLACE VIEW v_clarity_board_cards
WITH (security_invoker = true) AS
SELECT
  b.*,
  (SELECT count(*) FROM clarity_question_ingredient i WHERE i.question_slug = b.slug)
    AS ingredient_count,
  -- The binding ingredient caps the claim. It is surfaced by name so the card can print
  -- "capped by justice_funding at 93.65%" rather than a bare coverage bar with no cause.
  (SELECT i.object_key FROM clarity_question_ingredient i
    WHERE i.question_slug = b.slug AND i.is_binding LIMIT 1)
    AS binding_object,
  (SELECT i.measured_pct FROM clarity_question_ingredient i
    WHERE i.question_slug = b.slug AND i.is_binding LIMIT 1)
    AS binding_pct,
  -- Oldest write across the question's ingredients: the honest freshness of the answer, which is
  -- the STALEST input, not the most recent one.
  (SELECT min(o.last_write_at) FROM clarity_question_ingredient i
     JOIN clarity_object o ON o.object_key = i.object_key
    WHERE i.question_slug = b.slug)
    AS oldest_ingredient_write,
  -- Last six good runs, oldest first, for the sparkline. Errored runs are excluded here but are
  -- still visible on the card through ok/error_text -- a failed run must not silently vanish.
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

-- Verify: expects one row per non-retired question, each with a binding object and a spark array.
--   SELECT slug, ingredient_count, binding_object, binding_pct, run_count,
--          jsonb_array_length(coalesce(spark,'[]'::jsonb)) AS spark_points
--     FROM v_clarity_board_cards ORDER BY slug;
