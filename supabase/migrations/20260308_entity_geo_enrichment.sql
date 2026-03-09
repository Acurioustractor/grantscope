-- Entity geographic enrichment + community-controlled classification
-- Sprint B: Denormalize geo data to gs_entities for fast place-based queries

-- Add geographic enrichment columns
ALTER TABLE gs_entities ADD COLUMN IF NOT EXISTS seifa_irsd_decile smallint;
ALTER TABLE gs_entities ADD COLUMN IF NOT EXISTS remoteness text;
ALTER TABLE gs_entities ADD COLUMN IF NOT EXISTS sa2_code text;
ALTER TABLE gs_entities ADD COLUMN IF NOT EXISTS is_community_controlled boolean DEFAULT false;

-- Populate from postcode_geo + seifa_2021
UPDATE gs_entities e
SET remoteness = p.remoteness_2021,
    sa2_code = p.sa2_code
FROM (SELECT DISTINCT ON (postcode) postcode, remoteness_2021, sa2_code FROM postcode_geo) p
WHERE e.postcode = p.postcode AND e.postcode IS NOT NULL;

UPDATE gs_entities e
SET seifa_irsd_decile = s.decile_national
FROM seifa_2021 s
WHERE s.postcode = e.postcode AND s.index_type = 'IRSD' AND e.postcode IS NOT NULL;

-- Classify community-controlled organisations
-- 1. ORIC Indigenous corporations are definitionally community-controlled
UPDATE gs_entities SET is_community_controlled = true
WHERE entity_type = 'indigenous_corp';

-- 2. Charities with Aboriginal/Torres Strait Islander in their name (strong signal)
UPDATE gs_entities SET is_community_controlled = true
WHERE entity_type IN ('charity', 'social_enterprise')
  AND (
    canonical_name ILIKE '%aboriginal%'
    OR canonical_name ILIKE '%torres strait%'
    OR canonical_name ILIKE '%indigenous%'
    OR canonical_name ILIKE '%first nations%'
    OR canonical_name ILIKE '%koori%'
    OR canonical_name ILIKE '%murri%'
    OR canonical_name ILIKE '%yolngu%'
    OR canonical_name ILIKE '%noongar%'
  );

-- Indexes for place-based queries
CREATE INDEX IF NOT EXISTS idx_entities_postcode ON gs_entities(postcode) WHERE postcode IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_entities_community_controlled ON gs_entities(is_community_controlled) WHERE is_community_controlled = true;
CREATE INDEX IF NOT EXISTS idx_entities_seifa ON gs_entities(seifa_irsd_decile);
CREATE INDEX IF NOT EXISTS idx_entities_remoteness ON gs_entities(remoteness);
