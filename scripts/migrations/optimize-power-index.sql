-- Optimize mv_entity_power_index for 566K entities + 1.5M relationships scale
-- Key change: build universe of entity_ids from each system FIRST,
-- then only join details for entities that appear in at least one system.
-- This avoids scanning 566K × 9 LEFT JOINs.

BEGIN;

DROP MATERIALIZED VIEW IF EXISTS mv_entity_power_index CASCADE;

CREATE MATERIALIZED VIEW mv_entity_power_index AS
WITH
-- Step 1: Collect entity_ids per system (cheap — just IDs)
procurement_ids AS (
  SELECT DISTINCT e.id AS entity_id
  FROM austender_contracts ac
  JOIN gs_entities e ON e.abn = ac.supplier_abn
  WHERE ac.supplier_abn IS NOT NULL
),
justice_ids AS (
  SELECT DISTINCT gs_entity_id AS entity_id
  FROM justice_funding WHERE gs_entity_id IS NOT NULL
),
donation_ids AS (
  SELECT DISTINCT e.id AS entity_id
  FROM political_donations pd
  JOIN gs_entities e ON e.abn = pd.donor_abn
  WHERE pd.donor_abn IS NOT NULL
),
charity_ids AS (
  SELECT DISTINCT e.id AS entity_id
  FROM acnc_charities ac
  JOIN gs_entities e ON e.abn = ac.abn
  WHERE ac.abn IS NOT NULL
),
foundation_ids AS (
  SELECT DISTINCT e.id AS entity_id
  FROM foundations f
  JOIN gs_entities e ON e.abn = f.acnc_abn
  WHERE f.acnc_abn IS NOT NULL
),
alma_ids AS (
  SELECT DISTINCT gs_entity_id AS entity_id
  FROM alma_interventions WHERE gs_entity_id IS NOT NULL
),
ato_ids AS (
  SELECT DISTINCT e.id AS entity_id
  FROM ato_tax_transparency att
  JOIN gs_entities e ON e.abn = att.abn
  WHERE att.abn IS NOT NULL
),
ndis_ids AS (
  SELECT DISTINCT e.id AS entity_id
  FROM ndis_registered_providers nrp
  JOIN gs_entities e ON e.abn = nrp.abn
  WHERE nrp.abn IS NOT NULL AND nrp.registration_status = 'Approved'
),
-- Step 2: Universe = union of all system entity_ids
universe AS (
  SELECT entity_id FROM procurement_ids
  UNION SELECT entity_id FROM justice_ids
  UNION SELECT entity_id FROM donation_ids
  UNION SELECT entity_id FROM charity_ids
  UNION SELECT entity_id FROM foundation_ids
  UNION SELECT entity_id FROM alma_ids
  UNION SELECT entity_id FROM ato_ids
  UNION SELECT entity_id FROM ndis_ids
),
-- Step 3: Aggregate details only for universe entities
procurement AS (
  SELECT e.id AS entity_id,
    COUNT(*) AS contract_count,
    COALESCE(SUM(ac.contract_value), 0) AS procurement_dollars,
    COUNT(DISTINCT ac.buyer_name) AS distinct_buyers,
    array_agg(DISTINCT EXTRACT(year FROM ac.contract_start)::int ORDER BY EXTRACT(year FROM ac.contract_start)::int)
      FILTER (WHERE ac.contract_start IS NOT NULL) AS procurement_years
  FROM austender_contracts ac
  JOIN gs_entities e ON e.abn = ac.supplier_abn
  WHERE ac.supplier_abn IS NOT NULL
    AND e.id IN (SELECT entity_id FROM universe)
  GROUP BY e.id
),
justice AS (
  SELECT gs_entity_id AS entity_id,
    COUNT(*) AS justice_count,
    COALESCE(SUM(amount_dollars), 0) AS justice_dollars,
    COUNT(DISTINCT program_name) AS distinct_programs,
    array_agg(DISTINCT state ORDER BY state) FILTER (WHERE state IS NOT NULL) AS justice_states
  FROM justice_funding
  WHERE gs_entity_id IS NOT NULL
    AND gs_entity_id IN (SELECT entity_id FROM universe)
  GROUP BY gs_entity_id
),
donations AS (
  SELECT e.id AS entity_id,
    COUNT(*) AS donation_count,
    COALESCE(SUM(pd.amount), 0) AS donation_dollars,
    array_agg(DISTINCT pd.donation_to ORDER BY pd.donation_to)
      FILTER (WHERE pd.donation_to IS NOT NULL) AS parties_funded,
    COUNT(DISTINCT pd.donation_to) AS distinct_parties
  FROM political_donations pd
  JOIN gs_entities e ON e.abn = pd.donor_abn
  WHERE pd.donor_abn IS NOT NULL
    AND e.id IN (SELECT entity_id FROM universe)
  GROUP BY e.id
),
charity AS (
  SELECT e.id AS entity_id,
    ac.charity_size,
    ac.purposes,
    ac.beneficiaries
  FROM acnc_charities ac
  JOIN gs_entities e ON e.abn = ac.abn
  WHERE ac.abn IS NOT NULL
    AND e.id IN (SELECT entity_id FROM universe)
),
foundation AS (
  SELECT e.id AS entity_id,
    f.total_giving_annual,
    f.thematic_focus,
    f.geographic_focus
  FROM foundations f
  JOIN gs_entities e ON e.abn = f.acnc_abn
  WHERE f.acnc_abn IS NOT NULL
    AND e.id IN (SELECT entity_id FROM universe)
),
alma AS (
  SELECT gs_entity_id AS entity_id,
    COUNT(*) AS intervention_count,
    array_agg(DISTINCT type ORDER BY type) FILTER (WHERE type IS NOT NULL) AS intervention_types,
    AVG(portfolio_score) AS avg_evidence_score
  FROM alma_interventions
  WHERE gs_entity_id IS NOT NULL
    AND gs_entity_id IN (SELECT entity_id FROM universe)
  GROUP BY gs_entity_id
),
ato AS (
  SELECT e.id AS entity_id,
    att.total_income AS ato_total_income,
    att.taxable_income AS ato_taxable_income,
    att.tax_payable AS ato_tax_payable,
    att.report_year AS ato_year
  FROM ato_tax_transparency att
  JOIN gs_entities e ON e.abn = att.abn
  WHERE att.abn IS NOT NULL
    AND e.id IN (SELECT entity_id FROM universe)
),
ndis AS (
  SELECT e.id AS entity_id,
    COUNT(DISTINCT nrp.provider_detail_id) AS ndis_provider_count,
    array_agg(DISTINCT nrp.state_code ORDER BY nrp.state_code)
      FILTER (WHERE nrp.state_code IS NOT NULL) AS ndis_states
  FROM ndis_registered_providers nrp
  JOIN gs_entities e ON e.abn = nrp.abn
  WHERE nrp.abn IS NOT NULL AND nrp.registration_status = 'Approved'
    AND e.id IN (SELECT entity_id FROM universe)
  GROUP BY e.id
),
boards AS (
  SELECT target_entity_id AS entity_id,
    COUNT(*) AS board_connections,
    COUNT(DISTINCT source_entity_id) AS distinct_directors
  FROM gs_relationships
  WHERE relationship_type IN ('directorship', 'member_of')
    AND target_entity_id IN (SELECT entity_id FROM universe)
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
  (p.entity_id IS NOT NULL)::int AS in_procurement,
  (j.entity_id IS NOT NULL)::int AS in_justice_funding,
  (d.entity_id IS NOT NULL)::int AS in_political_donations,
  (c.entity_id IS NOT NULL)::int AS in_charity_registry,
  (f.entity_id IS NOT NULL)::int AS in_foundation,
  (a.entity_id IS NOT NULL)::int AS in_alma_evidence,
  (t.entity_id IS NOT NULL)::int AS in_ato_transparency,
  (n.entity_id IS NOT NULL)::int AS in_ndis_provider,
  (b.entity_id IS NOT NULL)::int AS has_board_links,
  -- System count
  (p.entity_id IS NOT NULL)::int + (j.entity_id IS NOT NULL)::int +
  (d.entity_id IS NOT NULL)::int + (c.entity_id IS NOT NULL)::int +
  (f.entity_id IS NOT NULL)::int + (a.entity_id IS NOT NULL)::int +
  (t.entity_id IS NOT NULL)::int + (n.entity_id IS NOT NULL)::int AS system_count,
  -- Dollar flows
  COALESCE(p.procurement_dollars, 0) AS procurement_dollars,
  COALESCE(j.justice_dollars, 0) AS justice_dollars,
  COALESCE(d.donation_dollars, 0) AS donation_dollars,
  COALESCE(f.total_giving_annual, 0) AS foundation_giving,
  COALESCE(t.ato_total_income, 0) AS ato_income,
  COALESCE(p.procurement_dollars, 0) + COALESCE(j.justice_dollars, 0) + COALESCE(d.donation_dollars, 0) AS total_dollar_flow,
  -- Counts
  COALESCE(p.contract_count, 0::bigint) AS contract_count,
  COALESCE(j.justice_count, 0::bigint) AS justice_record_count,
  COALESCE(d.donation_count, 0::bigint) AS donation_count,
  COALESCE(a.intervention_count, 0::bigint) AS alma_intervention_count,
  COALESCE(n.ndis_provider_count, 0::bigint) AS ndis_provider_count,
  COALESCE(b.board_connections, 0::bigint) AS board_connections,
  -- Diversity
  COALESCE(p.distinct_buyers, 0::bigint) AS distinct_govt_buyers,
  COALESCE(j.distinct_programs, 0::bigint) AS distinct_justice_programs,
  COALESCE(d.distinct_parties, 0::bigint) AS distinct_parties_funded,
  COALESCE(b.distinct_directors, 0::bigint) AS distinct_directors,
  -- Enrichment
  c.charity_size,
  d.parties_funded,
  a.intervention_types AS alma_types,
  a.avg_evidence_score,
  j.justice_states,
  n.ndis_states,
  -- Power score
  (p.entity_id IS NOT NULL)::int * 2 + (j.entity_id IS NOT NULL)::int * 2 +
  (d.entity_id IS NOT NULL)::int * 3 + (c.entity_id IS NOT NULL)::int * 1 +
  (f.entity_id IS NOT NULL)::int * 2 + (a.entity_id IS NOT NULL)::int * 1 +
  (t.entity_id IS NOT NULL)::int * 1 + (n.entity_id IS NOT NULL)::int * 2 +
  LEAST(COALESCE(b.board_connections, 0::bigint), 5) +
  CASE WHEN COALESCE(p.procurement_dollars, 0) > 10000000 THEN 2
       WHEN COALESCE(p.procurement_dollars, 0) > 1000000 THEN 1
       ELSE 0 END +
  CASE WHEN COALESCE(d.donation_dollars, 0) > 100000 THEN 2
       WHEN COALESCE(d.donation_dollars, 0) > 10000 THEN 1
       ELSE 0 END AS power_score
FROM universe u
JOIN gs_entities ge ON ge.id = u.entity_id
LEFT JOIN procurement p ON p.entity_id = u.entity_id
LEFT JOIN justice j ON j.entity_id = u.entity_id
LEFT JOIN donations d ON d.entity_id = u.entity_id
LEFT JOIN charity c ON c.entity_id = u.entity_id
LEFT JOIN foundation f ON f.entity_id = u.entity_id
LEFT JOIN alma a ON a.entity_id = u.entity_id
LEFT JOIN LATERAL (
  SELECT ato.entity_id, ato.ato_total_income, ato.ato_taxable_income, ato.ato_tax_payable, ato.ato_year
  FROM ato
  WHERE ato.entity_id = u.entity_id
  ORDER BY ato.ato_year DESC
  LIMIT 1
) t ON true
LEFT JOIN ndis n ON n.entity_id = u.entity_id
LEFT JOIN boards b ON b.entity_id = u.entity_id;

-- Indexes
CREATE UNIQUE INDEX idx_mv_epi_id ON mv_entity_power_index(id);
CREATE INDEX idx_mv_epi_system_count ON mv_entity_power_index(system_count DESC);
CREATE INDEX idx_mv_epi_power_score ON mv_entity_power_index(power_score DESC);
CREATE INDEX idx_mv_epi_entity_type ON mv_entity_power_index(entity_type);
CREATE INDEX idx_mv_epi_abn ON mv_entity_power_index(abn) WHERE abn IS NOT NULL;
CREATE INDEX idx_mv_epi_community ON mv_entity_power_index(is_community_controlled) WHERE is_community_controlled = true;

COMMIT;

-- Recreate mv_funding_deserts (depends on mv_entity_power_index — dropped by CASCADE)
CREATE MATERIALIZED VIEW mv_funding_deserts AS
WITH lga_power AS (
  SELECT lga_name, state,
    COUNT(*) AS entity_count,
    COUNT(*) FILTER (WHERE is_community_controlled) AS community_controlled_count,
    AVG(system_count) AS avg_system_count,
    AVG(power_score) AS avg_power_score,
    MAX(system_count) AS max_system_count,
    SUM(procurement_dollars) AS total_procurement,
    SUM(justice_dollars) AS total_justice,
    SUM(donation_dollars) AS total_donations,
    SUM(total_dollar_flow) AS total_flow,
    COUNT(*) FILTER (WHERE in_procurement = 1) AS procurement_entities,
    COUNT(*) FILTER (WHERE in_justice_funding = 1) AS justice_entities,
    COUNT(*) FILTER (WHERE in_political_donations = 1) AS donation_entities,
    COUNT(*) FILTER (WHERE in_foundation = 1) AS foundation_entities,
    COUNT(*) FILTER (WHERE in_alma_evidence = 1) AS alma_entities,
    COUNT(*) FILTER (WHERE in_ndis_provider = 1) AS ndis_entities,
    COUNT(*) FILTER (WHERE system_count >= 3) AS multi_system_entities
  FROM mv_entity_power_index
  WHERE lga_name IS NOT NULL
  GROUP BY lga_name, state
), lga_disadvantage AS (
  SELECT pg.lga_name, pg.state, pg.remoteness_2021 AS remoteness,
    AVG(s.score) FILTER (WHERE s.index_type = 'IRSD') AS avg_irsd_score,
    MIN(s.decile_national) FILTER (WHERE s.index_type = 'IRSD') AS min_irsd_decile,
    AVG(s.decile_national) FILTER (WHERE s.index_type = 'IRSD') AS avg_irsd_decile,
    COUNT(DISTINCT pg.postcode) AS postcode_count
  FROM postcode_geo pg
  LEFT JOIN seifa_2021 s ON s.postcode = pg.postcode
  WHERE pg.lga_name IS NOT NULL
  GROUP BY pg.lga_name, pg.state, pg.remoteness_2021
), lga_funding AS (
  SELECT lga_name, state, total_funding, entity_count AS funding_entity_count
  FROM mv_funding_by_lga
), ndis_lga AS (
  SELECT replace(regexp_replace(lga_name, '\s*\([A-Za-z]+\)\s*', '', 'g'), '-', ' ') AS lga_name,
    state,
    SUM(participant_count) AS ndis_participants
  FROM ndis_participants_lga
  WHERE quarter_date = (SELECT MAX(quarter_date) FROM ndis_participants_lga)
  GROUP BY replace(regexp_replace(lga_name, '\s*\([A-Za-z]+\)\s*', '', 'g'), '-', ' '), state
), ndis_util AS (
  SELECT state,
    AVG(utilisation_rate) FILTER (WHERE disability_type = 'ALL' AND age_group = 'ALL' AND support_class = 'ALL' AND service_district <> 'ALL') AS avg_utilisation
  FROM ndis_utilisation
  WHERE quarter_date = (SELECT MAX(quarter_date) FROM ndis_utilisation)
  GROUP BY state
)
SELECT
  COALESCE(d.lga_name, p.lga_name) AS lga_name,
  COALESCE(d.state, p.state) AS state,
  d.remoteness,
  d.avg_irsd_score, d.min_irsd_decile, d.avg_irsd_decile, d.postcode_count,
  COALESCE(p.entity_count, 0::bigint) AS indexed_entities,
  COALESCE(p.community_controlled_count, 0::bigint) AS community_controlled_entities,
  COALESCE(p.multi_system_entities, 0::bigint) AS multi_system_entities,
  COALESCE(p.procurement_entities, 0::bigint) AS procurement_entities,
  COALESCE(p.justice_entities, 0::bigint) AS justice_entities,
  COALESCE(p.donation_entities, 0::bigint) AS donation_entities,
  COALESCE(p.foundation_entities, 0::bigint) AS foundation_entities,
  COALESCE(p.alma_entities, 0::bigint) AS alma_entities,
  COALESCE(p.ndis_entities, 0::bigint) AS ndis_entities,
  COALESCE(p.total_procurement, 0) AS procurement_dollars,
  COALESCE(p.total_justice, 0) AS justice_dollars,
  COALESCE(p.total_donations, 0) AS donation_dollars,
  COALESCE(p.total_flow, 0) AS total_dollar_flow,
  COALESCE(f.total_funding, 0) AS total_funding_all_sources,
  COALESCE(p.avg_system_count, 0) AS avg_system_count,
  COALESCE(p.avg_power_score, 0) AS avg_power_score,
  COALESCE(nl.ndis_participants, 0::bigint) AS ndis_participants,
  COALESCE(nu.avg_utilisation, 0) AS ndis_avg_utilisation,
  CASE WHEN d.avg_irsd_decile IS NOT NULL THEN
    round(
      (11 - COALESCE(d.avg_irsd_decile, 5)) * 10 +
      CASE d.remoteness
        WHEN 'Major Cities of Australia' THEN 0
        WHEN 'Inner Regional Australia' THEN 10
        WHEN 'Outer Regional Australia' THEN 20
        WHEN 'Remote Australia' THEN 30
        WHEN 'Very Remote Australia' THEN 40
        ELSE 10
      END +
      CASE
        WHEN COALESCE(p.entity_count, 0::bigint) = 0 THEN 30
        WHEN COALESCE(p.multi_system_entities, 0::bigint) = 0 THEN 20
        WHEN COALESCE(p.avg_system_count, 0) < 1.5 THEN 10
        ELSE 0
      END +
      CASE
        WHEN COALESCE(p.total_flow, 0) = 0 THEN 20
        WHEN COALESCE(p.total_flow, 0) < 1000000 THEN 10
        ELSE 0
      END +
      CASE
        WHEN COALESCE(nl.ndis_participants, 0::bigint) > 0 AND COALESCE(p.ndis_entities, 0::bigint) = 0 THEN 15
        WHEN COALESCE(nl.ndis_participants, 0::bigint) > 1000 AND COALESCE(p.ndis_entities, 0::bigint) < 5 THEN 10
        ELSE 0
      END
    , 1)
  ELSE NULL END AS desert_score
FROM lga_disadvantage d
FULL JOIN lga_power p ON p.lga_name = d.lga_name AND p.state = d.state
LEFT JOIN lga_funding f ON f.lga_name = COALESCE(d.lga_name, p.lga_name) AND f.state = COALESCE(d.state, p.state)
LEFT JOIN ndis_lga nl ON nl.lga_name = COALESCE(d.lga_name, p.lga_name) AND nl.state = COALESCE(d.state, p.state)
LEFT JOIN ndis_util nu ON nu.state = COALESCE(d.state, p.state)
WHERE COALESCE(d.lga_name, p.lga_name) IS NOT NULL;

-- Funding deserts indexes
CREATE UNIQUE INDEX idx_mv_fd_lga_state ON mv_funding_deserts(lga_name, state);
CREATE INDEX idx_mv_fd_desert_score ON mv_funding_deserts(desert_score DESC NULLS LAST);

-- Verify
SELECT 'power_index' as mv, COUNT(*) as rows, MAX(system_count) as max_systems, AVG(power_score)::numeric(5,2) as avg_power
FROM mv_entity_power_index
UNION ALL
SELECT 'funding_deserts', COUNT(*), NULL, AVG(desert_score)::numeric(5,2)
FROM mv_funding_deserts;
