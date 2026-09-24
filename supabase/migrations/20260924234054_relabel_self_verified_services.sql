-- Relabel the 18 services the scraper marked 'verified' itself, as 'needs_review'.
--
-- JusticeHub's service-directory scraper set verification_status = 'verified' whenever the model
-- rated its own answer 0.8 or higher. Measured 2026-09-25: 18 of the 28 services it ever saved
-- (data_source = 'ai_scrape', created 9-10 October 2025) carry 'verified' that way; no person
-- checked any of them. One also has last_verified_at = 2026-06-02, set by an automated link check
-- (metadata.source_check.checked_by = 'alma_service_freshness_sprint', a HEAD request that got 200),
-- which confirms the page still loads, not the service. JusticeHub #506 stopped the scraper
-- verifying itself; this corrects the rows it already wrote.
--
-- What this does: copies each row's id and current status to services_self_verified_20260925, then
-- sets verification_status = 'needs_review'. Nothing else on the rows changes. Stops if the count
-- is not exactly 18.
--
-- Asked for by Ben 2026-09-25 ("relabel the 18").
--
-- Apply AFTER this file is on main (.claude/skills/db-apply/SKILL.md step 5):
--   scripts/db-apply.sh supabase/migrations/20260924234054_relabel_self_verified_services.sql
-- Undo: UPDATE services s SET verification_status = b.verification_status
--         FROM services_self_verified_20260925 b WHERE s.id = b.id;

BEGIN;
SET LOCAL lock_timeout = '30s';

CREATE TABLE public.services_self_verified_20260925 AS
SELECT id, verification_status, now() AS relabelled_at
  FROM services
 WHERE data_source = 'ai_scrape'
   AND scrape_confidence_score IS NOT NULL
   AND verification_status = 'verified';

DO $$
DECLARE n int;
BEGIN
  SELECT count(*) INTO n FROM services_self_verified_20260925;
  IF n <> 18 THEN
    RAISE EXCEPTION 'expected 18 self-verified services, found %', n;
  END IF;
END $$;

ALTER TABLE public.services_self_verified_20260925 ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.services_self_verified_20260925 FROM anon, authenticated;
GRANT SELECT ON public.services_self_verified_20260925 TO service_role;

UPDATE services s
   SET verification_status = 'needs_review'
  FROM services_self_verified_20260925 b
 WHERE s.id = b.id;

COMMIT;
