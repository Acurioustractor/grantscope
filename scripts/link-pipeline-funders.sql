-- Add funder_entity_id and funder_type to org_pipeline
ALTER TABLE org_pipeline
  ADD COLUMN IF NOT EXISTS funder_entity_id UUID REFERENCES gs_entities(id),
  ADD COLUMN IF NOT EXISTS funder_type TEXT; -- 'foundation', 'government', 'corporate', 'other'

-- Link NIAA (NAIDOC Grants)
UPDATE org_pipeline SET funder_entity_id = 'a4e675ff-9be9-4ec3-a6b3-187fcdf21c69', funder_type = 'government'
WHERE name = 'NAIDOC Grants' AND org_profile_id IN (SELECT id FROM org_profiles WHERE slug = 'picc');

-- Link Ian Potter Foundation
UPDATE org_pipeline SET funder_entity_id = 'a32c7d40-96fc-4f64-820a-269f138e6b8a', funder_type = 'foundation'
WHERE name = 'Ian Potter Environment' AND org_profile_id IN (SELECT id FROM org_profiles WHERE slug = 'picc');

-- Link Paul Ramsay Foundation
UPDATE org_pipeline SET funder_entity_id = '92edb50b-b111-45a8-b697-0354410b2d2d', funder_type = 'foundation'
WHERE name = 'Paul Ramsay Foundation' AND org_profile_id IN (SELECT id FROM org_profiles WHERE slug = 'picc');

-- Link Tim Fairfax Family Foundation
UPDATE org_pipeline SET funder_entity_id = '0fc1b770-73f2-43de-9db3-10c3a202d38b', funder_type = 'foundation'
WHERE name = 'Tim Fairfax Family Foundation' AND org_profile_id IN (SELECT id FROM org_profiles WHERE slug = 'picc');

-- Set funder_type for government-funded items (no specific entity match yet)
UPDATE org_pipeline SET funder_type = 'government'
WHERE funder LIKE '%Federal%' AND org_profile_id IN (SELECT id FROM org_profiles WHERE slug = 'picc');

UPDATE org_pipeline SET funder_type = 'government'
WHERE funder LIKE '%DITRDCA%' AND org_profile_id IN (SELECT id FROM org_profiles WHERE slug = 'picc');

UPDATE org_pipeline SET funder_type = 'government'
WHERE funder LIKE '%DEWR%' AND org_profile_id IN (SELECT id FROM org_profiles WHERE slug = 'picc');
