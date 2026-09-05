-- OP7 (leverage map) — Triple-proof suppliers: the premium buyer shortlist.
--
-- One row per org (by ABN) carrying THREE independent proof signals at once:
--   1. Justice/community domain delivery   (justice_funding.recipient_abn)
--   2. A won federal contract               (austender_contracts.supplier_abn)
--   3. ACNC charity governance/longevity    (acnc_charities.abn)
--
-- 724 orgs as of 2026-06-08. This is the deepest "real, capable, well-governed" evidence the
-- estate can assemble on a single supplier — the wedge's #1 asset (evidence depth > row count).
-- Anchored on gs_entities (all 724 are present there) so canonical name/place/sector come from
-- the registry spine. Refresh registered in scripts/refresh-views-v2.mjs.

DROP MATERIALIZED VIEW IF EXISTS mv_triple_proof_suppliers;

CREATE MATERIALIZED VIEW mv_triple_proof_suppliers AS
WITH base AS (
  -- one gs_entity per ABN (guarantees the unique index below for CONCURRENTLY refresh)
  SELECT DISTINCT ON (g.abn)
         g.gs_id, g.abn, g.canonical_name, g.entity_type, g.state, g.postcode,
         g.sector, g.lga_name, g.is_community_controlled
  FROM gs_entities g
  WHERE g.abn IS NOT NULL
    AND EXISTS (SELECT 1 FROM justice_funding    j WHERE j.recipient_abn = g.abn)
    AND EXISTS (SELECT 1 FROM austender_contracts c WHERE c.supplier_abn  = g.abn)
    AND EXISTS (SELECT 1 FROM acnc_charities      a WHERE a.abn           = g.abn)
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
  COALESCE(jf.justice_dollars, 0) + COALESCE(ct.contract_value, 0) AS total_evidence_dollars
FROM base b
LEFT JOIN jf ON jf.abn = b.abn
LEFT JOIN ct ON ct.abn = b.abn
LEFT JOIN ac ON ac.abn = b.abn;

CREATE UNIQUE INDEX mv_triple_proof_suppliers_abn_idx   ON mv_triple_proof_suppliers (abn);
CREATE INDEX        mv_triple_proof_suppliers_gsid_idx  ON mv_triple_proof_suppliers (gs_id);
CREATE INDEX        mv_triple_proof_suppliers_state_idx ON mv_triple_proof_suppliers (state);
CREATE INDEX        mv_triple_proof_suppliers_dollars_idx ON mv_triple_proof_suppliers (total_evidence_dollars DESC);
