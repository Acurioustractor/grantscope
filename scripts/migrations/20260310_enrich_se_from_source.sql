-- Enrich gs_entities social enterprises from social_enterprises source table
-- Backfills: postcode, state, sector, website (via description)

-- 1. Backfill postcode where missing
UPDATE gs_entities e
SET postcode = se.postcode
FROM social_enterprises se
WHERE e.abn = se.abn
  AND e.entity_type = 'social_enterprise'
  AND e.postcode IS NULL
  AND se.postcode IS NOT NULL;

-- 2. Backfill state where missing
UPDATE gs_entities e
SET state = se.state
FROM social_enterprises se
WHERE e.abn = se.abn
  AND e.entity_type = 'social_enterprise'
  AND e.state IS NULL
  AND se.state IS NOT NULL;

-- 3. Backfill sector from first array element
UPDATE gs_entities e
SET sector = se.sector[1]
FROM social_enterprises se
WHERE e.abn = se.abn
  AND e.entity_type = 'social_enterprise'
  AND e.sector IS NULL
  AND se.sector IS NOT NULL
  AND array_length(se.sector, 1) > 0;

-- 4. Cascade: fill remoteness from postcode_geo for newly-postcoded SEs
UPDATE gs_entities e
SET remoteness = pg.remoteness_2021
FROM postcode_geo pg
WHERE e.postcode = pg.postcode
  AND e.entity_type = 'social_enterprise'
  AND e.remoteness IS NULL
  AND pg.remoteness_2021 IS NOT NULL;

-- 5. Cascade: fill SEIFA from seifa_2021
UPDATE gs_entities e
SET seifa_irsd_decile = s.decile_national
FROM seifa_2021 s
WHERE e.postcode = s.postcode
  AND e.entity_type = 'social_enterprise'
  AND e.seifa_irsd_decile IS NULL
  AND s.index_type = 'irsd'
  AND s.decile_national IS NOT NULL;

-- 6. Cascade: fill LGA from postcode_geo
UPDATE gs_entities e
SET lga_name = pg.lga_name,
    lga_code = pg.lga_code
FROM postcode_geo pg
WHERE e.postcode = pg.postcode
  AND e.entity_type = 'social_enterprise'
  AND e.lga_name IS NULL
  AND pg.lga_name IS NOT NULL;

-- 7. Report
SELECT 'SE enrichment complete' as status,
  COUNT(*) as total_se,
  COUNT(postcode) as has_postcode,
  COUNT(state) as has_state,
  COUNT(remoteness) as has_remoteness,
  COUNT(seifa_irsd_decile) as has_seifa,
  COUNT(lga_name) as has_lga,
  COUNT(sector) as has_sector
FROM gs_entities
WHERE entity_type = 'social_enterprise';
