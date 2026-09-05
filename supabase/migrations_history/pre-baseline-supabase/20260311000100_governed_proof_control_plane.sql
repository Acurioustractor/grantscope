-- Governed proof control plane
-- Shared task/run/bundle infrastructure for Empathy Ledger, GrantScope, and JusticeHub.

CREATE TABLE IF NOT EXISTS public.governed_proof_tasks (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  task_type text NOT NULL,
  status text NOT NULL DEFAULT 'queued',
  queue_lane text NOT NULL DEFAULT 'core',
  priority text NOT NULL DEFAULT 'medium',
  owner_system text NOT NULL DEFAULT 'SHARED',
  system_scope text[] NOT NULL DEFAULT ARRAY[]::text[],
  target_type text NOT NULL,
  target_id text NOT NULL,
  value_score numeric(6,2) NOT NULL DEFAULT 0,
  confidence_required numeric(3,2) NOT NULL DEFAULT 0.80,
  input_payload jsonb NOT NULL DEFAULT '{}'::jsonb,
  acceptance_checks jsonb NOT NULL DEFAULT '[]'::jsonb,
  review_status text NOT NULL DEFAULT 'not_required',
  promotion_status text NOT NULL DEFAULT 'draft',
  attempt_count integer NOT NULL DEFAULT 0,
  claimed_by text,
  started_at timestamptz,
  completed_at timestamptz,
  last_error text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT governed_proof_tasks_task_type_check CHECK (
    task_type = ANY (
      ARRAY[
        'discover_gap',
        'resolve_identity',
        'enrich_record',
        'link_records',
        'validate_record',
        'assemble_proof',
        'refresh_bundle',
        'review_required'
      ]
    )
  ),
  CONSTRAINT governed_proof_tasks_status_check CHECK (
    status = ANY (
      ARRAY['queued', 'claimed', 'running', 'blocked', 'failed', 'completed']
    )
  ),
  CONSTRAINT governed_proof_tasks_queue_lane_check CHECK (
    queue_lane = ANY (
      ARRAY['hot', 'core', 'repair', 'exploration']
    )
  ),
  CONSTRAINT governed_proof_tasks_priority_check CHECK (
    priority = ANY (
      ARRAY['low', 'medium', 'high', 'critical']
    )
  ),
  CONSTRAINT governed_proof_tasks_owner_system_check CHECK (
    owner_system = ANY (
      ARRAY['GS', 'JH', 'EL', 'SHARED']
    )
  ),
  CONSTRAINT governed_proof_tasks_review_status_check CHECK (
    review_status = ANY (
      ARRAY['not_required', 'pending', 'approved', 'rejected']
    )
  ),
  CONSTRAINT governed_proof_tasks_promotion_status_check CHECK (
    promotion_status = ANY (
      ARRAY['draft', 'internal', 'partner', 'public', 'suppressed']
    )
  ),
  CONSTRAINT governed_proof_tasks_confidence_required_check CHECK (
    confidence_required >= 0.00 AND confidence_required <= 1.00
  )
);

COMMENT ON TABLE public.governed_proof_tasks IS
  'Shared queue for governed proof discovery, enrichment, linking, validation, and proof assembly work across EL, GS, and JH.';

CREATE INDEX IF NOT EXISTS governed_proof_tasks_status_idx
  ON public.governed_proof_tasks (status, queue_lane, priority, value_score DESC, created_at ASC);

CREATE INDEX IF NOT EXISTS governed_proof_tasks_target_idx
  ON public.governed_proof_tasks (target_type, target_id);

CREATE TABLE IF NOT EXISTS public.governed_proof_runs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  task_id uuid NOT NULL REFERENCES public.governed_proof_tasks(id) ON DELETE CASCADE,
  agent_role text NOT NULL,
  provider text NOT NULL,
  model text,
  prompt_version text,
  strategy_version text,
  input_hash text NOT NULL,
  output_hash text,
  result_status text NOT NULL DEFAULT 'success',
  eval_score numeric(6,3),
  confidence_delta numeric(4,3),
  cost_usd numeric(12,4),
  duration_ms bigint,
  notes text,
  run_payload jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT governed_proof_runs_result_status_check CHECK (
    result_status = ANY (
      ARRAY['success', 'partial', 'failed']
    )
  ),
  CONSTRAINT governed_proof_runs_eval_score_check CHECK (
    eval_score IS NULL OR (eval_score >= 0.00 AND eval_score <= 1.00)
  ),
  CONSTRAINT governed_proof_runs_confidence_delta_check CHECK (
    confidence_delta IS NULL OR (confidence_delta >= -1.00 AND confidence_delta <= 1.00)
  )
);

COMMENT ON TABLE public.governed_proof_runs IS
  'Experiment and execution ledger for agent runs that operate on governed proof tasks.';

CREATE INDEX IF NOT EXISTS governed_proof_runs_task_id_idx
  ON public.governed_proof_runs (task_id, created_at DESC);

CREATE INDEX IF NOT EXISTS governed_proof_runs_agent_role_idx
  ON public.governed_proof_runs (agent_role, provider, created_at DESC);

CREATE TABLE IF NOT EXISTS public.governed_proof_bundles (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  bundle_key text NOT NULL UNIQUE,
  subject_type text NOT NULL,
  subject_id text NOT NULL,
  owner_system text NOT NULL DEFAULT 'SHARED',
  lifecycle_status text NOT NULL DEFAULT 'raw',
  review_status text NOT NULL DEFAULT 'not_required',
  promotion_status text NOT NULL DEFAULT 'draft',
  overall_confidence numeric(3,2) NOT NULL DEFAULT 0.00,
  capital_confidence numeric(3,2),
  evidence_confidence numeric(3,2),
  voice_confidence numeric(3,2),
  governance_confidence numeric(3,2),
  capital_context jsonb NOT NULL DEFAULT '{}'::jsonb,
  evidence_context jsonb NOT NULL DEFAULT '{}'::jsonb,
  voice_context jsonb NOT NULL DEFAULT '{}'::jsonb,
  governance_context jsonb NOT NULL DEFAULT '{}'::jsonb,
  output_context jsonb NOT NULL DEFAULT '{}'::jsonb,
  freshness_at timestamptz,
  last_validated_at timestamptz,
  published_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT governed_proof_bundles_owner_system_check CHECK (
    owner_system = ANY (
      ARRAY['GS', 'JH', 'EL', 'SHARED']
    )
  ),
  CONSTRAINT governed_proof_bundles_lifecycle_status_check CHECK (
    lifecycle_status = ANY (
      ARRAY['raw', 'resolved', 'enriched', 'linked', 'validated', 'published']
    )
  ),
  CONSTRAINT governed_proof_bundles_review_status_check CHECK (
    review_status = ANY (
      ARRAY['not_required', 'pending', 'approved', 'rejected']
    )
  ),
  CONSTRAINT governed_proof_bundles_promotion_status_check CHECK (
    promotion_status = ANY (
      ARRAY['draft', 'internal', 'partner', 'public', 'suppressed']
    )
  ),
  CONSTRAINT governed_proof_bundles_overall_confidence_check CHECK (
    overall_confidence >= 0.00 AND overall_confidence <= 1.00
  ),
  CONSTRAINT governed_proof_bundles_capital_confidence_check CHECK (
    capital_confidence IS NULL OR (capital_confidence >= 0.00 AND capital_confidence <= 1.00)
  ),
  CONSTRAINT governed_proof_bundles_evidence_confidence_check CHECK (
    evidence_confidence IS NULL OR (evidence_confidence >= 0.00 AND evidence_confidence <= 1.00)
  ),
  CONSTRAINT governed_proof_bundles_voice_confidence_check CHECK (
    voice_confidence IS NULL OR (voice_confidence >= 0.00 AND voice_confidence <= 1.00)
  ),
  CONSTRAINT governed_proof_bundles_governance_confidence_check CHECK (
    governance_confidence IS NULL OR (governance_confidence >= 0.00 AND governance_confidence <= 1.00)
  )
);

COMMENT ON TABLE public.governed_proof_bundles IS
  'Validated bundles connecting capital, evidence, voice, and governance context into a governed proof artifact.';

CREATE INDEX IF NOT EXISTS governed_proof_bundles_subject_idx
  ON public.governed_proof_bundles (subject_type, subject_id);

CREATE INDEX IF NOT EXISTS governed_proof_bundles_status_idx
  ON public.governed_proof_bundles (lifecycle_status, promotion_status, overall_confidence DESC);

CREATE TABLE IF NOT EXISTS public.governed_proof_bundle_records (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  bundle_id uuid NOT NULL REFERENCES public.governed_proof_bundles(id) ON DELETE CASCADE,
  record_system text NOT NULL,
  record_type text NOT NULL,
  record_id text NOT NULL,
  link_role text NOT NULL,
  confidence_score numeric(3,2) NOT NULL DEFAULT 0.70,
  provenance_payload jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT governed_proof_bundle_records_record_system_check CHECK (
    record_system = ANY (
      ARRAY['GS', 'JH', 'EL']
    )
  ),
  CONSTRAINT governed_proof_bundle_records_confidence_check CHECK (
    confidence_score >= 0.00 AND confidence_score <= 1.00
  ),
  CONSTRAINT governed_proof_bundle_records_unique UNIQUE (bundle_id, record_system, record_type, record_id, link_role)
);

COMMENT ON TABLE public.governed_proof_bundle_records IS
  'Cross-system record attachments for governed proof bundles.';

CREATE INDEX IF NOT EXISTS governed_proof_bundle_records_bundle_idx
  ON public.governed_proof_bundle_records (bundle_id, link_role);

CREATE TABLE IF NOT EXISTS public.governed_proof_gold_sets (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  slug text NOT NULL UNIQUE,
  task_type text NOT NULL,
  owner_system text NOT NULL DEFAULT 'SHARED',
  description text,
  active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT governed_proof_gold_sets_task_type_check CHECK (
    task_type = ANY (
      ARRAY[
        'resolve_identity',
        'enrich_record',
        'link_records',
        'validate_record',
        'assemble_proof'
      ]
    )
  ),
  CONSTRAINT governed_proof_gold_sets_owner_system_check CHECK (
    owner_system = ANY (
      ARRAY['GS', 'JH', 'EL', 'SHARED']
    )
  )
);

COMMENT ON TABLE public.governed_proof_gold_sets IS
  'Named evaluation sets used to benchmark matching, enrichment, validation, and proof assembly quality.';

CREATE TABLE IF NOT EXISTS public.governed_proof_gold_set_cases (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  gold_set_id uuid NOT NULL REFERENCES public.governed_proof_gold_sets(id) ON DELETE CASCADE,
  case_key text NOT NULL,
  input_payload jsonb NOT NULL DEFAULT '{}'::jsonb,
  expected_payload jsonb NOT NULL DEFAULT '{}'::jsonb,
  expected_confidence numeric(3,2),
  active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT governed_proof_gold_set_cases_expected_confidence_check CHECK (
    expected_confidence IS NULL OR (expected_confidence >= 0.00 AND expected_confidence <= 1.00)
  ),
  CONSTRAINT governed_proof_gold_set_cases_unique UNIQUE (gold_set_id, case_key)
);

COMMENT ON TABLE public.governed_proof_gold_set_cases IS
  'Evaluation cases for gold sets, including source payloads and expected outputs.';

CREATE INDEX IF NOT EXISTS governed_proof_gold_set_cases_gold_set_idx
  ON public.governed_proof_gold_set_cases (gold_set_id, active, case_key);

CREATE OR REPLACE VIEW public.v_governed_proof_density_summary AS
SELECT
  subject_type,
  lifecycle_status,
  promotion_status,
  COUNT(*) AS bundle_count,
  COUNT(*) FILTER (WHERE overall_confidence >= 0.90) AS high_confidence_count,
  COUNT(*) FILTER (WHERE freshness_at IS NULL OR freshness_at >= now()) AS fresh_count,
  ROUND(AVG(overall_confidence)::numeric, 3) AS avg_confidence
FROM public.governed_proof_bundles
GROUP BY subject_type, lifecycle_status, promotion_status;

COMMENT ON VIEW public.v_governed_proof_density_summary IS
  'Rollup view for governed proof density by subject type, lifecycle stage, and promotion status.';

CREATE OR REPLACE VIEW public.v_governed_proof_hot_lane AS
SELECT
  id,
  task_type,
  status,
  queue_lane,
  priority,
  owner_system,
  system_scope,
  target_type,
  target_id,
  value_score,
  confidence_required,
  input_payload,
  acceptance_checks,
  review_status,
  promotion_status,
  attempt_count,
  claimed_by,
  started_at,
  completed_at,
  last_error,
  created_at,
  updated_at
FROM public.governed_proof_tasks
WHERE queue_lane = 'hot'
ORDER BY
  CASE priority
    WHEN 'critical' THEN 1
    WHEN 'high' THEN 2
    WHEN 'medium' THEN 3
    ELSE 4
  END,
  value_score DESC,
  created_at ASC;

COMMENT ON VIEW public.v_governed_proof_hot_lane IS
  'Ordered hot-lane queue for flagship governed proof work.';

DROP TRIGGER IF EXISTS governed_proof_tasks_updated_at ON public.governed_proof_tasks;
CREATE TRIGGER governed_proof_tasks_updated_at
  BEFORE UPDATE ON public.governed_proof_tasks
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();

DROP TRIGGER IF EXISTS governed_proof_bundles_updated_at ON public.governed_proof_bundles;
CREATE TRIGGER governed_proof_bundles_updated_at
  BEFORE UPDATE ON public.governed_proof_bundles
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();

DROP TRIGGER IF EXISTS governed_proof_gold_sets_updated_at ON public.governed_proof_gold_sets;
CREATE TRIGGER governed_proof_gold_sets_updated_at
  BEFORE UPDATE ON public.governed_proof_gold_sets
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();

DROP TRIGGER IF EXISTS governed_proof_gold_set_cases_updated_at ON public.governed_proof_gold_set_cases;
CREATE TRIGGER governed_proof_gold_set_cases_updated_at
  BEFORE UPDATE ON public.governed_proof_gold_set_cases
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();

ALTER TABLE public.governed_proof_tasks ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.governed_proof_runs ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.governed_proof_bundles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.governed_proof_bundle_records ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.governed_proof_gold_sets ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.governed_proof_gold_set_cases ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Service role full access on governed_proof_tasks" ON public.governed_proof_tasks;
CREATE POLICY "Service role full access on governed_proof_tasks"
  ON public.governed_proof_tasks
  FOR ALL
  TO service_role
  USING (true)
  WITH CHECK (true);

DROP POLICY IF EXISTS "Service role full access on governed_proof_runs" ON public.governed_proof_runs;
CREATE POLICY "Service role full access on governed_proof_runs"
  ON public.governed_proof_runs
  FOR ALL
  TO service_role
  USING (true)
  WITH CHECK (true);

DROP POLICY IF EXISTS "Service role full access on governed_proof_bundles" ON public.governed_proof_bundles;
CREATE POLICY "Service role full access on governed_proof_bundles"
  ON public.governed_proof_bundles
  FOR ALL
  TO service_role
  USING (true)
  WITH CHECK (true);

DROP POLICY IF EXISTS "Service role full access on governed_proof_bundle_records" ON public.governed_proof_bundle_records;
CREATE POLICY "Service role full access on governed_proof_bundle_records"
  ON public.governed_proof_bundle_records
  FOR ALL
  TO service_role
  USING (true)
  WITH CHECK (true);

DROP POLICY IF EXISTS "Service role full access on governed_proof_gold_sets" ON public.governed_proof_gold_sets;
CREATE POLICY "Service role full access on governed_proof_gold_sets"
  ON public.governed_proof_gold_sets
  FOR ALL
  TO service_role
  USING (true)
  WITH CHECK (true);

DROP POLICY IF EXISTS "Service role full access on governed_proof_gold_set_cases" ON public.governed_proof_gold_set_cases;
CREATE POLICY "Service role full access on governed_proof_gold_set_cases"
  ON public.governed_proof_gold_set_cases
  FOR ALL
  TO service_role
  USING (true)
  WITH CHECK (true);
