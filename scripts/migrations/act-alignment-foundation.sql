-- ACT Alignment Foundation Migration
-- 2026-05-22 — adds DGR/entity columns, QBE pipeline, and expands ACT project registry
-- Run with: source .env && PGPASSWORD="$DATABASE_PASSWORD" psql -h aws-0-ap-southeast-2.pooler.supabase.com -p 5432 -U "postgres.tednluwflfhxyucgwigh" -d postgres -f scripts/migrations/act-alignment-foundation.sql

BEGIN;

-- =====================================================================
-- 1. grant_opportunities — DGR + entity-type eligibility flags
-- =====================================================================
ALTER TABLE grant_opportunities
  ADD COLUMN IF NOT EXISTS dgr_required boolean,
  ADD COLUMN IF NOT EXISTS accepts_sole_trader boolean,
  ADD COLUMN IF NOT EXISTS accepts_pty_ltd boolean,
  ADD COLUMN IF NOT EXISTS accepts_charity boolean,
  ADD COLUMN IF NOT EXISTS accepts_unincorporated boolean,
  ADD COLUMN IF NOT EXISTS eligibility_signals_at timestamptz;

COMMENT ON COLUMN grant_opportunities.dgr_required IS 'TRUE if grant requires Deductible Gift Recipient endorsement. Backfilled from eligibility_criteria JSONB.';
COMMENT ON COLUMN grant_opportunities.accepts_sole_trader IS 'TRUE if sole trader applicants are eligible. NULL = unknown.';
COMMENT ON COLUMN grant_opportunities.accepts_pty_ltd IS 'TRUE if Pty Ltd applicants are eligible. NULL = unknown.';
COMMENT ON COLUMN grant_opportunities.accepts_charity IS 'TRUE if ACNC-registered charities are eligible. NULL = unknown.';
COMMENT ON COLUMN grant_opportunities.accepts_unincorporated IS 'TRUE if unincorporated associations are eligible. NULL = unknown.';
COMMENT ON COLUMN grant_opportunities.eligibility_signals_at IS 'Last time the backfill job ran for this row.';

CREATE INDEX IF NOT EXISTS idx_grant_opportunities_dgr_required ON grant_opportunities (dgr_required) WHERE dgr_required IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_grant_opportunities_accepts_sole_trader ON grant_opportunities (accepts_sole_trader) WHERE accepts_sole_trader = true;
CREATE INDEX IF NOT EXISTS idx_grant_opportunities_accepts_pty_ltd ON grant_opportunities (accepts_pty_ltd) WHERE accepts_pty_ltd = true;

-- =====================================================================
-- 2. act_grant_recommendation_projects — expand with ACT context JSONB
-- =====================================================================
ALTER TABLE act_grant_recommendation_projects
  ADD COLUMN IF NOT EXISTS project_label text,
  ADD COLUMN IF NOT EXISTS layer text,
  ADD COLUMN IF NOT EXISTS readiness text,
  ADD COLUMN IF NOT EXISTS current_state text,
  ADD COLUMN IF NOT EXISTS intelligence_role text,
  ADD COLUMN IF NOT EXISTS opportunity_alignment text,
  ADD COLUMN IF NOT EXISTS next_question text,
  ADD COLUMN IF NOT EXISTS source_doc text,
  ADD COLUMN IF NOT EXISTS dgr_required boolean DEFAULT false,
  ADD COLUMN IF NOT EXISTS entity_preference text DEFAULT 'sole_trader_then_pty',
  ADD COLUMN IF NOT EXISTS qbe_ready boolean DEFAULT false,
  ADD COLUMN IF NOT EXISTS preferred_funder_ids uuid[] DEFAULT ARRAY[]::uuid[],
  ADD COLUMN IF NOT EXISTS evidence_we_have jsonb DEFAULT '{}'::jsonb,
  ADD COLUMN IF NOT EXISTS act_context jsonb DEFAULT '{}'::jsonb;

COMMENT ON COLUMN act_grant_recommendation_projects.entity_preference IS 'sole_trader | pty_ltd | charity | sole_trader_then_pty (default during 2026-06-30 cutover)';
COMMENT ON COLUMN act_grant_recommendation_projects.qbe_ready IS 'TRUE if this project has gone through internal Qualify/Bid/Evaluate readiness checks';
COMMENT ON COLUMN act_grant_recommendation_projects.preferred_funder_ids IS 'Foundation/funder IDs ACT has existing relationship with for this project';
COMMENT ON COLUMN act_grant_recommendation_projects.evidence_we_have IS 'JSONB: { case_studies, datasets, partner_letters, prior_grants } — what evidence already exists';
COMMENT ON COLUMN act_grant_recommendation_projects.act_context IS 'Free-form JSONB for additional project context (ACT_POSITION fragments, role patterns, etc.)';

-- =====================================================================
-- 3. org_pipeline — QBE stage tracking
-- =====================================================================
ALTER TABLE org_pipeline
  ADD COLUMN IF NOT EXISTS qbe_stage text,
  ADD COLUMN IF NOT EXISTS qbe_qualified_at timestamptz,
  ADD COLUMN IF NOT EXISTS qbe_bid_amount numeric(14,2),
  ADD COLUMN IF NOT EXISTS qbe_submitted_at timestamptz,
  ADD COLUMN IF NOT EXISTS qbe_evaluated_at timestamptz,
  ADD COLUMN IF NOT EXISTS qbe_outcome text,
  ADD COLUMN IF NOT EXISTS opportunity_type text DEFAULT 'grant';

-- qbe_stage values: not_started | qualifying | bid_drafting | bid_submitted | evaluating | decided
-- qbe_outcome values: won | lost | withdrawn | no_decision
-- opportunity_type values: grant | foundation | procurement | partnership | capital

ALTER TABLE org_pipeline
  DROP CONSTRAINT IF EXISTS org_pipeline_qbe_stage_check;
ALTER TABLE org_pipeline
  ADD CONSTRAINT org_pipeline_qbe_stage_check CHECK (
    qbe_stage IS NULL OR qbe_stage IN ('not_started','qualifying','bid_drafting','bid_submitted','evaluating','decided')
  );

ALTER TABLE org_pipeline
  DROP CONSTRAINT IF EXISTS org_pipeline_qbe_outcome_check;
ALTER TABLE org_pipeline
  ADD CONSTRAINT org_pipeline_qbe_outcome_check CHECK (
    qbe_outcome IS NULL OR qbe_outcome IN ('won','lost','withdrawn','no_decision')
  );

ALTER TABLE org_pipeline
  DROP CONSTRAINT IF EXISTS org_pipeline_opportunity_type_check;
ALTER TABLE org_pipeline
  ADD CONSTRAINT org_pipeline_opportunity_type_check CHECK (
    opportunity_type IN ('grant','foundation','procurement','partnership','capital')
  );

CREATE INDEX IF NOT EXISTS idx_org_pipeline_qbe_stage ON org_pipeline (qbe_stage) WHERE qbe_stage IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_org_pipeline_opportunity_type ON org_pipeline (opportunity_type);

COMMENT ON COLUMN org_pipeline.qbe_stage IS 'External QBE process stage: not_started | qualifying | bid_drafting | bid_submitted | evaluating | decided';
COMMENT ON COLUMN org_pipeline.opportunity_type IS 'grant | foundation | procurement | partnership | capital — unified pipeline classifier';

-- =====================================================================
-- 4. qbe_evaluations — write-back results from external QBE process
-- =====================================================================
CREATE TABLE IF NOT EXISTS qbe_evaluations (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  pipeline_id uuid REFERENCES org_pipeline(id) ON DELETE CASCADE,
  opportunity_id uuid,
  project_code text,
  bid_amount numeric(14,2),
  bid_currency text DEFAULT 'AUD',
  bid_summary text,
  evaluation_score numeric(5,2),
  evaluation_max numeric(5,2),
  won boolean,
  outcome_reason text,
  feedback_received text,
  lessons_learned text,
  evaluated_at timestamptz DEFAULT now(),
  evaluator_name text,
  evaluator_org text,
  raw_payload jsonb DEFAULT '{}'::jsonb,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_qbe_evaluations_pipeline_id ON qbe_evaluations (pipeline_id);
CREATE INDEX IF NOT EXISTS idx_qbe_evaluations_opportunity_id ON qbe_evaluations (opportunity_id);
CREATE INDEX IF NOT EXISTS idx_qbe_evaluations_project_code ON qbe_evaluations (project_code);
CREATE INDEX IF NOT EXISTS idx_qbe_evaluations_won ON qbe_evaluations (won) WHERE won IS NOT NULL;

COMMENT ON TABLE qbe_evaluations IS 'Write-back log from external Qualify/Bid/Evaluate process. One row per bid evaluation outcome.';
COMMENT ON COLUMN qbe_evaluations.raw_payload IS 'Original payload from QBE system for audit/replay';

-- =====================================================================
-- 5. v_act_pipeline_unified — one screen for grants + procurement + decisions
-- =====================================================================
DROP VIEW IF EXISTS v_act_pipeline_unified CASCADE;
CREATE VIEW v_act_pipeline_unified AS
SELECT
  op.id                                   AS pipeline_id,
  op.project_code,
  op.name                                 AS opportunity_name,
  op.funder,
  op.amount_display,
  op.amount_numeric,
  op.deadline,
  op.status                               AS pipeline_status,
  op.opportunity_type,
  op.qbe_stage,
  op.qbe_outcome,
  op.qbe_bid_amount,
  op.pathway,
  op.recommended_role,
  agr.fit_score,
  agr.is_strong_fit,
  agr.flags                               AS recommendation_flags,
  agrd.decision                           AS last_decision,
  agrd.decided_at,
  agrd.notes                              AS decision_notes,
  arp.project_label,
  arp.layer                               AS project_layer,
  arp.readiness                           AS project_readiness,
  arp.dgr_required                        AS project_dgr_required,
  arp.entity_preference                   AS project_entity_preference,
  op.created_at,
  op.updated_at
FROM org_pipeline op
LEFT JOIN act_grant_recommendation_projects arp
  ON arp.project_code = op.project_code
LEFT JOIN act_grant_recommendations agr
  ON agr.project_code = op.project_code
 AND agr.opportunity_id = op.grant_opportunity_id
LEFT JOIN LATERAL (
  SELECT decision, decided_at, notes
  FROM act_grant_recommendation_decisions
  WHERE project_code = op.project_code
    AND opportunity_id = op.grant_opportunity_id
  ORDER BY decided_at DESC
  LIMIT 1
) agrd ON true;

COMMENT ON VIEW v_act_pipeline_unified IS 'One-screen view across org_pipeline + act_grant_recommendations + decisions + project context. Used by ACT pipeline kanban.';

COMMIT;
