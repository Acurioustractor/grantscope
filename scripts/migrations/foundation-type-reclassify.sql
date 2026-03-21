-- foundation-type-reclassify.sql
-- Reclassify generic 'grantmaker'/'grant_maker' foundations into accurate types
-- Many are universities, PHNs, legal aid, churches, schools — NOT actual grantmaking foundations

BEGIN;

-- 1. Normalize 'grant_maker' → 'grantmaker' first (62 rows)
UPDATE foundations SET type = 'grantmaker' WHERE type = 'grant_maker';

-- 2. Universities and research institutions → 'university'
UPDATE foundations SET type = 'university'
WHERE type = 'grantmaker'
  AND (name ILIKE '%universit%' OR name ILIKE '%rmit%' OR name ILIKE '%tafe%');

-- 3. Legal aid bodies → 'legal_aid'
UPDATE foundations SET type = 'legal_aid'
WHERE type = 'grantmaker'
  AND name ILIKE '%legal aid%';

-- 4. Primary Health Networks → 'primary_health_network'
UPDATE foundations SET type = 'primary_health_network'
WHERE type = 'grantmaker'
  AND (name ILIKE '%primary health%' OR name ILIKE '%health network%');

-- 5. Religious organisations → 'religious_organisation'
UPDATE foundations SET type = 'religious_organisation'
WHERE type = 'grantmaker'
  AND (name ILIKE '%church%' OR name ILIKE '%parish%' OR name ILIKE '%lutheran%'
    OR name ILIKE '%catholic education%' OR name ILIKE '%christian%'
    OR name ILIKE '%baptist%' OR name ILIKE '%methodist%' OR name ILIKE '%adventist%'
    OR name ILIKE '%ecumenical%' OR name ILIKE '%redeemed%' OR name ILIKE '%latter-day%'
    OR name ILIKE '%chevra%' OR name ILIKE '%churches of christ%'
    OR name ILIKE '%salvation army%' OR name ILIKE '%synagogue%' OR name ILIKE '%mosque%');

-- 6. Schools and education bodies → 'education_body'
UPDATE foundations SET type = 'education_body'
WHERE type = 'grantmaker'
  AND (name ILIKE '%school%' OR name ILIKE '%education%' OR name ILIKE '%college%');

-- 7. Hospitals and medical centres → 'hospital'
UPDATE foundations SET type = 'hospital'
WHERE type = 'grantmaker'
  AND (name ILIKE '%hospital%' OR name ILIKE '%medical%');

-- 8. International aid / service delivery orgs → 'service_delivery'
-- These receive/distribute funds but aren't foundations in the traditional sense
UPDATE foundations SET type = 'service_delivery'
WHERE type = 'grantmaker'
  AND (name ILIKE '%world vision%' OR name ILIKE '%red cross%'
    OR name ILIKE '%barnardos%' OR name ILIKE '%compassion australia%'
    OR name ILIKE '%medecins sans%' OR name ILIKE '%flying doctor%'
    OR name ILIKE '%job futures%' OR name ILIKE '%united israel%');

-- 9. NULLs → 'unknown'
UPDATE foundations SET type = 'unknown' WHERE type IS NULL;

-- Report results
SELECT type, COUNT(*) FROM foundations GROUP BY type ORDER BY count DESC;

COMMIT;
