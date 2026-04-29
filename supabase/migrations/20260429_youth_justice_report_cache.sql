-- Fast report cache for /reports/youth-justice.
-- These materialized views keep the public report instant while still being
-- generated from live CivicGraph tables.

CREATE MATERIALIZED VIEW IF NOT EXISTS mv_yj_report_alma_interventions AS
SELECT
  row_number() OVER (ORDER BY ai.portfolio_score DESC NULLS LAST, ai.name) AS snapshot_rank,
  ai.name,
  ai.type,
  ai.evidence_level,
  ai.geography::text AS geography,
  ai.portfolio_score::float AS portfolio_score,
  e.gs_id,
  e.canonical_name AS org_name,
  e.abn AS org_abn
FROM alma_interventions ai
LEFT JOIN gs_entities e ON e.id = ai.gs_entity_id
WHERE ai.topics @> ARRAY['youth-justice']::text[]
WITH NO DATA;

CREATE INDEX IF NOT EXISTS idx_mv_yj_report_alma_interventions_rank
  ON mv_yj_report_alma_interventions(snapshot_rank);

CREATE MATERIALIZED VIEW IF NOT EXISTS mv_yj_report_alma_type_counts AS
SELECT COALESCE(type, 'Uncategorised') AS type, COUNT(*)::int AS count
FROM alma_interventions
WHERE topics @> ARRAY['youth-justice']::text[]
GROUP BY COALESCE(type, 'Uncategorised')
WITH NO DATA;

CREATE INDEX IF NOT EXISTS idx_mv_yj_report_alma_type_counts_count
  ON mv_yj_report_alma_type_counts(count DESC);

CREATE MATERIALIZED VIEW IF NOT EXISTS mv_yj_report_recipients AS
SELECT
  jf.recipient_name,
  jf.state,
  ge.gs_id,
  SUM(jf.amount_dollars)::bigint AS total,
  COUNT(*)::int AS grants
FROM justice_funding jf
LEFT JOIN gs_entities ge ON ge.id = jf.gs_entity_id
WHERE jf.topics @> ARRAY['youth-justice']::text[]
  AND jf.source NOT IN ('austender-direct')
  AND jf.program_name NOT LIKE 'ROGS%'
GROUP BY jf.recipient_name, jf.state, ge.gs_id
WITH NO DATA;

CREATE INDEX IF NOT EXISTS idx_mv_yj_report_recipients_total
  ON mv_yj_report_recipients(total DESC NULLS LAST);

CREATE MATERIALIZED VIEW IF NOT EXISTS mv_yj_report_contracts AS
SELECT
  row_number() OVER (ORDER BY ac.contract_value DESC NULLS LAST, ac.title) AS snapshot_rank,
  ac.buyer_name,
  ac.supplier_name,
  ac.contract_value::bigint AS amount,
  EXTRACT(YEAR FROM ac.contract_start)::int AS year,
  ac.title
FROM austender_contracts ac
WHERE ac.title ILIKE '%youth%justice%'
   OR ac.title ILIKE '%juvenile%detention%'
   OR ac.title ILIKE '%youth%detention%'
WITH NO DATA;

CREATE INDEX IF NOT EXISTS idx_mv_yj_report_contracts_rank
  ON mv_yj_report_contracts(snapshot_rank);

CREATE MATERIALIZED VIEW IF NOT EXISTS mv_yj_report_heatmap AS
WITH alma_by_lga AS (
  SELECT ge.lga_name, COUNT(*)::int AS alma_count
  FROM alma_interventions ai
  JOIN gs_entities ge ON ge.id = ai.gs_entity_id
  WHERE ai.topics @> ARRAY['youth-justice']::text[]
    AND ge.lga_name IS NOT NULL
  GROUP BY ge.lga_name
)
SELECT
  l.lga_name,
  l.state,
  COALESCE(l.population, 0)::int AS population,
  COALESCE(l.low_icsea_schools, 0)::int AS low_icsea,
  COALESCE(l.avg_icsea, 0)::int AS avg_icsea,
  COALESCE(l.school_count, 0)::int AS schools,
  COALESCE(l.indigenous_pct, 0)::float AS indigenous_pct,
  CASE WHEN l.population > 0 THEN ROUND(l.dsp_recipients::numeric / l.population * 1000) ELSE 0 END::int AS dsp_rate,
  CASE WHEN l.population > 0 THEN ROUND(l.jobseeker_recipients::numeric / l.population * 1000) ELSE 0 END::int AS jobseeker_rate,
  CASE WHEN l.population > 0 THEN ROUND(l.youth_allowance_recipients::numeric / l.population * 1000) ELSE 0 END::int AS youth_allowance_rate,
  COALESCE(l.cost_per_detention_day, 0)::int AS cost_per_day,
  l.recidivism_pct::int AS recidivism_pct,
  COALESCE(l.indigenous_rate_ratio, 0)::float AS indigenous_rate_ratio,
  COALESCE(l.detention_indigenous_pct, 0)::int AS detention_indigenous_pct,
  CASE WHEN l.population > 0 THEN ROUND(l.ndis_youth_participants::numeric / l.population * 1000) ELSE 0 END::int AS ndis_rate,
  COALESCE(l.crime_rate_per_100k, 0)::int AS crime_rate,
  COALESCE(a.alma_count, 0)::int AS alma_count
FROM lga_cross_system_stats l
LEFT JOIN alma_by_lga a ON a.lga_name = l.lga_name
WHERE l.school_count > 0 OR l.dsp_recipients > 0 OR l.ndis_youth_participants > 0
WITH NO DATA;

CREATE INDEX IF NOT EXISTS idx_mv_yj_report_heatmap_lga
  ON mv_yj_report_heatmap(lga_name, state);

DROP MATERIALIZED VIEW IF EXISTS mv_yj_report_acco_gap;

CREATE MATERIALIZED VIEW mv_yj_report_acco_gap AS
SELECT
  CASE
    WHEN ge.is_community_controlled THEN 'Community Controlled'
    ELSE 'Other service providers'
  END AS org_type,
  COUNT(DISTINCT jf.recipient_name)::int AS orgs,
  SUM(jf.amount_dollars)::bigint AS total_funding,
  ROUND(SUM(jf.amount_dollars) / NULLIF(COUNT(DISTINCT jf.recipient_name), 0))::bigint AS avg_per_recipient,
  ROUND(AVG(jf.amount_dollars))::bigint AS avg_grant,
  COUNT(*)::int AS funding_rows,
  ROUND(
    SUM(jf.amount_dollars)::numeric
    / NULLIF(SUM(SUM(jf.amount_dollars)) OVER (), 0)
    * 100,
    1
  )::float AS funding_share_pct
FROM justice_funding jf
JOIN gs_entities ge ON ge.id = jf.gs_entity_id
WHERE jf.topics @> ARRAY['youth-justice']::text[]
  AND jf.source NOT IN ('austender-direct')
  AND jf.amount_dollars IS NOT NULL
  AND jf.amount_dollars > 0
  AND jf.recipient_name IS NOT NULL
  AND jf.recipient_name <> ''
  AND jf.recipient_name <> 'Total'
  AND jf.recipient_name !~* '^(Department of|Dept |Queensland Government|NSW Government|Victorian Government|Government of|State of|Commonwealth Government)'
  AND jf.recipient_name NOT IN (
    'Territory Families, Housing and Communities',
    'Community Services Directorate'
  )
  AND jf.program_name NOT LIKE 'ROGS%'
  AND jf.program_name NOT LIKE 'Total%'
GROUP BY CASE WHEN ge.is_community_controlled THEN 'Community Controlled' ELSE 'Other service providers' END
WITH NO DATA;

CREATE MATERIALIZED VIEW IF NOT EXISTS mv_yj_report_remoteness AS
SELECT
  ge.remoteness,
  COUNT(DISTINCT jf.recipient_name)::int AS orgs,
  SUM(jf.amount_dollars)::bigint AS total,
  COUNT(*)::int AS grants
FROM justice_funding jf
JOIN gs_entities ge ON ge.id = jf.gs_entity_id
WHERE jf.topics @> ARRAY['youth-justice']::text[]
  AND jf.source NOT IN ('austender-direct')
  AND jf.program_name NOT LIKE 'ROGS%'
  AND jf.program_name NOT LIKE 'Total%'
  AND ge.remoteness IS NOT NULL
GROUP BY ge.remoteness
WITH NO DATA;

CREATE INDEX IF NOT EXISTS idx_mv_yj_report_remoteness_total
  ON mv_yj_report_remoteness(total DESC);

CREATE MATERIALIZED VIEW IF NOT EXISTS mv_yj_report_state_programs AS
WITH provider_rows AS (
  SELECT jf.*
  FROM justice_funding jf
  WHERE jf.topics @> ARRAY['youth-justice']::text[]
    AND jf.source NOT IN ('austender-direct')
    AND jf.amount_dollars IS NOT NULL
    AND jf.amount_dollars > 0
    AND jf.state IS NOT NULL
    AND jf.program_name NOT LIKE 'ROGS%'
    AND jf.program_name NOT LIKE 'Total%'
    AND jf.program_name NOT LIKE 'Government real%'
    AND jf.program_name NOT LIKE 'Cost per%'
    AND jf.program_name NOT LIKE 'Net capital%'
    AND jf.program_name NOT LIKE 'Real recurrent%'
    AND jf.recipient_name IS NOT NULL
    AND jf.recipient_name <> ''
    AND jf.recipient_name <> 'Total'
    AND jf.recipient_name NOT LIKE 'Youth Justice -%'
    AND jf.recipient_name NOT LIKE 'Department of%'
    AND jf.recipient_name NOT LIKE 'State of%'
    AND jf.recipient_name NOT LIKE 'Multiple%'
    AND jf.recipient_name NOT IN ('Territory Families, Housing and Communities', 'Community Services Directorate')
)
SELECT
  state,
  program_name,
  COUNT(*)::int AS grants,
  SUM(amount_dollars)::bigint AS total,
  COUNT(DISTINCT recipient_name)::int AS orgs
FROM provider_rows
GROUP BY state, program_name
WITH NO DATA;

CREATE INDEX IF NOT EXISTS idx_mv_yj_report_state_programs_state_total
  ON mv_yj_report_state_programs(state, total DESC NULLS LAST);

DROP MATERIALIZED VIEW IF EXISTS mv_yj_report_state_program_partners;

CREATE MATERIALIZED VIEW mv_yj_report_state_program_partners AS
WITH provider_rows AS (
  SELECT jf.*
  FROM justice_funding jf
  WHERE jf.topics @> ARRAY['youth-justice']::text[]
    AND jf.source NOT IN ('austender-direct')
    AND jf.amount_dollars IS NOT NULL
    AND jf.amount_dollars > 0
    AND jf.state IS NOT NULL
    AND jf.program_name NOT LIKE 'ROGS%'
    AND jf.program_name NOT LIKE 'Total%'
    AND jf.program_name NOT LIKE 'Government real%'
    AND jf.program_name NOT LIKE 'Cost per%'
    AND jf.program_name NOT LIKE 'Net capital%'
    AND jf.program_name NOT LIKE 'Real recurrent%'
    AND jf.recipient_name IS NOT NULL
    AND jf.recipient_name <> ''
    AND jf.recipient_name <> 'Total'
    AND jf.recipient_name NOT LIKE 'Youth Justice -%'
    AND jf.recipient_name NOT LIKE 'Department of%'
    AND jf.recipient_name NOT LIKE 'State of%'
    AND jf.recipient_name NOT LIKE 'Multiple%'
    AND jf.recipient_name NOT IN ('Territory Families, Housing and Communities', 'Community Services Directorate')
),
ranked AS (
  SELECT
    jf.state,
    jf.program_name,
    jf.recipient_name,
    jf.recipient_abn,
    SUM(jf.amount_dollars)::bigint AS total,
    COUNT(*)::int AS grants,
    COALESCE(linked.gs_id, by_abn.gs_id) AS gs_id,
    COALESCE(linked.is_community_controlled, by_abn.is_community_controlled, false) AS is_community_controlled,
    ROW_NUMBER() OVER (
      PARTITION BY jf.state, jf.program_name
      ORDER BY SUM(jf.amount_dollars) DESC NULLS LAST, jf.recipient_name
    ) AS rn
  FROM provider_rows jf
  LEFT JOIN gs_entities linked ON linked.id = jf.gs_entity_id
  LEFT JOIN LATERAL (
    SELECT gs_id, is_community_controlled
    FROM gs_entities
    WHERE abn = jf.recipient_abn
    ORDER BY source_count DESC NULLS LAST
    LIMIT 1
  ) by_abn ON jf.recipient_abn IS NOT NULL
  GROUP BY
    jf.state,
    jf.program_name,
    jf.recipient_name,
    jf.recipient_abn,
    COALESCE(linked.gs_id, by_abn.gs_id),
    COALESCE(linked.is_community_controlled, by_abn.is_community_controlled, false)
)
SELECT state, program_name, recipient_name, recipient_abn, total, grants, gs_id, is_community_controlled, rn
FROM ranked
WITH NO DATA;

CREATE INDEX IF NOT EXISTS idx_mv_yj_report_state_program_partners_state_program
  ON mv_yj_report_state_program_partners(state, program_name, rn);

CREATE MATERIALIZED VIEW IF NOT EXISTS mv_yj_report_state_top_orgs AS
WITH provider_rows AS (
  SELECT jf.*
  FROM justice_funding jf
  WHERE jf.topics @> ARRAY['youth-justice']::text[]
    AND jf.source NOT IN ('austender-direct')
    AND jf.amount_dollars IS NOT NULL
    AND jf.amount_dollars > 0
    AND jf.state IS NOT NULL
    AND jf.program_name NOT LIKE 'ROGS%'
    AND jf.program_name NOT LIKE 'Total%'
    AND jf.recipient_name IS NOT NULL
    AND jf.recipient_name <> ''
    AND jf.recipient_name <> 'Total'
    AND jf.recipient_name NOT LIKE 'Youth Justice -%'
    AND jf.recipient_name NOT LIKE 'Department of%'
    AND jf.recipient_name NOT LIKE 'State of%'
    AND jf.recipient_name NOT LIKE 'Multiple%'
    AND jf.recipient_name NOT IN ('Territory Families, Housing and Communities', 'Community Services Directorate')
),
ranked AS (
  SELECT
    jf.state,
    jf.recipient_name,
    jf.recipient_abn,
    SUM(jf.amount_dollars)::bigint AS total,
    COUNT(*)::int AS grants,
    COALESCE(linked.gs_id, by_abn.gs_id) AS gs_id,
    ROW_NUMBER() OVER (
      PARTITION BY jf.state
      ORDER BY SUM(jf.amount_dollars) DESC NULLS LAST, jf.recipient_name
    ) AS rn
  FROM provider_rows jf
  LEFT JOIN gs_entities linked ON linked.id = jf.gs_entity_id
  LEFT JOIN LATERAL (
    SELECT gs_id
    FROM gs_entities
    WHERE abn = jf.recipient_abn
    ORDER BY source_count DESC NULLS LAST
    LIMIT 1
  ) by_abn ON jf.recipient_abn IS NOT NULL
  GROUP BY
    jf.state,
    jf.recipient_name,
    jf.recipient_abn,
    COALESCE(linked.gs_id, by_abn.gs_id)
)
SELECT state, recipient_name, recipient_abn, grants, total, gs_id
FROM ranked
WHERE rn <= 50
WITH NO DATA;

CREATE INDEX IF NOT EXISTS idx_mv_yj_report_state_top_orgs_state_total
  ON mv_yj_report_state_top_orgs(state, total DESC NULLS LAST);

CREATE MATERIALIZED VIEW IF NOT EXISTS mv_yj_report_unfunded_programs AS
SELECT
  ai.name,
  ai.type,
  ai.evidence_level,
  ai.cultural_authority,
  ai.geography::text AS geography
FROM alma_interventions ai
WHERE ai.topics @> ARRAY['youth-justice']::text[]
  AND (
    ai.evidence_level ILIKE '%Effective%'
    OR ai.evidence_level ILIKE '%Indigenous%'
  )
  AND ai.gs_entity_id IS NULL
ORDER BY ai.type, ai.name
WITH NO DATA;

CREATE INDEX IF NOT EXISTS idx_mv_yj_report_unfunded_programs_name
  ON mv_yj_report_unfunded_programs(name);

CREATE MATERIALIZED VIEW IF NOT EXISTS mv_yj_report_ndis_overlay AS
SELECT
  state,
  SUM(total_participants)::bigint AS ndis_total,
  SUM(youth_participants)::bigint AS ndis_youth,
  SUM(psychosocial_participants)::bigint AS psychosocial,
  SUM(intellectual_disability_participants)::bigint AS intellectual,
  SUM(autism_participants)::bigint AS autism,
  SUM(total_annual_budget)::bigint AS ndis_budget
FROM v_ndis_youth_justice_overlay
WHERE state != 'OT'
GROUP BY state
WITH NO DATA;

CREATE INDEX IF NOT EXISTS idx_mv_yj_report_ndis_overlay_budget
  ON mv_yj_report_ndis_overlay(ndis_budget DESC);

CREATE MATERIALIZED VIEW IF NOT EXISTS mv_yj_report_dss_payments AS
SELECT
  state,
  payment_type,
  SUM(recipient_count)::int AS recipients
FROM dss_payment_demographics
WHERE payment_type IN ('Disability Support Pension','Youth Allowance (other)','JobSeeker Payment')
  AND geography_type = 'state'
  AND state NOT IN ('Unknown')
GROUP BY state, payment_type
WITH NO DATA;

CREATE INDEX IF NOT EXISTS idx_mv_yj_report_dss_payments_state
  ON mv_yj_report_dss_payments(state, payment_type);

CREATE MATERIALIZED VIEW IF NOT EXISTS mv_yj_report_foundations AS
SELECT
  f.name,
  f.total_giving_annual::bigint,
  f.thematic_focus::text,
  f.geographic_focus::text,
  ge.gs_id
FROM foundations f
LEFT JOIN gs_entities ge ON ge.id = f.gs_entity_id
WHERE (
    f.thematic_focus::text ILIKE '%justice%'
    OR f.thematic_focus::text ILIKE '%youth%'
    OR (f.thematic_focus::text ILIKE '%indigenous%' AND f.total_giving_annual > 50000000)
  )
  AND (
    f.name ILIKE '%foundation%'
    OR f.name ILIKE '%trust%'
    OR f.name ILIKE '%philanthropic%'
    OR f.name ILIKE '%endowment%'
  )
  AND f.name NOT ILIKE '%university%'
WITH NO DATA;

CREATE INDEX IF NOT EXISTS idx_mv_yj_report_foundations_giving
  ON mv_yj_report_foundations(total_giving_annual DESC NULLS LAST);

CREATE MATERIALIZED VIEW IF NOT EXISTS mv_yj_report_coverage AS
SELECT
  (SELECT COUNT(*)::int FROM justice_funding) AS justice_funding_rows,
  (
    SELECT COUNT(*)::int
    FROM justice_funding
    WHERE topics @> ARRAY['youth-justice']::text[]
      AND source NOT IN ('austender-direct')
  ) AS youth_justice_funding_rows,
  (
    SELECT COALESCE(SUM(amount_dollars), 0)::bigint
    FROM justice_funding
    WHERE topics @> ARRAY['youth-justice']::text[]
      AND source NOT IN ('austender-direct')
  ) AS youth_justice_funding_dollars,
  (SELECT COUNT(*)::int FROM justice_funding WHERE source = 'rogs-2026') AS rogs_rows_in_justice_funding,
  (SELECT COUNT(*)::int FROM rogs_justice_spending WHERE rogs_section = 'youth_justice') AS rogs_rows_in_rogs_table,
  (
    SELECT COUNT(*)::int
    FROM alma_interventions
    WHERE topics @> ARRAY['youth-justice']::text[]
  ) AS alma_tagged,
  (
    SELECT COUNT(*)::int
    FROM alma_interventions
    WHERE topics @> ARRAY['youth-justice']::text[]
      OR serves_youth_justice = true
      OR target_cohort::text ILIKE '%youth justice%'
      OR description ILIKE '%youth justice%'
  ) AS alma_serves_youth_justice,
  (
    SELECT COUNT(*)::int
    FROM lga_cross_system_stats
    WHERE school_count > 0 OR dsp_recipients > 0 OR ndis_youth_participants > 0
  ) AS lga_cross_system_rows,
  (SELECT COUNT(*)::int FROM v_ndis_youth_justice_overlay WHERE state != 'OT') AS ndis_overlay_rows,
  (
    SELECT COUNT(*)::int
    FROM austender_contracts
    WHERE title ILIKE '%youth%justice%'
       OR title ILIKE '%juvenile%detention%'
       OR title ILIKE '%youth%detention%'
  ) AS austender_contracts,
  (
    SELECT COALESCE(SUM(contract_value), 0)::bigint
    FROM austender_contracts
    WHERE title ILIKE '%youth%justice%'
       OR title ILIKE '%juvenile%detention%'
       OR title ILIKE '%youth%detention%'
  ) AS austender_contract_dollars,
  (
    SELECT COUNT(DISTINCT metric_name)::int
    FROM outcomes_metrics
    WHERE domain = 'youth-justice'
  ) AS outcome_metric_names
WITH NO DATA;
