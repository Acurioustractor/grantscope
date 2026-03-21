-- Reclassify justice_funding entities that are actually charities or indigenous corps

BEGIN;

-- Reclassify ACNC charities
UPDATE gs_entities e
SET entity_type = 'charity', updated_at = NOW()
FROM acnc_charities c
WHERE e.abn = c.abn
  AND e.entity_type = 'company'
  AND 'justice_funding' = ANY(e.source_datasets);

-- Reclassify ORIC indigenous corporations (match by ABN against known indigenous_corp entities)
WITH oric_abns AS (
  SELECT DISTINCT abn FROM gs_entities WHERE entity_type = 'indigenous_corp' AND abn IS NOT NULL
)
UPDATE gs_entities e
SET entity_type = 'indigenous_corp', updated_at = NOW()
FROM oric_abns o
WHERE e.abn = o.abn
  AND e.entity_type = 'company'
  AND 'justice_funding' = ANY(e.source_datasets);

-- Set state from justice_funding data where missing
UPDATE gs_entities e
SET state = sub.state, updated_at = NOW()
FROM (
  SELECT DISTINCT ON (recipient_abn) recipient_abn, state
  FROM justice_funding
  WHERE state IS NOT NULL AND recipient_abn IS NOT NULL
  ORDER BY recipient_abn, amount_dollars DESC NULLS LAST
) sub
WHERE e.abn = sub.recipient_abn
  AND e.state IS NULL
  AND 'justice_funding' = ANY(e.source_datasets);

COMMIT;
