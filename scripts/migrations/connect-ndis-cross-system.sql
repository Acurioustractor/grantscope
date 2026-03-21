-- ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
-- Connect NDIS data to CivicGraph cross-system infrastructure
-- 1. Add NDIS as 8th system in mv_entity_power_index
-- 2. Add NDIS data to mv_funding_deserts
-- 3. Create mv_disability_landscape (cross-system disability intelligence)
-- ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

-- ══════════════════════════════════════════════════════
-- 1. Recreate mv_entity_power_index with NDIS as 8th system
-- ══════════════════════════════════════════════════════

DROP MATERIALIZED VIEW IF EXISTS mv_revolving_door CASCADE;
DROP MATERIALIZED VIEW IF EXISTS mv_funding_deserts CASCADE;
DROP MATERIALIZED VIEW IF EXISTS mv_entity_power_index CASCADE;

CREATE MATERIALIZED VIEW mv_entity_power_index AS
WITH procurement AS (
  SELECT ge.id AS entity_id,
    count(*) AS contract_count,
    COALESCE(sum(ac.contract_value), 0) AS procurement_dollars,
    count(DISTINCT ac.buyer_name) AS distinct_buyers,
    array_agg(DISTINCT EXTRACT(year FROM ac.contract_start)::integer ORDER BY EXTRACT(year FROM ac.contract_start)::integer)
      FILTER (WHERE ac.contract_start IS NOT NULL) AS procurement_years
  FROM austender_contracts ac
  JOIN gs_entities ge ON ge.abn = ac.supplier_abn
  WHERE ac.supplier_abn IS NOT NULL
  GROUP BY ge.id
), justice AS (
  SELECT gs_entity_id AS entity_id,
    count(*) AS justice_count,
    COALESCE(sum(amount_dollars), 0) AS justice_dollars,
    count(DISTINCT program_name) AS distinct_programs,
    array_agg(DISTINCT state ORDER BY state) FILTER (WHERE state IS NOT NULL) AS justice_states
  FROM justice_funding
  WHERE gs_entity_id IS NOT NULL
  GROUP BY gs_entity_id
), donations AS (
  SELECT ge.id AS entity_id,
    count(*) AS donation_count,
    COALESCE(sum(pd.amount), 0) AS donation_dollars,
    array_agg(DISTINCT pd.donation_to ORDER BY pd.donation_to) FILTER (WHERE pd.donation_to IS NOT NULL) AS parties_funded,
    count(DISTINCT pd.donation_to) AS distinct_parties
  FROM political_donations pd
  JOIN gs_entities ge ON ge.abn = pd.donor_abn
  WHERE pd.donor_abn IS NOT NULL
  GROUP BY ge.id
), charity AS (
  SELECT ge.id AS entity_id,
    ac.charity_size, ac.purposes, ac.beneficiaries
  FROM acnc_charities ac
  JOIN gs_entities ge ON ge.abn = ac.abn
  WHERE ac.abn IS NOT NULL
), foundation AS (
  SELECT ge.id AS entity_id,
    f.total_giving_annual, f.thematic_focus, f.geographic_focus
  FROM foundations f
  JOIN gs_entities ge ON ge.abn = f.acnc_abn
  WHERE f.acnc_abn IS NOT NULL
), alma AS (
  SELECT gs_entity_id AS entity_id,
    count(*) AS intervention_count,
    array_agg(DISTINCT type ORDER BY type) FILTER (WHERE type IS NOT NULL) AS intervention_types,
    avg(portfolio_score) AS avg_evidence_score
  FROM alma_interventions
  WHERE gs_entity_id IS NOT NULL
  GROUP BY gs_entity_id
), ato AS (
  SELECT ge.id AS entity_id,
    att.total_income AS ato_total_income,
    att.taxable_income AS ato_taxable_income,
    att.tax_payable AS ato_tax_payable,
    att.report_year AS ato_year
  FROM ato_tax_transparency att
  JOIN gs_entities ge ON ge.abn = att.abn
  WHERE att.abn IS NOT NULL
), boards AS (
  SELECT target_entity_id AS entity_id,
    count(*) AS board_connections,
    count(DISTINCT source_entity_id) AS distinct_directors
  FROM gs_relationships
  WHERE relationship_type IN ('directorship', 'member_of')
  GROUP BY target_entity_id
), ndis AS (
  -- NEW: NDIS registered providers linked via ABN
  SELECT ge.id AS entity_id,
    count(DISTINCT p.provider_detail_id) AS ndis_registrations,
    array_agg(DISTINCT p.state_code ORDER BY p.state_code)
      FILTER (WHERE p.state_code IS NOT NULL) AS ndis_states,
    max(p.report_date) AS ndis_latest_report
  FROM ndis_registered_providers p
  JOIN gs_entities ge ON ge.abn = p.abn
  WHERE p.abn IS NOT NULL
  GROUP BY ge.id
)
SELECT ge.id,
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
  -- System presence flags (now 8 systems)
  (p.entity_id IS NOT NULL)::integer AS in_procurement,
  (j.entity_id IS NOT NULL)::integer AS in_justice_funding,
  (d.entity_id IS NOT NULL)::integer AS in_political_donations,
  (c.entity_id IS NOT NULL)::integer AS in_charity_registry,
  (f.entity_id IS NOT NULL)::integer AS in_foundation,
  (a.entity_id IS NOT NULL)::integer AS in_alma_evidence,
  (t.entity_id IS NOT NULL)::integer AS in_ato_transparency,
  (n.entity_id IS NOT NULL)::integer AS in_ndis_provider,
  (b.entity_id IS NOT NULL)::integer AS has_board_links,
  -- System count (now includes NDIS)
  (p.entity_id IS NOT NULL)::integer
    + (j.entity_id IS NOT NULL)::integer
    + (d.entity_id IS NOT NULL)::integer
    + (c.entity_id IS NOT NULL)::integer
    + (f.entity_id IS NOT NULL)::integer
    + (a.entity_id IS NOT NULL)::integer
    + (t.entity_id IS NOT NULL)::integer
    + (n.entity_id IS NOT NULL)::integer AS system_count,
  -- Dollar flows
  COALESCE(p.procurement_dollars, 0) AS procurement_dollars,
  COALESCE(j.justice_dollars, 0) AS justice_dollars,
  COALESCE(d.donation_dollars, 0) AS donation_dollars,
  COALESCE(f.total_giving_annual, 0) AS foundation_giving,
  COALESCE(t.ato_total_income, 0) AS ato_income,
  COALESCE(p.procurement_dollars, 0) + COALESCE(j.justice_dollars, 0) + COALESCE(d.donation_dollars, 0) AS total_dollar_flow,
  -- Counts
  COALESCE(p.contract_count, 0) AS contract_count,
  COALESCE(j.justice_count, 0) AS justice_record_count,
  COALESCE(d.donation_count, 0) AS donation_count,
  COALESCE(a.intervention_count, 0) AS alma_intervention_count,
  COALESCE(b.board_connections, 0) AS board_connections,
  COALESCE(n.ndis_registrations, 0) AS ndis_registration_count,
  -- Distinct counts
  COALESCE(p.distinct_buyers, 0) AS distinct_govt_buyers,
  COALESCE(j.distinct_programs, 0) AS distinct_justice_programs,
  COALESCE(d.distinct_parties, 0) AS distinct_parties_funded,
  COALESCE(b.distinct_directors, 0) AS distinct_directors,
  -- Detail fields
  c.charity_size,
  d.parties_funded,
  a.intervention_types AS alma_types,
  a.avg_evidence_score,
  j.justice_states,
  n.ndis_states,
  n.ndis_latest_report,
  -- Power score (NDIS adds 1 point)
  (p.entity_id IS NOT NULL)::integer * 2
    + (j.entity_id IS NOT NULL)::integer * 2
    + (d.entity_id IS NOT NULL)::integer * 3
    + (c.entity_id IS NOT NULL)::integer * 1
    + (f.entity_id IS NOT NULL)::integer * 2
    + (a.entity_id IS NOT NULL)::integer * 1
    + (t.entity_id IS NOT NULL)::integer * 1
    + (n.entity_id IS NOT NULL)::integer * 1
    + LEAST(COALESCE(b.board_connections, 0), 5)
    + CASE WHEN COALESCE(p.procurement_dollars, 0) > 10000000 THEN 2
           WHEN COALESCE(p.procurement_dollars, 0) > 1000000 THEN 1 ELSE 0 END
    + CASE WHEN COALESCE(d.donation_dollars, 0) > 100000 THEN 2
           WHEN COALESCE(d.donation_dollars, 0) > 10000 THEN 1 ELSE 0 END
    AS power_score
FROM gs_entities ge
  LEFT JOIN procurement p ON p.entity_id = ge.id
  LEFT JOIN justice j ON j.entity_id = ge.id
  LEFT JOIN donations d ON d.entity_id = ge.id
  LEFT JOIN charity c ON c.entity_id = ge.id
  LEFT JOIN foundation f ON f.entity_id = ge.id
  LEFT JOIN alma a ON a.entity_id = ge.id
  LEFT JOIN (
    SELECT DISTINCT ON (entity_id) entity_id, ato_total_income, ato_taxable_income, ato_tax_payable, ato_year
    FROM ato ORDER BY entity_id, ato_year DESC
  ) t ON t.entity_id = ge.id
  LEFT JOIN boards b ON b.entity_id = ge.id
  LEFT JOIN ndis n ON n.entity_id = ge.id
WHERE p.entity_id IS NOT NULL
   OR j.entity_id IS NOT NULL
   OR d.entity_id IS NOT NULL
   OR f.entity_id IS NOT NULL
   OR a.entity_id IS NOT NULL
   OR t.entity_id IS NOT NULL
   OR n.entity_id IS NOT NULL;

-- Indexes for power index
CREATE INDEX idx_power_index_gs_id ON mv_entity_power_index(gs_id);
CREATE INDEX idx_power_index_abn ON mv_entity_power_index(abn);
CREATE INDEX idx_power_index_state ON mv_entity_power_index(state);
CREATE INDEX idx_power_index_lga ON mv_entity_power_index(lga_name);
CREATE INDEX idx_power_index_system_count ON mv_entity_power_index(system_count DESC);
CREATE INDEX idx_power_index_power_score ON mv_entity_power_index(power_score DESC);
CREATE INDEX idx_power_index_ndis ON mv_entity_power_index(in_ndis_provider) WHERE in_ndis_provider = 1;


-- ══════════════════════════════════════════════════════
-- 2. Recreate mv_funding_deserts with NDIS data
-- ══════════════════════════════════════════════════════

CREATE MATERIALIZED VIEW mv_funding_deserts AS
WITH lga_power AS (
  SELECT lga_name, state,
    count(*) AS entity_count,
    count(*) FILTER (WHERE is_community_controlled) AS community_controlled_count,
    avg(system_count) AS avg_system_count,
    avg(power_score) AS avg_power_score,
    max(system_count) AS max_system_count,
    sum(procurement_dollars) AS total_procurement,
    sum(justice_dollars) AS total_justice,
    sum(donation_dollars) AS total_donations,
    sum(total_dollar_flow) AS total_flow,
    count(*) FILTER (WHERE in_procurement = 1) AS procurement_entities,
    count(*) FILTER (WHERE in_justice_funding = 1) AS justice_entities,
    count(*) FILTER (WHERE in_political_donations = 1) AS donation_entities,
    count(*) FILTER (WHERE in_foundation = 1) AS foundation_entities,
    count(*) FILTER (WHERE in_alma_evidence = 1) AS alma_entities,
    count(*) FILTER (WHERE in_ndis_provider = 1) AS ndis_entities,
    count(*) FILTER (WHERE system_count >= 3) AS multi_system_entities
  FROM mv_entity_power_index
  WHERE lga_name IS NOT NULL
  GROUP BY lga_name, state
), lga_disadvantage AS (
  SELECT pg.lga_name, pg.state, pg.remoteness_2021 AS remoteness,
    avg(s.score) FILTER (WHERE s.index_type = 'IRSD') AS avg_irsd_score,
    min(s.decile_national) FILTER (WHERE s.index_type = 'IRSD') AS min_irsd_decile,
    avg(s.decile_national) FILTER (WHERE s.index_type = 'IRSD') AS avg_irsd_decile,
    count(DISTINCT pg.postcode) AS postcode_count
  FROM postcode_geo pg
  LEFT JOIN seifa_2021 s ON s.postcode = pg.postcode
  WHERE pg.lga_name IS NOT NULL
  GROUP BY pg.lga_name, pg.state, pg.remoteness_2021
), lga_funding AS (
  SELECT lga_name, state, total_funding, entity_count AS funding_entity_count
  FROM mv_funding_by_lga
), ndis_lga AS (
  -- NDIS participant counts per LGA (latest quarter)
  SELECT lga_name, state,
    SUM(participant_count) AS ndis_participants
  FROM ndis_participants_lga
  WHERE quarter_date = (SELECT MAX(quarter_date) FROM ndis_participants_lga)
  GROUP BY lga_name, state
), ndis_util AS (
  -- NDIS utilisation by state (latest quarter, all categories)
  SELECT state,
    AVG(utilisation_rate) FILTER (WHERE disability_type = 'ALL' AND age_group = 'ALL' AND support_class = 'ALL') AS avg_utilisation
  FROM ndis_utilisation
  WHERE quarter_date = (SELECT MAX(quarter_date) FROM ndis_utilisation)
    AND service_district != 'ALL'
  GROUP BY state
)
SELECT COALESCE(d.lga_name, p.lga_name) AS lga_name,
  COALESCE(d.state, p.state) AS state,
  d.remoteness,
  d.avg_irsd_score,
  d.min_irsd_decile,
  d.avg_irsd_decile,
  d.postcode_count,
  COALESCE(p.entity_count, 0) AS indexed_entities,
  COALESCE(p.community_controlled_count, 0) AS community_controlled_entities,
  COALESCE(p.multi_system_entities, 0) AS multi_system_entities,
  COALESCE(p.procurement_entities, 0) AS procurement_entities,
  COALESCE(p.justice_entities, 0) AS justice_entities,
  COALESCE(p.donation_entities, 0) AS donation_entities,
  COALESCE(p.foundation_entities, 0) AS foundation_entities,
  COALESCE(p.alma_entities, 0) AS alma_entities,
  COALESCE(p.ndis_entities, 0) AS ndis_entities,
  COALESCE(p.total_procurement, 0) AS procurement_dollars,
  COALESCE(p.total_justice, 0) AS justice_dollars,
  COALESCE(p.total_donations, 0) AS donation_dollars,
  COALESCE(p.total_flow, 0) AS total_dollar_flow,
  COALESCE(f.total_funding, 0) AS total_funding_all_sources,
  COALESCE(p.avg_system_count, 0) AS avg_system_count,
  COALESCE(p.avg_power_score, 0) AS avg_power_score,
  -- NEW: NDIS columns
  COALESCE(nl.ndis_participants, 0) AS ndis_participants,
  COALESCE(nu.avg_utilisation, 0) AS ndis_avg_utilisation,
  -- Desert score (now includes NDIS thin market signal)
  CASE WHEN d.avg_irsd_decile IS NOT NULL THEN
    round(
      (11 - COALESCE(d.avg_irsd_decile, 5)) * 10
      + CASE d.remoteness
          WHEN 'Major Cities of Australia' THEN 0
          WHEN 'Inner Regional Australia' THEN 10
          WHEN 'Outer Regional Australia' THEN 20
          WHEN 'Remote Australia' THEN 30
          WHEN 'Very Remote Australia' THEN 40
          ELSE 10
        END
      + CASE
          WHEN COALESCE(p.entity_count, 0) = 0 THEN 30
          WHEN COALESCE(p.multi_system_entities, 0) = 0 THEN 20
          WHEN COALESCE(p.avg_system_count, 0) < 1.5 THEN 10
          ELSE 0
        END
      + CASE
          WHEN COALESCE(p.total_flow, 0) = 0 THEN 20
          WHEN COALESCE(p.total_flow, 0) < 1000000 THEN 10
          ELSE 0
        END
      -- NEW: NDIS thin market penalty (no providers in an LGA with participants = red flag)
      + CASE
          WHEN COALESCE(nl.ndis_participants, 0) > 0 AND COALESCE(p.ndis_entities, 0) = 0 THEN 15
          WHEN COALESCE(nl.ndis_participants, 0) > 1000 AND COALESCE(p.ndis_entities, 0) < 5 THEN 10
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

CREATE INDEX idx_funding_deserts_state ON mv_funding_deserts(state);
CREATE INDEX idx_funding_deserts_score ON mv_funding_deserts(desert_score DESC NULLS LAST);
CREATE INDEX idx_funding_deserts_lga ON mv_funding_deserts(lga_name);


-- ══════════════════════════════════════════════════════
-- 3. Recreate mv_revolving_door (depends on power index)
-- ══════════════════════════════════════════════════════

CREATE MATERIALIZED VIEW mv_revolving_door AS
SELECT id, gs_id, canonical_name, entity_type, abn, state, remoteness,
  is_community_controlled, lga_name,
  in_procurement, in_justice_funding, in_political_donations,
  in_charity_registry, in_foundation, in_ato_transparency,
  in_ndis_provider,
  system_count, power_score,
  procurement_dollars, justice_dollars, donation_dollars, total_dollar_flow,
  contract_count, justice_record_count, donation_count,
  distinct_govt_buyers, distinct_parties_funded,
  -- Revolving door score: entities with 2+ influence vectors
  (in_procurement + in_political_donations + in_foundation
    + CASE WHEN donation_dollars > 50000 THEN 1 ELSE 0 END
    + CASE WHEN contract_count > 10 THEN 1 ELSE 0 END
  ) AS revolving_door_score
FROM mv_entity_power_index
WHERE (in_procurement + in_political_donations + in_foundation) >= 2
ORDER BY power_score DESC;

CREATE INDEX idx_revolving_door_score ON mv_revolving_door(revolving_door_score DESC);
CREATE INDEX idx_revolving_door_state ON mv_revolving_door(state);


-- ══════════════════════════════════════════════════════
-- 4. Create mv_disability_landscape — cross-system disability intelligence
-- ══════════════════════════════════════════════════════

DROP MATERIALIZED VIEW IF EXISTS mv_disability_landscape CASCADE;
CREATE MATERIALIZED VIEW mv_disability_landscape AS
WITH ndis_by_lga AS (
  -- Latest NDIS participant counts per LGA
  SELECT lga_name, state,
    SUM(participant_count) AS ndis_participants,
    COUNT(*) AS lga_entries
  FROM ndis_participants_lga
  WHERE quarter_date = (SELECT MAX(quarter_date) FROM ndis_participants_lga)
  GROUP BY lga_name, state
), ndis_prov_by_state AS (
  -- NDIS registered providers per state
  SELECT state_code AS state,
    COUNT(DISTINCT abn) AS registered_providers,
    COUNT(DISTINCT provider_detail_id) AS registration_count
  FROM ndis_registered_providers
  GROUP BY state_code
), disability_entities AS (
  -- Entities in CivicGraph that are NDIS providers (via ABN match)
  SELECT ge.lga_name, ge.state,
    COUNT(*) AS civicgraph_disability_entities,
    COUNT(*) FILTER (WHERE ge.is_community_controlled) AS community_controlled_disability,
    SUM(CASE WHEN pi.in_justice_funding = 1 THEN 1 ELSE 0 END) AS also_in_justice,
    SUM(CASE WHEN pi.in_procurement = 1 THEN 1 ELSE 0 END) AS also_in_procurement,
    AVG(pi.system_count) AS avg_system_count
  FROM gs_entities ge
  JOIN ndis_registered_providers nrp ON nrp.abn = ge.abn
  LEFT JOIN mv_entity_power_index pi ON pi.id = ge.id
  WHERE ge.lga_name IS NOT NULL
  GROUP BY ge.lga_name, ge.state
), utilisation_by_state AS (
  -- Utilisation rates by state (latest quarter)
  SELECT state,
    AVG(utilisation_rate) FILTER (WHERE disability_type = 'ALL' AND age_group = 'ALL' AND support_class = 'ALL' AND service_district != 'ALL') AS overall_utilisation,
    MIN(utilisation_rate) FILTER (WHERE disability_type = 'ALL' AND age_group = 'ALL' AND support_class = 'ALL' AND service_district != 'ALL') AS min_utilisation,
    MAX(utilisation_rate) FILTER (WHERE disability_type = 'ALL' AND age_group = 'ALL' AND support_class = 'ALL' AND service_district != 'ALL') AS max_utilisation
  FROM ndis_utilisation
  WHERE quarter_date = (SELECT MAX(quarter_date) FROM ndis_utilisation)
  GROUP BY state
), first_nations_by_state AS (
  -- First Nations NDIS data by state (latest quarter)
  SELECT state,
    SUM(participant_count) FILTER (WHERE remoteness = 'All') AS fn_total_participants,
    SUM(participant_count) FILTER (WHERE remoteness = 'Very Remote') AS fn_very_remote_participants,
    AVG(avg_annualised_support) FILTER (WHERE remoteness = 'All') AS fn_avg_budget,
    AVG(avg_annualised_support) FILTER (WHERE remoteness = 'Very Remote') AS fn_very_remote_avg_budget
  FROM ndis_first_nations
  WHERE quarter_date = (SELECT MAX(quarter_date) FROM ndis_first_nations)
  GROUP BY state
), alma_disability AS (
  -- ALMA interventions relevant to disability
  SELECT COALESCE(ge.lga_name, 'Unknown') AS lga_name,
    COALESCE(ge.state, 'Unknown') AS state,
    COUNT(*) AS disability_interventions,
    COUNT(*) FILTER (WHERE ai.type = 'Wraparound Support') AS wraparound_interventions,
    COUNT(*) FILTER (WHERE ai.type = 'Community-Led') AS community_led_interventions,
    AVG(ai.portfolio_score) AS avg_evidence_score
  FROM alma_interventions ai
  LEFT JOIN gs_entities ge ON ge.id = ai.gs_entity_id
  WHERE ai.topics @> ARRAY['ndis']
     OR ai.name ILIKE '%disab%'
     OR ai.description ILIKE '%disab%'
     OR ai.target_cohort::text ILIKE '%disab%'
  GROUP BY COALESCE(ge.lga_name, 'Unknown'), COALESCE(ge.state, 'Unknown')
), desert AS (
  SELECT lga_name, state, remoteness, desert_score, avg_irsd_decile
  FROM mv_funding_deserts
)
SELECT
  COALESCE(n.lga_name, de.lga_name, ds.lga_name) AS lga_name,
  COALESCE(n.state, de.state, ds.state) AS state,
  ds.remoteness,
  ds.desert_score,
  ds.avg_irsd_decile,
  -- NDIS participants
  COALESCE(n.ndis_participants, 0) AS ndis_participants,
  -- Provider coverage
  COALESCE(de.civicgraph_disability_entities, 0) AS disability_entities,
  COALESCE(de.community_controlled_disability, 0) AS community_controlled_disability,
  COALESCE(de.also_in_justice, 0) AS cross_system_justice,
  COALESCE(de.also_in_procurement, 0) AS cross_system_procurement,
  COALESCE(de.avg_system_count, 0) AS avg_entity_system_count,
  -- Utilisation (state-level, joined to LGA)
  COALESCE(u.overall_utilisation, 0) AS state_avg_utilisation,
  COALESCE(u.min_utilisation, 0) AS state_min_utilisation,
  -- First Nations (state-level)
  COALESCE(fn.fn_total_participants, 0) AS fn_ndis_participants,
  COALESCE(fn.fn_very_remote_participants, 0) AS fn_very_remote_participants,
  COALESCE(fn.fn_avg_budget, 0) AS fn_avg_budget,
  COALESCE(fn.fn_very_remote_avg_budget, 0) AS fn_very_remote_avg_budget,
  -- ALMA evidence
  COALESCE(al.disability_interventions, 0) AS alma_disability_interventions,
  COALESCE(al.avg_evidence_score, 0) AS alma_avg_evidence_score,
  -- Thin market indicator
  CASE
    WHEN COALESCE(n.ndis_participants, 0) > 0 AND COALESCE(de.civicgraph_disability_entities, 0) = 0
      THEN 'CRITICAL'
    WHEN COALESCE(n.ndis_participants, 0) > 500 AND COALESCE(de.civicgraph_disability_entities, 0) < 3
      THEN 'SEVERE'
    WHEN COALESCE(n.ndis_participants, 0) > 100 AND COALESCE(de.civicgraph_disability_entities, 0) < 5
      THEN 'MODERATE'
    WHEN COALESCE(n.ndis_participants, 0) > 0
      THEN 'ADEQUATE'
    ELSE 'NO_DATA'
  END AS thin_market_status,
  -- Participants per provider ratio (higher = thinner market)
  CASE WHEN COALESCE(de.civicgraph_disability_entities, 0) > 0
    THEN round(COALESCE(n.ndis_participants, 0)::numeric / de.civicgraph_disability_entities, 1)
    ELSE NULL
  END AS participants_per_provider
FROM ndis_by_lga n
  FULL JOIN disability_entities de ON de.lga_name = n.lga_name AND de.state = n.state
  LEFT JOIN desert ds ON ds.lga_name = COALESCE(n.lga_name, de.lga_name) AND ds.state = COALESCE(n.state, de.state)
  LEFT JOIN utilisation_by_state u ON u.state = COALESCE(n.state, de.state)
  LEFT JOIN first_nations_by_state fn ON fn.state = COALESCE(n.state, de.state)
  LEFT JOIN alma_disability al ON al.lga_name = COALESCE(n.lga_name, de.lga_name) AND al.state = COALESCE(n.state, de.state)
WHERE COALESCE(n.lga_name, de.lga_name) IS NOT NULL;

CREATE INDEX idx_disability_landscape_state ON mv_disability_landscape(state);
CREATE INDEX idx_disability_landscape_thin ON mv_disability_landscape(thin_market_status);
CREATE INDEX idx_disability_landscape_lga ON mv_disability_landscape(lga_name);
