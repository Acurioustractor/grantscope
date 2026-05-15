-- Auto-classify obvious patterns in unverified rows
-- Reduces human triage burden on the 548 newly-promoted rows

BEGIN;

-- 1. Scholarships, bursaries, prizes → award (individual recipients)
UPDATE alma_funding_opportunities SET
  opportunity_type = 'award',
  verification_status = 'placeholder',
  updated_at = NOW(),
  verification_notes = 'auto-classify 2026-05-15: scholarship/bursary/prize name pattern'
WHERE opportunity_type = 'unverified'
  AND (
    name ILIKE '%scholarship%'
    OR name ILIKE '%bursary%'
    OR name ILIKE '%prize'
    OR name ILIKE '% prize %'
    OR name ILIKE 'prize %'
    OR name ILIKE '%PhD %'
    OR name ILIKE '% postdoc%'
    OR name ILIKE '%postdoctoral%'
  );

-- 2. School / college / grammar / ladies' college funders → award
UPDATE alma_funding_opportunities SET
  opportunity_type = 'award',
  verification_status = 'placeholder',
  updated_at = NOW(),
  verification_notes = 'auto-classify 2026-05-15: school foundation funder pattern'
WHERE opportunity_type = 'unverified'
  AND (
    funder_name ILIKE '%Grammar School%'
    OR funder_name ILIKE '%Ladies'' College%'
    OR funder_name ILIKE '%Ladies College%'
    OR funder_name ILIKE '%Anglican School%'
    OR funder_name ILIKE '%Christian School%'
    OR funder_name ILIKE '%College Foundation%'
    OR funder_name ILIKE '%College Scholarship%'
    OR funder_name ILIKE '%Pembroke%'
    OR funder_name ILIKE '%Mount Scopus%'
    OR funder_name ILIKE '%Caulfield Grammar%'
    OR funder_name ILIKE '%St Aidan%'
    OR funder_name ILIKE '%Sacred Advent%'
    OR funder_name ILIKE '%Pinnacle Foundation%'
    OR funder_name ILIKE '%Ascham Foundation%'
    OR funder_name ILIKE '%Pymble%'
    OR funder_name ILIKE '%Canberra Grammar%'
  );

-- 3. Disease-specific health charities → invitation_only (rare org grants, narrow focus)
UPDATE alma_funding_opportunities SET
  opportunity_type = 'invitation_only',
  verification_status = 'placeholder',
  updated_at = NOW(),
  verification_notes = 'auto-classify 2026-05-15: disease-specific health charity, narrow scope'
WHERE opportunity_type = 'unverified'
  AND (
    funder_name ILIKE '%Arthritis Foundation%'
    OR funder_name ILIKE '%Tour De Cure%'
    OR funder_name ILIKE '%Snowdome%'
    OR funder_name ILIKE '%Macular Disease%'
    OR funder_name ILIKE '%Prostate Cancer%'
    OR funder_name ILIKE '%Cancer Council%'
    OR funder_name ILIKE '%Heart Foundation%'
    OR funder_name ILIKE '%Diabetes %'
    OR funder_name ILIKE '%Asthma Foundation%'
    OR funder_name ILIKE '%Multiple Sclerosis%'
    OR funder_name ILIKE '%Cystic Fibrosis%'
  );

-- 4. Religious / church / diocesan trusts (non-Indigenous) → policy_framework
UPDATE alma_funding_opportunities SET
  opportunity_type = 'invitation_only',
  verification_status = 'placeholder',
  updated_at = NOW(),
  verification_notes = 'auto-classify 2026-05-15: church/diocesan trust, narrow scope'
WHERE opportunity_type = 'unverified'
  AND (
    funder_name ILIKE '%Bible Society%'
    OR funder_name ILIKE '%Diocese%'
    OR funder_name ILIKE '%Roman Catholic Trust%'
    OR funder_name ILIKE '%Catholic Foundation%'
  );

-- 5. Research-only data/grant providers → policy_framework (not philanthropy grants)
UPDATE alma_funding_opportunities SET
  opportunity_type = 'policy_framework',
  verification_status = 'placeholder',
  updated_at = NOW(),
  verification_notes = 'auto-classify 2026-05-15: research/data provider, not a philanthropy grant'
WHERE opportunity_type = 'unverified'
  AND (
    funder_name ILIKE '%NHMRC%'
    OR funder_name ILIKE '%Australian Ocean Data%'
    OR funder_name ILIKE '%Research Council%'
  );

-- Summary
SELECT opportunity_type, verification_status, COUNT(*)
FROM alma_funding_opportunities
GROUP BY opportunity_type, verification_status
ORDER BY 3 DESC;

COMMIT;
