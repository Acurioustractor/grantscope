-- OP2 (leverage map / health-backlog L5) — link the unlinked VIC tender suppliers into gs_entities.
--
-- The VIC crawl landed in austender_contracts tagged via source_url = tenders.vic.gov.au
-- (4,891 rows, 2,353 distinct valid ABNs). Of those, 1,116 ABNs were not yet in gs_entities
-- (verified 2026-06-08). This creates registry-spine entities for them so the fresh VIC
-- procurement evidence flows into the same profiles and scout-se-buyers can pick them up.
--
-- Mirrors the canonical AusTender-supplier backfill (backfill-entities-from-datasets.sql Step 1),
-- scoped to VIC rows. confidence='reported' (honest provenance: reported in a government contract
-- disclosure, not registry-verified). Idempotent: NOT EXISTS guards + ON CONFLICT DO NOTHING — safe
-- to re-run, never modifies existing entities.

INSERT INTO gs_entities (gs_id, canonical_name, abn, entity_type, confidence)
SELECT DISTINCT ON (supplier_abn)
  'AU-ABN-' || REPLACE(supplier_abn, ' ', ''),
  supplier_name,
  supplier_abn,
  'company',
  'reported'
FROM austender_contracts
WHERE source_url ILIKE '%tenders.vic.gov.au%'
  AND supplier_abn ~ '^[0-9]{11}$'
  AND supplier_name IS NOT NULL
  AND LENGTH(TRIM(supplier_name)) > 0
  AND NOT EXISTS (
    SELECT 1 FROM gs_entities ge WHERE ge.abn = austender_contracts.supplier_abn
  )
  AND NOT EXISTS (
    SELECT 1 FROM gs_entities ge WHERE ge.gs_id = 'AU-ABN-' || REPLACE(austender_contracts.supplier_abn, ' ', '')
  )
ORDER BY supplier_abn, contract_value DESC NULLS LAST
ON CONFLICT (gs_id) DO NOTHING;
