-- ACCO retention metrics for QLD youth justice funding.
-- "Retention" = % of community-controlled orgs (gs_entities.is_community_controlled = true)
-- that received QLD YJ funding in financial year N AND also in year N+1.
-- Stored in outcomes_metrics so it surfaces alongside recidivism, bed-day cost, etc.

CREATE OR REPLACE VIEW public.v_acco_yj_retention_qld AS
WITH yearly AS (
  SELECT
    j.financial_year,
    e.id AS entity_id
  FROM public.justice_funding j
  JOIN public.gs_entities e ON e.id = j.gs_entity_id
  WHERE j.state = 'QLD'
    AND j.topics @> ARRAY['youth-justice']
    AND j.amount_dollars > 0
    AND e.is_community_controlled = true
    AND j.financial_year ~ '^20[0-9]{2}-[0-9]{2}$'
  GROUP BY 1, 2
),
pairs AS (
  SELECT
    a.financial_year AS prior_year,
    -- Compute next FY label: "2022-23" -> "2023-24"
    (substring(a.financial_year, 1, 4)::int + 1)::text || '-' || lpad(((substring(a.financial_year, 6, 2)::int + 1) % 100)::text, 2, '0') AS next_year,
    a.entity_id,
    (b.entity_id IS NOT NULL) AS retained
  FROM yearly a
  LEFT JOIN yearly b
    ON b.entity_id = a.entity_id
   AND b.financial_year = (substring(a.financial_year, 1, 4)::int + 1)::text || '-' || lpad(((substring(a.financial_year, 6, 2)::int + 1) % 100)::text, 2, '0')
)
SELECT
  prior_year,
  next_year,
  COUNT(*) AS prior_year_accos,
  COUNT(*) FILTER (WHERE retained) AS retained_accos,
  ROUND(100.0 * COUNT(*) FILTER (WHERE retained) / NULLIF(COUNT(*), 0), 1) AS retention_pct
FROM pairs
GROUP BY 1, 2
ORDER BY 1;

COMMENT ON VIEW public.v_acco_yj_retention_qld IS
  'QLD youth-justice ACCO year-over-year retention. Counts community-controlled orgs that received QLD YJ funding in year N and again in N+1.';

-- Insert top-line retention rates into outcomes_metrics so the long-read can surface them.
-- ON CONFLICT updates if already present.
INSERT INTO public.outcomes_metrics
  (jurisdiction, domain, metric_name, metric_value, metric_unit, period, cohort, source, source_table, notes)
SELECT
  'QLD',
  'youth-justice',
  'acco_yj_retention_pct',
  retention_pct,
  'percent',
  prior_year || '→' || next_year,
  'community-controlled',
  'CivicGraph derived from justice_funding × gs_entities',
  'v_acco_yj_retention_qld',
  'ACCO YoY retention: prior_year_accos=' || prior_year_accos || ', retained_accos=' || retained_accos
FROM public.v_acco_yj_retention_qld
WHERE prior_year_accos >= 5  -- noise floor: skip cohorts of <5 orgs
  AND retention_pct IS NOT NULL
ON CONFLICT (jurisdiction, domain, metric_name, period, cohort, source) DO UPDATE
SET metric_value = EXCLUDED.metric_value,
    notes = EXCLUDED.notes;
