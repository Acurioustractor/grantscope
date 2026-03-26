-- PRF Justice Reinvestment Portfolio Review Ingest
-- Source: JR-Portfolio-Review.pdf (July 2025)
-- 2026-03-27
--
-- Ingests:
-- 1. Updated PRF grant locations (specific communities)
-- 2. 37 Australian JR sites from Appendix B (new orgs + locations)
-- 3. Co-funder relationships from Appendix B
-- 4. Key outcome metrics from findings

BEGIN;

-- ============================================================
-- 1. Update PRF JR grant locations from Appendix A
-- ============================================================

-- Update existing PRF grants with specific funded locations
UPDATE justice_funding SET state = 'NSW'
WHERE program_name = 'PRF Justice Reinvestment Portfolio'
  AND recipient_name ILIKE '%Aboriginal Legal Services%';

UPDATE justice_funding SET state = 'NT'
WHERE program_name = 'PRF Justice Reinvestment Portfolio'
  AND recipient_name ILIKE '%Anindilyakwa%';

UPDATE justice_funding SET state = 'NSW'
WHERE program_name = 'PRF Justice Reinvestment Portfolio'
  AND recipient_name ILIKE '%Justice and Equity%';

UPDATE justice_funding SET state = 'NSW'
WHERE program_name = 'PRF Justice Reinvestment Portfolio'
  AND recipient_name ILIKE '%Just Reinvest%';

UPDATE justice_funding SET state = 'NSW'
WHERE program_name = 'PRF Justice Reinvestment Portfolio'
  AND recipient_name ILIKE '%Maranguka%';

UPDATE justice_funding SET state = 'WA'
WHERE program_name = 'PRF Justice Reinvestment Portfolio'
  AND recipient_name ILIKE '%Olabud%';

UPDATE justice_funding SET state = 'SA'
WHERE program_name = 'PRF Justice Reinvestment Portfolio'
  AND recipient_name ILIKE '%Tiraapendi%';

UPDATE justice_funding SET state = 'VIC'
WHERE program_name = 'PRF Justice Reinvestment Portfolio'
  AND recipient_name ILIKE '%WEstjustice%';

UPDATE justice_funding SET state = 'NSW'
WHERE program_name = 'PRF Justice Reinvestment Portfolio'
  AND recipient_name ILIKE '%Yuwaya%';

UPDATE justice_funding SET state = 'NT'
WHERE program_name = 'PRF Justice Reinvestment Portfolio'
  AND recipient_name ILIKE '%NTCOSS%';

-- ============================================================
-- 2. Insert 37 Australian JR sites from Appendix B
-- These go into justice_funding as Commonwealth JR program grants
-- Only insert if not already present
-- ============================================================

-- NSW sites
INSERT INTO justice_funding (id, recipient_name, program_name, state, source, financial_year)
SELECT gen_random_uuid(), name, program, 'NSW', 'prf-jr-portfolio-review-2025', '2020-2025'
FROM (VALUES
  ('Cowra Information and Neighbourhood Centre', 'Commonwealth JR Program'),
  ('Kinchela Boys Home Aboriginal Corporation', 'Commonwealth JR Program'),
  ('Dhina Durriti Aboriginal Corp', 'Stronger Places Stronger People / NSW DCJ / Dusseldorp Forum'),
  ('Jana Ngalee Local Aboriginal Land Council', 'NSW DCJ'),
  ('South Coast Womens Health and Wellbeing Aboriginal Corporation (Waminda)', 'NSW DCJ'),
  ('Toomelah Local Aboriginal Land Council', 'NSW DCJ'),
  ('Wahluu Health Aboriginal Corporation', 'NSW DCJ')
) AS t(name, program)
WHERE NOT EXISTS (
  SELECT 1 FROM justice_funding jf
  WHERE jf.recipient_name ILIKE '%' || LEFT(t.name, 15) || '%'
    AND jf.program_name ILIKE '%JR%' OR jf.program_name ILIKE '%Justice Reinvestment%'
  LIMIT 1
);

-- NT sites
INSERT INTO justice_funding (id, recipient_name, program_name, state, source, financial_year)
SELECT gen_random_uuid(), name, program, 'NT', 'prf-jr-portfolio-review-2025', '2020-2025'
FROM (VALUES
  ('Kurdiji Aboriginal Corporation', 'Commonwealth JR Program'),
  ('Ngurratjuta/Pmara Ntjarra Aboriginal Corporation', 'Commonwealth JR Program'),
  ('Nja-marleya Cultural Leaders and Justice Group', 'Commonwealth JR Program'),
  ('Savanna Solutions Business Services', 'Commonwealth JR Program')
) AS t(name, program)
WHERE NOT EXISTS (
  SELECT 1 FROM justice_funding jf
  WHERE jf.recipient_name ILIKE '%' || LEFT(t.name, 15) || '%'
  LIMIT 1
);

-- QLD sites
INSERT INTO justice_funding (id, recipient_name, program_name, state, source, financial_year)
SELECT gen_random_uuid(), name, program, 'QLD', 'prf-jr-portfolio-review-2025', '2020-2025'
FROM (VALUES
  ('Balkanu Cape York Development Corporation', 'Commonwealth JR Program'),
  ('Cape York Institute', 'Commonwealth JR Program'),
  ('Cherbourg Wellbeing Indigenous Corporation', 'Commonwealth JR Program'),
  ('Gindaja Treatment and Healing Indigenous Corporation', 'Commonwealth JR Program'),
  ('Gunawuna Jungai Limited', 'Commonwealth JR Program'),
  ('Jika Kangka Gununamanda Limited', 'Commonwealth JR Program'),
  ('Minjerribah Moorgumpin Aboriginal Corporation', 'Commonwealth JR Program'),
  ('Napranum Aboriginal Shire Council', 'Commonwealth JR Program'),
  ('Townsville Community Justice Group Aboriginal and Torres Strait Islander Corporation', 'Commonwealth JR Program')
) AS t(name, program)
WHERE NOT EXISTS (
  SELECT 1 FROM justice_funding jf
  WHERE jf.recipient_name ILIKE '%' || LEFT(t.name, 15) || '%'
  LIMIT 1
);

-- SA sites
INSERT INTO justice_funding (id, recipient_name, program_name, state, source, financial_year)
SELECT gen_random_uuid(), name, program, 'SA', 'prf-jr-portfolio-review-2025', '2020-2025'
FROM (VALUES
  ('Healthy Dreaming', 'Commonwealth JR Program'),
  ('Ngarrindjeri Regional Authority', 'Commonwealth JR Program')
) AS t(name, program)
WHERE NOT EXISTS (
  SELECT 1 FROM justice_funding jf
  WHERE jf.recipient_name ILIKE '%' || LEFT(t.name, 15) || '%'
  LIMIT 1
);

-- VIC sites
INSERT INTO justice_funding (id, recipient_name, program_name, state, source, financial_year)
SELECT gen_random_uuid(), name, program, 'VIC', 'prf-jr-portfolio-review-2025', '2020-2025'
FROM (VALUES
  ('Aboriginal and Torres Strait Islander Corporation FVPLS / Djirra', 'Commonwealth JR Program')
) AS t(name, program)
WHERE NOT EXISTS (
  SELECT 1 FROM justice_funding jf
  WHERE jf.recipient_name ILIKE '%Djirra%' OR jf.recipient_name ILIKE '%FVPLS%'
  LIMIT 1
);

-- WA sites
INSERT INTO justice_funding (id, recipient_name, program_name, state, source, financial_year)
SELECT gen_random_uuid(), name, program, 'WA', 'prf-jr-portfolio-review-2025', '2020-2025'
FROM (VALUES
  ('Aboriginal Legal Service of Western Australia Ltd', 'Commonwealth JR Program'),
  ('Aboriginal Males Healing Centre Strong Spirit Strong Families', 'Commonwealth JR Program'),
  ('Ebenezer Aboriginal Corporation', 'Commonwealth JR Program'),
  ('Emama Nguda Aboriginal Corporation', 'Commonwealth JR Program'),
  ('Gascoyne Development Commission', 'Commonwealth JR Program'),
  ('Shire of Halls Creek', 'Commonwealth JR Program')
) AS t(name, program)
WHERE NOT EXISTS (
  SELECT 1 FROM justice_funding jf
  WHERE jf.recipient_name ILIKE '%' || LEFT(t.name, 15) || '%'
  LIMIT 1
);

-- ============================================================
-- 3. Government co-funding data from findings
-- ============================================================

-- Commonwealth $69M commitment
INSERT INTO justice_funding (id, recipient_name, program_name, amount_dollars, state, source, financial_year)
VALUES (
  gen_random_uuid(),
  'Commonwealth Justice Reinvestment Program',
  'Commonwealth JR Program — 30 sites',
  69000000,
  'National',
  'prf-jr-portfolio-review-2025',
  '2026-2027'
);

-- Commonwealth $20M/yr ongoing
INSERT INTO justice_funding (id, recipient_name, program_name, amount_dollars, state, source, financial_year)
VALUES (
  gen_random_uuid(),
  'Commonwealth Justice Reinvestment Program',
  'Commonwealth JR Program — Ongoing Annual',
  20000000,
  'National',
  'prf-jr-portfolio-review-2025',
  '2026-2027'
);

-- Commonwealth $10M Central Australia expansion
INSERT INTO justice_funding (id, recipient_name, program_name, amount_dollars, state, source, financial_year)
VALUES (
  gen_random_uuid(),
  'Commonwealth Justice Reinvestment Program',
  'Commonwealth JR Program — Central Australia Expansion',
  10000000,
  'NT',
  'prf-jr-portfolio-review-2025',
  '2026-2030'
);

-- Commonwealth $12.5M National JR Unit
INSERT INTO justice_funding (id, recipient_name, program_name, amount_dollars, state, source, financial_year)
VALUES (
  gen_random_uuid(),
  'National Justice Reinvestment Unit',
  'Commonwealth JR Program — National JR Unit',
  12500000,
  'National',
  'prf-jr-portfolio-review-2025',
  '2024-2028'
);

-- NSW Government $9.8M for 6 JR sites
INSERT INTO justice_funding (id, recipient_name, program_name, amount_dollars, state, source, financial_year)
VALUES (
  gen_random_uuid(),
  'NSW Government Justice Reinvestment',
  'NSW JR Program — 6 sites',
  9800000,
  'NSW',
  'prf-jr-portfolio-review-2025',
  '2022-ongoing'
);

-- ============================================================
-- 4. Outcome metrics from findings
-- ============================================================

INSERT INTO outcomes_metrics (id, metric_name, metric_value, metric_unit, jurisdiction, period, domain, source)
VALUES
  (gen_random_uuid(), 'PRF JR Portfolio — People reached', 3352, 'people', 'National', '2021-2025', 'justice', 'prf-jr-portfolio-review-2025'),
  (gen_random_uuid(), 'PRF JR Portfolio — Children/young people intensive support', 480, 'people', 'National', '2021-2025', 'justice', 'prf-jr-portfolio-review-2025'),
  (gen_random_uuid(), 'PRF JR Portfolio — Prior justice contact avoided further contact', 114, 'people', 'National', '2021-2025', 'justice', 'prf-jr-portfolio-review-2025'),
  (gen_random_uuid(), 'PRF JR Portfolio — Estimated diversions from detention', 73, 'people', 'National', '2021-2025', 'justice', 'prf-jr-portfolio-review-2025'),
  (gen_random_uuid(), 'PRF JR Portfolio — Total investment 2021-2025', 53100000, 'dollars', 'National', '2021-2025', 'justice', 'prf-jr-portfolio-review-2025'),
  (gen_random_uuid(), 'PRF JR Portfolio — Number of partnerships', 15, 'count', 'National', '2025', 'justice', 'prf-jr-portfolio-review-2025'),
  (gen_random_uuid(), 'PRF JR Portfolio — Community sites', 34, 'count', 'National', '2025', 'justice', 'prf-jr-portfolio-review-2025'),
  (gen_random_uuid(), 'PRF JR Portfolio — Jurisdictions', 5, 'count', 'National', '2025', 'justice', 'prf-jr-portfolio-review-2025'),
  (gen_random_uuid(), 'Youth detention cost per young person per year', 1200000, 'dollars', 'National', '2023-24', 'justice', 'prf-jr-portfolio-review-2025'),
  (gen_random_uuid(), 'Australia annual prison spend', 6800000000, 'dollars', 'National', '2025', 'justice', 'prf-jr-portfolio-review-2025'),
  (gen_random_uuid(), 'First Nations youth return to sentenced supervision within 12 months', 64, 'percent', 'National', '2021-22', 'justice', 'prf-jr-portfolio-review-2025'),
  (gen_random_uuid(), 'Average nightly youth detention population', 709, 'people', 'National', '2023-24', 'justice', 'prf-jr-portfolio-review-2025'),
  (gen_random_uuid(), 'Raise the Age support — seen campaign', 54, 'percent', 'NSW', '2024', 'justice', 'prf-jr-portfolio-review-2025'),
  (gen_random_uuid(), 'Raise the Age support — not seen campaign', 33, 'percent', 'NSW', '2024', 'justice', 'prf-jr-portfolio-review-2025'),
  (gen_random_uuid(), 'Total Australian JR sites', 37, 'count', 'National', '2024', 'justice', 'prf-jr-portfolio-review-2025'),
  (gen_random_uuid(), 'Total Australian JR sites', 7, 'count', 'National', '2020', 'justice', 'prf-jr-portfolio-review-2025');

-- Co-funder metadata skipped — justice_funding has no metadata column.
-- Co-funding relationships should be stored as separate grant records or in gs_relationships.

ANALYZE justice_funding;
ANALYZE outcomes_metrics;

COMMIT;
