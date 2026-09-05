-- =============================================================================
-- 2026-08-14-fix-misdeclared-service-role-policies.sql
--
-- COMPANION to 2026-08-14-revoke-anon-private-reads.sql. Independent of it —
-- either may be applied alone.
--
-- THE DEFECT: ALL THIRTEEN of the `FOR ALL` policies in schema `public` that
-- grant role `public` with USING(true) are NAMED for a privileged role
-- ("Service role full access...", "Service manages...", "Admin write...",
-- "Allow all access for service role", "Authenticated write access...") but
-- were created without a TO clause. Postgres defaults that to role `public`, which in Supabase
-- includes `anon`. Combined with `USING (true)` / `WITH CHECK (true)` on an
-- ALL-command policy, anonymous callers holding only the publishable anon key
-- can SELECT, INSERT, UPDATE and DELETE those tables.
--
-- WHY THIS IS WORSE THAN A LOOSE READ: on six of these tables a correctly
-- scoped policy ALREADY EXISTS and is silently defeated, because RLS policies
-- are OR-ed. Dropping the broad policy does not invent an access model — it
-- restores the one that was already written and intended:
--
--   storytellers               "Public read for consenting storytellers"
--                                USING (consent_given AND privacy_preferences
--                                       ->>'public_display' = 'true')
--                              -- consent gate, currently bypassed
--   review_projects            "Public can view published review projects"
--                                USING (is_published = true)
--   alert_events               "Users see own alert events"
--                                USING (auth.uid() = user_id)
--   funder_portfolios          "funder_portfolios_user_policy"
--                                USING (auth.uid() = user_id)
--   funder_portfolio_entities  "funder_portfolio_entities_user_policy"
--                                USING (portfolio_id IN (own portfolios))
--   review_curated_entries /   "Public read access ..." SELECT USING (true)
--   review_year_settings /
--   review_media_links /
--   review_videos /
--   campaign_content /
--   campaign_outreach
--
-- `storytellers` is the sharpest case: 226 rows carrying date_of_birth,
-- phone_number, contact_email, cultural_background, transcript, and an explicit
-- consent_given / privacy_preferences / narrative_ownership_level consent model.
-- The ALL policy makes every one of those readable and writable by anon,
-- consent flag ignored.
--
-- This file drops all 13, plus 4 further anon-write policies of the same shape
-- that are not FOR ALL: portraits "Allow all updates"/"Allow all deletes" and
-- project_knowledge "pk_insert_all"/"pk_update_all". 17 statements in total.
--
-- ONE EXCEPTION IS PRESERVED: JusticeHub app/judges-on-country/page.tsx is a
-- 'use client' component using the anon-key browser client and calling
-- .from('campaign_outreach').insert(...) at line 473. That INSERT is a real
-- public submit path, so this migration replaces the ALL policy with an
-- explicit anon INSERT policy rather than removing write access outright.
--
-- SCOPE NOTE: legitimate anon-INSERT submit paths are left completely alone —
-- harvest_businesses, harvest_events, discrimination_reports, story_comments,
-- story_reactions, story_attribution_events, event_feedback, page_views,
-- pulse_events, messages, signal_content, signal_events, alma_research_*.
-- Those are public forms and telemetry; anon INSERT is the design.
--
-- APPLY WITH (NOT APPLIED — this file is a deliverable):
--   cd /Users/benknight/Code/grantscope && source .env && PGPASSWORD="$DATABASE_PASSWORD" \
--     psql -h aws-0-ap-southeast-2.pooler.supabase.com -p 5432 \
--     -U postgres.tednluwflfhxyucgwigh -d postgres \
--     -f migrations/2026-08-14-fix-misdeclared-service-role-policies.sql
--
-- VERIFY AFTER APPLY:
--   SELECT tablename, policyname, cmd FROM pg_policies
--   WHERE schemaname='public' AND cmd='ALL'
--     AND roles::text[] && ARRAY['anon','public']
--     AND coalesce(qual,'true')='true' AND coalesce(with_check,'true')='true';
--   -- expect 0 rows
-- =============================================================================

BEGIN;

-- --- consent-bearing storyteller records: restore the consent gate ----------
DROP POLICY IF EXISTS "Service role has full access to storytellers" ON public.storytellers;

-- --- published/ownership gates that were being bypassed ---------------------
DROP POLICY IF EXISTS "Service role full access review_projects" ON public.review_projects;
DROP POLICY IF EXISTS "Service manages alert events" ON public.alert_events;
DROP POLICY IF EXISTS "funder_portfolios_service" ON public.funder_portfolios;
DROP POLICY IF EXISTS "funder_portfolio_entities_service" ON public.funder_portfolio_entities;

-- --- ALL -> keep the existing public SELECT, remove anon write -------------
DROP POLICY IF EXISTS "Service role full access review_media_links" ON public.review_media_links;
DROP POLICY IF EXISTS "Service role full access review_videos" ON public.review_videos;
DROP POLICY IF EXISTS "Authenticated write access for curated entries" ON public.review_curated_entries;
DROP POLICY IF EXISTS "Authenticated write access for year settings" ON public.review_year_settings;
DROP POLICY IF EXISTS "Admin write campaign_content" ON public.campaign_content;

-- --- ACT strategy tables: no separate SELECT policy exists, so these become
--- service-role-only. Neither is referenced by any app code (verified by
--- from('<table>') walk over both src trees: zero hits).
DROP POLICY IF EXISTS "Allow all access for service role" ON public.strategic_objectives;
DROP POLICY IF EXISTS "Allow all access for service role" ON public.project_strategic_profile;

-- --- portraits: keep public read, drop anon mutate --------------------------
DROP POLICY IF EXISTS "Allow all updates" ON public.portraits;
DROP POLICY IF EXISTS "Allow all deletes" ON public.portraits;

-- --- project_knowledge: anon could INSERT and UPDATE meeting transcripts ----
DROP POLICY IF EXISTS "pk_insert_all" ON public.project_knowledge;
DROP POLICY IF EXISTS "pk_update_all" ON public.project_knowledge;

-- --- campaign_outreach: preserve the public submit path, remove the rest ----
DROP POLICY IF EXISTS "Admin write campaign_outreach" ON public.campaign_outreach;
CREATE POLICY "anon_submit_campaign_outreach"
  ON public.campaign_outreach FOR INSERT TO anon, authenticated WITH CHECK (true);

COMMIT;

-- =============================================================================
-- HOLD — reviewed and left alone
--
--  portraits "Allow all inserts"  — CONTAINED lets visitors create a portrait.
--      Removing it breaks the public flow. Left in place; note that 21 rows and
--      an anon INSERT path with no rate limit is a spam surface, not a leak.
--  alert_notifications "Service can insert notifications" (INSERT {public})
--  ti_usage_log "Service can insert usage" (INSERT {public})
--      Both misdeclared the same way but INSERT-only into append-only logs.
--      Low blast radius; fix in the same pass as the next policy audit.
--  alma_research_findings / _sessions / _tool_logs (INSERT {public})
--      Named "Authenticated create ...". Same defect, research-log tables.
-- =============================================================================

-- =============================================================================
-- ROLLBACK
-- =============================================================================
-- BEGIN;
-- CREATE POLICY "Service role has full access to storytellers" ON public.storytellers FOR ALL USING (true) WITH CHECK (true);
-- CREATE POLICY "Service role full access review_projects" ON public.review_projects FOR ALL USING (true);
-- CREATE POLICY "Service manages alert events" ON public.alert_events FOR ALL USING (true) WITH CHECK (true);
-- CREATE POLICY "funder_portfolios_service" ON public.funder_portfolios FOR ALL USING (true) WITH CHECK (true);
-- CREATE POLICY "funder_portfolio_entities_service" ON public.funder_portfolio_entities FOR ALL USING (true) WITH CHECK (true);
-- CREATE POLICY "Service role full access review_media_links" ON public.review_media_links FOR ALL USING (true);
-- CREATE POLICY "Service role full access review_videos" ON public.review_videos FOR ALL USING (true);
-- CREATE POLICY "Authenticated write access for curated entries" ON public.review_curated_entries FOR ALL USING (true) WITH CHECK (true);
-- CREATE POLICY "Authenticated write access for year settings" ON public.review_year_settings FOR ALL USING (true) WITH CHECK (true);
-- CREATE POLICY "Admin write campaign_content" ON public.campaign_content FOR ALL USING (true);
-- CREATE POLICY "Allow all access for service role" ON public.strategic_objectives FOR ALL USING (true);
-- CREATE POLICY "Allow all access for service role" ON public.project_strategic_profile FOR ALL USING (true);
-- CREATE POLICY "Allow all updates" ON public.portraits FOR UPDATE USING (true);
-- CREATE POLICY "Allow all deletes" ON public.portraits FOR DELETE USING (true);
-- CREATE POLICY "pk_insert_all" ON public.project_knowledge FOR INSERT WITH CHECK (true);
-- CREATE POLICY "pk_update_all" ON public.project_knowledge FOR UPDATE USING (true);
-- DROP POLICY IF EXISTS "anon_submit_campaign_outreach" ON public.campaign_outreach;
-- CREATE POLICY "Admin write campaign_outreach" ON public.campaign_outreach FOR ALL USING (true);
-- COMMIT;
