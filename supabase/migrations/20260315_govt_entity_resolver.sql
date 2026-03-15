-- Government Entity Resolver
-- Creates gs_entities for all austender_contracts buyer_name values
-- that don't have a matching entity yet.
-- Pattern: gs_id = 'AU-GOV-{md5(buyer_name)}', entity_type = 'government_body'

BEGIN;

-- Create government entities for unmatched buyer names
INSERT INTO gs_entities (
  entity_type,
  canonical_name,
  gs_id,
  source_datasets,
  confidence,
  sector
)
SELECT DISTINCT
  'government_body',
  a.buyer_name,
  'AU-GOV-' || md5(a.buyer_name),
  ARRAY['austender'],
  'reported',
  'government'
FROM austender_contracts a
LEFT JOIN gs_entities e ON e.canonical_name = a.buyer_name
WHERE e.id IS NULL
  AND a.buyer_name IS NOT NULL
  AND a.buyer_name != ''
ON CONFLICT (gs_id) DO NOTHING;

COMMIT;
