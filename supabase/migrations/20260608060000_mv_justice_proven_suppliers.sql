-- OP3 (leverage map) — Justice-domain proven suppliers: the broad buyer evidence tier.
--
-- One row per org (by ABN) carrying TWO independent proof signals at once:
--   1. Justice/community domain delivery   (justice_funding.recipient_abn)
--   2. A won federal contract               (austender_contracts.supplier_abn)
--
-- ~4,225 orgs as of 2026-06-08 — the broad "real and capable" shortlist. This is
-- mv_triple_proof_suppliers MINUS the ACNC requirement: the 724 triple-proof orgs are a strict
-- subset, so the app's strongest-badge-wins hierarchy keeps showing them the deeper badge.
-- ACNC is kept as an OPTIONAL signal (LEFT JOIN) — present where it exists, null otherwise — so a
-- justice-proven org that also happens to be a charity still surfaces its governance data.
-- Carries has_alma_evidence_outcomes so the gold "Proven outcomes" tier composes here too.
-- Anchored on gs_entities (registry spine). Refresh registered in scripts/refresh-views-v2.mjs
-- and the pg_cron refresh_civicgraph_mvs() order array (migration 20260608070000).
--
-- Wrapped in a transaction so concurrent readers briefly block, then see the populated MV.

BEGIN;

DROP MATERIALIZED VIEW IF EXISTS mv_justice_proven_suppliers;

CREATE MATERIALIZED VIEW mv_justice_proven_suppliers AS
WITH base AS (
  -- one gs_entity per ABN (guarantees the unique index below for CONCURRENTLY refresh)
  SELECT DISTINCT ON (g.abn)
         g.id AS entity_id, g.gs_id, g.abn, g.canonical_name, g.entity_type, g.state, g.postcode,
         g.sector, g.lga_name, g.is_community_controlled
  FROM gs_entities g
  WHERE g.abn IS NOT NULL
    AND EXISTS (SELECT 1 FROM justice_funding    j WHERE j.recipient_abn = g.abn)
    AND EXISTS (SELECT 1 FROM austender_contracts c WHERE c.supplier_abn  = g.abn)
  ORDER BY g.abn, g.gs_id
),
jf AS (
  SELECT recipient_abn AS abn,
         SUM(amount_dollars)                                          AS justice_dollars,
         COUNT(*)                                                     AS justice_record_count,
         COUNT(DISTINCT program_name)                                 AS distinct_justice_programs,
         array_agg(DISTINCT state) FILTER (WHERE state IS NOT NULL)   AS justice_states
  FROM justice_funding
  WHERE recipient_abn IN (SELECT abn FROM base)
  GROUP BY recipient_abn
),
ct AS (
  SELECT supplier_abn AS abn,
         COUNT(*)                                                     AS contract_count,
         SUM(contract_value)                                          AS contract_value,
         COUNT(DISTINCT buyer_name)                                   AS distinct_buyers,
         MAX(contract_end)                                            AS last_contract_end,
         MIN(contract_start)                                          AS first_contract_start
  FROM austender_contracts
  WHERE supplier_abn IN (SELECT abn FROM base)
  GROUP BY supplier_abn
),
ac AS (
  -- Optional governance signal — NOT a gate. Present only for the orgs that are also charities.
  SELECT DISTINCT ON (abn)
         abn, charity_size, name AS acnc_name, registration_date AS acnc_registered_since
  FROM acnc_charities
  WHERE abn IN (SELECT abn FROM base)
  ORDER BY abn, registration_date NULLS LAST
)
SELECT
  b.gs_id, b.abn, b.canonical_name, b.entity_type, b.state, b.postcode,
  b.sector, b.lga_name, b.is_community_controlled,
  jf.justice_dollars, jf.justice_record_count, jf.distinct_justice_programs, jf.justice_states,
  ct.contract_count, ct.contract_value, ct.distinct_buyers, ct.last_contract_end, ct.first_contract_start,
  ac.charity_size, ac.acnc_name, ac.acnc_registered_since,
  (ac.abn IS NOT NULL)                                            AS has_acnc,
  COALESCE(jf.justice_dollars, 0) + COALESCE(ct.contract_value, 0) AS total_evidence_dollars,
  EXISTS (
    SELECT 1 FROM alma_interventions ai
    WHERE ai.gs_entity_id = b.entity_id
      AND EXISTS (SELECT 1 FROM alma_intervention_evidence e WHERE e.intervention_id = ai.id)
      AND EXISTS (SELECT 1 FROM alma_intervention_outcomes o WHERE o.intervention_id = ai.id)
  ) AS has_alma_evidence_outcomes
FROM base b
LEFT JOIN jf ON jf.abn = b.abn
LEFT JOIN ct ON ct.abn = b.abn
LEFT JOIN ac ON ac.abn = b.abn;

CREATE UNIQUE INDEX mv_justice_proven_suppliers_abn_idx     ON mv_justice_proven_suppliers (abn);
CREATE INDEX        mv_justice_proven_suppliers_gsid_idx    ON mv_justice_proven_suppliers (gs_id);
CREATE INDEX        mv_justice_proven_suppliers_state_idx   ON mv_justice_proven_suppliers (state);
CREATE INDEX        mv_justice_proven_suppliers_dollars_idx ON mv_justice_proven_suppliers (total_evidence_dollars DESC);
CREATE INDEX        mv_justice_proven_suppliers_alma_idx    ON mv_justice_proven_suppliers (has_alma_evidence_outcomes) WHERE has_alma_evidence_outcomes;

COMMIT;
