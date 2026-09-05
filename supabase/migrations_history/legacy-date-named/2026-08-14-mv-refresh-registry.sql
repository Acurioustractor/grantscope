-- =============================================================================
-- 2026-08-14-mv-refresh-registry.sql
--
-- Single authoritative registry for materialized-view refresh.
--
-- APPLY WITH (NOT APPLIED — this file is a deliverable):
--   cd /Users/benknight/Code/grantscope && source .env && PGPASSWORD="$DATABASE_PASSWORD" \
--     psql -h aws-0-ap-southeast-2.pooler.supabase.com -p 5432 \
--     -U postgres.tednluwflfhxyucgwigh -d postgres \
--     -f migrations/2026-08-14-mv-refresh-registry.sql
--
-- Then (separately, Tier 3 — changes a live cron job):
--   -- see migrations/2026-08-14-mv-refresh-cron.sql
--
-- -----------------------------------------------------------------------------
-- WHY
--
-- Before this migration the refresh schedule lived in SIX hardcoded lists that
-- had drifted apart:
--   1. refresh_civicgraph_mvs()                        27 names  (pg_cron job 4)
--   2. scripts/refresh-views-v2.mjs VIEW_LIST          43 names
--   3. scripts/refresh-views.mjs (v1)                  ~52 names (dead script)
--   4. scripts/sql/setup-pg-cron-mv-refresh.sql        23 names (stale snapshot)
--   5. scripts/refresh-youth-justice-report-cache.mjs  15 names (mv_yj_report_*)
--   6. scripts/refresh-total-funding-mv.mjs             1 name
-- plus three separate hardcoded NEEDS_NON_CONCURRENT / HEAVY arrays.
--
-- 98 materialized views exist. 55 were on no schedule at all. Re-syncing two
-- copies would have recreated the drift within a month, so instead:
--
--   * the MEMBERSHIP + TIER live in one table          -> mv_refresh_registry
--   * the ORDER is DERIVED from pg_depend at runtime   -> mv_refresh_plan()
--   * CONCURRENTLY is DERIVED from pg_index at runtime -> mv_refresh_plan()
--   * drift is surfaced, not silent                    -> v_mv_refresh_drift
--
-- Nothing about ordering or concurrency is hand-maintained any more. A new
-- matview needs one INSERT here and slots into the correct position by itself;
-- if someone forgets the INSERT, v_mv_refresh_drift shows it the next day.
--
-- Verified 2026-08-14 against project tednluwflfhxyucgwigh:
--   98 matviews · 19 read other matviews · max dependency depth 4 · NO cycles
--   nightly tier = 50 matviews, max depth 2, ~15.6 min of measured median time
-- =============================================================================

BEGIN;

-- -----------------------------------------------------------------------------
-- 1. The registry. Membership and cadence only — never order, never concurrency.
-- -----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS mv_refresh_registry (
  mv_name              text PRIMARY KEY,
  tier                 text NOT NULL
                         CHECK (tier IN ('nightly', 'weekly', 'on_demand', 'retire')),
  enabled              boolean NOT NULL DEFAULT true,
  -- Escape hatch only. The plan derives CONCURRENTLY from pg_index; set this
  -- true when a matview HAS a unique index but concurrent refresh still misbehaves.
  force_non_concurrent boolean NOT NULL DEFAULT false,
  -- 'broken_upstream' = refreshes successfully but produces wrong/no rows.
  health               text CHECK (health IS NULL OR health IN ('broken_upstream', 'slow_unmeasured')),
  notes                text,
  updated_at           timestamptz NOT NULL DEFAULT now()
);

COMMENT ON TABLE mv_refresh_registry IS
  'Single source of truth for which materialized views get refreshed and how often. '
  'Refresh ORDER is derived from pg_depend by mv_refresh_plan() — do not add an order column. '
  'Both pg_cron (refresh_civicgraph_mvs) and scripts/refresh-views-v2.mjs read this table.';

COMMENT ON COLUMN mv_refresh_registry.tier IS
  'nightly = daily-cadence source data behind live app surfaces. '
  'weekly = slow-changing reference/scoring data, or cost not yet measured. '
  'on_demand = refreshed by a named owner (another cron job, an RPC, or a pipeline script). '
  'retire = no reader in app code, DB functions, DB views, or other matviews; not refreshed.';

-- -----------------------------------------------------------------------------
-- 2. Matview -> matview dependency edges, chased through plain views.
--    A matview that reads a plain view that reads a matview still has a real
--    ordering constraint; edges built only from direct m->m links miss those.
-- -----------------------------------------------------------------------------
CREATE OR REPLACE VIEW v_mv_dependency_edges AS
WITH RECURSIVE raw AS (
  SELECT DISTINCT
         dep.oid     AS dependent,
         dep.relkind AS dep_kind,
         src.oid     AS source,
         src.relkind AS src_kind
  FROM pg_depend d
  JOIN pg_rewrite r  ON r.oid   = d.objid  AND d.classid    = 'pg_rewrite'::regclass
  JOIN pg_class  dep ON dep.oid = r.ev_class
  JOIN pg_class  src ON src.oid = d.refobjid AND d.refclassid = 'pg_class'::regclass
  JOIN pg_namespace nd ON nd.oid = dep.relnamespace
  JOIN pg_namespace ns ON ns.oid = src.relnamespace
  WHERE dep.oid <> src.oid
    AND nd.nspname = 'public'
    AND ns.nspname = 'public'
    AND dep.relkind IN ('m', 'v')
    AND src.relkind IN ('m', 'v')
),
reach (root, cur, cur_kind, hops) AS (
  SELECT r.dependent, r.source, r.src_kind, 1
  FROM raw r
  WHERE r.dep_kind = 'm'
  UNION
  SELECT rc.root, r2.source, r2.src_kind, rc.hops + 1
  FROM reach rc
  JOIN raw r2 ON r2.dependent = rc.cur
  WHERE rc.cur_kind = 'v'      -- only keep chasing through plain views
    AND rc.hops < 16           -- guard against a view cycle
)
SELECT DISTINCT
       root::regclass::text AS mv_name,
       cur::regclass::text  AS depends_on
FROM reach
WHERE cur_kind = 'm'
  AND root <> cur;

COMMENT ON VIEW v_mv_dependency_edges IS
  'Materialized-view -> materialized-view dependency edges derived from pg_depend/pg_rewrite, '
  'chased transitively through plain views. Consumed by mv_refresh_plan().';

-- -----------------------------------------------------------------------------
-- 3. The plan: dependency-ordered, concurrency-resolved, for one tier.
--    Longest-path depth so a matview always follows every base it reads.
-- -----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION mv_refresh_plan(p_tier text DEFAULT 'nightly')
RETURNS TABLE (seq int, mv_name text, depth int, use_concurrent boolean)
LANGUAGE sql
STABLE
SET search_path TO 'public', 'pg_catalog'
AS $$
WITH RECURSIVE members AS (
  -- registry rows for this tier that still exist as a populated matview
  SELECT r.mv_name, r.force_non_concurrent
  FROM mv_refresh_registry r
  JOIN pg_class c      ON c.relname = r.mv_name AND c.relkind = 'm'
  JOIN pg_namespace n  ON n.oid = c.relnamespace AND n.nspname = 'public'
  WHERE r.tier = p_tier
    AND r.enabled
),
edges AS (
  SELECT e.mv_name, e.depends_on
  FROM v_mv_dependency_edges e
  JOIN members m1 ON m1.mv_name = e.mv_name
  JOIN members m2 ON m2.mv_name = e.depends_on
),
depth (mv_name, d) AS (
  SELECT m.mv_name, 0
  FROM members m
  WHERE NOT EXISTS (SELECT 1 FROM edges e WHERE e.mv_name = m.mv_name)
  UNION ALL
  SELECT e.mv_name, dp.d + 1
  FROM depth dp
  JOIN edges e ON e.depends_on = dp.mv_name
  WHERE dp.d < 32              -- cycle guard; there are none today
),
ranked AS (
  SELECT m.mv_name,
         COALESCE(MAX(dp.d), 0) AS depth,
         -- CONCURRENTLY is only legal with a unique index. Derive it; never hardcode.
         (EXISTS (
            SELECT 1
            FROM pg_index i
            JOIN pg_class c ON c.oid = i.indrelid
            JOIN pg_namespace n ON n.oid = c.relnamespace AND n.nspname = 'public'
            WHERE c.relname = m.mv_name AND i.indisunique
              -- CORRECTED 2026-08-14 (adversarial review, B8): REFRESH ... CONCURRENTLY
              -- also requires the unique index to be non-partial and expression-free.
              -- mv_foundation_landscape_geo has a unique EXPRESSION index today.
              AND i.indpred IS NULL AND i.indexprs IS NULL
          ) AND NOT m.force_non_concurrent) AS use_concurrent
  FROM members m
  LEFT JOIN depth dp ON dp.mv_name = m.mv_name
  GROUP BY m.mv_name, m.force_non_concurrent
)
SELECT (ROW_NUMBER() OVER (ORDER BY depth, mv_name))::int AS seq,
       mv_name, depth, use_concurrent
FROM ranked
ORDER BY depth, mv_name;
$$;

COMMENT ON FUNCTION mv_refresh_plan(text) IS
  'Dependency-ordered refresh plan for one tier. Order comes from pg_depend, '
  'CONCURRENTLY eligibility from pg_index. Read by refresh_civicgraph_mvs() and '
  'by scripts/refresh-views-v2.mjs so both use exactly the same list.';

-- -----------------------------------------------------------------------------
-- 4. The drift guard. This is what stops the registries diverging again:
--    an unregistered matview is visible the next morning instead of invisible
--    for months.
-- -----------------------------------------------------------------------------
CREATE OR REPLACE VIEW v_mv_refresh_drift AS
WITH cat AS (
  SELECT c.relname AS mv_name,
         pg_total_relation_size(c.oid) AS bytes,
         EXISTS (SELECT 1 FROM pg_index i WHERE i.indrelid = c.oid AND i.indisunique
                        AND i.indpred IS NULL AND i.indexprs IS NULL) AS has_unique_idx
  FROM pg_class c
  JOIN pg_namespace n ON n.oid = c.relnamespace
  WHERE n.nspname = 'public' AND c.relkind = 'm'
),
last_run AS (
  SELECT DISTINCT ON (l.mv_name) l.mv_name, l.started_at, l.status
  FROM mv_refresh_log l
  ORDER BY l.mv_name, l.started_at DESC
)
SELECT COALESCE(cat.mv_name, r.mv_name)  AS mv_name,
       CASE
         WHEN r.mv_name IS NULL  THEN 'UNREGISTERED'   -- exists, nobody scheduled it
         WHEN cat.mv_name IS NULL THEN 'ORPHAN_ROW'    -- registry points at a dropped matview
         ELSE 'ok'
       END                                AS drift,
       r.tier, r.enabled, r.health,
       cat.bytes, cat.has_unique_idx,
       last_run.started_at                AS last_refresh_at,
       last_run.status                    AS last_refresh_status,
       (now() - last_run.started_at)      AS staleness
FROM cat
FULL OUTER JOIN mv_refresh_registry r ON r.mv_name = cat.mv_name
LEFT JOIN last_run ON last_run.mv_name = COALESCE(cat.mv_name, r.mv_name)
ORDER BY (CASE WHEN r.mv_name IS NULL OR cat.mv_name IS NULL THEN 0 ELSE 1 END),
         last_run.started_at NULLS FIRST;

COMMENT ON VIEW v_mv_refresh_drift IS
  'Every matview in the catalog joined to the refresh registry and its last run. '
  'drift = UNREGISTERED means a matview exists that nobody scheduled — check this after '
  'any migration that creates a matview.';

-- -----------------------------------------------------------------------------
-- 5. mv_refresh_log: make it real. The previous cron function used now(), which
--    in PL/pgSQL is transaction_timestamp() and therefore CONSTANT for the whole
--    run — every cron-written row has started_at = finished_at and duration_ms = 0.
--    Verified on the 2026-08-13 17:00 run: all 27 rows stamped 17:00:00.10131,
--    all durations 0. The rewrite below uses clock_timestamp().
-- -----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS mv_refresh_log (
  id            BIGSERIAL PRIMARY KEY,
  mv_name       TEXT NOT NULL,
  started_at    TIMESTAMPTZ NOT NULL DEFAULT now(),
  finished_at   TIMESTAMPTZ,
  duration_ms   INTEGER,
  status        TEXT NOT NULL,
  used_concurrent BOOLEAN,
  error_message TEXT,
  triggered_by  TEXT DEFAULT 'pg_cron'
);
CREATE INDEX IF NOT EXISTS mv_refresh_log_started
  ON mv_refresh_log (mv_name, started_at DESC);

-- -----------------------------------------------------------------------------
-- 6. Seed: all 98 matviews, tiered. Verified 2026-08-14.
--    Tier evidence per object: read by app code (apps/web/src + JusticeHub/src),
--    by a DB function body (pg_proc.prosrc), by a DB view (pg_get_viewdef), or
--    consumed by another matview that is itself read.
-- -----------------------------------------------------------------------------
INSERT INTO mv_refresh_registry (mv_name, tier, health, notes) VALUES
  ('mv_acnc_ais_yearly', 'nightly', NULL, 'read by 1 db function(s)'),
  ('mv_acnc_latest', 'nightly', NULL, 'read by 4 db function(s); 3 db view(s)'),
  ('mv_award_history_by_theme', 'nightly', NULL, 'read by 1 db function(s)'),
  ('mv_award_winner_by_theme', 'nightly', NULL, 'read by 1 db function(s)'),
  ('mv_board_interlocks', 'nightly', NULL, 'read by 9 app file(s); 1 db view(s)'),
  ('mv_charity_network', 'nightly', NULL, 'read by feeds mv_charity_rankings'),
  ('mv_charity_rankings', 'nightly', NULL, 'read by 2 app file(s)'),
  ('mv_disability_landscape', 'nightly', NULL, 'read by 5 app file(s)'),
  ('mv_donation_contract_timing', 'nightly', NULL, 'read by 2 app file(s); 1 db function(s); feeds mv_temporal_summary'),
  ('mv_donor_contract_crossref', 'nightly', NULL, 'read by 2 app file(s); feeds mv_crossref_quality'),
  ('mv_entity_power_index', 'nightly', NULL, 'read by 28 app file(s); 1 db function(s); 1 db view(s); feeds mv_board_interlocks, mv_disability_landscape, mv_funding_deserts'),
  ('mv_foundation_grantees', 'nightly', NULL, 'read by 5 app file(s); 3 db function(s); 2 db view(s); feeds mv_evidence_backed_funding, mv_foundation_need_alignment, mv_foundation_readiness, mv_foundation_regranting, mv_foundation_scores, mv_lga_place_profile, mv_trustee_grantee_chain'),
  ('mv_foundation_regranting', 'nightly', NULL, 'read by 3 app file(s)'),
  ('mv_foundation_trends', 'nightly', NULL, 'read by 2 app file(s)'),
  ('mv_funding_by_disadvantage', 'nightly', 'broken_upstream', '1 row - acnc_ais has ONE stray ais_year=2025 row; the MV filters ais_year = max(ais_year) so it aggregates that single row. Real latest year is 2023 (53,207 rows).'),
  ('mv_funding_by_lga', 'nightly', NULL, 'read by 5 app file(s); feeds mv_funding_deserts'),
  ('mv_funding_by_postcode', 'nightly', NULL, 'read by 11 app file(s); 1 db function(s)'),
  ('mv_funding_deserts', 'nightly', NULL, 'read by 17 app file(s); feeds mv_disability_landscape, mv_foundation_need_alignment'),
  ('mv_funding_outcomes_summary', 'nightly', NULL, 'read by 1 app file(s)'),
  ('mv_grant_contract_overlap', 'nightly', NULL, 'read by 1 app file(s)'),
  ('mv_gs_donor_contractors', 'nightly', NULL, 'read by 9 app file(s)'),
  ('mv_gs_entity_stats', 'nightly', NULL, 'read by 6 app file(s)'),
  ('mv_indigenous_funding_by_disadvantage', 'nightly', 'broken_upstream', '0 rows - same acnc_ais max(ais_year)=2025 stray-row bug, plus ben_aboriginal_tsi filter.'),
  ('mv_indigenous_procurement_score', 'nightly', NULL, 'read by 1 app file(s)'),
  ('mv_indigenous_proven_suppliers', 'nightly', NULL, 'read by 2 app file(s)'),
  ('mv_individual_donors', 'nightly', NULL, 'read by feeds mv_person_cross_system'),
  ('mv_justice_charity_financial_health', 'nightly', NULL, 'read by 1 app file(s)'),
  ('mv_justice_proven_suppliers', 'nightly', NULL, 'read by 2 app file(s)'),
  ('mv_lga_indigenous_proxy_score', 'nightly', NULL, 'read by 1 app file(s)'),
  ('mv_lga_place_profile', 'nightly', NULL, 'read by 3 app file(s)'),
  ('mv_org_justice_signals', 'nightly', NULL, 'read by 2 app file(s); 1 db function(s)'),
  ('mv_person_cross_system', 'nightly', NULL, 'read by 3 app file(s)'),
  ('mv_person_entity_network', 'nightly', NULL, 'read by 4 app file(s); 2 db view(s); feeds mv_person_identity_network, mv_person_influence'),
  ('mv_person_identity_influence', 'nightly', NULL, 'read by 3 app file(s)'),
  ('mv_person_identity_influence_v2', 'nightly', NULL, 'read by 1 app file(s)'),
  ('mv_person_identity_network', 'nightly', NULL, 'read by 2 app file(s); 1 db function(s); feeds mv_person_identity_influence, mv_person_identity_influence_v2'),
  ('mv_person_influence', 'nightly', NULL, 'read by 9 app file(s)'),
  ('mv_person_network', 'nightly', NULL, 'read by 3 app file(s); feeds mv_donor_person_crosslink'),
  ('mv_revolving_door', 'nightly', NULL, 'read by 19 app file(s); 1 db function(s); 1 db view(s)'),
  ('mv_triple_proof_suppliers', 'nightly', NULL, 'read by 1 app file(s); 1 db view(s)'),
  ('v_ato_largest_entities', 'nightly', NULL, 'read by 1 app file(s)'),
  ('v_austender_entity_summary', 'nightly', NULL, 'read by 1 app file(s)'),
  ('v_austender_procurement_by_type', 'nightly', NULL, 'read by 1 app file(s)'),
  ('v_austender_stats', 'nightly', NULL, 'read by 1 app file(s)'),
  ('v_austender_supplier_tax', 'nightly', NULL, 'read by 1 app file(s)'),
  ('v_austender_top_charities', 'nightly', NULL, 'read by 1 app file(s)'),
  ('v_austender_top_oric', 'nightly', NULL, 'read by 1 app file(s)'),
  ('v_grant_focus_areas', 'nightly', NULL, 'read by 1 app file(s)'),
  ('v_grant_provider_summary', 'nightly', NULL, 'read by 1 app file(s)'),
  ('v_grant_stats', 'nightly', NULL, 'read by 1 app file(s)'),
  ('mv_abr_name_lookup', 'weekly', NULL, '1.3GB / 9.0M rows / 124s median but ZERO app, function, view or matview readers; ABR reference data changes monthly at most'),
  ('mv_board_power', 'weekly', NULL, 'app-read (/api/data/board-power) but EXPLAIN cost 20.2M over ~25.8M est rows and never measured; board data is slow-changing'),
  ('mv_crossref_quality', 'weekly', NULL, 'data-quality dashboard; weekly is the right reporting cadence'),
  ('mv_data_quality', 'weekly', NULL, 'data-quality dashboard; weekly is the right reporting cadence'),
  ('mv_donor_person_crosslink', 'weekly', NULL, 'derived from mv_person_network; slow-changing'),
  ('mv_evidence_backed_funding', 'weekly', NULL, 'base of mv_foundation_scores; annual-cadence evidence data'),
  ('mv_foundation_need_alignment', 'weekly', NULL, 'base of mv_foundation_scores; annual-cadence'),
  ('mv_foundation_readiness', 'weekly', NULL, 'derived from mv_foundation_scores; same cadence'),
  ('mv_foundation_scores', 'weekly', NULL, '3 of its 4 bases are annual-cadence; weekly is MORE correct than today (bases currently never refresh)'),
  ('mv_multi_board_persons', 'weekly', NULL, '1 row; board data slow-changing'),
  ('mv_person_entity_crosswalk', 'weekly', NULL, 'EXPLAIN cost 39.8M (nested-loop) and never measured; feeds the weekly foundation-scores chain'),
  ('mv_sa2_map_data', 'weekly', NULL, 'geography reference; effectively static'),
  ('mv_temporal_summary', 'weekly', NULL, 'derived from mv_donation_contract_timing; summary only'),
  ('mv_trustee_grantee_chain', 'weekly', NULL, 'foundation/trustee data is annual-cadence; part of the foundation-scores chain'),
  ('mv_trustee_grantee_overlaps', 'weekly', NULL, 'trustee data annual-cadence'),
  ('act_grant_recommendations', 'on_demand', NULL, 'ACT-scoped; 13 app refs; confirm owner before scheduling'),
  ('alma_daily_sentiment', 'on_demand', NULL, 'owned by refresh_sentiment_analytics()'),
  ('alma_dashboard_interventions', 'on_demand', NULL, 'owned by refresh_alma_dashboards()'),
  ('alma_dashboard_queue', 'on_demand', NULL, 'owned by refresh_alma_dashboards()'),
  ('alma_sentiment_program_correlation', 'on_demand', NULL, 'owned by refresh_sentiment_analytics()'),
  ('mv_closing_the_gap_state_summary', 'on_demand', NULL, 'owned by pg_cron job 10 (refresh_closing_the_gap_state_summary)'),
  ('mv_entity_total_funding', 'on_demand', NULL, 'owned by scripts/refresh-total-funding-mv.mjs'),
  ('mv_intervention_funding_chain', 'on_demand', NULL, 'read only via v_chain_summary; ALMA-cadence, refresh with ALMA loads'),
  ('mv_project_quarter_position', 'on_demand', NULL, 'owned by refresh_mv_project_quarter_position(); also D14/ACT - leaves this DB'),
  ('mv_yj_report_acco_gap', 'on_demand', NULL, 'owned by scripts/refresh-youth-justice-report-cache.mjs (npm run report:youth-justice:cache)'),
  ('mv_yj_report_alma_interventions', 'on_demand', NULL, 'owned by scripts/refresh-youth-justice-report-cache.mjs (npm run report:youth-justice:cache)'),
  ('mv_yj_report_alma_type_counts', 'on_demand', NULL, 'owned by scripts/refresh-youth-justice-report-cache.mjs (npm run report:youth-justice:cache)'),
  ('mv_yj_report_contracts', 'on_demand', NULL, 'owned by scripts/refresh-youth-justice-report-cache.mjs (npm run report:youth-justice:cache)'),
  ('mv_yj_report_coverage', 'on_demand', NULL, 'owned by scripts/refresh-youth-justice-report-cache.mjs (npm run report:youth-justice:cache)'),
  ('mv_yj_report_dss_payments', 'on_demand', NULL, 'owned by scripts/refresh-youth-justice-report-cache.mjs (npm run report:youth-justice:cache)'),
  ('mv_yj_report_foundations', 'on_demand', NULL, 'owned by scripts/refresh-youth-justice-report-cache.mjs (npm run report:youth-justice:cache)'),
  ('mv_yj_report_heatmap', 'on_demand', NULL, 'owned by scripts/refresh-youth-justice-report-cache.mjs (npm run report:youth-justice:cache)'),
  ('mv_yj_report_ndis_overlay', 'on_demand', NULL, 'owned by scripts/refresh-youth-justice-report-cache.mjs (npm run report:youth-justice:cache)'),
  ('mv_yj_report_recipients', 'on_demand', NULL, 'owned by scripts/refresh-youth-justice-report-cache.mjs (npm run report:youth-justice:cache)'),
  ('mv_yj_report_remoteness', 'on_demand', NULL, 'owned by scripts/refresh-youth-justice-report-cache.mjs (npm run report:youth-justice:cache)'),
  ('mv_yj_report_state_program_partners', 'on_demand', NULL, 'owned by scripts/refresh-youth-justice-report-cache.mjs (npm run report:youth-justice:cache)'),
  ('mv_yj_report_state_programs', 'on_demand', NULL, 'owned by scripts/refresh-youth-justice-report-cache.mjs (npm run report:youth-justice:cache)'),
  ('mv_yj_report_state_top_orgs', 'on_demand', NULL, 'owned by scripts/refresh-youth-justice-report-cache.mjs (npm run report:youth-justice:cache)'),
  ('mv_yj_report_unfunded_programs', 'on_demand', NULL, 'owned by scripts/refresh-youth-justice-report-cache.mjs (npm run report:youth-justice:cache)'),
  ('mv_api_usage_daily', 'retire', NULL, '0 rows; no code, function, view or matview reader'),
  ('mv_board_contractor_links', 'retire', NULL, '4 rows; no reader of any kind'),
  ('mv_board_donor_links', 'retire', NULL, '2 rows; no reader of any kind'),
  ('mv_foundation_landscape_access', 'retire', NULL, '6 rows; no reader of any kind'),
  ('mv_foundation_landscape_category', 'retire', NULL, '16 rows; no reader of any kind'),
  ('mv_foundation_landscape_geo', 'retire', NULL, '23 rows; no reader of any kind'),
  ('mv_foundation_landscape_top_foundations', 'retire', NULL, '10,129 rows; no reader of any kind'),
  ('mv_fy_donation_contracts', 'retire', NULL, '50,685 rows / 10MB; no reader of any kind'),
  ('mv_youth_justice_entities', 'retire', NULL, '5,469 rows; no reader of any kind (superseded by the mv_yj_report_* family)')
ON CONFLICT (mv_name) DO UPDATE
  SET tier = EXCLUDED.tier,
      health = EXCLUDED.health,
      notes = EXCLUDED.notes,
      updated_at = now();

COMMIT;

-- -----------------------------------------------------------------------------
-- POST-APPLY VERIFICATION (run these; they are read-only)
-- -----------------------------------------------------------------------------
-- Registry covers every matview, nothing unregistered:
--   SELECT drift, count(*) FROM v_mv_refresh_drift GROUP BY 1;
--     expect: ok | 98
--
-- The nightly plan is dependency-ordered (50 rows, depth 0..2):
--   SELECT * FROM mv_refresh_plan('nightly');
--
-- No matview is scheduled fresher than something it reads:
--   SELECT e.mv_name, a.tier AS mv_tier, e.depends_on, b.tier AS base_tier
--   FROM v_mv_dependency_edges e
--   JOIN mv_refresh_registry a ON a.mv_name = e.mv_name
--   JOIN mv_refresh_registry b ON b.mv_name = e.depends_on
--   WHERE array_position(ARRAY['nightly','weekly','on_demand','retire'], a.tier)
--       < array_position(ARRAY['nightly','weekly','on_demand','retire'], b.tier);
--     expect: 0 rows
--
-- No dependency cycles (plan row count must equal enabled member count):
--   SELECT (SELECT count(*) FROM mv_refresh_plan('nightly')) AS planned,
--          (SELECT count(*) FROM mv_refresh_registry WHERE tier='nightly' AND enabled) AS members;
--     expect: equal
-- =============================================================================
