-- Alice Springs Provider Entity Fixes
-- 1. Update CAAC canonical name (was stored as Utju Health Service, a sub-clinic)
-- 2. Link CAYLUS ALMA intervention to Tangentyere Council (CAYLUS is a division)
-- 3. Link remaining unlinked Alice Springs ALMA interventions where possible

BEGIN;

-- 1. Fix CAAC canonical name
UPDATE gs_entities
SET canonical_name = 'Central Australian Aboriginal Congress Aboriginal Corporation',
    updated_at = NOW()
WHERE abn = '76210591710';

-- 2. Link CAYLUS intervention to Tangentyere Council (CAYLUS is a Tangentyere division)
UPDATE alma_interventions
SET gs_entity_id = '093ec48b-7d33-4363-9c82-6bc820117992'  -- Tangentyere Council
WHERE name = 'Central Australian Youth Link-Up Service (CAYLUS)'
  AND gs_entity_id IS NULL;

-- 3. Link "Community Night and Youth Patrol Service" to Tangentyere Council
-- (Tangentyere runs the Night Patrol in Alice Springs town camps)
UPDATE alma_interventions
SET gs_entity_id = '093ec48b-7d33-4363-9c82-6bc820117992'  -- Tangentyere Council
WHERE name = 'Community Night and Youth Patrol Service - Alice Springs'
  AND gs_entity_id IS NULL;

-- 4. Link "Community Youth Diversion Program" to NAAJA
-- (NAAJA runs key youth diversion programs in Alice Springs)
UPDATE alma_interventions
SET gs_entity_id = (SELECT id FROM gs_entities WHERE gs_id = 'AU-ABN-63118017842')  -- NAAJA
WHERE name = 'Community Youth Diversion Program - Alice Springs'
  AND gs_entity_id IS NULL;

COMMIT;

-- Verify
SELECT name, gs_entity_id,
  (SELECT canonical_name FROM gs_entities WHERE id = alma_interventions.gs_entity_id) as entity_name
FROM alma_interventions
WHERE geography::text ILIKE '%alice springs%'
ORDER BY name;
