-- NDIS Participant Data
-- Source: https://dataresearch.ndis.gov.au/datasets/participant-datasets
-- Quarterly release, service-district level granularity

CREATE TABLE IF NOT EXISTS ndis_participants (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  report_date date NOT NULL,
  state text NOT NULL,
  service_district text NOT NULL,
  disability_group text NOT NULL,
  age_band text NOT NULL,
  support_class text NOT NULL DEFAULT 'ALL',
  avg_annual_budget numeric,
  active_participants integer,
  source text NOT NULL,
  created_at timestamptz DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_ndis_participants_district ON ndis_participants (service_district);
CREATE INDEX IF NOT EXISTS idx_ndis_participants_state ON ndis_participants (state);
CREATE INDEX IF NOT EXISTS idx_ndis_participants_disability ON ndis_participants (disability_group);
CREATE INDEX IF NOT EXISTS idx_ndis_participants_source ON ndis_participants (source);

-- View: NDIS participants by service district with youth justice overlay
CREATE OR REPLACE VIEW v_ndis_youth_justice_overlay AS
SELECT
  np.service_district,
  np.state,
  SUM(CASE WHEN np.disability_group = 'ALL' AND np.age_band = 'ALL' THEN np.active_participants END) as total_participants,
  SUM(CASE WHEN np.disability_group = 'Psychosocial disability' AND np.age_band = 'ALL' THEN np.active_participants END) as psychosocial_participants,
  SUM(CASE WHEN np.disability_group = 'Intellectual Disability' AND np.age_band = 'ALL' THEN np.active_participants END) as intellectual_disability_participants,
  SUM(CASE WHEN np.disability_group = 'Autism' AND np.age_band = 'ALL' THEN np.active_participants END) as autism_participants,
  SUM(CASE WHEN np.disability_group = 'ALL' AND np.age_band IN ('0 to 8', '9 to 14', '15 to 18') THEN np.active_participants END) as youth_participants,
  SUM(CASE WHEN np.disability_group = 'ALL' AND np.age_band = 'ALL' THEN np.avg_annual_budget * np.active_participants END) as total_annual_budget,
  AVG(CASE WHEN np.disability_group = 'ALL' AND np.age_band = 'ALL' THEN np.avg_annual_budget END) as avg_budget_per_participant
FROM ndis_participants np
WHERE np.support_class = 'ALL'
GROUP BY np.service_district, np.state;
