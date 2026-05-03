-- Fix malformed function search_path values.
-- The previous definitions set search_path as one quoted schema name
-- ('public, extensions, pg_catalog'), so RPC calls could not resolve
-- grant_opportunities even though the table exists in public.

ALTER FUNCTION public.match_grants_for_org(vector, double precision, integer)
  SET search_path = public, extensions, pg_catalog;

ALTER FUNCTION public.get_user_feedback_signals(uuid, uuid)
  SET search_path = public, extensions, pg_catalog;
