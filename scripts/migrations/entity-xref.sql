-- Entity Cross-Reference: unified identifier lookup for gs_entities
-- Collects ABN, ACN, gs_id, ACNC registration, ORIC ICN from all sources
-- Enables: "given any identifier, find the entity and all its other identifiers"

DROP MATERIALIZED VIEW IF EXISTS mv_entity_xref CASCADE;

CREATE MATERIALIZED VIEW mv_entity_xref AS

-- ABN identifiers from gs_entities
SELECT
  ge.id AS entity_id,
  ge.gs_id,
  ge.canonical_name,
  'ABN' AS identifier_type,
  ge.abn AS identifier_value,
  'gs_entities' AS source
FROM gs_entities ge
WHERE ge.abn IS NOT NULL

UNION ALL

-- ACN from ABR registry (matched via ABN)
SELECT
  ge.id,
  ge.gs_id,
  ge.canonical_name,
  'ACN',
  ar.acn,
  'abr_registry'
FROM gs_entities ge
JOIN abr_registry ar ON ar.abn = ge.abn
WHERE ge.abn IS NOT NULL
  AND ar.acn IS NOT NULL
  AND ar.acn != ''

UNION ALL

-- ACNC ABN from foundations table
SELECT
  ge.id,
  ge.gs_id,
  ge.canonical_name,
  'ACNC_ABN',
  f.acnc_abn,
  'foundations'
FROM foundations f
JOIN gs_entities ge ON ge.abn = f.acnc_abn
WHERE f.acnc_abn IS NOT NULL

UNION ALL

-- ORIC ICN from person_roles (company_acn for ORIC corps)
SELECT DISTINCT
  ge.id,
  ge.gs_id,
  ge.canonical_name,
  'ORIC_ICN',
  pr.company_acn,
  'person_roles_oric'
FROM person_roles pr
JOIN gs_entities ge ON ge.abn = pr.company_abn
WHERE pr.source = 'oric_register'
  AND pr.company_acn IS NOT NULL
  AND pr.company_acn != ''
  AND pr.company_abn IS NOT NULL

UNION ALL

-- Trading names from ABR
SELECT
  ge.id,
  ge.gs_id,
  ge.canonical_name,
  'TRADING_NAME',
  unnest(ar.trading_names),
  'abr_registry'
FROM gs_entities ge
JOIN abr_registry ar ON ar.abn = ge.abn
WHERE ge.abn IS NOT NULL
  AND ar.trading_names IS NOT NULL
  AND array_length(ar.trading_names, 1) > 0

UNION ALL

-- GS_ID as an identifier itself (for reverse lookups)
SELECT
  ge.id,
  ge.gs_id,
  ge.canonical_name,
  'GS_ID',
  ge.gs_id,
  'gs_entities'
FROM gs_entities ge
WHERE ge.gs_id IS NOT NULL;

-- Indexes for fast lookups
CREATE INDEX idx_entity_xref_value ON mv_entity_xref (identifier_value);
CREATE INDEX idx_entity_xref_type_value ON mv_entity_xref (identifier_type, identifier_value);
CREATE INDEX idx_entity_xref_entity ON mv_entity_xref (entity_id);
CREATE INDEX idx_entity_xref_gsid ON mv_entity_xref (gs_id);
CREATE INDEX idx_entity_xref_name ON mv_entity_xref (canonical_name);
