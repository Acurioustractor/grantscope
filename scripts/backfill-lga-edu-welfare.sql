-- Backfill education and welfare columns in lga_cross_system_stats
-- from acara_schools and dss_payment_demographics

BEGIN;

-- 1. Education data from acara_schools
WITH edu AS (
  SELECT
    lga_name,
    COUNT(*)::int AS school_count,
    ROUND(AVG(icsea_value))::int AS avg_icsea,
    COUNT(*) FILTER (WHERE icsea_value < 900)::int AS low_icsea_schools,
    ROUND(AVG(indigenous_pct)::numeric, 1) AS indigenous_pct
  FROM acara_schools
  WHERE lga_name IS NOT NULL
  GROUP BY lga_name
)
UPDATE lga_cross_system_stats s
SET
  school_count = edu.school_count,
  avg_icsea = edu.avg_icsea,
  low_icsea_schools = edu.low_icsea_schools,
  indigenous_pct = edu.indigenous_pct
FROM edu
WHERE s.lga_name = edu.lga_name;

-- 2. Welfare data from dss_payment_demographics
WITH welfare AS (
  SELECT
    p.lga_name,
    SUM(d.recipient_count) FILTER (WHERE d.payment_type = 'Disability Support Pension')::int AS dsp,
    SUM(d.recipient_count) FILTER (WHERE d.payment_type = 'JobSeeker Payment')::int AS jobseeker,
    SUM(d.recipient_count) FILTER (WHERE d.payment_type = 'Youth Allowance (other)')::int AS youth_allowance
  FROM dss_payment_demographics d
  JOIN (SELECT DISTINCT lga_code, lga_name FROM postcode_geo WHERE lga_name IS NOT NULL) p
    ON p.lga_code = d.geography_code
  WHERE d.geography_type = 'lga'
    AND d.payment_type IN ('Disability Support Pension', 'Youth Allowance (other)', 'JobSeeker Payment')
  GROUP BY p.lga_name
)
UPDATE lga_cross_system_stats s
SET
  dsp_recipients = COALESCE(welfare.dsp, 0),
  jobseeker_recipients = COALESCE(welfare.jobseeker, 0),
  youth_allowance_recipients = COALESCE(welfare.youth_allowance, 0)
FROM welfare
WHERE s.lga_name = welfare.lga_name;

-- 3. Verify
SELECT
  COUNT(*) AS total_lgas,
  COUNT(CASE WHEN school_count > 0 THEN 1 END) AS has_edu,
  COUNT(CASE WHEN dsp_recipients > 0 THEN 1 END) AS has_welfare,
  COUNT(CASE WHEN ndis_youth_participants > 0 THEN 1 END) AS has_ndis,
  COUNT(CASE WHEN crime_rate_per_100k > 0 THEN 1 END) AS has_crime
FROM lga_cross_system_stats;

COMMIT;
