-- =============================================================================
-- 2026-08-14-revoke-anon-private-reads.sql
--
-- STOPGAP. Closes anonymous READ access to objects that are not public civic
-- data: ACT private-business finance and CRM, personal knowledge/message
-- corpora, inbound form submissions with PII, and one contact backup table.
--
-- Derived from a full survey of every permissive policy in schema `public`
-- where cmd IN ('SELECT','ALL'), roles include `anon` or `public`, and
-- USING = true. That population is 240 policies. 227 of them are SELECT
-- (148 {anon,authenticated} + 72 {public} + 7 {anon}); 13 are ALL {public}.
-- Of the 240, 43 sit on objects the data map assigns to D14 (ACT private
-- business). This file drops 48 of the 240: 33 in Tier 1 (ACT private) and
-- 15 in Tier 2 (not ACT, not public-civic).
--
-- Everything NOT listed here was classified as legitimately public civic
-- data and is deliberately left alone: abr_registry, asic_*, acnc_*, alma_*,
-- aihw_*, austender_contracts, gs_entities, gs_relationships, justice_funding,
-- political_donations, ndis_*, foundation*, grantconnect_awards, seifa_2021,
-- postcode_geo, state_tenders, qld_watchhouse_*, rogs_*, crime_stats_lga,
-- oric_corporations, community_directory_orgs, social_enterprises, and the
-- rest of the reference-data tier. Those back public pages on both apps.
--
-- SAFETY BASIS FOR EACH DROP (method, not assertion):
--   1. Neither app reads the object through an anon-key client. Verified by
--      walking every .ts/.tsx in apps/web/src and JusticeHub/src, matching
--      `from('<table>')`, and testing whether the containing file imports an
--      anon-key client (`supabase-browser` in GrantScope; `@/lib/supabase/client`
--      or `client-lite` / NEXT_PUBLIC_SUPABASE_ANON_KEY in JusticeHub).
--      Only campaign_content and campaign_outreach came back positive, and
--      neither is in this file.
--   2. All server-side reads use the service role, which BYPASSES RLS, so
--      dropping a policy cannot affect them.
--   3. Objects with zero code references anywhere are dropped outright.
--
-- WHAT A DROP MEANS: RLS stays enabled. With no permissive SELECT policy the
-- table becomes service-role-only. That is the intended end state for all of
-- Tier 1 and Tier 2. It also removes `authenticated` reads where the policy
-- covered {anon,authenticated} — deliberate: an authenticated CivicGraph
-- customer is not entitled to ACT's payment records either.
--
-- ROLLBACK: each DROP is paired with the exact CREATE POLICY that restores it,
-- in the ROLLBACK block at the foot of this file.
--
-- APPLY WITH (NOT APPLIED — this file is a deliverable):
--   cd /Users/benknight/Code/grantscope && source .env && PGPASSWORD="$DATABASE_PASSWORD" \
--     psql -h aws-0-ap-southeast-2.pooler.supabase.com -p 5432 \
--     -U postgres.tednluwflfhxyucgwigh -d postgres \
--     -f migrations/2026-08-14-revoke-anon-private-reads.sql
--
-- VERIFY AFTER APPLY:
--   SELECT tablename, policyname, cmd, roles::text FROM pg_policies
--   WHERE schemaname='public' AND coalesce(qual,'')='true'
--     AND cmd IN ('SELECT','ALL') AND roles::text[] && ARRAY['anon','public']
--   ORDER BY tablename;
--   -- before: 240 rows.  after this file alone: 192 rows.
--   -- (the companion misdeclared-policy migration removes a further 13)
-- =============================================================================

BEGIN;

-- -----------------------------------------------------------------------------
-- TIER 1 — ACT private business: money, contacts, personal corpora.
-- Confirmed exposure. Zero anon-client reads. Highest priority.
-- -----------------------------------------------------------------------------

-- xero_payments — 1,536 payment records, $2,459,275 total, 2025-06-03..2026-07-17,
-- carries bank_account_name / bank_account_code / reference / raw_payload.
-- ACT's payment ledger. No `from('xero_payments')` anywhere in either app.
DROP POLICY IF EXISTS "Public read" ON public.xero_payments;

-- knowledge_chunks — 19,413 embedded chunks. CANONICAL-DATA-MAP records that
-- sampling found VERBATIM personal iMessage content. 19,367 of 19,413 rows have
-- org_profile_id NULL (ACT's own), 46 belong to one CivicGraph org profile.
-- Single server-side reference (service role). Backed by match_knowledge_chunks /
-- search_knowledge / hybrid_memory_search, all SECURITY-definer style RPCs.
DROP POLICY IF EXISTS "Anon read access on knowledge_chunks" ON public.knowledge_chunks;

-- CORRECTED 2026-08-14 (adversarial review, blocker B2). Dropping the policy above
-- alone closes NOTHING. knowledge_chunks carries a SECOND {public} SELECT policy,
-- `org_chunks_select`, whose predicate begins `org_profile_id IS NULL OR ...` —
-- and 19,367 of 19,413 rows (99.76%, measured) have a NULL org_profile_id. So the
-- verbatim personal iMessage content that is the headline motive for this whole
-- migration would have stayed readable with the public anon key.
-- Minimal fix: re-create the same predicate scoped to `authenticated` instead of
-- `public`. Anon stops matching; authenticated behaviour is byte-identical.
-- (That any authenticated user can still read org-less chunks is a separate,
-- lesser question — 24 accounts — and is deliberately NOT changed here.)
DROP POLICY IF EXISTS "org_chunks_select" ON public.knowledge_chunks;
CREATE POLICY "org_chunks_select" ON public.knowledge_chunks
  FOR SELECT TO authenticated
  USING (
    org_profile_id IS NULL
    OR org_profile_id IN (
      SELECT org_profiles.id FROM org_profiles
       WHERE org_profiles.user_id = (SELECT auth.uid())
      UNION
      SELECT org_members.org_profile_id FROM org_members
       WHERE org_members.user_id = (SELECT auth.uid())
    )
  );

-- project_knowledge — 995 rows of meeting transcripts, decisions, rationale,
-- action items, participant contact_ids, ai_summary, transcript.
DROP POLICY IF EXISTS "pk_read_all" ON public.project_knowledge;

-- linkedin_contacts — 13,810 LinkedIn connections: full_name, email_address,
-- current_company, location, connected_date, bio. Policy is misnamed
-- ("Allow authenticated read") but its role list is {public}, so anon reads it.
DROP POLICY IF EXISTS "Allow authenticated read" ON public.linkedin_contacts;

-- person_identity_map — 14,919 people: full_name, email, current_position,
-- indigenous_affiliation, government_influence, funding_capacity, engagement
-- priority. Same misnamed-policy pattern: roles = {public}.
DROP POLICY IF EXISTS "Allow authenticated read" ON public.person_identity_map;

-- canonical_entities — 15,324 CRM records with canonical_email, canonical_phone,
-- cultural_affiliation, community_connections, relationship_strength.
DROP POLICY IF EXISTS "Public read" ON public.canonical_entities;

-- entity_identifiers — 31,451 identifier rows. Verified composition (VERIFICATION
-- V33): linkedin_id 13,807 · linkedin_url 13,520 · ghl_id 2,012 · email 1,720 ·
-- xero_id 349 · phone 31. ZERO ABNs — this is a contact book, not the civic
-- identifier crosswalk (that is entity_xref, 1.2M rows, left public).
DROP POLICY IF EXISTS "Public read" ON public.entity_identifiers;

-- entity_merge_log / entity_potential_matches — CRM dedup queue. Probe confirmed
-- their entity ids resolve in canonical_entities and NOT in gs_entities.
DROP POLICY IF EXISTS "Public read" ON public.entity_merge_log;
DROP POLICY IF EXISTS "Public read" ON public.entity_potential_matches;

-- contact_intelligence_scores — per-person influence / accessibility / alignment
-- scoring keyed on person_identity_map.
DROP POLICY IF EXISTS "Users can view all scores" ON public.contact_intelligence_scores;

-- supporters_intelligence — 179 funders with total_paid_aud, outstanding_aud,
-- outstanding_age_days, primary_email, cc_email, framing_notes_excerpt.
-- This is ACT's receivables position by funder. Commercially sensitive.
DROP POLICY IF EXISTS "Public read" ON public.supporters_intelligence;

-- supporter_comms_summary — 1,101 rows: last_touch_subject and
-- last_touch_snippet per counterparty domain. Message content.
DROP POLICY IF EXISTS "Public read" ON public.supporter_comms_summary;

-- vendor_project_rules — 507 supplier rules with xero_account_code,
-- xero_tax_type, xero_tenant_id, rd_eligible.
DROP POLICY IF EXISTS "vendor_rules_read_all" ON public.vendor_project_rules;

-- finance_ai_routing_suggestions — 390 rows: vendor_name, amount, bank_account,
-- suggested_project_code, model prompts and token counts.
DROP POLICY IF EXISTS "Public read" ON public.finance_ai_routing_suggestions;

-- act_payable_decisions — 359 approve/decline decisions on ACT invoices,
-- with decided_by and notes.
DROP POLICY IF EXISTS "Public read" ON public.act_payable_decisions;

-- goods_relationships — 306 funder relationships with ask_amount_aud, ask_purpose,
-- warmth, warm_intro_path, total_received_aud, next_action. Live fundraising state.
DROP POLICY IF EXISTS "Public read" ON public.goods_relationships;

-- goods_tranches — 17 rows tying funder name to xero_invoice_number and amount_aud.
DROP POLICY IF EXISTS "Public read" ON public.goods_tranches;

-- goods_deployment_batches — funded_by_funder_id / funded_amount_aud /
-- funded_via_invoice per community deployment. Write-first (currently empty),
-- written from app/api/goods/community/[id]/deploy/route.ts.
DROP POLICY IF EXISTS "Public read" ON public.goods_deployment_batches;

-- project_pipelines — 63 rows of open/won/lost pipeline value per ACT project.
DROP POLICY IF EXISTS "Public read" ON public.project_pipelines;

-- civicscope_act_entity_bridge — 3,074 rows mapping ACT CRM records to
-- gs_entities. Discloses who ACT is tracking.
DROP POLICY IF EXISTS "Public read" ON public.civicscope_act_entity_bridge;

-- act_grant_recommendation_{decisions,projects} — ACT's internal pursue/pass
-- calls and per-project strategy (theme_keywords, next_question, act_context).
DROP POLICY IF EXISTS "Public read" ON public.act_grant_recommendation_decisions;
DROP POLICY IF EXISTS "Public read" ON public.act_grant_recommendation_projects;

-- newsletter_candidates / newsletter_drafts — unsent drafts, consent_warnings,
-- storyteller_ids, voice_grade_details. Pre-publication content.
DROP POLICY IF EXISTS "Public read" ON public.newsletter_candidates;
DROP POLICY IF EXISTS "Public read" ON public.newsletter_drafts;

-- knowledge_sources — currently 0 rows but write-first (knowledge_source_sync
-- writes it); carries source_url, verified_by, limitations, storage_path.
DROP POLICY IF EXISTS "Sources are viewable by everyone" ON public.knowledge_sources;

-- Low-volume ACT operational scaffolding. Nothing reads these from any client.
DROP POLICY IF EXISTS "Authenticated read access on ignored_email_patterns" ON public.ignored_email_patterns;
DROP POLICY IF EXISTS "Public read" ON public.telegram_mutes;
DROP POLICY IF EXISTS "Public read" ON public.idea_ack;
DROP POLICY IF EXISTS "Public read" ON public.idea_snoozes;
DROP POLICY IF EXISTS "Public read" ON public.compliance_ack;

-- founder_intake_* — the CivicGraph founder-intake wizard. NOT ACT private
-- business (it is a product feature) but the rows are user-submitted private
-- content: 23 messages, avg 1,306 chars for assistant turns, plus intake bodies
-- holding idea_summary, founder_motivation, draft_email. Read server-side only
-- (lib/services/intake-service.ts, app/api/start/[intakeId]/claim/route.ts).
DROP POLICY IF EXISTS "anon_read_messages" ON public.founder_intake_messages;
DROP POLICY IF EXISTS "anon_read_intakes" ON public.founder_intakes;
DROP POLICY IF EXISTS "anon_read_signals" ON public.founder_intake_signals;

-- -----------------------------------------------------------------------------
-- TIER 2 — not ACT, but not public civic either: inbound submissions with PII,
-- internal funder working notes, an audit log, and one backup table.
-- All server-only or zero-reference.
-- -----------------------------------------------------------------------------

-- 16,664 rows of website/email/phone/contact_source. Backup cruft from
-- 2026-06-06. Zero references in either app.
DROP POLICY IF EXISTS "Public read" ON public._backup_entity_contacts_20260606;

-- Inbound form submissions — names, emails, phone numbers, free-text.
DROP POLICY IF EXISTS "Public read" ON public.partnership_inquiries;
DROP POLICY IF EXISTS "Public read" ON public.exhibition_service_submissions;
DROP POLICY IF EXISTS "Public read" ON public.report_submissions;
DROP POLICY IF EXISTS "Public read" ON public.report_feedback;
DROP POLICY IF EXISTS "Public read" ON public.whats_new_subscribers;
-- HELD 2026-08-14 (adversarial review, blocker B3). These two drops are
-- DELIBERATELY DISABLED — they would take down a live public endpoint.
--
-- JusticeHub/src/app/api/organizations/[id]/route.ts is `dynamic = "force-dynamic"`,
-- has NO auth check, is not covered by middleware (matcher is /justice-matrix/* only),
-- builds its client from @/lib/supabase/server-lite = createServerClient(URL,
-- NEXT_PUBLIC_SUPABASE_ANON_KEY), and reads partner_goals + partner_contacts.
-- Verified: each table has RLS on, an anon SELECT grant, and EXACTLY ONE policy —
-- the one below. Dropping it leaves RLS on with zero policies, i.e. deny-all, and
-- the endpoint returns empty.
--
-- The original safety sweep missed this because its anon-client module list
-- included `client-lite` but not `server-lite`.
--
-- PREREQUISITE before enabling: switch that route to createServiceClient(), or
-- confirm the endpoint has no external consumers. Then uncomment.
-- DROP POLICY IF EXISTS "Public can view contacts" ON public.partner_contacts;
-- DROP POLICY IF EXISTS "Public can view goals" ON public.partner_goals;

-- discrimination_reports — 47 first-person accounts of discrimination. The
-- companion anon_insert_ policy (the public submit path) is left INTACT;
-- only the read is removed. This is the single clearest read/write asymmetry
-- in the survey: a public submission form should never be publicly readable.
DROP POLICY IF EXISTS "public_read_discrimination_reports" ON public.discrimination_reports;

-- youth_survey_results — survey responses from young people.
DROP POLICY IF EXISTS "Public read" ON public.youth_survey_results;

-- audit_events — the audit trail itself should not be anon-readable.
DROP POLICY IF EXISTS "Public read" ON public.audit_events;

-- Internal funder working notes and bid evaluations.
DROP POLICY IF EXISTS "Public read" ON public.funder_briefs;
DROP POLICY IF EXISTS "Public read" ON public.funder_nudge_log;
DROP POLICY IF EXISTS "Public read" ON public.qbe_evaluations;

-- kiosk_control_signals — remote-control channel for a physical kiosk display.
-- Read by JusticeHub admin routes (server side) only. Anon read of a control
-- plane is gratuitous.
DROP POLICY IF EXISTS "Public read" ON public.kiosk_control_signals;

COMMIT;

-- =============================================================================
-- HOLD LIST — deliberately NOT in the transaction above.
-- Each of these looked like a candidate and was rejected. Reasons recorded so
-- the next pass does not re-litigate them.
--
--  campaign_content, campaign_outreach
--      The ONLY two objects in the whole survey that a verified anon-key client
--      touches. JusticeHub app/judges-on-country/page.tsx is a 'use client'
--      component importing @/lib/supabase/client (browser, anon key) and calling
--      .from('campaign_outreach').insert(...) at line 473. Revoking here breaks
--      a live public page. Their WRITE half is still wrong — handled separately
--      in 2026-08-14-fix-misdeclared-service-role-policies.sql.
--
--  storytellers, portraits, messages, review_*, alert_events, funder_portfolios,
--  funder_portfolio_entities, strategic_objectives, project_strategic_profile
--      These carry ALL-command policies granting {public}, i.e. anon can also
--      INSERT/UPDATE/DELETE. Dropping the whole policy would remove reads that
--      public JusticeHub pages may depend on. Correct fix is to split ALL into
--      a SELECT-only policy — see the companion migration.
--
--  project_media_links (23 rows), pulse_events (284 rows)
--      Serve get_hero_image() / get_project_media() and CONTAINED portrait
--      analytics. Plausibly needed by a public page; not sensitive enough to
--      risk it. Revisit with a route-level trace, not a grep.
--
--  act_research_experiments, act_research_initiatives
--      Have anon-open policies but anon holds NO table-level SELECT grant, so
--      they are not actually exposed. No action needed; listed so the next
--      survey does not flag them as new.
--
--  sector_map_cache
--      Anon-readable, but its payload is aggregate civic data (entity_breakdown,
--      funding_total, top_funded_orgs) written by a JusticeHub cron for public
--      display. Legitimately public.
-- =============================================================================

-- =============================================================================
-- ROLLBACK — restores every policy dropped above, exactly as it was.
-- =============================================================================
-- BEGIN;
-- CREATE POLICY "Public read" ON public.xero_payments FOR SELECT TO anon, authenticated USING (true);
-- CREATE POLICY "Anon read access on knowledge_chunks" ON public.knowledge_chunks FOR SELECT USING (true);
-- CREATE POLICY "pk_read_all" ON public.project_knowledge FOR SELECT USING (true);
-- CREATE POLICY "Allow authenticated read" ON public.linkedin_contacts FOR SELECT USING (true);
-- CREATE POLICY "Allow authenticated read" ON public.person_identity_map FOR SELECT USING (true);
-- CREATE POLICY "Public read" ON public.canonical_entities FOR SELECT TO anon, authenticated USING (true);
-- CREATE POLICY "Public read" ON public.entity_identifiers FOR SELECT TO anon, authenticated USING (true);
-- CREATE POLICY "Public read" ON public.entity_merge_log FOR SELECT TO anon, authenticated USING (true);
-- CREATE POLICY "Public read" ON public.entity_potential_matches FOR SELECT TO anon, authenticated USING (true);
-- CREATE POLICY "Users can view all scores" ON public.contact_intelligence_scores FOR SELECT USING (true);
-- CREATE POLICY "Public read" ON public.supporters_intelligence FOR SELECT TO anon, authenticated USING (true);
-- CREATE POLICY "Public read" ON public.supporter_comms_summary FOR SELECT TO anon, authenticated USING (true);
-- CREATE POLICY "vendor_rules_read_all" ON public.vendor_project_rules FOR SELECT USING (true);
-- CREATE POLICY "Public read" ON public.finance_ai_routing_suggestions FOR SELECT TO anon, authenticated USING (true);
-- CREATE POLICY "Public read" ON public.act_payable_decisions FOR SELECT TO anon, authenticated USING (true);
-- CREATE POLICY "Public read" ON public.goods_relationships FOR SELECT TO anon, authenticated USING (true);
-- CREATE POLICY "Public read" ON public.goods_tranches FOR SELECT TO anon, authenticated USING (true);
-- CREATE POLICY "Public read" ON public.goods_deployment_batches FOR SELECT TO anon, authenticated USING (true);
-- CREATE POLICY "Public read" ON public.project_pipelines FOR SELECT TO anon, authenticated USING (true);
-- CREATE POLICY "Public read" ON public.civicscope_act_entity_bridge FOR SELECT TO anon, authenticated USING (true);
-- CREATE POLICY "Public read" ON public.act_grant_recommendation_decisions FOR SELECT TO anon, authenticated USING (true);
-- CREATE POLICY "Public read" ON public.act_grant_recommendation_projects FOR SELECT TO anon, authenticated USING (true);
-- CREATE POLICY "Public read" ON public.newsletter_candidates FOR SELECT TO anon, authenticated USING (true);
-- CREATE POLICY "Public read" ON public.newsletter_drafts FOR SELECT TO anon, authenticated USING (true);
-- CREATE POLICY "Sources are viewable by everyone" ON public.knowledge_sources FOR SELECT USING (true);
-- CREATE POLICY "Authenticated read access on ignored_email_patterns" ON public.ignored_email_patterns FOR SELECT USING (true);
-- CREATE POLICY "Public read" ON public.telegram_mutes FOR SELECT TO anon, authenticated USING (true);
-- CREATE POLICY "Public read" ON public.idea_ack FOR SELECT TO anon, authenticated USING (true);
-- CREATE POLICY "Public read" ON public.idea_snoozes FOR SELECT TO anon, authenticated USING (true);
-- CREATE POLICY "Public read" ON public.compliance_ack FOR SELECT TO anon, authenticated USING (true);
-- CREATE POLICY "anon_read_messages" ON public.founder_intake_messages FOR SELECT TO anon USING (true);
-- CREATE POLICY "anon_read_intakes" ON public.founder_intakes FOR SELECT TO anon USING (true);
-- CREATE POLICY "anon_read_signals" ON public.founder_intake_signals FOR SELECT TO anon USING (true);
-- CREATE POLICY "Public read" ON public._backup_entity_contacts_20260606 FOR SELECT TO anon, authenticated USING (true);
-- CREATE POLICY "Public read" ON public.partnership_inquiries FOR SELECT TO anon, authenticated USING (true);
-- CREATE POLICY "Public read" ON public.exhibition_service_submissions FOR SELECT TO anon, authenticated USING (true);
-- CREATE POLICY "Public read" ON public.report_submissions FOR SELECT TO anon, authenticated USING (true);
-- CREATE POLICY "Public read" ON public.report_feedback FOR SELECT TO anon, authenticated USING (true);
-- CREATE POLICY "Public read" ON public.whats_new_subscribers FOR SELECT TO anon, authenticated USING (true);
-- CREATE POLICY "Public can view contacts" ON public.partner_contacts FOR SELECT USING (true);
-- CREATE POLICY "Public can view goals" ON public.partner_goals FOR SELECT USING (true);
-- CREATE POLICY "public_read_discrimination_reports" ON public.discrimination_reports FOR SELECT TO anon USING (true);
-- CREATE POLICY "Public read" ON public.youth_survey_results FOR SELECT TO anon, authenticated USING (true);
-- CREATE POLICY "Public read" ON public.audit_events FOR SELECT TO anon, authenticated USING (true);
-- CREATE POLICY "Public read" ON public.funder_briefs FOR SELECT TO anon, authenticated USING (true);
-- CREATE POLICY "Public read" ON public.funder_nudge_log FOR SELECT TO anon, authenticated USING (true);
-- CREATE POLICY "Public read" ON public.qbe_evaluations FOR SELECT TO anon, authenticated USING (true);
-- CREATE POLICY "Public read" ON public.kiosk_control_signals FOR SELECT TO anon, authenticated USING (true);
-- COMMIT;
