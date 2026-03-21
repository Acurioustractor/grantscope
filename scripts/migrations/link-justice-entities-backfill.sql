-- link-justice-entities-backfill.sql
-- Backfill gs_entity_id on justice_funding where ABN matches gs_entities
-- Then attempt name-based matching for remaining unlinked records

BEGIN;

-- Phase 1: ABN exact match (the big win — ~27K records)
UPDATE justice_funding jf
SET gs_entity_id = ge.id,
    updated_at = now()
FROM gs_entities ge
WHERE jf.recipient_abn = ge.abn
  AND jf.gs_entity_id IS NULL
  AND jf.recipient_abn IS NOT NULL
  AND jf.recipient_abn != '';

-- Phase 2: Name exact match for records without ABN
-- Match recipient_name to gs_entities.canonical_name (case-insensitive)
UPDATE justice_funding jf
SET gs_entity_id = ge.id,
    recipient_abn = ge.abn,
    updated_at = now()
FROM gs_entities ge
WHERE lower(trim(jf.recipient_name)) = lower(trim(ge.canonical_name))
  AND jf.gs_entity_id IS NULL
  AND jf.recipient_abn IS NULL
  AND ge.abn IS NOT NULL;

COMMIT;
