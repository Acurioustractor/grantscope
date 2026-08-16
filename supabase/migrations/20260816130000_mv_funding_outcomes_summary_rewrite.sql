-- mv_funding_outcomes_summary: fix the fan-out AND apply the money filters
-- (fix #3 from the money-views audit)
--
-- Apply:
--   source .env && PGPASSWORD="$DATABASE_PASSWORD" psql -h aws-0-ap-southeast-2.pooler.supabase.com \
--     -p 5432 -U "postgres.tednluwflfhxyucgwigh" -d postgres \
--     -f supabase/migrations/20260816130000_mv_funding_outcomes_summary_rewrite.sql
--
-- TWO DEFECTS, ONE WORSE THAN THE OTHER.
--
-- 1. THE FAN-OUT. The old definition joined justice_funding × outcome_submissions ×
--    alma_interventions in one pass. Counts used count(DISTINCT ...) and were safe; sum() cannot
--    be de-duplicated that way, so every funding row was counted (submissions × interventions)
--    times. Measured: Queensland Department of Youth Justice at $258.50bn on one row; the whole
--    view summed $377.00bn — more than 3x the entire table's honest content. The rewrite
--    pre-aggregates each lane in its own CTE and joins the aggregates, which is the same shape
--    the cross-project service used for the identical bug (Goods at $1.02bn vs $4m).
--
-- 2. THE FILTERS. justice_funding was read raw. The standard three are now applied, so entities
--    whose only "funding" was a whole-of-state budget row or a spreadsheet total leave the view.
--
-- Column names and types match the old definition exactly (verified against pg_attribute).
-- No dependents (pg_depend). Indexes and ACL (service_role ALL, agent_readonly SELECT) restored.
-- Baselines before: 40,872 rows · $377.00bn · 1 proven. Expect rows and dollars to fall sharply;
-- proven/submitted counts should NOT change (they were DISTINCT-protected).

BEGIN;

DROP MATERIALIZED VIEW public.mv_funding_outcomes_summary;

CREATE MATERIALIZED VIEW public.mv_funding_outcomes_summary AS
WITH funding AS (
    SELECT jf.gs_entity_id,
           count(*) AS funding_records,
           sum(jf.amount_dollars) AS total_funding,
           array_agg(DISTINCT jf.program_name) FILTER (WHERE jf.program_name IS NOT NULL) AS funding_programs
      FROM justice_funding jf
     WHERE jf.gs_entity_id IS NOT NULL
       AND jf.measure_kind = 'grant'
       AND jf.is_aggregate IS NOT TRUE
       AND (jf.recipient_name IS NULL
            OR lower(btrim(jf.recipient_name)) <> ALL (ARRAY['total','totals','grand total','subtotal','sub-total','various','n/a','na','unknown','tbc','other']))
     GROUP BY jf.gs_entity_id
), outcomes AS (
    SELECT os.gs_entity_id,
           count(*) AS outcome_submissions,
           count(*) FILTER (WHERE os.status = 'validated'::text) AS validated_submissions
      FROM outcome_submissions os
     GROUP BY os.gs_entity_id
), alma AS (
    SELECT ai.gs_entity_id,
           count(*) AS alma_interventions,
           max(ai.portfolio_score) AS max_portfolio_score,
           max(ai.evidence_level) AS best_evidence_level
      FROM alma_interventions ai
     GROUP BY ai.gs_entity_id
)
SELECT ge.id AS entity_id,
       ge.gs_id,
       ge.canonical_name,
       ge.abn,
       ge.state,
       ge.is_community_controlled,
       f.funding_records,
       f.total_funding,
       f.funding_programs,
       COALESCE(o.outcome_submissions, 0::bigint) AS outcome_submissions,
       COALESCE(o.validated_submissions, 0::bigint) AS validated_submissions,
       COALESCE(a.alma_interventions, 0::bigint) AS alma_interventions,
       a.max_portfolio_score,
       a.best_evidence_level,
       CASE
           WHEN COALESCE(o.validated_submissions, 0::bigint) > 0 THEN 'proven'::text
           WHEN COALESCE(o.outcome_submissions, 0::bigint) > 0 THEN 'submitted'::text
           WHEN COALESCE(a.alma_interventions, 0::bigint) > 0 THEN 'evidence_exists'::text
           ELSE 'no_outcomes'::text
       END AS outcomes_status,
       LEAST(100,
           CASE WHEN COALESCE(o.validated_submissions, 0::bigint) > 0 THEN 40 ELSE 0 END +
           CASE WHEN COALESCE(a.alma_interventions, 0::bigint) > 0 THEN 30 ELSE 0 END +
           CASE
               WHEN a.max_portfolio_score > 50::numeric THEN 20
               ELSE COALESCE(a.max_portfolio_score::integer / 3, 0)
           END +
           CASE WHEN COALESCE(o.outcome_submissions, 0::bigint) > 0 THEN 10 ELSE 0 END
       ) AS proof_completeness
  FROM gs_entities ge
  JOIN funding f ON f.gs_entity_id = ge.id
  LEFT JOIN outcomes o ON o.gs_entity_id = ge.gs_id
  LEFT JOIN alma a ON a.gs_entity_id = ge.id;

CREATE UNIQUE INDEX idx_mv_funding_outcomes_summary_entity ON public.mv_funding_outcomes_summary USING btree (entity_id);
CREATE INDEX idx_mv_funding_outcomes_summary_status ON public.mv_funding_outcomes_summary USING btree (outcomes_status);
CREATE INDEX idx_mv_funding_outcomes_summary_proof ON public.mv_funding_outcomes_summary USING btree (proof_completeness DESC);
GRANT ALL ON public.mv_funding_outcomes_summary TO service_role;
GRANT SELECT ON public.mv_funding_outcomes_summary TO agent_readonly;

COMMENT ON MATERIALIZED VIEW public.mv_funding_outcomes_summary IS
  'Per-entity: recorded grants received vs outcome submissions vs ALMA evidence. Rewritten '
  '2026-08-16: per-lane CTE aggregation (the old three-way join fan-out multiplied sums by '
  'submissions x interventions — one entity showed $258.5bn) and the mandatory money filters. '
  'See thoughts/shared/data-map/unfiltered-money-views-audit.md';

COMMIT;
