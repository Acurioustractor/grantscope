-- Fix is_community_controlled false positives
-- Problem: enrich-from-acnc.mjs flagged ANY charity listing Aboriginal/TSI as
-- a beneficiary group as "community-controlled". This is wrong — a charity
-- serving Indigenous people (Red Cross, Mission Australia) is not the same as
-- being controlled BY Indigenous communities.
--
-- Correct criteria:
-- 1. entity_type = 'indigenous_corp' (ORIC-registered) → always community-controlled
-- 2. Name contains Indigenous-related terms → likely community-controlled
-- 3. Merely listing Aboriginal/TSI as beneficiaries → NOT community-controlled
--
-- This migration unsets the flag for group 3 only.

-- Count before
DO $$
DECLARE
  before_count INTEGER;
BEGIN
  SELECT COUNT(*) INTO before_count FROM gs_entities WHERE is_community_controlled = TRUE;
  RAISE NOTICE 'Before: % entities flagged as community-controlled', before_count;
END $$;

-- Unset flag for entities that are NOT indigenous_corp AND don't have Indigenous names
UPDATE gs_entities
SET is_community_controlled = FALSE, updated_at = NOW()
WHERE is_community_controlled = TRUE
  AND entity_type != 'indigenous_corp'
  AND canonical_name NOT ILIKE ANY(ARRAY[
    '%aboriginal%', '%torres strait%', '%indigenous%', '%first nations%',
    '%koori%', '%murri%', '%yolngu%', '%noongar%', '%palawa%', '%nyungar%',
    '%anangu%', '%arrernte%', '%warlpiri%', '%pitjantjatjara%',
    '%community controlled%', '%land council%', '%native title%'
  ]);

-- Count after
DO $$
DECLARE
  after_count INTEGER;
  oric_count INTEGER;
  name_count INTEGER;
BEGIN
  SELECT COUNT(*) INTO after_count FROM gs_entities WHERE is_community_controlled = TRUE;
  SELECT COUNT(*) INTO oric_count FROM gs_entities WHERE is_community_controlled = TRUE AND entity_type = 'indigenous_corp';
  SELECT COUNT(*) INTO name_count FROM gs_entities WHERE is_community_controlled = TRUE AND entity_type != 'indigenous_corp';
  RAISE NOTICE 'After: % entities flagged as community-controlled', after_count;
  RAISE NOTICE '  ORIC indigenous_corp: %', oric_count;
  RAISE NOTICE '  Name-matched (non-ORIC): %', name_count;
END $$;
