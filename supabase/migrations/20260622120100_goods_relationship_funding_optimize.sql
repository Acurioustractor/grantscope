-- Goods Command Center — fix Funding chips timing out on buyer cards.
--
-- BUG: v_goods_relationship_funding aggregated its ENTIRE source tables
-- (political_donations ~312K, austender_contracts ~770K, justice_funding ~150K,
-- foundations ~10.8K) into the pol/aus/jf/fnd CTEs, producing tens of thousands
-- of groups, THEN LEFT JOIN-ed down to the ~117 entity-linked Goods relationships.
-- Postgres can't push the 117-row filter into the independent CTEs, so the view
-- took ~14.2s — over PostgREST's ~8s statement timeout. goods-relationship-funding.ts
-- therefore got "canceling statement due to statement timeout" and FundingChip
-- rendered blank on /org/[slug]/goods/buyers (separate from, and unmasked by, the
-- 20260622120000 GRANT fix that lit up the Power chips).
--
-- FIX: restrict each aggregation CTE to only the entity_ids / ABNs present in the
-- 117-row `ent` spine BEFORE aggregating (semi-join into ent). Only those keys
-- survive the join anyway, so SUM/COUNT/MAX per surviving key are byte-for-byte
-- identical. Verified parity (2026-06-22): both variants return 95 rows,
-- gives Σ=$2,878,571,847.00, receives Σ=$2,057,939,589.63. Execution time:
-- 14,182ms -> 648ms (~22x), now index-driven over ~105 keys. No materialization;
-- still a request-time, always-current VIEW.

CREATE OR REPLACE VIEW v_goods_relationship_funding AS
WITH ent AS (
  SELECT
    gr.id                               AS rel_id,
    gr.entity_id,
    gr.display_name,
    gr.relationship_type,
    COALESCE(gr.warmth_display, 0)::int AS warmth_display,
    NULLIF(e.abn, '')                   AS abn
  FROM goods_relationships gr
  JOIN gs_entities e ON e.id = gr.entity_id
  WHERE gr.entity_id IS NOT NULL
),

-- MONEY OUT — grantmaking. One row per entity: the primary (largest-giving)
-- foundation record, so a counterpart with multiple foundation rows can't fan out.
fnd AS (
  SELECT DISTINCT ON (f.gs_entity_id)
    f.gs_entity_id        AS entity_id,
    f.total_giving_annual AS foundation_giving_annual,
    f.avg_grant_size      AS foundation_avg_grant,
    f.thematic_focus      AS foundation_themes,
    f.geographic_focus    AS foundation_geo
  FROM foundations f
  WHERE f.gs_entity_id IS NOT NULL
    AND f.gs_entity_id IN (SELECT entity_id FROM ent)
  ORDER BY f.gs_entity_id, f.total_giving_annual DESC NULLS LAST
),

-- MONEY OUT — political giving (donor side, by ABN).
pol AS (
  SELECT
    donor_abn           AS abn,
    SUM(amount)         AS political_total,
    COUNT(*)            AS political_count,
    MAX(financial_year) AS political_latest_fy
  FROM political_donations
  WHERE donor_abn IS NOT NULL AND donor_abn <> ''
    AND donor_abn IN (SELECT abn FROM ent WHERE abn IS NOT NULL)
  GROUP BY donor_abn
),

-- MONEY IN — justice funding received (recipient; prefer the gs_entity_id FK).
jf AS (
  SELECT
    gs_entity_id                 AS entity_id,
    SUM(amount_dollars)          AS justice_total,
    COUNT(DISTINCT program_name) AS justice_program_count,
    MAX(financial_year)          AS justice_latest_fy
  FROM justice_funding
  WHERE gs_entity_id IS NOT NULL
    AND gs_entity_id IN (SELECT entity_id FROM ent)
  GROUP BY gs_entity_id
),

-- MONEY IN — procurement revenue (supplier side, by ABN).
aus AS (
  SELECT
    supplier_abn        AS abn,
    SUM(contract_value) AS austender_total,
    COUNT(*)            AS austender_contract_count,
    MAX(contract_start) AS austender_latest
  FROM austender_contracts
  WHERE supplier_abn IS NOT NULL AND supplier_abn <> ''
    AND supplier_abn IN (SELECT abn FROM ent WHERE abn IS NOT NULL)
  GROUP BY supplier_abn
)

SELECT
  ent.rel_id,
  ent.entity_id,
  ent.display_name,
  ent.relationship_type,
  ent.warmth_display,
  ent.abn,

  -- money out (gives)
  fnd.foundation_giving_annual,
  fnd.foundation_avg_grant,
  fnd.foundation_themes,
  fnd.foundation_geo,
  pol.political_total,
  pol.political_count,
  pol.political_latest_fy,

  -- money in (receives)
  jf.justice_total,
  jf.justice_program_count,
  jf.justice_latest_fy,
  aus.austender_total,
  aus.austender_contract_count,
  aus.austender_latest,

  -- rollups
  (COALESCE(fnd.foundation_giving_annual, 0) + COALESCE(pol.political_total, 0)) AS gives_total,
  (COALESCE(jf.justice_total, 0) + COALESCE(aus.austender_total, 0))             AS receives_total

FROM ent
LEFT JOIN fnd ON fnd.entity_id = ent.entity_id
LEFT JOIN jf  ON jf.entity_id  = ent.entity_id
LEFT JOIN pol ON pol.abn       = ent.abn
LEFT JOIN aus ON aus.abn       = ent.abn
WHERE
  fnd.entity_id IS NOT NULL
  OR jf.entity_id IS NOT NULL
  OR pol.abn IS NOT NULL
  OR aus.abn IS NOT NULL;

COMMENT ON VIEW v_goods_relationship_funding IS
  'Funder funding-history overlay on Goods relationships: MONEY OUT (foundations.total_giving_annual grantmaking + political_donations donor giving) and MONEY IN (justice_funding + austender_contracts received), each pre-aggregated per entity (semi-joined to the Goods relationship spine for speed) and joined on entity_id/abn. Only rows with a funding signal. Read by goods-relationship-funding.ts.';

-- Re-assert read grants so this migration is correct on a fresh DB too
-- (CREATE OR REPLACE preserves existing grants; a from-scratch create would not).
GRANT SELECT ON public.v_goods_relationship_funding TO anon, authenticated, service_role;
