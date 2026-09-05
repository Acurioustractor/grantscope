-- The rows behind an answer.
--
-- Apply:
--   source .env && PGPASSWORD="$DATABASE_PASSWORD" psql -h aws-0-ap-southeast-2.pooler.supabase.com \
--     -p 5432 -U "postgres.tednluwflfhxyucgwigh" -d postgres \
--     -f supabase/migrations/20260815000700_clarity_question_rows.sql
--
-- Rollback:
--   DROP FUNCTION IF EXISTS clarity_question_rows(text, integer, integer);
--
-- Why a function
--
-- rows_sql is arbitrary SELECT text held in the registry. The app cannot run it: exec_sql is
-- SELECT-only behind an 8-second cap and is blocked app-side anyway (SQL_RPC_DISABLED). Putting
-- it in a definer function keeps the SQL in the database where it can be tested from psql, and
-- keeps exactly one execution path instead of two.
--
-- SAFETY, since this executes stored SQL text:
--   * rows_sql is authored by us in migrations. It is not user input and there is no write path
--     to it from the app.
--   * The function refuses anything that is not a single SELECT/WITH statement, and refuses a
--     statement containing a semicolon, so a registry row can never smuggle in a second command.
--   * p_limit is clamped to 1..500. An unbounded rows page against justice_funding is a way to
--     hang the pooler, which is already the most contended resource in this project.
--   * EXECUTE is granted to service_role only, IN THIS MIGRATION. A function created without its
--     ACL keeps PostgreSQL's default of EXECUTE to PUBLIC -- that is how clarity_apply_act_flag
--     ended up open (PR #202), and a definer function is the case where it would have mattered.

BEGIN;

CREATE OR REPLACE FUNCTION clarity_question_rows(
  p_slug   text,
  p_limit  integer DEFAULT 100,
  p_offset integer DEFAULT 0
) RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $fn$
DECLARE
  v_sql       text;
  v_stripped  text;
  v_limit     integer := least(greatest(coalesce(p_limit, 100), 1), 500);
  v_offset    integer := greatest(coalesce(p_offset, 0), 0);
  v_rows      jsonb;
BEGIN
  SELECT rows_sql INTO v_sql FROM clarity_question WHERE slug = p_slug;

  IF v_sql IS NULL THEN
    RETURN jsonb_build_object('ok', false, 'error', 'no rows_sql registered for this question');
  END IF;

  v_stripped := btrim(v_sql);

  -- Single statement only. A semicolon anywhere is a refusal, not a trim: trimming a trailing
  -- one would quietly accept "SELECT 1; DROP ..." on the next edit.
  IF position(';' IN v_stripped) > 0 THEN
    RETURN jsonb_build_object('ok', false, 'error', 'rows_sql must be a single statement');
  END IF;

  IF v_stripped !~* '^\s*(select|with)\s' THEN
    RETURN jsonb_build_object('ok', false, 'error', 'rows_sql must begin with SELECT or WITH');
  END IF;

  EXECUTE format(
    'SELECT coalesce(jsonb_agg(to_jsonb(z)), ''[]''::jsonb) FROM (%s LIMIT %s OFFSET %s) z',
    v_stripped, v_limit, v_offset
  ) INTO v_rows;

  RETURN jsonb_build_object(
    'ok', true,
    'rows', v_rows,
    'limit', v_limit,
    'offset', v_offset
  );
END;
$fn$;

REVOKE EXECUTE ON FUNCTION clarity_question_rows(text, integer, integer) FROM PUBLIC;
GRANT  EXECUTE ON FUNCTION clarity_question_rows(text, integer, integer) TO service_role;

COMMIT;

-- Verify: expects ok=true and 3 rows.
--   SELECT clarity_question_rows('watchhouse-children', 3, 0);
-- And the ACL, which must match the other locked clarity functions:
--   SELECT proname, array_to_string(proacl,' | ') FROM pg_proc
--    WHERE proname = 'clarity_question_rows';
