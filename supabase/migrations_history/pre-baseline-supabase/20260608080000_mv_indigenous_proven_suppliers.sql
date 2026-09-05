-- OP1 (leverage map) — Proven Indigenous suppliers: the Indigenous-procurement buyer evidence tier.
--
-- One row per org (by ABN) carrying TWO independent proof signals at once:
--   1. A registered Indigenous corporation  (oric_corporations, status='Registered')
--   2. A won federal contract                (austender_contracts.supplier_abn)
--
-- ~301 orgs as of 2026-06-08 — the G4∩G1 "best quadrant": verified Indigenous-controlled supply with a
-- proven government delivery record, exactly the evidence a buyer with Indigenous Procurement Policy (IPP)
-- targets needs. This is an ORTHOGONAL axis to the OP3 justice hierarchy (domain = Indigenous registration,
-- not justice funding) — 92 of these orgs are ALSO justice-proven and correctly carry both badges.
--
-- DEREGISTERED corps are excluded: of the 325 ORIC corps with a federal contract, 25 are deregistered.
-- The contract is real history, but a buyer SHORTLIST must not recommend a wound-up corporation, so the
-- MV is scoped to status='Registered' — the defensible "still-operating, Indigenous-controlled" set.
--
-- Carries has_alma_evidence_outcomes so the gold "Proven outcomes" tier composes here too (mirrors OP3).
-- Anchored on gs_entities (registry spine). Refresh registered in scripts/refresh-views-v2.mjs and the
-- pg_cron refresh_civicgraph_mvs() order array (migration 20260608090000).
--
-- Wrapped in a transaction so concurrent readers briefly block, then see the populated MV.

BEGIN;

DROP MATERIALIZED VIEW IF EXISTS mv_indigenous_proven_suppliers;

CREATE MATERIALIZED VIEW mv_indigenous_proven_suppliers AS
WITH oric AS (
  -- one ACTIVE (Registered) ORIC corporation per ABN. Prefer the most-recently-registered row when an
  -- ABN maps to multiple ICNs (one ABN has both a Registered and a Deregistered corp — Registered wins).
  SELECT DISTINCT ON (o.abn)
         o.abn,
         o.icn               AS oric_icn,
         o.name              AS oric_name,
         o.status            AS oric_status,
         o.corporation_size,
         o.registered_on     AS oric_registered_on,
         o.industry_sectors
  FROM oric_corporations o
  WHERE o.abn IS NOT NULL
    AND o.status = 'Registered'
  ORDER BY o.abn, o.registered_on DESC NULLS LAST
),
base AS (
  -- one gs_entity per ABN (guarantees the unique index below for CONCURRENTLY refresh)
  SELECT DISTINCT ON (g.abn)
         g.id AS entity_id, g.gs_id, g.abn, g.canonical_name, g.entity_type, g.state, g.postcode,
         g.sector, g.lga_name, g.is_community_controlled
  FROM gs_entities g
  WHERE g.abn IS NOT NULL
    AND g.abn IN (SELECT abn FROM oric)
    AND EXISTS (SELECT 1 FROM austender_contracts c WHERE c.supplier_abn = g.abn)
  ORDER BY g.abn, g.gs_id
),
ct AS (
  SELECT supplier_abn AS abn,
         COUNT(*)                   AS contract_count,
         SUM(contract_value)        AS contract_value,
         COUNT(DISTINCT buyer_name) AS distinct_buyers,
         MAX(contract_end)          AS last_contract_end,
         MIN(contract_start)        AS first_contract_start
  FROM austender_contracts
  WHERE supplier_abn IN (SELECT abn FROM base)
  GROUP BY supplier_abn
)
SELECT
  b.gs_id, b.abn, b.canonical_name, b.entity_type, b.state, b.postcode,
  b.sector, b.lga_name, b.is_community_controlled,
  o.oric_icn, o.oric_name, o.oric_status, o.corporation_size, o.oric_registered_on, o.industry_sectors,
  ct.contract_count, ct.contract_value, ct.distinct_buyers, ct.last_contract_end, ct.first_contract_start,
  COALESCE(ct.contract_value, 0) AS total_evidence_dollars,
  EXISTS (
    SELECT 1 FROM alma_interventions ai
    WHERE ai.gs_entity_id = b.entity_id
      AND EXISTS (SELECT 1 FROM alma_intervention_evidence e WHERE e.intervention_id = ai.id)
      AND EXISTS (SELECT 1 FROM alma_intervention_outcomes ao WHERE ao.intervention_id = ai.id)
  ) AS has_alma_evidence_outcomes
FROM base b
JOIN oric o ON o.abn = b.abn
LEFT JOIN ct ON ct.abn = b.abn;

CREATE UNIQUE INDEX mv_indigenous_proven_suppliers_abn_idx     ON mv_indigenous_proven_suppliers (abn);
CREATE INDEX        mv_indigenous_proven_suppliers_gsid_idx    ON mv_indigenous_proven_suppliers (gs_id);
CREATE INDEX        mv_indigenous_proven_suppliers_state_idx   ON mv_indigenous_proven_suppliers (state);
CREATE INDEX        mv_indigenous_proven_suppliers_dollars_idx ON mv_indigenous_proven_suppliers (total_evidence_dollars DESC);
CREATE INDEX        mv_indigenous_proven_suppliers_alma_idx    ON mv_indigenous_proven_suppliers (has_alma_evidence_outcomes) WHERE has_alma_evidence_outcomes;

COMMIT;
