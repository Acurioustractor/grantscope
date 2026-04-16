CREATE OR REPLACE VIEW v_agent_runtime_sweeps AS
SELECT
  ars.agent_id,
  COALESCE(ar.agent_name, ars.agent_id) AS agent_name,
  NULLIF(ars.state->>'fullSweepCursor', '')::integer AS full_sweep_cursor,
  NULLIF(ars.state->>'fullSweepCandidateCount', '')::integer AS full_sweep_candidate_count,
  CASE
    WHEN NULLIF(ars.state->>'fullSweepCandidateCount', '')::numeric > 0
    THEN ROUND(
      (NULLIF(ars.state->>'fullSweepCursor', '')::numeric
        / NULLIF(ars.state->>'fullSweepCandidateCount', '')::numeric) * 100,
      1
    )
    ELSE NULL
  END AS full_sweep_progress_pct,
  NULLIF(ars.state->>'fullSweepAdvancedBy', '')::integer AS full_sweep_advanced_by,
  NULLIF(ars.state->>'fullSweepLastProgramsFound', '')::integer AS full_sweep_last_programs_found,
  NULLIF(ars.state->>'fullSweepLastInserted', '')::integer AS full_sweep_last_inserted,
  NULLIF(ars.state->>'fullSweepLastUpdated', '')::integer AS full_sweep_last_updated,
  NULLIF(ars.state->>'fullSweepLastSkipped', '')::integer AS full_sweep_last_skipped,
  NULLIF(ars.state->>'fullSweepLastErrors', '')::integer AS full_sweep_last_errors,
  COALESCE(ars.state->'fullSweepLastBatchFoundationIds', '[]'::jsonb) AS full_sweep_last_batch_foundation_ids,
  COALESCE(ars.state->'fullSweepLastBatchFoundationNames', '[]'::jsonb) AS full_sweep_last_batch_foundation_names,
  NULLIF(ars.state->>'fullSweepLastRunAt', '')::timestamptz AS full_sweep_last_run_at,
  s.interval_hours,
  s.enabled,
  s.auto_create_task,
  s.last_run_at AS schedule_last_run_at,
  ar.status AS recent_run_status,
  ar.completed_at AS recent_run_completed_at,
  ars.updated_at
FROM agent_runtime_state ars
LEFT JOIN agent_schedules s
  ON s.agent_id = ars.agent_id
LEFT JOIN LATERAL (
  SELECT
    agent_name,
    status,
    completed_at
  FROM agent_runs
  WHERE agent_id = ars.agent_id
  ORDER BY started_at DESC
  LIMIT 1
) ar ON TRUE
WHERE ars.state ? 'fullSweepCursor'
   OR ars.state ? 'fullSweepCandidateCount';

NOTIFY pgrst, 'reload schema';
