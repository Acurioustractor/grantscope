-- The three story-syndication columns are operational telemetry for the
-- studio's internal operations page, which reads with the service role.
-- The public read policy on ecosystem_sites stays for name, url, status and
-- deploy times; these columns are withheld from the public key.
-- Raised by review on grantscope #449.
BEGIN;

REVOKE SELECT (el_site_slug, stories_consented, stories_last_pull_at)
  ON public.ecosystem_sites FROM anon, authenticated;

COMMIT;

-- post-check:
--   anon PostgREST: ecosystem_sites?select=slug            -> 200
--   anon PostgREST: ecosystem_sites?select=stories_consented -> 401/403
