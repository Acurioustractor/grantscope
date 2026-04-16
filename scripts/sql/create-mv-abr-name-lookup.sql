-- Materialized view: ABR name lookup for fast entity matching
-- Pre-normalizes entity names from abr_registry (18.5M rows) into a compact lookup table
-- Enables fast JOINs for ORIC backfill, entity dedup, and general name matching

-- Only Active entities with ABNs (~12M of 18.5M)
CREATE MATERIALIZED VIEW IF NOT EXISTS mv_abr_name_lookup AS
SELECT
  abn,
  entity_name,
  UPPER(entity_name) AS upper_name,
  TRIM(LOWER(REGEXP_REPLACE(
    REGEXP_REPLACE(entity_name, '\m(Aboriginal|Torres Strait Islander|Corporation|Incorporated|Inc|Ltd|Limited|Pty|Co-operative|Association|Assoc|The|Of)\M', '', 'gi'),
    '[^a-zA-Z0-9 ]', '', 'g'
  ))) AS norm_name
FROM abr_registry
WHERE status = 'Active'
  AND abn IS NOT NULL
  AND LENGTH(entity_name) > 0
WITH DATA;

-- Indexes for different matching strategies
CREATE INDEX IF NOT EXISTS idx_abr_lookup_upper ON mv_abr_name_lookup (upper_name);
CREATE INDEX IF NOT EXISTS idx_abr_lookup_norm ON mv_abr_name_lookup (norm_name);
CREATE INDEX IF NOT EXISTS idx_abr_lookup_abn ON mv_abr_name_lookup (abn);

-- Verify
SELECT COUNT(*) AS total_rows FROM mv_abr_name_lookup;
