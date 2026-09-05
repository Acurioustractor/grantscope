-- Grants for the question registry.
--
-- Apply:
--   source .env && PGPASSWORD="$DATABASE_PASSWORD" psql -h aws-0-ap-southeast-2.pooler.supabase.com \
--     -p 5432 -U "postgres.tednluwflfhxyucgwigh" -d postgres \
--     -f supabase/migrations/20260815000800_clarity_question_grants.sql
--
-- Rollback:
--   REVOKE SELECT ON clarity_question, clarity_question_ingredient, clarity_answer,
--                    clarity_sentinel FROM service_role;
--
-- Why this exists
--
-- v_clarity_board and v_clarity_board_cards are security_invoker = true, on purpose: a definer
-- view is precisely the construct that let 1,618 bank transactions stay publicly readable through
-- an RLS sweep that closed 48 policies. The cost of that correct choice is that the CALLER needs
-- rights on the base tables -- granting SELECT on the view alone produced
-- "permission denied for table clarity_question" on the first real page load. The view compiled,
-- typechecked and returned rows to psql as postgres; it failed only when the app asked for it.
--
-- service_role ONLY. anon and authenticated get nothing:
--   * /clarity is admin-gated and reads through the service client.
--   * The registry names our own attack surface and quotes the exact wording we may not publish.
--     Neither belongs on an anonymous endpoint.
-- Stated explicitly rather than left to a default, which is the lesson from PR #202.

BEGIN;

GRANT SELECT ON clarity_question             TO service_role;
GRANT SELECT ON clarity_question_ingredient  TO service_role;
GRANT SELECT ON clarity_answer               TO service_role;
GRANT SELECT ON clarity_sentinel             TO service_role;

-- The runner writes answers as postgres via psql, not through PostgREST, so no INSERT grant is
-- needed here. If an in-app re-run button ever lands, it goes through a definer function with its
-- own ACL -- not by widening these.

COMMIT;

-- Verify: expects four rows, all service_role / SELECT, and NOTHING for anon or authenticated.
--   SELECT table_name, grantee, privilege_type FROM information_schema.role_table_grants
--    WHERE table_name LIKE 'clarity_%' AND grantee IN ('service_role','anon','authenticated')
--    ORDER BY table_name, grantee;
