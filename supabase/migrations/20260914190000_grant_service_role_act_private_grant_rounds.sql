-- Apply: scripts/db-apply.sh supabase/migrations/20260914190000_grant_service_role_act_private_grant_rounds.sql
-- 20260914170000 created act_private_grant_rounds with CREATE TABLE AS and revoked PUBLIC/anon/authenticated, but
-- the table never received the service_role grant other act_* tables carry. The sync dry-run failed with
-- 42501 permission denied, and the /org/act/grants desk cannot read it. Service role only, as intended:
-- anon and authenticated stay revoked, RLS stays on with no policies.
BEGIN;

GRANT SELECT, INSERT, UPDATE, DELETE ON public.act_private_grant_rounds TO service_role;

COMMIT;

-- Post-check: has_table_privilege('service_role', …, 'SELECT') = true; anon/authenticated = false.
