-- Apply: scripts/db-apply.sh supabase/migrations/20260914160000_disable_smartygrants_discovery.sql
-- Data-only. Stops the SmartyGrants crawl scheduled by 20260914140000. Our Community's Terms of Use (July 2026)
-- cover "All SmartyGrants grantmaker portals ... and their associated public-facing applicant portals ... accessible
-- via subdomains" (cl 1.1) and say users "will not use bots or web scraping tools to access, browse or extract data
-- from our online services" (cl 2(i)); cl 4.3(e) adds they "won't tolerate anyone scraping, indexing, downloading or
-- sharing our data". Read 2026-09-14, after two manual runs and before any scheduled one.
-- The 609 grant_opportunities rows already collected are NOT touched here: deleting them is a separate decision.
BEGIN;

UPDATE agent_schedules SET enabled = false, updated_at = now()
WHERE agent_id = 'grantscope-discovery-smartygrants';

UPDATE agent_tasks SET status = 'cancelled', completed_at = now(),
  error = 'Cancelled: SmartyGrants terms of use prohibit bots and scraping (20260914160000)'
WHERE agent_id = 'grantscope-discovery-smartygrants' AND status = 'pending';

COMMIT;
