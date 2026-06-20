-- Goods Command Center — Funder Funding-History overlay.
--
-- For every entity-linked Goods relationship, surface the counterpart's real
-- funding footprint from data we already hold, in two clearly-separated
-- directions:
--
--   MONEY OUT — what this funder actually funds / gives
--     • foundations.total_giving_annual   — annual grantmaking (+ avg grant, themes, geo)
--     • political_donations (donor side)   — political giving (labelled distinctly)
--
--   MONEY IN — what this counterpart has received
--     • justice_funding (recipient)        — government justice money received
--     • austender_contracts (supplier)     — procurement revenue
--
-- Why: the warmth map says who we know; this says what they fund. A funder's
-- giving scale + themes is the single best read on fit and ask-size; a
-- counterpart's money-in flags a peer recipient (a partner to co-apply with)
-- rather than a grantmaker. Turns the "who could match this grant" question
-- into evidence instead of memory.
--
-- Directionality verified over the 88 ABN-linked relationships (2026-06-20):
--   foundations.gs_entity_id       66/88   (giver — richest signal)
--   austender_contracts.supplier   27/88   (recipient)
--   justice_funding.gs_entity_id   11/88   (recipient)
--   political_donations.donor_abn  10/88   (giver — political)
--
-- Join chain: goods_relationships.entity_id = gs_entities.id, then by the uuid
-- FK where the source carries one (foundations.gs_entity_id,
-- justice_funding.gs_entity_id) or by ABN (gs_entities.abn = donor_abn /
-- supplier_abn). Preferring the gs_entity_id FK avoids ABN-format mismatch.
--
-- Each source is pre-aggregated to ONE row per entity BEFORE the join, so the
-- relationship spine never fans out. A VIEW (not materialized): request-time,
-- always current, tiny once filtered to entity-linked relationships with a
-- signal. Read by goods-relationship-funding.ts.

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
  -- keep only relationships that actually carry a funding signal
  fnd.entity_id IS NOT NULL
  OR jf.entity_id IS NOT NULL
  OR pol.abn IS NOT NULL
  OR aus.abn IS NOT NULL;

COMMENT ON VIEW v_goods_relationship_funding IS
  'Funder funding-history overlay on Goods relationships: MONEY OUT (foundations.total_giving_annual grantmaking + political_donations donor giving) and MONEY IN (justice_funding + austender_contracts received), each pre-aggregated per entity and joined on entity_id/abn. Only rows with a funding signal. Read by goods-relationship-funding.ts.';
