-- ABR Enrichment Pipeline
-- Phase 1: BACKFILL — match gs_entities missing ABN against abr_registry by name
-- Phase 2: ENRICH — pull metadata from ABR into gs_entities
-- Phase 3: REPAIR — audit relationship link integrity

-- ═══════════════════════════════════════════════════════════════
-- Phase 1: BACKFILL — Fill missing ABNs via exact name match
-- ═══════════════════════════════════════════════════════════════

-- 1a. Exact match: entity canonical_name = abr entity_name (case-insensitive)
-- Only match ACTIVE ABR records to avoid assigning cancelled ABNs
UPDATE gs_entities e
SET abn = a.abn
FROM abr_registry a
WHERE e.abn IS NULL
  AND e.entity_type != 'person'
  AND a.status = 'Active'
  AND UPPER(TRIM(e.canonical_name)) = UPPER(TRIM(a.entity_name))
  AND NOT EXISTS (
    SELECT 1 FROM gs_entities e2 WHERE e2.abn = a.abn AND e2.id != e.id
  );

-- 1b. Match via ABR trading names
-- gs_entities name might be a trading name rather than legal name
UPDATE gs_entities e
SET abn = a.abn
FROM abr_registry a
WHERE e.abn IS NULL
  AND e.entity_type != 'person'
  AND a.status = 'Active'
  AND UPPER(TRIM(e.canonical_name)) = ANY(
    SELECT UPPER(TRIM(t)) FROM unnest(a.trading_names) t
  )
  AND NOT EXISTS (
    SELECT 1 FROM gs_entities e2 WHERE e2.abn = a.abn AND e2.id != e.id
  );

-- 1c. Match via ASIC company names (current + former)
UPDATE gs_entities e
SET abn = ac.abn
FROM asic_companies ac
WHERE e.abn IS NULL
  AND e.entity_type != 'person'
  AND ac.abn IS NOT NULL
  AND ac.status = 'REGD'
  AND (
    UPPER(TRIM(e.canonical_name)) = UPPER(TRIM(ac.company_name))
    OR UPPER(TRIM(e.canonical_name)) = ANY(
      SELECT UPPER(TRIM(f)) FROM unnest(ac.former_names) f
    )
  )
  AND NOT EXISTS (
    SELECT 1 FROM gs_entities e2 WHERE e2.abn = ac.abn AND e2.id != e.id
  );


-- ═══════════════════════════════════════════════════════════════
-- Phase 2: ENRICH — Pull ABR metadata into gs_entities
-- ═══════════════════════════════════════════════════════════════

-- 2a. Fill missing state from ABR
UPDATE gs_entities e
SET state = a.state
FROM abr_registry a
WHERE e.abn = a.abn
  AND (e.state IS NULL OR e.state = '')
  AND a.state IS NOT NULL;

-- 2b. Fill missing postcode from ABR
UPDATE gs_entities e
SET postcode = a.postcode
FROM abr_registry a
WHERE e.abn = a.abn
  AND (e.postcode IS NULL OR e.postcode = '')
  AND a.postcode IS NOT NULL;

-- 2c. Create a view that exposes ABR enrichment data for any entity
-- This avoids duplicating data into gs_entities while making it queryable
CREATE OR REPLACE VIEW v_entity_abr AS
SELECT
  e.id,
  e.gs_id,
  e.canonical_name,
  e.abn,
  e.entity_type,
  a.entity_type AS abr_entity_type,
  a.entity_type_code AS abr_type_code,
  a.status AS abr_status,
  a.gst_status,
  a.acnc_registered,
  a.charity_type,
  a.trading_names AS abr_trading_names,
  a.acn,
  a.record_updated_date,
  ac.company_type AS asic_company_type,
  ac.company_class AS asic_company_class,
  ac.status AS asic_status,
  ac.date_of_registration AS asic_registered_date,
  ac.former_names AS asic_former_names
FROM gs_entities e
LEFT JOIN abr_registry a ON e.abn = a.abn
LEFT JOIN asic_companies ac ON a.acn = ac.acn
WHERE e.abn IS NOT NULL;


-- ═══════════════════════════════════════════════════════════════
-- Phase 3: REPAIR — Relationship integrity audit view
-- ═══════════════════════════════════════════════════════════════

-- View showing relationship health — which links are now fixable
CREATE OR REPLACE VIEW v_relationship_health AS
SELECT
  r.relationship_type,
  r.dataset,
  COUNT(*) AS total,
  COUNT(CASE WHEN s.abn IS NOT NULL AND t.abn IS NOT NULL THEN 1 END) AS both_abn,
  COUNT(CASE WHEN s.abn IS NULL AND t.abn IS NULL THEN 1 END) AS neither_abn,
  COUNT(CASE WHEN s.abn IS NULL AND t.abn IS NOT NULL THEN 1 END) AS source_missing,
  COUNT(CASE WHEN s.abn IS NOT NULL AND t.abn IS NULL THEN 1 END) AS target_missing,
  ROUND(100.0 * COUNT(CASE WHEN s.abn IS NOT NULL AND t.abn IS NOT NULL THEN 1 END) / COUNT(*), 1) AS pct_solid
FROM gs_relationships r
JOIN gs_entities s ON s.id = r.source_entity_id
JOIN gs_entities t ON t.id = r.target_entity_id
GROUP BY r.relationship_type, r.dataset
ORDER BY total DESC;

-- Universal entity search: search across ABR + ASIC + gs_entities
-- Finds any Australian entity by name with ABN, type, status
CREATE OR REPLACE FUNCTION search_all_entities(search_term text, max_results int DEFAULT 20)
RETURNS TABLE(
  source text,
  name text,
  abn text,
  acn text,
  entity_type text,
  status text,
  state text,
  postcode text,
  in_civicgraph boolean
) AS $fn$
BEGIN
  RETURN QUERY
  -- gs_entities first (our curated data)
  SELECT
    'civicgraph'::text,
    e.canonical_name,
    e.abn,
    a.acn,
    e.entity_type,
    COALESCE(a.status, 'Unknown')::text,
    e.state,
    e.postcode,
    true
  FROM gs_entities e
  LEFT JOIN abr_registry a ON e.abn = a.abn
  WHERE e.canonical_name ILIKE '%' || search_term || '%'

  UNION ALL

  -- ABR entities NOT in gs_entities
  SELECT
    'abr'::text,
    a.entity_name,
    a.abn,
    a.acn,
    a.entity_type,
    a.status,
    a.state,
    a.postcode,
    false
  FROM abr_registry a
  WHERE a.entity_name ILIKE '%' || search_term || '%'
    AND NOT EXISTS (SELECT 1 FROM gs_entities e WHERE e.abn = a.abn)

  ORDER BY in_civicgraph DESC, name
  LIMIT max_results;
END;
$fn$ LANGUAGE plpgsql STABLE;
