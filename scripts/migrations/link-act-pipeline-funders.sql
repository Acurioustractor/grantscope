-- Link ACT pipeline items to foundation entities in gs_entities
-- This enables the dashboard to show network connections to funders

BEGIN;

-- Myer Foundation / Sidney Myer Fund
UPDATE org_pipeline SET funder_entity_id = (
  SELECT id FROM gs_entities WHERE canonical_name ILIKE '%Myer Foundation%' AND entity_type = 'charity' LIMIT 1
), funder_type = 'foundation'
WHERE org_profile_id = '8b6160a1-7eea-4bd2-8404-71c196381de0'
  AND funder ILIKE '%Myer%'
  AND funder_entity_id IS NULL;

-- Paul Ramsay Foundation
UPDATE org_pipeline SET funder_entity_id = (
  SELECT id FROM gs_entities WHERE canonical_name ILIKE '%Paul Ramsay%' LIMIT 1
), funder_type = 'foundation'
WHERE org_profile_id = '8b6160a1-7eea-4bd2-8404-71c196381de0'
  AND funder ILIKE '%Ramsay%'
  AND funder_entity_id IS NULL;

-- Ian Potter Foundation
UPDATE org_pipeline SET funder_entity_id = (
  SELECT id FROM gs_entities WHERE canonical_name ILIKE '%Ian Potter%' LIMIT 1
), funder_type = 'foundation'
WHERE org_profile_id = '8b6160a1-7eea-4bd2-8404-71c196381de0'
  AND funder ILIKE '%Potter%'
  AND funder_entity_id IS NULL;

-- Australian Communities Foundation
UPDATE org_pipeline SET funder_entity_id = (
  SELECT id FROM gs_entities WHERE canonical_name ILIKE '%Australian Communities Foundation%' LIMIT 1
), funder_type = 'foundation'
WHERE org_profile_id = '8b6160a1-7eea-4bd2-8404-71c196381de0'
  AND funder ILIKE '%Communities Foundation%'
  AND funder_entity_id IS NULL;

-- Minderoo Foundation
UPDATE org_pipeline SET funder_entity_id = (
  SELECT id FROM gs_entities WHERE canonical_name ILIKE '%Minderoo%' LIMIT 1
), funder_type = 'foundation'
WHERE org_profile_id = '8b6160a1-7eea-4bd2-8404-71c196381de0'
  AND funder ILIKE '%Minderoo%'
  AND funder_entity_id IS NULL;

-- BHP Foundation
UPDATE org_pipeline SET funder_entity_id = (
  SELECT id FROM gs_entities WHERE canonical_name ILIKE '%BHP Foundation%' LIMIT 1
), funder_type = 'foundation'
WHERE org_profile_id = '8b6160a1-7eea-4bd2-8404-71c196381de0'
  AND funder ILIKE '%BHP%'
  AND funder_entity_id IS NULL;

-- Rio Tinto Foundation
UPDATE org_pipeline SET funder_entity_id = (
  SELECT id FROM gs_entities WHERE canonical_name ILIKE '%Rio Tinto%' LIMIT 1
), funder_type = 'foundation'
WHERE org_profile_id = '8b6160a1-7eea-4bd2-8404-71c196381de0'
  AND funder ILIKE '%Rio Tinto%'
  AND funder_entity_id IS NULL;

-- CBA Foundation
UPDATE org_pipeline SET funder_entity_id = (
  SELECT id FROM gs_entities WHERE canonical_name ILIKE '%CBA Foundation%' LIMIT 1
), funder_type = 'foundation'
WHERE org_profile_id = '8b6160a1-7eea-4bd2-8404-71c196381de0'
  AND funder ILIKE '%CBA%'
  AND funder_entity_id IS NULL;

-- Fortescue Foundation
UPDATE org_pipeline SET funder_entity_id = (
  SELECT id FROM gs_entities WHERE canonical_name ILIKE '%Fortescue%' LIMIT 1
), funder_type = 'foundation'
WHERE org_profile_id = '8b6160a1-7eea-4bd2-8404-71c196381de0'
  AND funder ILIKE '%Fortescue%'
  AND funder_entity_id IS NULL;

-- Snow Foundation
UPDATE org_pipeline SET funder_entity_id = (
  SELECT id FROM gs_entities WHERE canonical_name ILIKE '%Snow Foundation%' LIMIT 1
), funder_type = 'foundation'
WHERE org_profile_id = '8b6160a1-7eea-4bd2-8404-71c196381de0'
  AND funder ILIKE '%Snow%'
  AND funder_entity_id IS NULL;

-- Woolworths Group Foundation
UPDATE org_pipeline SET funder_entity_id = (
  SELECT id FROM gs_entities WHERE canonical_name ILIKE '%Woolworths Group Foundation%' LIMIT 1
), funder_type = 'foundation'
WHERE org_profile_id = '8b6160a1-7eea-4bd2-8404-71c196381de0'
  AND funder ILIKE '%Woolworths%'
  AND funder_entity_id IS NULL;

-- Vincent Fairfax Family Foundation
UPDATE org_pipeline SET funder_entity_id = (
  SELECT id FROM gs_entities WHERE canonical_name ILIKE '%Vincent Fairfax%' LIMIT 1
), funder_type = 'foundation'
WHERE org_profile_id = '8b6160a1-7eea-4bd2-8404-71c196381de0'
  AND funder ILIKE '%Vincent Fairfax%'
  AND funder_entity_id IS NULL;

-- Tim Fairfax Family Foundation
UPDATE org_pipeline SET funder_entity_id = (
  SELECT id FROM gs_entities WHERE canonical_name ILIKE '%Tim Fairfax%' LIMIT 1
), funder_type = 'foundation'
WHERE org_profile_id = '8b6160a1-7eea-4bd2-8404-71c196381de0'
  AND funder ILIKE '%Tim Fairfax%'
  AND funder_entity_id IS NULL;

-- Lowy Foundation
UPDATE org_pipeline SET funder_entity_id = (
  SELECT id FROM gs_entities WHERE canonical_name ILIKE '%Lowy%' LIMIT 1
), funder_type = 'foundation'
WHERE org_profile_id = '8b6160a1-7eea-4bd2-8404-71c196381de0'
  AND funder ILIKE '%Lowy%'
  AND funder_entity_id IS NULL;

-- QBE Foundation
UPDATE org_pipeline SET funder_entity_id = (
  SELECT id FROM gs_entities WHERE canonical_name ILIKE '%QBE%Foundation%' OR canonical_name ILIKE '%QBE%' LIMIT 1
), funder_type = 'foundation'
WHERE org_profile_id = '8b6160a1-7eea-4bd2-8404-71c196381de0'
  AND funder ILIKE '%QBE%'
  AND funder_entity_id IS NULL;

-- Suncorp Foundation
UPDATE org_pipeline SET funder_entity_id = (
  SELECT id FROM gs_entities WHERE canonical_name ILIKE '%Suncorp%' LIMIT 1
), funder_type = 'foundation'
WHERE org_profile_id = '8b6160a1-7eea-4bd2-8404-71c196381de0'
  AND funder ILIKE '%Suncorp%'
  AND funder_entity_id IS NULL;

-- Macquarie Group Foundation
UPDATE org_pipeline SET funder_entity_id = (
  SELECT id FROM gs_entities WHERE canonical_name ILIKE '%Macquarie Group Foundation%' LIMIT 1
), funder_type = 'foundation'
WHERE org_profile_id = '8b6160a1-7eea-4bd2-8404-71c196381de0'
  AND funder ILIKE '%Macquarie%'
  AND funder_entity_id IS NULL;

-- Add R&D Tax Incentive pipeline item if not exists
INSERT INTO org_pipeline (org_profile_id, name, funder, amount_display, amount_numeric, status, funder_type, notes)
SELECT '8b6160a1-7eea-4bd2-8404-71c196381de0',
       'R&D Tax Incentive — FY26 Claim',
       'ATO / AusIndustry',
       '$170K/yr refund',
       170000,
       'prospect',
       'government',
       '43.5% refundable offset on ~$490K eligible R&D spend. Registration deadline April 30 for FY25 activities. Requires Pty Ltd structure (July 2026).'
WHERE NOT EXISTS (
  SELECT 1 FROM org_pipeline
  WHERE org_profile_id = '8b6160a1-7eea-4bd2-8404-71c196381de0'
    AND name ILIKE '%R&D Tax%'
);

-- Add Gambling Community Benefit Fund if not exists
INSERT INTO org_pipeline (org_profile_id, name, funder, amount_display, amount_numeric, status, funder_type, deadline, notes)
SELECT '8b6160a1-7eea-4bd2-8404-71c196381de0',
       'Gambling Community Benefit Fund (QLD)',
       'QLD Government',
       'Up to $35K',
       35000,
       'prospect',
       'government',
       'Rolling quarterly',
       'Community venue/equipment grants. Apply via AKT (charity). Easy application, rolling deadlines.'
WHERE NOT EXISTS (
  SELECT 1 FROM org_pipeline
  WHERE org_profile_id = '8b6160a1-7eea-4bd2-8404-71c196381de0'
    AND name ILIKE '%Gambling Community%'
);

-- Add Arts Queensland if not exists
INSERT INTO org_pipeline (org_profile_id, name, funder, amount_display, amount_numeric, status, funder_type, notes)
SELECT '8b6160a1-7eea-4bd2-8404-71c196381de0',
       'Arts Queensland — Organisations Fund',
       'Arts Queensland',
       '$50-200K/yr',
       100000,
       'prospect',
       'government',
       'Multi-year operational funding for arts organisations. Apply via AKT. Harvest gallery/programming.'
WHERE NOT EXISTS (
  SELECT 1 FROM org_pipeline
  WHERE org_profile_id = '8b6160a1-7eea-4bd2-8404-71c196381de0'
    AND name ILIKE '%Organisations Fund%'
);

-- Add Smart Farms / Landcare if not exists
INSERT INTO org_pipeline (org_profile_id, name, funder, amount_display, amount_numeric, status, funder_type, notes)
SELECT '8b6160a1-7eea-4bd2-8404-71c196381de0',
       'Smart Farms — Landcare AgTech Grants',
       'Landcare Australia / DAFF',
       '$50-200K',
       100000,
       'prospect',
       'government',
       'AgTech sensor networks, soil monitoring, regenerative data. Apply via Pty Ltd for Farm R&D.'
WHERE NOT EXISTS (
  SELECT 1 FROM org_pipeline
  WHERE org_profile_id = '8b6160a1-7eea-4bd2-8404-71c196381de0'
    AND name ILIKE '%Smart Farms%'
);

-- Add Documentary Australia Foundation if not exists
INSERT INTO org_pipeline (org_profile_id, name, funder, amount_display, amount_numeric, status, funder_type, notes)
SELECT '8b6160a1-7eea-4bd2-8404-71c196381de0',
       'Documentary Australia Foundation — Storytelling Impact',
       'Documentary Australia Foundation',
       '$10-50K',
       25000,
       'prospect',
       'foundation',
       'Empathy Ledger storytelling work. Documentary/impact content connected to Contained and World Tour.'
WHERE NOT EXISTS (
  SELECT 1 FROM org_pipeline
  WHERE org_profile_id = '8b6160a1-7eea-4bd2-8404-71c196381de0'
    AND funder ILIKE '%Documentary%'
);

-- Add Humanitix if not exists
INSERT INTO org_pipeline (org_profile_id, name, funder, amount_display, amount_numeric, status, funder_type, notes)
SELECT '8b6160a1-7eea-4bd2-8404-71c196381de0',
       'Humanitix Foundation — Event Impact Program',
       'Humanitix Foundation',
       '$10-50K',
       25000,
       'prospect',
       'foundation',
       'Arts + Indigenous + youth event programs at The Harvest. Natural partnership for social impact events.'
WHERE NOT EXISTS (
  SELECT 1 FROM org_pipeline
  WHERE org_profile_id = '8b6160a1-7eea-4bd2-8404-71c196381de0'
    AND funder ILIKE '%Humanitix%'
);

-- Add Gandel Foundation if not exists
INSERT INTO org_pipeline (org_profile_id, name, funder, amount_display, amount_numeric, status, funder_type, notes)
SELECT '8b6160a1-7eea-4bd2-8404-71c196381de0',
       'Gandel Foundation — Arts & Youth Community',
       'Gandel Family Foundation',
       '$25-100K',
       50000,
       'prospect',
       'foundation',
       'Arts + youth + community. Harvest programming model matches well.'
WHERE NOT EXISTS (
  SELECT 1 FROM org_pipeline
  WHERE org_profile_id = '8b6160a1-7eea-4bd2-8404-71c196381de0'
    AND funder ILIKE '%Gandel%'
);

-- Add IBA if not exists
INSERT INTO org_pipeline (org_profile_id, name, funder, amount_display, amount_numeric, status, funder_type, notes)
SELECT '8b6160a1-7eea-4bd2-8404-71c196381de0',
       'Indigenous Business Australia — Social Enterprise Fund',
       'Indigenous Business Australia',
       '$20-100K',
       50000,
       'prospect',
       'foundation',
       'Social enterprise funding for Indigenous-partnered ventures. Goods on Country / community-owned Harvest elements.'
WHERE NOT EXISTS (
  SELECT 1 FROM org_pipeline
  WHERE org_profile_id = '8b6160a1-7eea-4bd2-8404-71c196381de0'
    AND funder ILIKE '%Indigenous Business%'
);

-- Add Burnett Mary if not exists
INSERT INTO org_pipeline (org_profile_id, name, funder, amount_display, amount_numeric, status, funder_type, notes)
SELECT '8b6160a1-7eea-4bd2-8404-71c196381de0',
       'Burnett Mary NRM — Regenerative Agriculture Partnership',
       'Burnett Mary Regional Group',
       '$20-100K',
       50000,
       'prospect',
       'foundation',
       'Farm regenerative agriculture / biodiversity monitoring. QLD-based NRM group with $15M+ annual budget.'
WHERE NOT EXISTS (
  SELECT 1 FROM org_pipeline
  WHERE org_profile_id = '8b6160a1-7eea-4bd2-8404-71c196381de0'
    AND funder ILIKE '%Burnett%'
);

-- Add Social Traders certification as pipeline item
INSERT INTO org_pipeline (org_profile_id, name, funder, amount_display, status, funder_type, notes)
SELECT '8b6160a1-7eea-4bd2-8404-71c196381de0',
       'Social Traders Certification — Social Procurement Access',
       'Social Traders',
       'Access to $1B+ procurement',
       'prospect',
       'government',
       'Certification opens government social procurement panels. Apply after Pty Ltd registered (July 2026).'
WHERE NOT EXISTS (
  SELECT 1 FROM org_pipeline
  WHERE org_profile_id = '8b6160a1-7eea-4bd2-8404-71c196381de0'
    AND name ILIKE '%Social Traders%'
);

COMMIT;
