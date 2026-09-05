-- ABR Enrichment Phase 2 — optimized for timeout limits
-- Run after Phase 1a (283 exact matches done)

-- Set longer timeout for this session
SET statement_timeout = '600s';

-- ═══════════════════════════════════════════════════════════════
-- Phase 1c: Match via ASIC company names (current_name column)
-- ═══════════════════════════════════════════════════════════════

UPDATE gs_entities e
SET abn = ac.abn
FROM asic_companies ac
WHERE e.abn IS NULL
  AND e.entity_type != 'person'
  AND ac.abn IS NOT NULL
  AND ac.status = 'REGD'
  AND UPPER(TRIM(e.canonical_name)) = UPPER(TRIM(ac.company_name))
  AND NOT EXISTS (
    SELECT 1 FROM gs_entities e2 WHERE e2.abn = ac.abn AND e2.id != e.id
  );

-- Also try current_name field
UPDATE gs_entities e
SET abn = ac.abn
FROM asic_companies ac
WHERE e.abn IS NULL
  AND e.entity_type != 'person'
  AND ac.abn IS NOT NULL
  AND ac.status = 'REGD'
  AND ac.current_name IS NOT NULL
  AND UPPER(TRIM(e.canonical_name)) = UPPER(TRIM(ac.current_name))
  AND NOT EXISTS (
    SELECT 1 FROM gs_entities e2 WHERE e2.abn = ac.abn AND e2.id != e.id
  );

-- ═══════════════════════════════════════════════════════════════
-- Phase 1b: Trading name match (batched by entity type to avoid timeout)
-- Only check entities still missing ABN against active ABR with trading names
-- ═══════════════════════════════════════════════════════════════

-- Indigenous corps first (biggest gap)
UPDATE gs_entities e
SET abn = sub.abn
FROM (
  SELECT DISTINCT ON (upper_name) a.abn, UPPER(TRIM(t)) as upper_name
  FROM abr_registry a, unnest(a.trading_names) t
  WHERE a.status = 'Active'
    AND a.trading_names != '{}'
    AND a.entity_type_code IN ('INC', 'OIE', 'TRT', 'DIT')
) sub
WHERE e.abn IS NULL
  AND e.entity_type = 'indigenous_corp'
  AND UPPER(TRIM(e.canonical_name)) = sub.upper_name
  AND NOT EXISTS (
    SELECT 1 FROM gs_entities e2 WHERE e2.abn = sub.abn AND e2.id != e.id
  );

-- Companies
UPDATE gs_entities e
SET abn = sub.abn
FROM (
  SELECT DISTINCT ON (upper_name) a.abn, UPPER(TRIM(t)) as upper_name
  FROM abr_registry a, unnest(a.trading_names) t
  WHERE a.status = 'Active'
    AND a.trading_names != '{}'
    AND a.entity_type_code IN ('PRV', 'PUB')
) sub
WHERE e.abn IS NULL
  AND e.entity_type = 'company'
  AND UPPER(TRIM(e.canonical_name)) = sub.upper_name
  AND NOT EXISTS (
    SELECT 1 FROM gs_entities e2 WHERE e2.abn = sub.abn AND e2.id != e.id
  );

-- ═══════════════════════════════════════════════════════════════
-- Phase 2: ENRICH — metadata from ABR into gs_entities
-- ═══════════════════════════════════════════════════════════════

-- Fill missing state
UPDATE gs_entities e
SET state = a.state
FROM abr_registry a
WHERE e.abn = a.abn
  AND (e.state IS NULL OR e.state = '')
  AND a.state IS NOT NULL;

-- Fill missing postcode
UPDATE gs_entities e
SET postcode = a.postcode
FROM abr_registry a
WHERE e.abn = a.abn
  AND (e.postcode IS NULL OR e.postcode = '')
  AND a.postcode IS NOT NULL;

-- ═══════════════════════════════════════════════════════════════
-- Phase 3: Views for relationship health + universal search
-- ═══════════════════════════════════════════════════════════════

-- ABR enrichment view
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
  ac.date_of_registration AS asic_registered_date
FROM gs_entities e
LEFT JOIN abr_registry a ON e.abn = a.abn
LEFT JOIN asic_companies ac ON a.acn = ac.acn
WHERE e.abn IS NOT NULL;

-- Relationship health view
CREATE OR REPLACE VIEW v_relationship_health AS
SELECT
  r.relationship_type,
  r.dataset,
  COUNT(*) AS total,
  COUNT(CASE WHEN s.abn IS NOT NULL AND t.abn IS NOT NULL THEN 1 END) AS both_abn,
  COUNT(CASE WHEN s.abn IS NULL AND t.abn IS NULL THEN 1 END) AS neither_abn,
  COUNT(CASE WHEN s.abn IS NULL AND t.abn IS NOT NULL THEN 1 END) AS source_missing,
  COUNT(CASE WHEN s.abn IS NOT NULL AND t.abn IS NULL THEN 1 END) AS target_missing,
  ROUND(100.0 * COUNT(CASE WHEN s.abn IS NOT NULL AND t.abn IS NOT NULL THEN 1 END) / NULLIF(COUNT(*), 0), 1) AS pct_solid
FROM gs_relationships r
JOIN gs_entities s ON s.id = r.source_entity_id
JOIN gs_entities t ON t.id = r.target_entity_id
GROUP BY r.relationship_type, r.dataset
ORDER BY total DESC;

-- Universal entity search across all registries
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
) AS $$
BEGIN
  RETURN QUERY
  -- gs_entities first
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
    a2.entity_name,
    a2.abn,
    a2.acn,
    a2.entity_type,
    a2.status,
    a2.state,
    a2.postcode,
    false
  FROM abr_registry a2
  WHERE a2.entity_name ILIKE '%' || search_term || '%'
    AND NOT EXISTS (SELECT 1 FROM gs_entities e2 WHERE e2.abn = a2.abn)

  LIMIT max_results;
END;
$$ LANGUAGE plpgsql STABLE;

RESET statement_timeout;
