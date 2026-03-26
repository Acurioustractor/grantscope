-- Sprint 4: Outcomes Scale — Funding → Outcomes linkage views
-- Links justice_funding records to outcome_submissions and ALMA evidence
-- to answer "what happened with the money?"

-- 1. View: funding_outcomes_chain
-- Connects: funding record → entity → outcome submissions + ALMA interventions
CREATE OR REPLACE VIEW v_funding_outcomes_chain AS
SELECT
  jf.id as funding_id,
  jf.recipient_name,
  jf.recipient_abn,
  jf.gs_entity_id,
  ge.canonical_name as entity_name,
  jf.program_name as funding_program,
  jf.amount_dollars,
  jf.financial_year,
  jf.state,
  jf.source as funding_source,
  -- Outcome submissions
  os.id as submission_id,
  os.program_name as outcomes_program,
  os.reporting_period,
  os.outcomes as outcomes_data,
  os.narrative,
  os.methodology,
  os.status as submission_status,
  os.proof_bundle_id,
  -- ALMA interventions
  ai.id as alma_id,
  ai.name as alma_intervention,
  ai.type as alma_type,
  ai.evidence_level,
  ai.cultural_authority,
  ai.portfolio_score,
  -- Chain completeness
  CASE
    WHEN os.id IS NOT NULL AND os.status = 'validated' THEN 'proven'
    WHEN os.id IS NOT NULL THEN 'submitted'
    WHEN ai.id IS NOT NULL THEN 'evidence_exists'
    ELSE 'no_outcomes'
  END as outcomes_status
FROM justice_funding jf
LEFT JOIN gs_entities ge ON ge.id = jf.gs_entity_id
LEFT JOIN outcome_submissions os ON os.gs_entity_id = ge.gs_id
LEFT JOIN alma_interventions ai ON ai.gs_entity_id = jf.gs_entity_id
WHERE jf.gs_entity_id IS NOT NULL;

-- 2. Materialized view: funding outcomes summary per entity
CREATE MATERIALIZED VIEW IF NOT EXISTS mv_funding_outcomes_summary AS
SELECT
  ge.id as entity_id,
  ge.gs_id,
  ge.canonical_name,
  ge.abn,
  ge.state,
  ge.is_community_controlled,
  -- Funding totals
  COUNT(DISTINCT jf.id) as funding_records,
  SUM(jf.amount_dollars) as total_funding,
  array_agg(DISTINCT jf.program_name) FILTER (WHERE jf.program_name IS NOT NULL) as funding_programs,
  -- Outcome submissions
  COUNT(DISTINCT os.id) as outcome_submissions,
  COUNT(DISTINCT os.id) FILTER (WHERE os.status = 'validated') as validated_submissions,
  -- ALMA coverage
  COUNT(DISTINCT ai.id) as alma_interventions,
  MAX(ai.portfolio_score) as max_portfolio_score,
  MAX(ai.evidence_level) as best_evidence_level,
  -- Chain status
  CASE
    WHEN COUNT(DISTINCT os.id) FILTER (WHERE os.status = 'validated') > 0 THEN 'proven'
    WHEN COUNT(DISTINCT os.id) > 0 THEN 'submitted'
    WHEN COUNT(DISTINCT ai.id) > 0 THEN 'evidence_exists'
    ELSE 'no_outcomes'
  END as outcomes_status,
  -- Proof completeness score (0-100)
  LEAST(100, (
    (CASE WHEN COUNT(DISTINCT os.id) FILTER (WHERE os.status = 'validated') > 0 THEN 40 ELSE 0 END) +
    (CASE WHEN COUNT(DISTINCT ai.id) > 0 THEN 30 ELSE 0 END) +
    (CASE WHEN MAX(ai.portfolio_score) > 50 THEN 20 ELSE COALESCE(MAX(ai.portfolio_score)::int / 3, 0) END) +
    (CASE WHEN COUNT(DISTINCT os.id) > 0 THEN 10 ELSE 0 END)
  )) as proof_completeness
FROM gs_entities ge
JOIN justice_funding jf ON jf.gs_entity_id = ge.id
LEFT JOIN outcome_submissions os ON os.gs_entity_id = ge.gs_id
LEFT JOIN alma_interventions ai ON ai.gs_entity_id = ge.id
GROUP BY ge.id, ge.gs_id, ge.canonical_name, ge.abn, ge.state, ge.is_community_controlled;

CREATE UNIQUE INDEX IF NOT EXISTS idx_mv_funding_outcomes_summary_entity
  ON mv_funding_outcomes_summary (entity_id);
CREATE INDEX IF NOT EXISTS idx_mv_funding_outcomes_summary_status
  ON mv_funding_outcomes_summary (outcomes_status);
CREATE INDEX IF NOT EXISTS idx_mv_funding_outcomes_summary_proof
  ON mv_funding_outcomes_summary (proof_completeness DESC);

-- 3. PRF-specific view: portfolio outcomes dashboard
CREATE OR REPLACE VIEW v_prf_portfolio_outcomes AS
SELECT
  jf.recipient_name,
  jf.recipient_abn,
  jf.gs_entity_id,
  ge.canonical_name,
  jf.amount_dollars,
  -- Outcome submissions for this org
  (SELECT COUNT(*) FROM outcome_submissions os WHERE os.gs_entity_id = ge.gs_id) as submissions,
  (SELECT COUNT(*) FROM outcome_submissions os WHERE os.gs_entity_id = ge.gs_id AND os.status = 'validated') as validated,
  -- ALMA interventions
  (SELECT COUNT(*) FROM alma_interventions ai WHERE ai.gs_entity_id = jf.gs_entity_id) as alma_interventions,
  (SELECT MAX(portfolio_score) FROM alma_interventions ai WHERE ai.gs_entity_id = jf.gs_entity_id) as best_portfolio_score,
  -- Governed Proof bundles
  (SELECT COUNT(*) FROM governed_proof_bundles gpb WHERE gpb.subject_id = ge.gs_id) as proof_bundles,
  -- Tasks pending
  (SELECT COUNT(*) FROM governed_proof_tasks gpt WHERE gpt.target_id = ge.gs_id AND gpt.status != 'completed') as pending_tasks,
  -- Status
  CASE
    WHEN (SELECT COUNT(*) FROM outcome_submissions os WHERE os.gs_entity_id = ge.gs_id AND os.status = 'validated') > 0 THEN 'proven'
    WHEN (SELECT COUNT(*) FROM outcome_submissions os WHERE os.gs_entity_id = ge.gs_id) > 0 THEN 'submitted'
    WHEN (SELECT COUNT(*) FROM alma_interventions ai WHERE ai.gs_entity_id = jf.gs_entity_id) > 0 THEN 'evidence_exists'
    ELSE 'awaiting_submission'
  END as status
FROM justice_funding jf
LEFT JOIN gs_entities ge ON ge.id = jf.gs_entity_id
WHERE jf.program_name = 'PRF Justice Reinvestment Portfolio'
ORDER BY jf.recipient_name;
