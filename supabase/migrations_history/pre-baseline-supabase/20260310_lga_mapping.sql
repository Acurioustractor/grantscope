-- Add LGA (Local Government Area) columns to postcode_geo and gs_entities
-- Data source: Matthew Proctor Australian Postcodes Database (492 unique LGAs)

ALTER TABLE postcode_geo ADD COLUMN IF NOT EXISTS lga_name TEXT;
ALTER TABLE postcode_geo ADD COLUMN IF NOT EXISTS lga_code TEXT;

ALTER TABLE gs_entities ADD COLUMN IF NOT EXISTS lga_name TEXT;
ALTER TABLE gs_entities ADD COLUMN IF NOT EXISTS lga_code TEXT;

-- Index for LGA lookups
CREATE INDEX IF NOT EXISTS idx_postcode_geo_lga ON postcode_geo (lga_code);
CREATE INDEX IF NOT EXISTS idx_gs_entities_lga ON gs_entities (lga_name);

-- Add LGA to the funding materialized view
DROP MATERIALIZED VIEW IF EXISTS mv_funding_by_lga;
CREATE MATERIALIZED VIEW mv_funding_by_lga AS
SELECT
  e.lga_name,
  e.lga_code,
  e.state,
  COUNT(DISTINCT e.id) AS entity_count,
  COUNT(DISTINCT CASE WHEN e.is_community_controlled THEN e.id END) AS community_controlled_count,
  COALESCE(SUM(r.amount), 0) AS total_funding,
  COUNT(DISTINCT r.id) AS relationship_count,
  AVG(e.seifa_irsd_decile) AS avg_seifa_decile
FROM gs_entities e
LEFT JOIN gs_relationships r ON r.target_entity_id = e.id AND r.relationship_type IN ('donation', 'contract', 'grant')
WHERE e.lga_name IS NOT NULL
GROUP BY e.lga_name, e.lga_code, e.state
ORDER BY entity_count DESC;

CREATE UNIQUE INDEX IF NOT EXISTS idx_mv_funding_by_lga_unique ON mv_funding_by_lga (lga_code, state);
