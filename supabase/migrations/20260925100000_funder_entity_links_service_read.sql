-- Let the service role read funder_entity_links, so ALMA inserts work again.
--
-- Why: 20260922090000_key_buyer_prospects_and_funders.sql created funder_entity_links (RLS on, no
-- grants) and a SECURITY INVOKER trigger, trg_set_funder_entity_id, that reads it on every INSERT
-- (and UPDATE OF funder_name) on alma_funding_opportunities. The promote scripts insert with the
-- service role, which had no privilege on the table, so every insert since 2026-09-22 failed with
-- "permission denied for table funder_entity_links" while agent_runs still logged success.
-- Found 2026-09-25 running promote-* for real after the ALMA dedupe: 60 new rounds, 0 inserted.
--
-- service_role bypasses RLS; it needs only the table privilege. Nothing is granted to anon or
-- authenticated (shared-project rule: nothing private to anon).
--
-- Apply: scripts/db-apply.sh supabase/migrations/20260925100000_funder_entity_links_service_read.sql (Tier 3)

BEGIN;
GRANT SELECT ON public.funder_entity_links TO service_role;
COMMIT;
