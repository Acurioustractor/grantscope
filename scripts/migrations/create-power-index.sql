-- create-power-index.sql
-- Cross-system power concentration index
-- Scores each entity by presence across procurement, justice funding,
-- political donations, charity, foundations, ALMA evidence, and ATO transparency.

DROP MATERIALIZED VIEW IF EXISTS mv_entity_power_index CASCADE;

CREATE MATERIALIZED VIEW mv_entity_power_index AS
WITH
-- 1. Procurement (AusTender) — supplier side
procurement AS (
  SELECT ge.id as entity_id,
         COUNT(*) as contract_count,
         COALESCE(SUM(ac.contract_value), 0) as procurement_dollars,
         COUNT(DISTINCT ac.buyer_name) as distinct_buyers,
         array_agg(DISTINCT EXTRACT(YEAR FROM ac.contract_start)::int ORDER BY EXTRACT(YEAR FROM ac.contract_start)::int) FILTER (WHERE ac.contract_start IS NOT NULL) as procurement_years
  FROM austender_contracts ac
  JOIN gs_entities ge ON ge.abn = ac.supplier_abn
  WHERE ac.supplier_abn IS NOT NULL
  GROUP BY ge.id
),

-- 2. Justice / social funding — recipient side
justice AS (
  SELECT gs_entity_id as entity_id,
         COUNT(*) as justice_count,
         COALESCE(SUM(amount_dollars), 0) as justice_dollars,
         COUNT(DISTINCT program_name) as distinct_programs,
         array_agg(DISTINCT state ORDER BY state) FILTER (WHERE state IS NOT NULL) as justice_states
  FROM justice_funding
  WHERE gs_entity_id IS NOT NULL
  GROUP BY gs_entity_id
),

-- 3. Political donations — donor side
donations AS (
  SELECT ge.id as entity_id,
         COUNT(*) as donation_count,
         COALESCE(SUM(pd.amount), 0) as donation_dollars,
         array_agg(DISTINCT pd.donation_to ORDER BY pd.donation_to) FILTER (WHERE pd.donation_to IS NOT NULL) as parties_funded,
         COUNT(DISTINCT pd.donation_to) as distinct_parties
  FROM political_donations pd
  JOIN gs_entities ge ON ge.abn = pd.donor_abn
  WHERE pd.donor_abn IS NOT NULL
  GROUP BY ge.id
),

-- 4. Charity registry (ACNC)
charity AS (
  SELECT ge.id as entity_id,
         ac.charity_size,
         ac.purposes,
         ac.beneficiaries
  FROM acnc_charities ac
  JOIN gs_entities ge ON ge.abn = ac.abn
  WHERE ac.abn IS NOT NULL
),

-- 5. Foundation giving
foundation AS (
  SELECT ge.id as entity_id,
         f.total_giving_annual,
         f.thematic_focus,
         f.geographic_focus
  FROM foundations f
  JOIN gs_entities ge ON ge.abn = f.acnc_abn
  WHERE f.acnc_abn IS NOT NULL
),

-- 6. ALMA evidence
alma AS (
  SELECT gs_entity_id as entity_id,
         COUNT(*) as intervention_count,
         array_agg(DISTINCT type ORDER BY type) FILTER (WHERE type IS NOT NULL) as intervention_types,
         AVG(portfolio_score) as avg_evidence_score
  FROM alma_interventions
  WHERE gs_entity_id IS NOT NULL
  GROUP BY gs_entity_id
),

-- 7. ATO tax transparency
ato AS (
  SELECT ge.id as entity_id,
         att.total_income as ato_total_income,
         att.taxable_income as ato_taxable_income,
         att.tax_payable as ato_tax_payable,
         att.report_year as ato_year
  FROM ato_tax_transparency att
  JOIN gs_entities ge ON ge.abn = att.abn
  WHERE att.abn IS NOT NULL
),

-- 8. Board/directorship connections
boards AS (
  SELECT target_entity_id as entity_id,
         COUNT(*) as board_connections,
         COUNT(DISTINCT source_entity_id) as distinct_directors
  FROM gs_relationships
  WHERE relationship_type IN ('directorship', 'member_of')
  GROUP BY target_entity_id
)

SELECT
  ge.id,
  ge.gs_id,
  ge.canonical_name,
  ge.entity_type,
  ge.abn,
  ge.state,
  ge.postcode,
  ge.remoteness,
  ge.seifa_irsd_decile,
  ge.is_community_controlled,
  ge.lga_name,

  -- System presence flags
  (p.entity_id IS NOT NULL)::int as in_procurement,
  (j.entity_id IS NOT NULL)::int as in_justice_funding,
  (d.entity_id IS NOT NULL)::int as in_political_donations,
  (c.entity_id IS NOT NULL)::int as in_charity_registry,
  (f.entity_id IS NOT NULL)::int as in_foundation,
  (a.entity_id IS NOT NULL)::int as in_alma_evidence,
  (t.entity_id IS NOT NULL)::int as in_ato_transparency,
  (b.entity_id IS NOT NULL)::int as has_board_links,

  -- Power score: number of systems present in
  (p.entity_id IS NOT NULL)::int +
  (j.entity_id IS NOT NULL)::int +
  (d.entity_id IS NOT NULL)::int +
  (c.entity_id IS NOT NULL)::int +
  (f.entity_id IS NOT NULL)::int +
  (a.entity_id IS NOT NULL)::int +
  (t.entity_id IS NOT NULL)::int AS system_count,

  -- Financial aggregates
  COALESCE(p.procurement_dollars, 0) as procurement_dollars,
  COALESCE(j.justice_dollars, 0) as justice_dollars,
  COALESCE(d.donation_dollars, 0) as donation_dollars,
  COALESCE(f.total_giving_annual, 0) as foundation_giving,
  COALESCE(t.ato_total_income, 0) as ato_income,

  COALESCE(p.procurement_dollars, 0) +
  COALESCE(j.justice_dollars, 0) +
  COALESCE(d.donation_dollars, 0) AS total_dollar_flow,

  -- Activity counts
  COALESCE(p.contract_count, 0) as contract_count,
  COALESCE(j.justice_count, 0) as justice_record_count,
  COALESCE(d.donation_count, 0) as donation_count,
  COALESCE(a.intervention_count, 0) as alma_intervention_count,
  COALESCE(b.board_connections, 0) as board_connections,

  -- Network breadth
  COALESCE(p.distinct_buyers, 0) as distinct_govt_buyers,
  COALESCE(j.distinct_programs, 0) as distinct_justice_programs,
  COALESCE(d.distinct_parties, 0) as distinct_parties_funded,
  COALESCE(b.distinct_directors, 0) as distinct_directors,

  -- Enrichment data
  c.charity_size,
  d.parties_funded,
  a.intervention_types as alma_types,
  a.avg_evidence_score,
  j.justice_states,

  -- Composite power score (weighted)
  -- Higher = more cross-system influence
  (
    (p.entity_id IS NOT NULL)::int * 2 +          -- procurement = strong signal
    (j.entity_id IS NOT NULL)::int * 2 +          -- justice funding = strong signal
    (d.entity_id IS NOT NULL)::int * 3 +          -- political donations = strongest signal
    (c.entity_id IS NOT NULL)::int * 1 +          -- charity = base signal
    (f.entity_id IS NOT NULL)::int * 2 +          -- foundation = strong signal
    (a.entity_id IS NOT NULL)::int * 1 +          -- evidence = base signal
    (t.entity_id IS NOT NULL)::int * 1 +          -- ATO = base signal
    LEAST(COALESCE(b.board_connections, 0), 5) +  -- board links capped at 5
    CASE WHEN COALESCE(p.procurement_dollars, 0) > 10000000 THEN 2
         WHEN COALESCE(p.procurement_dollars, 0) > 1000000 THEN 1 ELSE 0 END +
    CASE WHEN COALESCE(d.donation_dollars, 0) > 100000 THEN 2
         WHEN COALESCE(d.donation_dollars, 0) > 10000 THEN 1 ELSE 0 END
  ) AS power_score

FROM gs_entities ge
LEFT JOIN procurement p ON p.entity_id = ge.id
LEFT JOIN justice j ON j.entity_id = ge.id
LEFT JOIN donations d ON d.entity_id = ge.id
LEFT JOIN charity c ON c.entity_id = ge.id
LEFT JOIN foundation f ON f.entity_id = ge.id
LEFT JOIN alma a ON a.entity_id = ge.id
LEFT JOIN (SELECT DISTINCT ON (entity_id) * FROM ato ORDER BY entity_id, ato_year DESC) t ON t.entity_id = ge.id
LEFT JOIN boards b ON b.entity_id = ge.id
WHERE
  -- Only include entities that appear in at least 1 system
  p.entity_id IS NOT NULL
  OR j.entity_id IS NOT NULL
  OR d.entity_id IS NOT NULL
  OR f.entity_id IS NOT NULL
  OR a.entity_id IS NOT NULL
  OR t.entity_id IS NOT NULL;

-- Indexes for fast querying
CREATE INDEX idx_power_index_system_count ON mv_entity_power_index (system_count DESC);
CREATE INDEX idx_power_index_power_score ON mv_entity_power_index (power_score DESC);
CREATE INDEX idx_power_index_entity_type ON mv_entity_power_index (entity_type);
CREATE INDEX idx_power_index_state ON mv_entity_power_index (state);
CREATE INDEX idx_power_index_abn ON mv_entity_power_index (abn);
CREATE INDEX idx_power_index_lga ON mv_entity_power_index (lga_name);
CREATE INDEX idx_power_index_community ON mv_entity_power_index (is_community_controlled) WHERE is_community_controlled = true;
