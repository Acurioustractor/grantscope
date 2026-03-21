-- Clean up junk government_body entities (CSV fragments, not real entities)
-- Reclassify to 'company' instead of deleting (avoids FK issues)

BEGIN;

UPDATE gs_entities
SET entity_type = 'company',
    description = 'Data quality issue: misclassified as government_body',
    updated_at = NOW()
WHERE entity_type = 'government_body'
  AND (
    canonical_name LIKE '%,%'
    OR canonical_name LIKE '%$%'
    OR canonical_name LIKE 'The contractor%'
    OR canonical_name LIKE 'Human Resource Strategic%'
    OR LENGTH(canonical_name) < 5
    OR canonical_name LIKE '- Adjust%'
    OR canonical_name LIKE '- Rethink%'
    OR canonical_name LIKE 'IA Talent%'
  );

COMMIT;
