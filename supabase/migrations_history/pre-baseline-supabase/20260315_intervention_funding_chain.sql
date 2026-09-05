-- Chain validation view: Intervention → Entity → Funding
-- "Who funds this intervention and does it work?"

-- Drop if exists for idempotency
DROP VIEW IF EXISTS v_intervention_funding_chain;
DROP MATERIALIZED VIEW IF EXISTS mv_intervention_funding_chain;

CREATE MATERIALIZED VIEW mv_intervention_funding_chain AS
SELECT
  e.id as entity_id,
  e.gs_id,
  e.canonical_name as org_name,
  e.entity_type,
  e.abn,
  e.state,
  e.sector,
  e.is_community_controlled,
  e.metadata->>'acnc' IS NOT NULL as has_acnc_data,

  -- Intervention stats
  COUNT(DISTINCT ai.id) as intervention_count,
  array_agg(DISTINCT ai.type) FILTER (WHERE ai.type IS NOT NULL) as intervention_types,
  MAX(ai.evidence_level) as max_evidence_level,
  AVG(ai.portfolio_score) FILTER (WHERE ai.portfolio_score IS NOT NULL) as avg_portfolio_score,

  -- Evidence stats
  COUNT(DISTINCT aie.evidence_id) as evidence_count,

  -- Outcome stats
  COUNT(DISTINCT aio.outcome_id) as outcome_count,

  -- Funding stats
  COUNT(DISTINCT r_grant.id) as grant_count,
  COALESCE(SUM(r_grant.amount), 0) as total_grant_funding,
  COUNT(DISTINCT r_contract.id) as contract_count,
  COUNT(DISTINCT r_donation.id) as donation_count,

  -- Chain completeness score (0-4)
  (
    CASE WHEN COUNT(DISTINCT ai.id) > 0 THEN 1 ELSE 0 END +  -- has interventions
    CASE WHEN COUNT(DISTINCT aie.evidence_id) > 0 THEN 1 ELSE 0 END +  -- has evidence
    CASE WHEN COUNT(DISTINCT aio.outcome_id) > 0 THEN 1 ELSE 0 END +  -- has outcomes
    CASE WHEN COUNT(DISTINCT r_grant.id) + COUNT(DISTINCT r_contract.id) > 0 THEN 1 ELSE 0 END  -- has funding
  ) as chain_completeness,

  -- Flags
  CASE
    WHEN COUNT(DISTINCT r_grant.id) + COUNT(DISTINCT r_contract.id) = 0 THEN 'unfunded'
    WHEN COUNT(DISTINCT aie.evidence_id) = 0 THEN 'no_evidence'
    WHEN COUNT(DISTINCT aio.outcome_id) = 0 THEN 'no_outcomes'
    ELSE 'complete'
  END as chain_status

FROM gs_entities e
JOIN alma_interventions ai ON ai.gs_entity_id = e.id
LEFT JOIN alma_intervention_evidence aie ON aie.intervention_id = ai.id
LEFT JOIN alma_intervention_outcomes aio ON aio.intervention_id = ai.id
LEFT JOIN gs_relationships r_grant ON r_grant.target_entity_id = e.id AND r_grant.relationship_type = 'grant'
LEFT JOIN gs_relationships r_contract ON r_contract.target_entity_id = e.id AND r_contract.relationship_type = 'contract'
LEFT JOIN gs_relationships r_donation ON r_donation.target_entity_id = e.id AND r_donation.relationship_type = 'donation'
GROUP BY e.id, e.gs_id, e.canonical_name, e.entity_type, e.abn, e.state, e.sector, e.is_community_controlled, e.metadata;

-- Indexes for fast queries
CREATE INDEX idx_mv_ifc_chain_status ON mv_intervention_funding_chain(chain_status);
CREATE INDEX idx_mv_ifc_chain_completeness ON mv_intervention_funding_chain(chain_completeness);
CREATE INDEX idx_mv_ifc_entity_type ON mv_intervention_funding_chain(entity_type);
CREATE INDEX idx_mv_ifc_state ON mv_intervention_funding_chain(state);

-- Summary stats view
CREATE OR REPLACE VIEW v_chain_summary AS
SELECT
  chain_status,
  chain_completeness,
  COUNT(*) as org_count,
  SUM(intervention_count) as total_interventions,
  SUM(evidence_count) as total_evidence,
  SUM(outcome_count) as total_outcomes,
  SUM(grant_count) as total_grants,
  SUM(total_grant_funding) as total_funding
FROM mv_intervention_funding_chain
GROUP BY chain_status, chain_completeness
ORDER BY chain_completeness DESC, org_count DESC;
