-- Assign owners to 33 of the 51 objects the 2026-09-26 register pass left as unknown, by the repo whose
-- migration created them (grantscope and its clones grantscope-atlas/-sinks/-scraping; act-global-infrastructure
-- and agi-jev-tagger are act; JusticeHub; The Harvest Website). Ben chose this rule 2026-09-26. The other 18
-- have no creating migration anywhere and stay unknown.
--
-- Apply: scripts/db-apply.sh supabase/migrations/20260926110000_assign_unknown_owners.sql (Tier 3)

BEGIN;
UPDATE schema_ownership SET owner = 'grantscope', evidence = evidence || ' | owner: creating repo, Ben 2026-09-26' WHERE owner = 'unknown' AND object IN ('donor_entity_match_rejections', 'funder_entity_links', 'job_health', 'model_writes', 'v_justice_spending_summary', 'v_lga_place_profile', 'v_ndis_support_class_supply', 'v_nt_community_buyer_crosswalk', 'v_nt_community_entity_matches', 'v_nt_community_procurement_summary', 'v_person_roles_typed', 'v_relationship_health', 'v_youth_justice_cost_comparison');
UPDATE schema_ownership SET owner = 'act', evidence = evidence || ' | owner: creating repo, Ben 2026-09-26' WHERE owner = 'unknown' AND object IN ('v_monthly_revenue', 'v_newsletter_audience', 'v_newsletter_reprompt_candidates', 'v_pending_receipts', 'v_pending_subscriptions_review', 'v_project_actions', 'v_project_decisions', 'v_project_lifetime_position', 'v_project_questions', 'v_receipt_pipeline_funnel', 'v_recent_agent_errors', 'v_recent_project_knowledge', 'v_team_capacity', 'v_voice_notes_cultural_review', 'v_voice_notes_with_actions');
UPDATE schema_ownership SET owner = 'justicehub', evidence = evidence || ' | owner: creating repo, Ben 2026-09-26' WHERE owner = 'unknown' AND object IN ('jr_site_support_request_events', 'v_org_grant_health', 'v_org_upcoming_deadlines', 'v_state_ecosystem_summary');
UPDATE schema_ownership SET owner = 'harvest', evidence = evidence || ' | owner: creating repo, Ben 2026-09-26' WHERE owner = 'unknown' AND object IN ('witta_contributions');
COMMIT;
