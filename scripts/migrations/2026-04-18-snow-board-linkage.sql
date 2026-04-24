BEGIN;

-- Backfill canonical person links for Snow Foundation board roles
WITH snow_people(person_name_normalised, person_entity_id) AS (
  VALUES
    ('GINETTE SNOW', '79fbab07-7dae-4900-8eb1-03e2f9846327'::uuid),
    ('ANDREW LEECE', '42726a53-2d83-4ae1-abdf-cddadadee9ae'::uuid),
    ('CRAIG BETTS', 'a2fa4dd6-8ada-4ebe-acf9-7dbe82103bab'::uuid),
    ('DAVID HARDIE', 'bd04f676-c64e-46a7-a1d0-e031534ffdee'::uuid),
    ('GEORGINA BYRON', '936676b5-8733-49fa-9deb-adf1a38bf8c9'::uuid),
    ('LOUISE MARY WALSH', 'd997e1da-fbd1-4b96-a991-1662ba546cf9'::uuid),
    ('SCARLETT GAFFEY', 'fe7bc6fc-1179-4dc2-963e-d3dab9753ac0'::uuid),
    ('STEPHEN BYRON', '80787a7c-fd8c-4cb6-a7c3-8d4afa00868d'::uuid),
    ('STEPHEN GAFFEY', 'c11b00fb-eda7-47dd-989e-4c134aa01789'::uuid)
)
UPDATE person_roles pr
SET person_entity_id = sp.person_entity_id
FROM snow_people sp
WHERE pr.company_abn = '49411415493'
  AND pr.person_name_normalised = sp.person_name_normalised
  AND (pr.person_entity_id IS NULL OR pr.person_entity_id <> sp.person_entity_id);

-- Seed Snow-specific foundation_people from the verified registry layer
INSERT INTO foundation_people (
  foundation_id,
  foundation_abn,
  foundation_name,
  person_name,
  person_name_normalised,
  role_title,
  role_type,
  person_entity_id,
  source_url,
  source_document_url,
  evidence_text,
  extraction_method,
  confidence,
  metadata
)
SELECT
  'd242967e-0e68-4367-9785-06cf0ec7485e'::uuid,
  '49411415493',
  'The Trustee For The Snow Foundation',
  pr.person_name,
  pr.person_name_normalised,
  initcap(replace(pr.role_type, '_', ' ')),
  pr.role_type,
  pr.person_entity_id,
  'https://www.snowfoundation.org.au/',
  'https://www.acnc.gov.au/charity/charities?search=49411415493',
  'Backfilled from ACNC responsible-person registry data already linked in person_roles.',
  'registry_backfill',
  'verified',
  jsonb_build_object(
    'source_table', 'person_roles',
    'source', pr.source,
    'backfill_reason', 'snow_foundation_governance_linkage',
    'backfilled_at', now()
  )
FROM person_roles pr
WHERE pr.company_abn = '49411415493'
  AND pr.person_entity_id IS NOT NULL
ON CONFLICT (
  foundation_id,
  person_name_normalised,
  role_type,
  source_url,
  extraction_method
) DO UPDATE
SET
  person_entity_id = EXCLUDED.person_entity_id,
  role_title = EXCLUDED.role_title,
  confidence = EXCLUDED.confidence,
  metadata = EXCLUDED.metadata,
  updated_at = now();

COMMIT;
