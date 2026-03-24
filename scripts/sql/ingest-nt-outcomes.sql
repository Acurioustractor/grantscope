-- ═══════════════════════════════════════════════════════════════
-- NT-specific youth justice outcomes metrics
-- Sources: NT Children's Commissioner 2024, NT Corrections, AIHW
-- ═══════════════════════════════════════════════════════════════

BEGIN;

-- ── Children's Commissioner 2024: "Our Most Vulnerable Children" ──

INSERT INTO outcomes_metrics (jurisdiction, domain, metric_name, metric_value, metric_unit, period, cohort, source, source_url, notes)
VALUES
  ('NT', 'youth-justice', 'pct_substantiated_harm_in_detention', 88, 'percent', '2023-24', 'all',
   'NT Children''s Commissioner 2024', 'https://occ.nt.gov.au/publications',
   '88% of children in detention had substantiated harm notifications'),

  ('NT', 'youth-justice', 'pct_dfv_exposure_in_detention', 94, 'percent', '2023-24', 'all',
   'NT Children''s Commissioner 2024', 'https://occ.nt.gov.au/publications',
   '94% of detained children had documented exposure to domestic/family violence'),

  ('NT', 'youth-justice', 'fasd_prevalence_ratio', 18, 'ratio', '2023-24', 'all',
   'NT Children''s Commissioner 2024', 'https://occ.nt.gov.au/publications',
   'FASD prevalence 18x general population among detained youth'),

  ('NT', 'youth-justice', 'pct_known_to_child_protection', 100, 'percent', '2023-24', 'under_14',
   'NT Children''s Commissioner 2024', 'https://occ.nt.gov.au/publications',
   'Every child under 14 in detention was known to child protection system'),

  ('NT', 'youth-justice', 'pct_first_nations_in_detention', 97, 'percent', '2023-24', 'indigenous',
   'NT Children''s Commissioner 2024', 'https://occ.nt.gov.au/publications',
   '97% of children in NT youth detention are First Nations')
ON CONFLICT ON CONSTRAINT outcomes_metrics_unique_metric
DO UPDATE SET metric_value = EXCLUDED.metric_value, notes = EXCLUDED.notes;

-- ── NT Corrections / AIHW: Facility-level data ──

INSERT INTO outcomes_metrics (jurisdiction, domain, metric_name, metric_value, metric_unit, period, cohort, source, source_url, notes)
VALUES
  ('NT', 'youth-justice', 'don_dale_capacity', 56, 'count', '2024-25', 'all',
   'NT Corrections 2024', 'https://corrections.nt.gov.au/youth-justice',
   'Don Dale Youth Detention Centre (Darwin) operational capacity'),

  ('NT', 'youth-justice', 'alice_springs_ydc_capacity', 24, 'count', '2024-25', 'all',
   'NT Corrections 2024', 'https://corrections.nt.gov.au/youth-justice',
   'Alice Springs Youth Detention Centre operational capacity'),

  ('NT', 'youth-justice', 'avg_daily_detention_alice_springs', 19, 'count', '2023-24', 'all',
   'NT Corrections Census', 'https://corrections.nt.gov.au/statistics',
   'Average daily population at Alice Springs Youth Detention Centre'),

  ('NT', 'youth-justice', 'avg_daily_detention_darwin', 43, 'count', '2023-24', 'all',
   'NT Corrections Census', 'https://corrections.nt.gov.au/statistics',
   'Average daily population at Don Dale Youth Detention Centre (Darwin)'),

  ('NT', 'youth-justice', 'recidivism_12_months', 78, 'percent', '2023-24', 'all',
   'NT Corrections 2024', 'https://corrections.nt.gov.au/statistics',
   '78% of released youth return to detention within 12 months'),

  ('NT', 'youth-justice', 'detention_capacity_utilisation', 110, 'percent', '2023-24', 'all',
   'NT Corrections 2024', 'https://corrections.nt.gov.au/statistics',
   'System operating at 110% capacity — overcapacity across both facilities')
ON CONFLICT ON CONSTRAINT outcomes_metrics_unique_metric
DO UPDATE SET metric_value = EXCLUDED.metric_value, notes = EXCLUDED.notes;

-- ═══════════════════════════════════════════════════════════════
-- POLICY EVENTS
-- ═══════════════════════════════════════════════════════════════

INSERT INTO policy_events (jurisdiction, domain, event_date, title, description, event_type, severity, source, source_url)
VALUES
  ('NT', 'youth-justice', '2017-11-17',
   'Royal Commission final report',
   'Royal Commission into the Protection and Detention of Children in the Northern Territory delivered final report with 227 recommendations',
   'report', 'critical',
   'Royal Commission into Protection and Detention of Children in NT',
   'https://www.royalcommission.gov.au/child-detention'),

  ('NT', 'youth-justice', '2023-08-01',
   'Minimum age of criminal responsibility raised to 12',
   'NT Labor government raised minimum age of criminal responsibility from 10 to 12, implementing key Royal Commission recommendation',
   'legislation', 'significant',
   'NT Government',
   'https://legislation.nt.gov.au/Legislation/YOUTH-JUSTICE-ACT-2005'),

  ('NT', 'youth-justice', '2024-10-01',
   'Minimum age of criminal responsibility lowered back to 10',
   'CLP government reversed Labor reform, lowering minimum age of criminal responsibility from 12 back to 10',
   'legislation', 'critical',
   'NT Government',
   'https://legislation.nt.gov.au/Legislation/YOUTH-JUSTICE-ACT-2005')
ON CONFLICT DO NOTHING;

COMMIT;
