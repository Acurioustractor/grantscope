-- =====================================================================================
-- CivicGraph Clarity — gap metric registry seed (part 3)
--
-- NOT APPLIED. Apply with psql, AFTER 20260815000000 and 20260815000100:
--
--   cd /Users/benknight/Code/grantscope && source .env && \
--   PGPASSWORD="$DATABASE_PASSWORD" psql -h aws-0-ap-southeast-2.pooler.supabase.com \
--     -p 5432 -U "postgres.tednluwflfhxyucgwigh" -d postgres \
--     -f supabase/migrations/20260815000200_clarity_gap_metrics_seed.sql
--
-- Every numerator_sql / denominator_sql below was EXECUTED against
-- tednluwflfhxyucgwigh on 2026-08-14 and its result is recorded in the `note`.
-- Metrics whose SQL reads clarity_object carry a day-one baseline computed from
-- the same measurements by an offline scan; they are marked BASELINE in the note.
-- =====================================================================================

BEGIN;

INSERT INTO clarity_gap_metric
  (metric_key, title, family, question, numerator_sql, denominator_sql, unit, direction, target, cost_class, note)
VALUES

-- ---------------------------------------------------------------- 1. coverage
('described_objects',
 'Objects with a written purpose',
 'coverage',
 'How much of what we hold has anyone said what it is for?',
 $q$SELECT count(*) FROM clarity_object WHERE purpose IS NOT NULL AND btrim(purpose) <> '' AND missing_since IS NULL$q$,
 $q$SELECT count(*) FROM clarity_object WHERE missing_since IS NULL$q$,
 'pct','higher_better',95,'cheap',
 '2026-08-14: 812 of 1,433 = 56.7%. The 2026-08-14 inventory shards describe 714 tables + 98 matviews and ZERO of the 212 views and ZERO of the 409 functions.'),

('governed_objects',
 'Objects with a governance row (owner, licence, PII level)',
 'coverage',
 'Which of these can I publish, and who do I ask?',
 $q$SELECT count(*) FROM clarity_object o JOIN data_catalog dc ON dc.table_name = o.object_name$q$,
 $q$SELECT count(*) FROM clarity_object WHERE missing_since IS NULL$q$,
 'pct','higher_better',60,'cheap',
 '2026-08-14: data_catalog holds 25 rows. 25 / 1,433 = 1.7%. It already has the right 21 columns (licence, public_export, pii_level, source_url, sla_hours) at 1.7% fill. Widen it, do not build a second one.'),

-- ---------------------------------------------------------------- 2. freshness
('freshness_knowable',
 'Objects whose last write can be established at all',
 'freshness',
 'For how much of this can I answer "when was this last updated"?',
 $q$SELECT count(*) FROM clarity_object WHERE object_kind <> 'function' AND last_write_at IS NOT NULL$q$,
 $q$SELECT count(*) FROM clarity_object WHERE object_kind <> 'function' AND missing_since IS NULL$q$,
 'pct','higher_better',85,'cheap',
 'BASELINE 2026-08-14: 608 of 812 tables+matviews carry a resolvable last-write (74.9%). 632 of 714 tables have a candidate timestamp column; only 1 of 98 matviews does, so matview freshness comes from mv_refresh_log (44 of 98) or nowhere.'),

('stale_core_sources',
 'Core source datasets not written in 30 days',
 'freshness',
 'Which of our evidence bases has quietly stopped updating?',
 $q$SELECT count(*) FROM clarity_object
     WHERE lifecycle = 'core_source' AND state = 'live'
       AND last_write_at IS NOT NULL AND last_write_at < now() - interval '30 days'$q$,
 NULL,'count','lower_better',0,'cheap',
 'BASELINE 2026-08-14: 141 of 608 objects with a known last-write are older than 180 days.'),

-- ---------------------------------------------------------------- 3. schedule
('matviews_unscheduled',
 'Materialized views in no refresh registry',
 'schedule',
 'How much of the derived layer is running on a hand crank?',
 $q$WITH cron_list AS (
      SELECT unnest(regexp_split_to_array(
               regexp_replace(coalesce(p.prosrc,''), '[^a-z0-9_]+', ' ', 'g'), '\s+')) AS nm
      FROM pg_proc p JOIN pg_namespace n ON n.oid = p.pronamespace
      WHERE n.nspname='public' AND p.proname = 'refresh_civicgraph_mvs')
    SELECT count(*) FROM pg_class c JOIN pg_namespace n ON n.oid = c.relnamespace
     WHERE n.nspname='public' AND c.relkind='m'
       AND c.relname NOT IN (SELECT nm FROM cron_list)$q$,
 $q$SELECT count(*) FROM pg_class c JOIN pg_namespace n ON n.oid=c.relnamespace
     WHERE n.nspname='public' AND c.relkind='m'$q$,
 'pct','lower_better',0,'cheap',
 '2026-08-14: 71 of 98 matviews (2,871,838 rows) are absent from refresh_civicgraph_mvs(), the only scheduled path (pg_cron jobid 4, 0 17 * * *). The function hardcodes 27 names; scripts/refresh-views-v2.mjs hardcodes 43. The mjs list is a strict SUPERSET of the function list, so reconciliation is additive: 55 matviews (1,374,264 rows) are in NEITHER.'),

-- SUCCESSOR to matviews_unscheduled. A parallel work stream is shipping
-- migrations/2026-08-14-mv-refresh-registry.sql, which replaces the hardcoded array
-- in refresh_civicgraph_mvs() with a read of mv_refresh_plan() over a new
-- mv_refresh_registry table. When that lands, matviews_unscheduled above returns a
-- FALSE 98/98 because the function body no longer contains any matview names.
-- Disable that metric and enable this one at the same time. Until then this row
-- records status='error' (relation does not exist), which is the correct signal.
-- (enabled=false on purpose: its table does not exist yet)
('matviews_unregistered',
 'Materialized views absent from mv_refresh_registry',
 'schedule',
 'How much of the derived layer is running on a hand crank? (registry era)',
 $q$SELECT count(*) FROM pg_class c JOIN pg_namespace n ON n.oid=c.relnamespace
     WHERE n.nspname='public' AND c.relkind='m'
       AND NOT EXISTS (SELECT 1 FROM mv_refresh_registry r
                        WHERE r.mv_name = c.relname AND r.enabled AND r.tier <> 'retire')$q$,
 $q$SELECT count(*) FROM pg_class c JOIN pg_namespace n ON n.oid=c.relnamespace
     WHERE n.nspname='public' AND c.relkind='m'$q$,
 'pct','lower_better',0,'cheap',
 'Depends on migrations/2026-08-14-mv-refresh-registry.sql, which is NOT applied as of 2026-08-14. Enable this and disable matviews_unscheduled in the same change.'),

('matviews_stale',
 'Materialized views whose last successful refresh is over 48h old',
 'schedule',
 'Is the director-links pillar current right now?',
 $q$SELECT count(*) FROM pg_class c JOIN pg_namespace n ON n.oid=c.relnamespace
     WHERE n.nspname='public' AND c.relkind='m'
       AND coalesce((SELECT max(l.started_at) FROM mv_refresh_log l
                      WHERE l.mv_name=c.relname AND l.status LIKE 'success%'),
                    '-infinity'::timestamptz) < now() - interval '48 hours'$q$,
 $q$SELECT count(*) FROM pg_class c JOIN pg_namespace n ON n.oid=c.relnamespace
     WHERE n.nspname='public' AND c.relkind='m'$q$,
 'pct','lower_better',10,'cheap',
 '2026-08-14, measured with this exact SQL: 70 of 98 = 71.4%. 54 matviews have never appeared in mv_refresh_log at all; 16 more last succeeded 2026-08-09, the day someone ran scripts/refresh-views-v2.mjs by hand. 28 are current (24 clean successes + 4 CONCURRENTLY fallbacks). The whole director-links pillar - mv_person_entity_network, mv_person_entity_crosswalk, mv_person_identity_influence_v2 - is in the never-logged set.'),

('matview_concurrent_fallback',
 'Matviews that fall back from REFRESH CONCURRENTLY',
 'schedule',
 'Which refreshes take a full table lock every night?',
 $q$SELECT count(DISTINCT mv_name) FROM mv_refresh_log
     WHERE started_at > now() - interval '3 days' AND status = 'success-fallback'$q$,
 NULL,'count','lower_better',0,'cheap',
 '2026-08-14: 4 (mv_abr_name_lookup, mv_grant_contract_overlap, mv_indigenous_procurement_score, mv_lga_indigenous_proxy_score). Each lacks a unique index, so CONCURRENTLY fails and the nightly job holds an ACCESS EXCLUSIVE lock instead.'),

-- ---------------------------------------------------------------- 4. usage
('dark_rows',
 'Rows in populated objects that nothing reads',
 'usage',
 'How much of this database is nobody looking at?',
 $q$SELECT coalesce(sum(row_count),0) FROM clarity_object
     WHERE object_kind IN ('table','matview') AND coalesce(row_count,0) > 0
       AND refs_app = 0 AND refs_script = 0 AND refs_db_function = 0 AND lineage_in = 0$q$,
 $q$SELECT coalesce(sum(row_count),0) FROM clarity_object
     WHERE object_kind IN ('table','matview') AND coalesce(row_count,0) > 0$q$,
 'pct','lower_better',5,'cheap',
 'BASELINE 2026-08-14: 184 populated objects / 5,087,126 rows = 9.7% of 52,349,579. This CORRECTS the "290 objects / 14,894,611 rows" figure, which counted only application code and never read the 386,420 characters of pg_proc.prosrc (202 relations referenced there), the 219 triggers, or the 695 view-lineage edges (220 relations).'),

('views_unreferenced',
 'Regular views with no query-shaped reference anywhere',
 'usage',
 'How many of the 212 anon-readable view endpoints does anyone actually call?',
 $q$SELECT count(*) FROM clarity_object WHERE object_kind='view'
       AND refs_app=0 AND refs_script=0 AND refs_db_function=0 AND lineage_in=0$q$,
 $q$SELECT count(*) FROM clarity_object WHERE object_kind='view'$q$,
 'pct','lower_better',30,'cheap',
 'BASELINE 2026-08-14: 132 of 212 = 62.3%. 60 are referenced from app source, 78 from anything.'),

-- ---------------------------------------------------------------- 5. join integrity
('justice_edge_drillthrough',
 'Justice graph edges that resolve to a funding record',
 'join_integrity',
 'Can I click an edge on the graph and see the actual grant?',
 $q$WITH s AS (SELECT source_record_id FROM gs_relationships WHERE source_record_id IS NOT NULL LIMIT 50000)
    SELECT count(*) FROM s
     WHERE source_record_id ~ '^[0-9a-f]{8}-'
       AND EXISTS (SELECT 1 FROM justice_funding j WHERE j.id = s.source_record_id::uuid)$q$,
 $q$WITH s AS (SELECT source_record_id FROM gs_relationships WHERE source_record_id IS NOT NULL LIMIT 50000)
    SELECT count(*) FROM s WHERE source_record_id ~ '^[0-9a-f]{8}-'$q$,
 'pct','higher_better',80,'medium',
 '2026-08-14, re-measured independently: 0 of 49,426. gs_relationships.source_record_id is a DEAD KEY NAMESPACE - it is uuid-shaped but matches neither justice_funding.id nor source_statement_id. Drill-through is 0%, not 18%. No "click an edge to see the grant" feature is buildable until the key is rebuilt.'),

('bridge_columns_populated',
 'Declared bridge columns that actually carry values',
 'join_integrity',
 'Which of our advertised joins are 0% full?',
 $q$SELECT (SELECT count(*) FROM nz_charities WHERE gs_entity_id IS NOT NULL)
         + (SELECT count(*) FROM ndis_participants_lga WHERE lga_code IS NOT NULL)$q$,
 $q$SELECT (SELECT count(*) FROM nz_charities) + (SELECT count(*) FROM ndis_participants_lga)$q$,
 'pct','higher_better',50,'cheap',
 '2026-08-14: 0 of 53,521. nz_charities 0 of 45,192 linked; ndis_participants_lga 0 of 8,329 with an LGA code. Both columns exist, are documented, and have never been written.'),

-- ---------------------------------------------------------------- 6. attribution
('abn_attribution_money',
 'Money rows whose payee resolves to an entity in the spine',
 'attribution',
 'What share of the dollars can we actually attribute to a real organisation?',
 $q$SELECT (SELECT count(*) FROM austender_contracts a
            WHERE EXISTS (SELECT 1 FROM gs_entities g WHERE g.abn = regexp_replace(a.supplier_abn,'[^0-9]','','g')))
         + (SELECT count(*) FROM grantconnect_awards w
            WHERE EXISTS (SELECT 1 FROM gs_entities g WHERE g.abn = regexp_replace(w.recipient_abn,'[^0-9]','','g')))
         + (SELECT count(*) FROM justice_funding j
            WHERE EXISTS (SELECT 1 FROM gs_entities g WHERE g.abn = regexp_replace(j.recipient_abn,'[^0-9]','','g')))$q$,
 $q$SELECT (SELECT count(*) FROM austender_contracts)
         + (SELECT count(*) FROM grantconnect_awards)
         + (SELECT count(*) FROM justice_funding)$q$,
 'pct','higher_better',95,'expensive',
 '2026-08-14: 1,125,402 of 1,272,000 = 88.5%. Per table: austender 765,431/823,620 = 92.9%; justice_funding 149,207/157,116 = 95.0%; grantconnect_awards 210,764/291,264 = 72.4% (68,172 rows carry a well-formed ABN that is not in gs_entities). political_donations is measured separately at 639,430/2,549,483 = 25.1% and is excluded here because it would swamp the ratio.'),

('abn_attribution_donations',
 'Political donation rows whose donor resolves to the spine',
 'attribution',
 'Can we say who gave the money?',
 $q$SELECT count(*) FROM political_donations p
     WHERE EXISTS (SELECT 1 FROM gs_entities g WHERE g.abn = regexp_replace(p.donor_abn,'[^0-9]','','g'))$q$,
 $q$SELECT count(*) FROM political_donations$q$,
 'pct','higher_better',60,'expensive',
 '2026-08-14: 639,430 of 2,549,483 = 25.1%. 653,261 rows carry any donor_abn at all (25.6%), so the loss is at collection, not at matching. This is the weakest attribution of the four money tables by a factor of three.'),

-- ---------------------------------------------------------------- 7. place
('entities_placed',
 'Entities with a resolved local government area',
 'place',
 'How much of the registry can we put on a map?',
 $q$SELECT count(*) FROM gs_entities WHERE lga_code IS NOT NULL$q$,
 $q$SELECT count(*) FROM gs_entities$q$,
 'pct','higher_better',70,'medium',
 '2026-08-14: 294,214 of 609,448 = 48.3%. 282,182 entities (46.3%) hold no postcode at all, so they are structurally unplaceable, not merely unresolved.'),

('postcodes_placeable',
 'Funding postcodes that exist in the geography reference',
 'place',
 'Are we attributing money to places we cannot locate?',
 $q$SELECT count(*) FROM (SELECT DISTINCT postcode FROM mv_funding_by_postcode) m
     WHERE EXISTS (SELECT 1 FROM postcode_geo g WHERE g.postcode = m.postcode)$q$,
 $q$SELECT count(*) FROM (SELECT DISTINCT postcode FROM mv_funding_by_postcode) m$q$,
 'pct','higher_better',95,'cheap',
 '2026-08-14: 2,790 of 6,684 = 41.7%. 3,894 postcodes carrying funding have no row in postcode_geo, which holds only 2,909 distinct postcodes against Australia''s ~2,600 real ones plus LVR/PO ranges. The reference table is smaller than the fact table it is supposed to place.'),

-- ---------------------------------------------------------------- 8. evidence
('interventions_with_evidence',
 'ALMA interventions with at least one linked piece of evidence',
 'evidence',
 'When we say something works, can we show why?',
 $q$SELECT count(DISTINCT intervention_id) FROM alma_intervention_evidence$q$,
 $q$SELECT count(*) FROM alma_interventions$q$,
 'pct','higher_better',80,'cheap',
 '2026-08-14: 1,277 of 2,136 = 59.8%. Outcomes are thinner: 1,005 of 2,136 = 47.0%. Evidence and outcomes attach only through junction tables (alma_intervention_evidence / alma_intervention_outcomes); there is no direct intervention_id on alma_evidence or alma_outcomes.'),

-- ---------------------------------------------------------------- 9. exposure
('anon_readable_relations',
 'Relations readable with the public anon key',
 'exposure',
 'What can anyone with the browser key read?',
 $q$SELECT count(*) FROM pg_class c JOIN pg_namespace n ON n.oid=c.relnamespace
     WHERE n.nspname='public' AND c.relkind IN ('r','m','v')
       AND has_table_privilege('anon', c.oid, 'SELECT')
       AND (NOT c.relrowsecurity
            OR EXISTS (SELECT 1 FROM pg_policy p WHERE p.polrelid=c.oid AND p.polpermissive
                        AND p.polcmd IN ('r','*')
                        AND coalesce(pg_get_expr(p.polqual,p.polrelid),'true')='true'
                        AND (p.polroles='{0}'::oid[]
                             OR EXISTS (SELECT 1 FROM unnest(p.polroles) rr WHERE pg_get_userbyid(rr)='anon'))))$q$,
 $q$SELECT count(*) FROM pg_class c JOIN pg_namespace n ON n.oid=c.relnamespace
     WHERE n.nspname='public' AND c.relkind IN ('r','m','v')$q$,
 'pct','lower_better',30,'cheap',
 '2026-08-14: 451 of 1,024 = 44.0% (232 tables, 13 matviews, 206 of the 212 views). 99 of those views run with DEFINER rights (security_invoker is not set), so base-table RLS does not apply to them at all. 215 tables sit at RLS-on-with-zero-policies, which is unreachable rather than protected - a different diagnosis with a different fix.'),

('act_business_exposed',
 'ACT private-business objects readable by anon',
 'exposure',
 'Is the private bookkeeping reachable from the public key?',
 $q$SELECT count(*) FROM clarity_object o
     WHERE o.act_business AND o.anon_readable AND o.object_kind <> 'function'$q$,
 $q$SELECT count(*) FROM clarity_object WHERE act_business AND object_kind <> 'function'$q$,
 'pct','lower_better',0,'cheap',
 'BASELINE 2026-08-14: 47 of 238 = 19.7%, including canonical_entities, entity_identifiers, founder_intakes and founder_intake_messages. 213 of the 238 carry an anon SELECT GRANT; RLS stops all but 47. Ben''s decision 1 (move this cluster to its own Supabase) is the fix; until then the flag drives the default filter.'),

('anon_executable_definers',
 'SECURITY DEFINER functions the anon key can execute',
 'exposure',
 'Can a browser trigger an RLS-bypassing routine?',
 $q$SELECT count(*) FROM pg_proc p JOIN pg_namespace n ON n.oid=p.pronamespace
     WHERE n.nspname='public' AND p.prosecdef AND has_function_privilege('anon', p.oid, 'EXECUTE')$q$,
 NULL,'count','lower_better',0,'cheap',
 '2026-08-14: 3 - rebuild_funder_board_paths(), rebuild_funder_intelligence(), rebuild_place_funding_snapshot(). All three rebuild data and all three are callable with the public key. Separately, 340 of 410 functions are anon-EXECUTE-able; 64 are SECURITY DEFINER.'),

-- ---------------------------------------------------------------- 10. definitions
('conflicting_metric_definitions',
 'Concepts with more than one live definition',
 'definition',
 'Why is this number different on the other page?',
 $q$SELECT count(*) FROM (
      SELECT concept FROM clarity_metric_definition GROUP BY concept HAVING count(*) > 1
    ) x$q$,
 NULL,'count','lower_better',0,'cheap',
 '2026-08-14: 1 known and live. "justice funding, cleaned" has two definitions: view justice_funding_clean (sector IS DISTINCT FROM ''procurement'') = 151,866 rows, and OPPORTUNITY-MAP''s mandatory measure_kind = ''grant'' = 126,673 rows / $46.097bn. The gap is 25,193 rows. Naively summing all measure_kinds gives $120.6bn because 848 expenditure_aggregate rows carry $66.126bn - 55% of the dollars in 0.5% of the rows.'),

-- ---------------------------------------------------------------- 11. countability
('countable_objects',
 'Objects whose size can be established',
 'countability',
 'Do we even know how big this is?',
 $q$SELECT count(*) FROM clarity_object
     WHERE object_kind <> 'function' AND row_count IS NOT NULL AND row_count_probe = 'ok'$q$,
 $q$SELECT count(*) FROM clarity_object WHERE object_kind <> 'function' AND missing_since IS NULL$q$,
 'pct','higher_better',97,'cheap',
 'BASELINE 2026-08-14: 1,006 of 1,024 = 98.2%. 806 tables/matviews exact-counted in 92.7s (zero timeouts at a 10s cap); 6 use reltuples; 194 of 212 views counted in 122s at a 3s cap; 18 views cannot be counted in 3s and are recorded as timeout, not as zero.'),

('estimated_row_counts',
 'Objects whose size is an estimate rather than a count',
 'countability',
 'Which numbers on this page are approximate?',
 $q$SELECT count(*) FROM clarity_object WHERE row_count_is_estimate$q$,
 NULL,'count','lower_better',10,'cheap',
 '2026-08-14: 6 (abr_registry, mv_abr_name_lookup, gs_relationships, political_donations, asic_companies, asic_name_lookup). Worst measured reltuples error among them is 0.26%. pg_stat_user_tables.n_live_tup, by contrast, reports 0 for political_donations (2,549,483 real) and 144 for qld_watchhouse_snapshot_rows (8,488 real) - never use it.')

ON CONFLICT (metric_key) DO UPDATE SET
  title = EXCLUDED.title, question = EXCLUDED.question,
  numerator_sql = EXCLUDED.numerator_sql, denominator_sql = EXCLUDED.denominator_sql,
  unit = EXCLUDED.unit, direction = EXCLUDED.direction, target = EXCLUDED.target,
  cost_class = EXCLUDED.cost_class, note = EXCLUDED.note;

-- Its table does not exist yet. Off until migrations/2026-08-14-mv-refresh-registry.sql lands.
UPDATE clarity_gap_metric SET enabled = false WHERE metric_key = 'matviews_unregistered';

-- ---------------------------------------------------------------- the live conflict
INSERT INTO clarity_metric_definition
  (definition_key, concept, expression, source_object, row_count, measured_at, is_canonical, used_by, rationale)
VALUES
 ('justice_clean_view', 'justice funding, cleaned',
  'sector IS DISTINCT FROM ''procurement''', 'justice_funding_clean', 151866, now(), false,
  ARRAY['view justice_funding_clean'],
  'Excludes only the 5,250 rows tagged sector=procurement. Leaves 29,519 contract_value rows and 848 expenditure_aggregate rows in the total, so any sum over this view mixes grants with budget aggregates.'),
 ('justice_grant_only', 'justice funding, cleaned',
  'measure_kind = ''grant''', 'justice_funding', 126673, now(), true,
  ARRAY['OPPORTUNITY-MAP.md', 'report-service.ts'],
  'The only measure_kind that is money actually awarded to a named recipient. $46.097bn. Canonical because it is the only filter under which the total does not double-count budget announcements against the grants inside them.')
ON CONFLICT (definition_key) DO UPDATE SET
  row_count = EXCLUDED.row_count, measured_at = EXCLUDED.measured_at,
  is_canonical = EXCLUDED.is_canonical, rationale = EXCLUDED.rationale;

-- ---------------------------------------------------------------- Ben's decision 1
--
-- HANDOVER NOTE. A parallel work stream is shipping
-- migrations/2026-08-14-catalog-object-scope.sql, which creates
-- public.catalog_object_scope (object_name, scope IN
-- ('civic','act_private','act_private_review','platform'), reason, decided_by).
-- That taxonomy is BETTER than this boolean: it separates "extract now" from
-- "entangled with civic objects, resolve first", and it refuses to hide anything
-- unclassified. When it lands, replace the seed below and section G of
-- clarity_refresh() with a single derivation:
--
--   UPDATE clarity_object o SET
--     act_business = (s.scope IN ('act_private','act_private_review')),
--     act_business_source = 'canonical_d14'
--   FROM catalog_object_scope s WHERE s.object_name = o.object_name;
--
-- Keep the name rule as the fallback for objects created after that table was
-- populated, so a new xero_* table cannot appear on a civic surface by default.
-- The ACT private-business cluster (CANONICAL-DATA-MAP.md domain D14) leaves this
-- database and is rebuilt in its own Supabase. Until that move happens the cluster is
-- FLAGGED, with provenance, so /clarity hides it by default and nothing civic joins it.
--
-- 221 names below, extracted mechanically from CANONICAL-DATA-MAP.md (109 dedicated
-- table rows + a 112-name bulk tier line). clarity_refresh() adds a further 17 by name
-- rule, for 238 total against the canonical map's own stated count of 237.
--
-- REVIEW BEFORE THE PHYSICAL MOVE: 13 objects match the name rule but are NOT in the
-- canonical D14 list and are arguable civic/ACT boundary cases -
--   act_communities, act_community_links, act_grant_recommendations,
--   act_opportunity_observatory, ce_metrics, ce_users, email_financial_documents,
--   goods_communities, goods_procurement_entities, goods_procurement_signals,
--   goods_supply_routes, knowledge_extraction_queue, knowledge_links
-- Set act_business_source = 'manual' on any of these that Ben rules civic; the refresh
-- function will then leave them alone.
UPDATE clarity_object SET act_business = true, act_business_source = 'canonical_d14'
 WHERE act_business_source IS DISTINCT FROM 'manual'
   AND object_name IN (
 'act_ask_artefacts', 'act_ask_none_owed', 'act_ask_warmers', 'act_entities',
  'act_grant_recommendation_decisions', 'act_grant_recommendation_projects', 'act_obligations',
  'act_opportunity_benchmark_cases', 'act_payable_decisions', 'act_people', 'act_person_roles',
  'act_research_experiments', 'act_research_initiatives', 'app_config', 'bank_statement_lines',
  'bgfit_budget_items', 'bgfit_deadlines', 'bgfit_financial_periods', 'bgfit_grants',
  'bgfit_suppliers', 'bgfit_transactions', 'bookkeeping_rules', 'bookkeeping_sync_state',
  'business_alerts', 'calendar_events', 'campaign_content', 'campaign_nomination_upvotes',
  'campaign_nominations', 'campaign_tracked_posts', 'canonical_entities', 'cashflow_scenarios',
  'civicscope_act_entity_bridge', 'cms_pages', 'collections_actions',
  'communication_project_links', 'communication_user_actions', 'communications_history',
  'compliance_ack', 'compliance_tracking', 'contact_cadence_metrics', 'contact_enrichments',
  'contact_intelligence', 'contact_intelligence_insights', 'contact_intelligence_scores',
  'contact_project_links', 'contact_submissions', 'contact_support_recommendations',
  'contact_votes', 'daily_reflections', 'dext_supplier_setup_status',
  'discovered_subscriptions', 'dream_journal', 'ecosystem_projects', 'ecosystem_sites',
  'email_response_templates', 'enrollment_codes', 'entity_identifiers', 'entity_merge_log',
  'exa_api_usage', 'exa_company_intelligence', 'exa_linkedin_profiles',
  'finance_ai_routing_suggestions', 'finance_receipt_bank_line_links',
  'finance_receipt_documents', 'finance_receipt_ingestion_runs', 'financial_overview_cache',
  'financial_snapshots', 'financial_summary', 'founder_intake_messages',
  'founder_intake_signals', 'founder_intakes', 'fundraising_pipeline', 'ghl_contacts',
  'ghl_opportunities', 'ghl_pipelines', 'ghl_sync_log', 'ghl_tags', 'ghl_task_bridge',
  'gmail_auth_tokens', 'gmail_contacts', 'gmail_messages', 'gmail_sync_status', 'goal_updates',
  'goals_2026', 'goods_asset_lifecycle', 'goods_capital_blocks', 'goods_content_library',
  'goods_cost_allocation_decisions', 'goods_deployment_batches', 'goods_funding_matters',
  'goods_funding_routes', 'goods_governance_readiness', 'goods_products', 'goods_relationships',
  'goods_route_allocations', 'goods_tranches', 'harvest_businesses', 'harvest_events',
  'health_alerts', 'idea_ack', 'idea_board', 'idea_snoozes', 'ignored_email_patterns',
  'image_overrides', 'imessage_attachments', 'invoice_project_overrides', 'knowledge_chunks',
  'knowledge_edges', 'knowledge_source_sync', 'knowledge_sources', 'knowledge_versions',
  'linkedin_contacts', 'location_project_rules', 'member_actions', 'member_wall_entries',
  'memory_episodes', 'migration_email_templates', 'mv_project_quarter_position',
  'newsletter_candidates', 'newsletter_drafts', 'newsletter_subscriptions', 'notion_actions',
  'notion_calendar', 'notion_decisions', 'notion_grants', 'notion_meetings',
  'notion_opportunities', 'notion_organizations', 'notion_projects', 'notion_projects_cache',
  'opportunities_unified', 'org_pipeline', 'page_gallery', 'pending_subscriptions',
  'person_identity_map', 'pm2_cron_status', 'project_budgets', 'project_commentary',
  'project_contact_alignment', 'project_contact_matches', 'project_focus_areas',
  'project_funding_allocations', 'project_funding_drawdowns', 'project_funding_profiles',
  'project_health', 'project_health_analysis', 'project_health_history', 'project_intelligence',
  'project_intelligence_snapshots', 'project_knowledge', 'project_media_links',
  'project_monthly_financials', 'project_pairings', 'project_pipelines', 'project_profiles',
  'project_research', 'project_salary_allocations', 'project_storytellers',
  'project_strategic_profile', 'project_summaries', 'project_support_graph', 'projects',
  'pulse_events', 'pulse_report_links', 'pulse_reports', 'pulse_responses', 'ralph_prds',
  'ralph_tasks', 'receipt_emails', 'receipt_match_history', 'receipt_matches',
  'receipt_pipeline_status', 'receipt_status', 'relationship_health', 'relationship_pipeline',
  'reminders', 'repo_project_links', 'resource_allocations', 'revenue_scenarios',
  'revenue_stream_projections', 'revenue_streams', 'saved_foundations', 'saved_grants',
  'sector_map_cache', 'sessions', 'site_config', 'site_health_checks', 'sprint_items',
  'sprint_snapshots', 'sprint_suggestions', 'strategic_objectives', 'studio_projects',
  'subscription_discovery_events', 'subscription_history', 'subscription_patterns',
  'subscriptions', 'supporter_comms_summary', 'supporters_intelligence', 'team_members',
  'telegram_conversations', 'telegram_mutes', 'touchpoints', 'user_gamification_stats',
  'user_identities', 'vendor_contact_log', 'vendor_project_rules', 'voice_notes',
  'wiki_page_versions', 'wiki_pages', 'wiki_search_index', 'witta_contributions',
  'xero_bank_accounts', 'xero_bank_transactions', 'xero_bas_tracking', 'xero_contacts',
  'xero_invoices', 'xero_payments', 'xero_sync_log', 'xero_sync_status', 'xero_tokens',
  'xero_transactions'
);

COMMIT;
