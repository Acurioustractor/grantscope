-- OP4 — Financial-health signal on justice-funded ACNC charities.
-- Joins justice_funding recipients to their latest ACNC Annual Information Statement (AIS)
-- financials, computes a small set of transparent solvency/runway ratios, and assigns a
-- fragility tier. Serves G3 (delivery orgs). Wedge: supply-magnet / mission.
--
-- DATA-QUALITY GATES (verified 2026-06-09 against the 3,996 justice-funded charities with AIS):
--   * revenue / expenses / net-result / net-assets / govt-revenue ≈ 96–100% coverage.
--   * balance-sheet split (current assets/liabilities) only ≈ 49% — cash-basis & small-charity
--     filers report no balance sheet. So `current_ratio`/`low_liquidity` are NULL when the source
--     fields are absent — NEVER inferred false. A charity is not "liquid" because it didn't file
--     a balance sheet.
--   * Each row carries `ais_year` so the UI can caveat stale filings (91% are 2023+).
--
-- One row per justice-funded ABN that has at least one AIS. Latest AIS year wins.

DROP MATERIALIZED VIEW IF EXISTS mv_justice_charity_financial_health CASCADE;

CREATE MATERIALIZED VIEW mv_justice_charity_financial_health AS
WITH justice_abns AS (
  SELECT DISTINCT recipient_abn AS abn
  FROM justice_funding
  WHERE recipient_abn IS NOT NULL AND recipient_abn <> ''
),
latest_ais AS (
  SELECT DISTINCT ON (a.abn)
    a.abn,
    a.ais_year,
    a.charity_name,
    a.charity_size,
    a.total_revenue,
    a.total_expenses,
    a.net_surplus_deficit,
    a.total_current_assets,
    a.total_current_liabilities,
    a.net_assets_liabilities,
    a.revenue_from_government
  FROM acnc_ais a
  JOIN justice_abns j ON j.abn = a.abn
  ORDER BY a.abn, a.ais_year DESC, a.date_ais_received DESC NULLS LAST
),
computed AS (
  SELECT
    l.*,
    -- Surplus margin: how much of income is retained (negative = running at a loss).
    CASE WHEN l.total_revenue > 0
      THEN round(l.net_surplus_deficit / l.total_revenue, 4) END AS operating_margin,
    -- Current ratio: short-term assets vs short-term obligations (<1 = can't cover).
    -- NULL when the filer reported no balance-sheet split (≈51% of cases).
    CASE WHEN l.total_current_liabilities > 0
      THEN round(l.total_current_assets / l.total_current_liabilities, 4) END AS current_ratio,
    -- Reserves runway: months of total operating cost covered by net assets.
    -- Only when net assets are non-negative (negative equity is its own fragile trigger).
    CASE WHEN l.total_expenses > 0 AND l.net_assets_liabilities >= 0
      THEN round(l.net_assets_liabilities / (l.total_expenses / 12.0), 2) END AS months_of_reserves,
    -- Government-revenue concentration (these orgs are govt-funded by definition; tracked
    -- as a separate concentration signal, NOT folded into the fragility tier).
    CASE WHEN l.total_revenue > 0 AND l.revenue_from_government IS NOT NULL
      THEN round(l.revenue_from_government / l.total_revenue, 4) END AS govt_revenue_share
  FROM latest_ais l
)
SELECT
  c.abn,
  c.charity_name,
  c.charity_size,
  c.ais_year,
  c.total_revenue,
  c.total_expenses,
  c.net_surplus_deficit,
  c.total_current_assets,
  c.total_current_liabilities,
  c.net_assets_liabilities,
  c.revenue_from_government,
  c.operating_margin,
  c.current_ratio,
  c.months_of_reserves,
  c.govt_revenue_share,
  -- Risk flags. NULL = not assessable from filed data; never an inferred false.
  (c.net_surplus_deficit < 0)                                          AS is_deficit,
  (c.net_assets_liabilities < 0)                                       AS net_assets_negative,
  CASE WHEN c.current_ratio IS NOT NULL
    THEN c.current_ratio < 1.0 END                                     AS low_liquidity,
  CASE WHEN c.months_of_reserves IS NOT NULL
    THEN c.months_of_reserves < 3 END                                  AS low_reserves,
  CASE WHEN c.govt_revenue_share IS NOT NULL
    THEN c.govt_revenue_share > 0.75 END                               AS high_govt_dependency,
  -- Fragility tier — a transparent rule where the RESERVES RUNWAY is the master solvency
  -- signal (96% coverage) and liquidity only refines it. Strong reserves override a weak
  -- current ratio: a large asset-rich org (e.g. a university) with 20+ months of reserves
  -- but a sub-1 current ratio is a balance-sheet-structure artifact, NOT fragility. Each row
  -- also exposes the raw flags so the UI can show WHY. 'unknown' = no usable income/expense.
  CASE
    WHEN c.total_revenue IS NULL OR c.total_revenue <= 0 THEN 'unknown'
    -- Insolvency or no meaningful buffer at all.
    WHEN c.net_assets_liabilities < 0 THEN 'fragile'
    WHEN c.months_of_reserves IS NOT NULL AND c.months_of_reserves < 1 THEN 'fragile'
    -- Thin buffer (<3 months) AND bleeding or illiquid.
    WHEN c.months_of_reserves IS NOT NULL AND c.months_of_reserves < 3
      AND (c.net_surplus_deficit < 0 OR c.current_ratio < 1.0) THEN 'fragile'
    -- Reserves unknown but two independent red flags (deficit + illiquid).
    WHEN c.months_of_reserves IS NULL AND c.net_surplus_deficit < 0
      AND c.current_ratio IS NOT NULL AND c.current_ratio < 1.0 THEN 'fragile'
    -- Single yellow flag, still-limited resilience → watch.
    WHEN c.net_surplus_deficit < 0 THEN 'watch'
    WHEN c.months_of_reserves IS NOT NULL AND c.months_of_reserves < 3 THEN 'watch'
    WHEN c.current_ratio IS NOT NULL AND c.current_ratio < 1.0
      AND (c.months_of_reserves IS NULL OR c.months_of_reserves < 6) THEN 'watch'
    ELSE 'healthy'
  END AS fragility_tier
FROM computed c;

-- Unique index on abn enables CONCURRENTLY refresh + fast per-profile lookup.
CREATE UNIQUE INDEX mv_justice_charity_financial_health_abn_idx
  ON mv_justice_charity_financial_health (abn);
CREATE INDEX mv_justice_charity_financial_health_tier_idx
  ON mv_justice_charity_financial_health (fragility_tier);

COMMENT ON MATERIALIZED VIEW mv_justice_charity_financial_health IS
  'OP4: latest ACNC AIS financial-health signal for justice-funded charities. Fragility tier + raw flags. Liquidity NULL when no balance sheet filed (never inferred). Supply-magnet/mission lens — capacity signal, not a buyer warning.';
