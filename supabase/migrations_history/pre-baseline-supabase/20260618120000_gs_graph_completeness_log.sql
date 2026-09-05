-- Graph completeness gate — data-health roadmap Phase 2 (the centerpiece).
--
-- Per-dataset expected-vs-actual edge counts, one row per relationship dataset per run.
-- Written by scripts/check-graph-completeness.mjs (nightly agent, after build-entity-graph).
--
-- This table IS the roadmap's "coverage trend": query it over time to see whether each
-- dataset's edge coverage is holding, rising (genuinely capturing more), or silently
-- regressing. status='ALERT' means edges went missing relative to what the source data +
-- current build code support — the exact #82/#83 bug class that hid for months because
-- nothing was watching graph completeness.

CREATE TABLE IF NOT EXISTS gs_graph_completeness_log (
  id                 bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  checked_at         timestamptz NOT NULL DEFAULT now(),
  dataset            text        NOT NULL,   -- gs_relationships.dataset (e.g. aec_donations, austender)
  relationship_type  text,                   -- the edge type this dataset produces
  expected_edges     bigint      NOT NULL,   -- distinct edge-keys the current build SELECT would produce
  actual_edges       bigint      NOT NULL,   -- edges currently in gs_relationships for this dataset
  source_rows        bigint,                 -- rows in the base source table (coverage denominator)
  drift_pct          numeric,                -- (expected - actual) / expected  (signed; >0 = under-built)
  coverage_pct       numeric,                -- actual / source_rows  (the trend line, %)
  status             text        NOT NULL,   -- OK | ALERT (under-built) | STALE (over-built) | EMPTY
  threshold          numeric     NOT NULL,   -- drift tolerance used for this run (fraction, e.g. 0.05)
  duration_ms        integer,
  run_id             uuid                    -- agent_runs.id for this check (nullable under pooler stress)
);

CREATE INDEX IF NOT EXISTS idx_gs_graph_completeness_log_dataset_time
  ON gs_graph_completeness_log (dataset, checked_at DESC);

CREATE INDEX IF NOT EXISTS idx_gs_graph_completeness_log_status
  ON gs_graph_completeness_log (status, checked_at DESC)
  WHERE status <> 'OK';

-- Access: the nightly agent writes via the service_role key (PostgREST). New tables created
-- through psql don't inherit API-role grants, so grant explicitly. Not exposed to anon/
-- authenticated — /health reads this server-side via the service key, keeping it off the
-- public PostgREST surface (no RLS-disabled-but-exposed advisory).
GRANT SELECT, INSERT ON gs_graph_completeness_log TO service_role;

COMMENT ON TABLE gs_graph_completeness_log IS
  'Nightly graph-completeness gate (data-health roadmap Phase 2). Expected vs actual edge counts per relationship dataset. status=ALERT => edges silently went missing (the #82/#83 bug class).';

-- Register the nightly check (runs after build-entity-graph via the orchestrator dependency).
-- Idempotent so re-applying the migration is safe; agent metadata lives in scripts/lib/agent-registry.mjs.
INSERT INTO agent_schedules (agent_id, interval_hours, enabled, priority)
VALUES ('check-graph-completeness', 24, true, 4)
ON CONFLICT (agent_id) DO NOTHING;
