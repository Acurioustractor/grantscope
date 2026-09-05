-- Youth Justice Unified Data Model
-- Connects: spending → outcomes → entities → locations → interventions
-- Enables: "Who gets the money, what outcomes, where, and does it work?"

-- 1. Unified state-level youth justice dashboard view
-- Joins ROGS spending, outcomes, CtG targets, and facility data per state per year
CREATE OR REPLACE VIEW v_youth_justice_state_dashboard AS
WITH spending AS (
  SELECT
    financial_year,
    'detention' AS service,
    nsw, vic, qld, wa, sa, tas, act, nt, aust
  FROM rogs_justice_spending
  WHERE rogs_table = '17A.10'
    AND rogs_section = 'youth_justice'
    AND description3 = 'Total expenditure'
    AND unit = '$''000'
),
cost_per_detention AS (
  SELECT
    financial_year,
    nsw, vic, qld, wa, sa, tas, act, nt, aust
  FROM rogs_justice_spending
  WHERE rogs_table = '17A.20'
    AND rogs_section = 'youth_justice'
    AND unit = '$'
),
recidivism AS (
  SELECT
    financial_year,
    nsw, vic, qld, wa, sa, tas, act, nt, aust
  FROM rogs_justice_spending
  WHERE rogs_table = '17A.26'
    AND rogs_section = 'youth_justice'
    AND unit = '%'
),
completion AS (
  SELECT
    financial_year,
    nsw, vic, qld, wa, sa, tas, act, nt, aust
  FROM rogs_justice_spending
  WHERE rogs_table = '17A.25'
    AND rogs_section = 'youth_justice'
    AND unit = '%'
    AND description2 = 'Proportion of orders'
),
indigenous_rate AS (
  SELECT
    financial_year,
    nsw, vic, qld, wa, sa, tas, act, nt, aust
  FROM rogs_justice_spending
  WHERE rogs_table = '17A.7'
    AND rogs_section = 'youth_justice'
    AND description2 = 'Rate ratio'
    AND unit = 'ratio'
),
ctg_detention AS (
  SELECT
    financial_year,
    description3 AS data_type, -- 'Trajectory' or actual
    nsw, vic, qld, wa, sa, tas, act, nt, aust
  FROM rogs_justice_spending
  WHERE rogs_table = 'CtG11A.1'
    AND rogs_section = 'closing-the-gap'
    AND unit = 'rate'
    AND indigenous_status ILIKE '%Aboriginal%'
    AND description2 ILIKE '%Rate per 10000%'
),
facilities AS (
  SELECT
    state,
    COUNT(*) FILTER (WHERE operational_status = 'operational') AS facility_count,
    SUM(capacity_beds) FILTER (WHERE operational_status = 'operational') AS total_beds,
    AVG(indigenous_population_percentage) FILTER (WHERE operational_status = 'operational') AS avg_indigenous_pct
  FROM youth_detention_facilities
  GROUP BY state
)
SELECT
  s.financial_year,
  -- Unnest to rows per state
  state.abbrev AS state,
  -- Spending ($'000 → $M)
  CASE state.abbrev
    WHEN 'NSW' THEN s.nsw WHEN 'VIC' THEN s.vic WHEN 'QLD' THEN s.qld
    WHEN 'WA' THEN s.wa WHEN 'SA' THEN s.sa WHEN 'TAS' THEN s.tas
    WHEN 'ACT' THEN s.act WHEN 'NT' THEN s.nt
  END / 1000.0 AS total_expenditure_m,
  -- Cost per detention day
  CASE state.abbrev
    WHEN 'NSW' THEN cpd.nsw WHEN 'VIC' THEN cpd.vic WHEN 'QLD' THEN cpd.qld
    WHEN 'WA' THEN cpd.wa WHEN 'SA' THEN cpd.sa WHEN 'TAS' THEN cpd.tas
    WHEN 'ACT' THEN cpd.act WHEN 'NT' THEN cpd.nt
  END AS cost_per_detention,
  -- Recidivism %
  CASE state.abbrev
    WHEN 'NSW' THEN r.nsw WHEN 'VIC' THEN r.vic WHEN 'QLD' THEN r.qld
    WHEN 'WA' THEN r.wa WHEN 'SA' THEN r.sa WHEN 'TAS' THEN r.tas
    WHEN 'ACT' THEN r.act WHEN 'NT' THEN r.nt
  END AS recidivism_pct,
  -- Community order completion %
  CASE state.abbrev
    WHEN 'NSW' THEN c.nsw WHEN 'VIC' THEN c.vic WHEN 'QLD' THEN c.qld
    WHEN 'WA' THEN c.wa WHEN 'SA' THEN c.sa WHEN 'TAS' THEN c.tas
    WHEN 'ACT' THEN c.act WHEN 'NT' THEN c.nt
  END AS completion_pct,
  -- Indigenous overrepresentation ratio
  CASE state.abbrev
    WHEN 'NSW' THEN ir.nsw WHEN 'VIC' THEN ir.vic WHEN 'QLD' THEN ir.qld
    WHEN 'WA' THEN ir.wa WHEN 'SA' THEN ir.sa WHEN 'TAS' THEN ir.tas
    WHEN 'ACT' THEN ir.act WHEN 'NT' THEN ir.nt
  END AS indigenous_rate_ratio,
  -- Facility data
  f.facility_count,
  f.total_beds,
  f.avg_indigenous_pct AS facility_indigenous_pct
FROM spending s
CROSS JOIN (VALUES ('NSW'),('VIC'),('QLD'),('WA'),('SA'),('TAS'),('ACT'),('NT')) AS state(abbrev)
LEFT JOIN cost_per_detention cpd ON cpd.financial_year = s.financial_year
LEFT JOIN recidivism r ON r.financial_year = s.financial_year
LEFT JOIN completion c ON c.financial_year = s.financial_year
LEFT JOIN indigenous_rate ir ON ir.financial_year = s.financial_year
LEFT JOIN facilities f ON f.state = state.abbrev
ORDER BY s.financial_year DESC, state.abbrev;

-- 2. Youth justice entity roster: orgs that receive YJ funding or deliver YJ services
-- Materialized for performance (100K+ entities, lateral joins too slow)
DROP MATERIALIZED VIEW IF EXISTS mv_youth_justice_entities;
CREATE MATERIALIZED VIEW mv_youth_justice_entities AS
WITH yj_funding AS (
  SELECT
    gs_entity_id,
    SUM(amount_dollars) AS justice_funding_total,
    COUNT(*) AS justice_grant_count
  FROM justice_funding
  WHERE gs_entity_id IS NOT NULL
    AND (sector ILIKE '%youth%' OR sector ILIKE '%justice%'
         OR program_name ILIKE '%youth%' OR program_name ILIKE '%juvenile%')
  GROUP BY gs_entity_id
),
yj_contracts AS (
  SELECT
    e.id AS entity_id,
    SUM(c.contract_value) AS contract_total,
    COUNT(*) AS contract_count
  FROM austender_contracts c
  JOIN gs_entities e ON e.abn = c.supplier_abn AND e.abn IS NOT NULL
  WHERE c.title ILIKE '%youth justice%' OR c.title ILIKE '%juvenile%'
     OR c.title ILIKE '%young offend%' OR c.title ILIKE '%youth detention%'
  GROUP BY e.id
),
yj_alma AS (
  SELECT
    gs_entity_id,
    COUNT(*) AS intervention_count,
    ARRAY_AGG(DISTINCT evidence_level) AS evidence_levels,
    AVG(cost_per_young_person) AS avg_cost_per_person
  FROM alma_interventions
  WHERE gs_entity_id IS NOT NULL AND serves_youth_justice = true
  GROUP BY gs_entity_id
),
yj_entity_ids AS (
  SELECT gs_entity_id AS id FROM yj_funding
  UNION
  SELECT entity_id FROM yj_contracts
  UNION
  SELECT gs_entity_id FROM yj_alma
)
SELECT
  e.id,
  e.gs_id,
  e.canonical_name,
  e.abn,
  e.entity_type,
  e.sector,
  e.state,
  e.postcode,
  e.remoteness,
  e.lga_name,
  e.is_community_controlled,
  COALESCE(jf.justice_funding_total, 0) AS justice_funding_total,
  COALESCE(jf.justice_grant_count, 0) AS justice_grant_count,
  COALESCE(ac.contract_total, 0) AS contract_total,
  COALESCE(ac.contract_count, 0) AS contract_count,
  COALESCE(alma.intervention_count, 0) AS alma_intervention_count,
  alma.evidence_levels,
  alma.avg_cost_per_person,
  (jf.justice_funding_total IS NOT NULL) AS has_justice_funding,
  (ac.contract_total IS NOT NULL) AS has_yj_contracts,
  (alma.intervention_count IS NOT NULL) AS has_alma_interventions
FROM yj_entity_ids ids
JOIN gs_entities e ON e.id = ids.id
LEFT JOIN yj_funding jf ON jf.gs_entity_id = e.id
LEFT JOIN yj_contracts ac ON ac.entity_id = e.id
LEFT JOIN yj_alma alma ON alma.gs_entity_id = e.id;

CREATE UNIQUE INDEX ON mv_youth_justice_entities (id);

-- 3. Closing the Gap progress tracker
-- Shows actual Indigenous detention rates vs trajectory targets by state
CREATE OR REPLACE VIEW v_ctg_youth_justice_progress AS
SELECT
  a.financial_year,
  state.abbrev AS state,
  CASE state.abbrev
    WHEN 'NSW' THEN a.nsw WHEN 'VIC' THEN a.vic WHEN 'QLD' THEN a.qld
    WHEN 'WA' THEN a.wa WHEN 'SA' THEN a.sa WHEN 'TAS' THEN a.tas
    WHEN 'ACT' THEN a.act WHEN 'NT' THEN a.nt
  END AS actual_rate,
  CASE state.abbrev
    WHEN 'NSW' THEN t.nsw WHEN 'VIC' THEN t.vic WHEN 'QLD' THEN t.qld
    WHEN 'WA' THEN t.wa WHEN 'SA' THEN t.sa WHEN 'TAS' THEN t.tas
    WHEN 'ACT' THEN t.act WHEN 'NT' THEN t.nt
  END AS trajectory_rate,
  t.aust AS national_target,
  a.aust AS national_actual,
  -- Gap: positive = behind target (bad), negative = ahead (good)
  CASE state.abbrev
    WHEN 'NSW' THEN a.nsw - COALESCE(t.nsw, 0)
    WHEN 'VIC' THEN a.vic - COALESCE(t.vic, 0)
    WHEN 'QLD' THEN a.qld - COALESCE(t.qld, 0)
    WHEN 'WA' THEN a.wa - COALESCE(t.wa, 0)
    WHEN 'SA' THEN a.sa - COALESCE(t.sa, 0)
    WHEN 'TAS' THEN a.tas - COALESCE(t.tas, 0)
    WHEN 'ACT' THEN a.act - COALESCE(t.act, 0)
    WHEN 'NT' THEN a.nt - COALESCE(t.nt, 0)
  END AS gap_from_target
FROM rogs_justice_spending a
CROSS JOIN (VALUES ('NSW'),('VIC'),('QLD'),('WA'),('SA'),('TAS'),('ACT'),('NT')) AS state(abbrev)
LEFT JOIN rogs_justice_spending t
  ON t.financial_year = a.financial_year
  AND t.rogs_table = 'CtG11A.1'
  AND t.rogs_section = 'closing-the-gap'
  AND t.description3 = 'Trajectory'
WHERE a.rogs_table = 'CtG11A.1'
  AND a.rogs_section = 'closing-the-gap'
  AND a.description3 IS DISTINCT FROM 'Trajectory'
  AND a.description3 IS DISTINCT FROM 'Linear regression estimates'
  AND a.unit = 'rate'
  AND a.indigenous_status ILIKE '%Aboriginal%'
ORDER BY a.financial_year DESC, state.abbrev;

COMMENT ON VIEW v_youth_justice_state_dashboard IS 'Unified youth justice metrics per state per year: spending, cost per detention, recidivism, completion, Indigenous overrepresentation, facility data';
COMMENT ON VIEW v_youth_justice_entities IS 'Organizations receiving youth justice funding, contracts, or delivering ALMA interventions';
COMMENT ON VIEW v_ctg_youth_justice_progress IS 'Closing the Gap Outcome 11 progress: actual Indigenous detention rates vs trajectory targets';
