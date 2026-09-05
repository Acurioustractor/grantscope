-- Lock EXECUTE on clarity_apply_act_flag to match its four sibling functions.
--
-- Apply:
--   source .env && PGPASSWORD="$DATABASE_PASSWORD" psql -h aws-0-ap-southeast-2.pooler.supabase.com \
--     -p 5432 -U "postgres.tednluwflfhxyucgwigh" -d postgres \
--     -f migrations/2026-08-15-lock-clarity-act-flag-grant.sql
--
-- Rollback (restores the PostgreSQL default, i.e. EXECUTE to PUBLIC):
--   ALTER FUNCTION public.clarity_apply_act_flag() OWNER TO postgres;
--   REVOKE EXECUTE ON FUNCTION public.clarity_apply_act_flag() FROM service_role;
--   GRANT EXECUTE ON FUNCTION public.clarity_apply_act_flag() TO PUBLIC;
--
-- Why this exists
--
-- 2026-08-15-act-flag-from-scope-table.sql created clarity_apply_act_flag() but never
-- set its ACL, so it kept PostgreSQL's default of EXECUTE to PUBLIC -- which includes
-- anon. Its four siblings (clarity_refresh, clarity_score, clarity_measure_gaps,
-- clarity_set_probe) were all explicitly restricted to postgres + service_role in their
-- own migrations. This is drift, not a deliberate exception.
--
-- Impact today is contained, and that was verified rather than assumed: the function is
-- SECURITY INVOKER, and anon/authenticated hold zero grants on clarity_object and
-- catalog_object_scope, so an anonymous call fails on its first write. The reason to
-- close it anyway is that it is one "SECURITY DEFINER" away from being live, and an
-- unexplained asymmetry reads as intentional to whoever finds it next.
--
-- Found by the catalog itself: clarity_object surfaced the function as a newly-seen
-- routine with anon_execute = true on the first refresh after the migration that
-- created it.

BEGIN;

REVOKE EXECUTE ON FUNCTION public.clarity_apply_act_flag() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.clarity_apply_act_flag() TO service_role;

COMMIT;

-- Verify: expects "postgres=X/postgres | service_role=X/postgres", matching the siblings.
--
--   SELECT p.proname, array_to_string(p.proacl, ' | ') AS acl
--   FROM pg_proc p JOIN pg_namespace n ON n.oid = p.pronamespace
--   WHERE n.nspname = 'public' AND p.proname LIKE 'clarity%'
--   ORDER BY p.proname;
