-- Corrects 20260907005751: a column-level REVOKE does not narrow a
-- table-level SELECT grant (privileges are additive), so anon could still
-- read the story telemetry columns. Revoke the table grant and re-grant only
-- the public columns explicitly. Service role is unaffected.
BEGIN;

REVOKE SELECT ON public.ecosystem_sites FROM anon, authenticated;
GRANT SELECT (id, name, slug, url, description, category, status, last_check_at, response_time_ms, icon_url, display_order, created_at, updated_at, vercel_project_id, vercel_project_name, github_repo, health_score, health_trend, last_deployment_at, ssl_expires_at, project_code)
  ON public.ecosystem_sites TO anon, authenticated;

COMMIT;

-- post-check:
--   anon PostgREST: ecosystem_sites?select=slug              -> 200
--   anon PostgREST: ecosystem_sites?select=stories_consented -> 401/403 (42501)
--   service role:   ecosystem_sites?select=stories_consented -> 200
