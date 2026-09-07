-- ecosystem_sites: story syndication state per site, from Empathy Ledger.
--
-- Written by act-global-infrastructure/scripts/vercel-sync.mjs (daily) from
-- Empathy Ledger's admin_syndication_by_site and syndication_site_traffic.
-- The studio's /admin/ecosystem shows "consented but never pulled" per site,
-- which is how The Harvest sat unnoticed for months. Plan:
-- act-global-infrastructure/thoughts/shared/plans/syndication-out.md
BEGIN;

ALTER TABLE public.ecosystem_sites
  ADD COLUMN IF NOT EXISTS el_site_slug text,
  ADD COLUMN IF NOT EXISTS stories_consented integer,
  ADD COLUMN IF NOT EXISTS stories_last_pull_at timestamptz;

COMMENT ON COLUMN public.ecosystem_sites.el_site_slug IS 'Empathy Ledger syndication_sites.slug that consumes this site''s stories';
COMMENT ON COLUMN public.ecosystem_sites.stories_consented IS 'articles + stories consented to this site in Empathy Ledger, as of the last sync';
COMMENT ON COLUMN public.ecosystem_sites.stories_last_pull_at IS 'last time this site pulled from Empathy Ledger, as of the last sync; NULL = never';

COMMIT;

-- post-check:
-- SELECT column_name, data_type FROM information_schema.columns
--  WHERE table_name='ecosystem_sites' AND column_name IN ('el_site_slug','stories_consented','stories_last_pull_at');
