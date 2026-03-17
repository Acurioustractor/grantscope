-- Link pipeline items to grant_opportunities
-- NAIDOC Grants → NAIDOC 2026 Local Grants
UPDATE org_pipeline SET grant_opportunity_id = 'a7d6f97b-805d-401c-bb70-d7071d3096ce'
WHERE name = 'NAIDOC Grants' AND org_profile_id IN (SELECT id FROM org_profiles WHERE slug = 'picc');

-- REAL Innovation Fund EOI
UPDATE org_pipeline SET grant_opportunity_id = '29c03557-0745-460a-b3ce-99b9a98369b9'
WHERE name = 'REAL Innovation Fund EOI' AND org_profile_id IN (SELECT id FROM org_profiles WHERE slug = 'picc');

-- Ian Potter Environment
UPDATE org_pipeline SET grant_opportunity_id = '4bf8ec5e-6a15-4dba-a25c-b34358cc6bcf'
WHERE name = 'Ian Potter Environment' AND org_profile_id IN (SELECT id FROM org_profiles WHERE slug = 'picc');

-- Paul Ramsay Foundation
UPDATE org_pipeline SET grant_opportunity_id = '89bb9749-bddb-4ff7-b7f4-124dfaa88c9c'
WHERE name = 'Paul Ramsay Foundation' AND org_profile_id IN (SELECT id FROM org_profiles WHERE slug = 'picc');
