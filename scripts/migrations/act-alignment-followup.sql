-- ACT Alignment Followup
-- 2026-05-22 — backfills + schedules to activate the foundation migration
-- Run AFTER scripts/migrations/act-alignment-foundation.sql

BEGIN;

-- =====================================================================
-- 1. Backfill org_pipeline.project_code from act_grant_recommendations
-- =====================================================================
-- For each existing pipeline row, set project_code to the ACT project
-- with the best fit_score for that opportunity. Only fills NULLs.
UPDATE org_pipeline op
SET project_code = sub.project_code,
    updated_at = now()
FROM (
  SELECT DISTINCT ON (opportunity_id) opportunity_id, project_code, fit_score
  FROM act_grant_recommendations
  ORDER BY opportunity_id, fit_score DESC
) sub
WHERE op.grant_opportunity_id = sub.opportunity_id
  AND op.project_code IS NULL;

-- =====================================================================
-- 2. Schedule the 3 phased orchestrator agents
-- =====================================================================
-- Disable the legacy single-run orchestrator (it was timing out).
UPDATE agent_schedules
SET enabled = false,
    updated_at = now()
WHERE agent_id = 'nightly-grant-pipeline';

-- Insert phase-specific schedules (24h, priority chained so they fan out).
-- Priority lower = runs first in a given run window; the orchestrator's
-- dependency graph in agent-registry.mjs handles ordering within priority.
INSERT INTO agent_schedules (agent_id, interval_hours, enabled, priority, params)
VALUES
  ('nightly-grant-pipeline-ingest',   24, true, 2, '{"phase":"ingest"}'::jsonb),
  ('nightly-grant-pipeline-enrich',   24, true, 3, '{"phase":"enrich"}'::jsonb),
  ('nightly-grant-pipeline-finalize', 24, true, 4, '{"phase":"finalize"}'::jsonb)
ON CONFLICT (agent_id) DO UPDATE
  SET enabled = EXCLUDED.enabled,
      interval_hours = EXCLUDED.interval_hours,
      priority = EXCLUDED.priority,
      params = EXCLUDED.params,
      updated_at = now();

COMMIT;
