-- Round 2: more aggressive auto-classification of unverified grants
-- Targets the 421 unverified rows after Round 1

BEGIN;

-- 1. Council / LGA grants (funder name ends in state suffix or contains "Council/Shire")
UPDATE alma_funding_opportunities SET
  opportunity_type = 'open_grant',
  verification_status = 'verified',
  verified_at = NOW(),
  updated_at = NOW(),
  verification_notes = 'auto-classify 2026-05-15 r2: council/LGA open program'
WHERE opportunity_type = 'unverified'
  AND (
    funder_name ILIKE '%Council%'
    OR funder_name ILIKE '%Shire%'
    OR funder_name ILIKE '% Qld'
    OR funder_name ILIKE '% Nsw'
    OR funder_name ILIKE '% Vic'
    OR funder_name ILIKE '% Wa'
    OR funder_name ILIKE '% Sa'
    OR funder_name ILIKE '% Tas'
    OR funder_name ILIKE '% Nt'
    OR funder_name ILIKE '% Act'
    OR funder_name = 'Brisbane City Council'
    OR funder_name = 'Gold Coast Community Fund'
    OR funder_name = 'Bundaberg Qld'
    OR funder_name = 'Cumberland Nsw'
  );

-- 2. Name patterns that are unambiguously open community/grant rounds
UPDATE alma_funding_opportunities SET
  opportunity_type = 'open_grant',
  verification_status = 'verified',
  verified_at = NOW(),
  updated_at = NOW(),
  verification_notes = 'auto-classify 2026-05-15 r2: open community grant name pattern'
WHERE opportunity_type = 'unverified'
  AND (
    name ILIKE '%Community Grant%'
    OR name ILIKE '%Community Fund%'
    OR name ILIKE '%Community Sponsorship%'
    OR name ILIKE '%Community Project%'
    OR name ILIKE '%Community Stewardship%'
    OR name ILIKE '%Community Conservation%'
    OR name ILIKE '%Community Recovery%'
    OR name ILIKE '%Community Leadership Activities%'
    OR name ILIKE '%Community Infrastructure%'
    OR name ILIKE '%Community Benefit Fund%'
    OR name ILIKE '%Community Initiated%'
    OR name ILIKE '%Community-Led%'
    OR name ILIKE '%Community Controlled%'
    OR name ILIKE '%Community-Controlled%'
    OR name ILIKE '%Sponsorship Funding%'
    OR name ILIKE '%Event Support Grant%'
    OR name ILIKE '%Festival Grant%'
    OR name ILIKE '%Festival Funding%'
    OR name ILIKE '%Cultural Grant%'
    OR name ILIKE '%Arts Grant%'
    OR name ILIKE '%Aboriginal Community%'
    OR name ILIKE '%Indigenous Community%'
    OR name ILIKE '%Capacity Building%'
    OR name ILIKE '%Capacity Funding%'
    OR name ILIKE '%Round %'
    OR name ILIKE '% Round'
    OR name ILIKE '%Heritage Grant%'
    OR name ILIKE '%Climate Adaptation%'
    OR name ILIKE '%Environment Grant%'
    OR name ILIKE '%Community Stewardship%'
    OR name ILIKE 'Grants for %'
    OR name ILIKE '%Health Promotion%'
    OR name ILIKE '%Disability Grant%'
    OR name ILIKE '%Inclusion Grant%'
  );

-- 3. Allowlisted funders with clear open-grant signal (description) but unverified status
-- Promote them to open_grant since their funder is trusted
UPDATE alma_funding_opportunities SET
  opportunity_type = 'open_grant',
  verification_status = 'verified',
  verified_at = NOW(),
  updated_at = NOW(),
  verification_notes = 'auto-classify 2026-05-15 r2: allowlisted funder open program'
WHERE opportunity_type = 'unverified'
  AND funder_name IN (
    'Rio Tinto Foundation',
    'The Trustee For The Fogarty Foundation',
    'Minderoo Foundation Limited as trustee for The Minderoo Foundation Trust',
    'The Trustee For The Gelganyem Trust',
    'Moriarty Foundation',
    'Australian Indigenous Education Foundation',
    'Shark Island Foundation',
    'The Trustee For The WCCT Central Sub-Regional Trust',
    'The Mercy Foundation Limited',
    'Community Broadcasting Foundation',
    'FAY FULLER COMMUNITY HEALTH FOUNDATION LTD',
    'The Trustee For Geelong Community Foundation',
    'Mater Foundation Ltd as trustee for the Mater Foundation',
    'RAS FOUNDATION LIMITED',
    'Coles Group Foundation',
    'CommBank Foundation'
  )
  AND NOT (
    name ILIKE '%Scholarship%'
    OR name ILIKE '%Bursary%'
  );

-- 4. Visa programs / data programs / statistical → policy_framework
UPDATE alma_funding_opportunities SET
  opportunity_type = 'policy_framework',
  verification_status = 'placeholder',
  updated_at = NOW(),
  verification_notes = 'auto-classify 2026-05-15 r2: visa/data/statistical scheme'
WHERE opportunity_type = 'unverified'
  AND (
    name ILIKE '%visa%'
    OR name ILIKE '%statistical%'
    OR name ILIKE '%dataset%'
    OR name ILIKE '%Intergovernmental Panel%'
  );

-- Summary
SELECT opportunity_type, verification_status, COUNT(*)
FROM alma_funding_opportunities
GROUP BY opportunity_type, verification_status
ORDER BY 3 DESC;

COMMIT;
