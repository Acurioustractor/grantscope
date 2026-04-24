-- Round A — Tiered community-controlled classification + Supply Nation flag
--
-- Adds three columns to gs_entities:
--   community_controlled_tier  — 'oric' | 'acnc_indigenous' | 'self_identified' | 'board_analyzed' | 'unclassified' | null
--   cc_confidence              — 0-10 scale, null for unclassified
--   is_supply_nation_certified — boolean, default false
--
-- All three are additive and backward-compatible. The existing
-- is_community_controlled boolean is preserved and remains the primary
-- public-facing flag. The tier + confidence provide the finer-grained
-- breakdown the Indigenous Proxy investigation needs to distinguish
-- verified Indigenous-controlled orgs from self-identified or inferred.

BEGIN;

ALTER TABLE gs_entities
  ADD COLUMN IF NOT EXISTS community_controlled_tier text,
  ADD COLUMN IF NOT EXISTS cc_confidence smallint,
  ADD COLUMN IF NOT EXISTS is_supply_nation_certified boolean DEFAULT false;

-- Tier constraint — valid values only
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'gs_entities_cc_tier_check'
  ) THEN
    ALTER TABLE gs_entities
      ADD CONSTRAINT gs_entities_cc_tier_check
      CHECK (community_controlled_tier IS NULL
        OR community_controlled_tier IN ('oric', 'acnc_indigenous', 'self_identified', 'board_analyzed', 'unclassified'));
  END IF;
END $$;

-- Confidence range
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'gs_entities_cc_confidence_check'
  ) THEN
    ALTER TABLE gs_entities
      ADD CONSTRAINT gs_entities_cc_confidence_check
      CHECK (cc_confidence IS NULL OR (cc_confidence >= 0 AND cc_confidence <= 10));
  END IF;
END $$;

-- Index on tier for the Indigenous Proxy report queries
CREATE INDEX IF NOT EXISTS gs_entities_cc_tier_idx
  ON gs_entities (community_controlled_tier)
  WHERE community_controlled_tier IS NOT NULL;

CREATE INDEX IF NOT EXISTS gs_entities_supply_nation_idx
  ON gs_entities (is_supply_nation_certified)
  WHERE is_supply_nation_certified = true;

COMMIT;

-- Backfill tier 1: ORIC (highest confidence)
-- Every indigenous_corp entity_type → tier='oric', confidence 10
UPDATE gs_entities
   SET community_controlled_tier = 'oric',
       cc_confidence = 10
 WHERE entity_type = 'indigenous_corp'
   AND (community_controlled_tier IS NULL OR community_controlled_tier = 'unclassified');

-- Backfill tier 2: ACNC Indigenous-focused charities (high confidence)
-- Charities where ACNC purposes or beneficiaries explicitly mention Indigenous
UPDATE gs_entities ge
   SET community_controlled_tier = 'acnc_indigenous',
       cc_confidence = 8
  FROM acnc_charities ac
 WHERE ge.abn = ac.abn
   AND ge.community_controlled_tier IS NULL
   AND (
     ac.purposes::text ILIKE '%indigenous%'
     OR ac.purposes::text ILIKE '%aboriginal%'
     OR ac.purposes::text ILIKE '%torres strait%'
     OR ac.beneficiaries::text ILIKE '%indigenous%'
     OR ac.beneficiaries::text ILIKE '%aboriginal%'
     OR ac.beneficiaries::text ILIKE '%torres strait%'
   );

-- Backfill tier 3: self-identified by name (medium confidence)
UPDATE gs_entities
   SET community_controlled_tier = 'self_identified',
       cc_confidence = 6,
       is_community_controlled = true
 WHERE community_controlled_tier IS NULL
   AND entity_type IN ('charity', 'social_enterprise', 'trust', 'unknown', 'company', 'foundation')
   AND (
     canonical_name ILIKE '%aboriginal%'
     OR canonical_name ILIKE '%torres strait%'
     OR canonical_name ILIKE '%indigenous%'
     OR canonical_name ILIKE '%first nations%'
     OR canonical_name ILIKE '%land council%'
     OR canonical_name ILIKE '%native title%'
     OR canonical_name ILIKE '%koori%'
     OR canonical_name ILIKE '%murri%'
     OR canonical_name ILIKE '%yolngu%'
     OR canonical_name ILIKE '%noongar%'
     OR canonical_name ILIKE '%palawa%'
     OR canonical_name ILIKE '%nyungar%'
     OR canonical_name ILIKE '%anangu%'
     OR canonical_name ILIKE '%arrernte%'
     OR canonical_name ILIKE '%warlpiri%'
     OR canonical_name ILIKE '%pitjantjatjara%'
   );

-- Everything else with is_community_controlled = true but no tier yet → 'unclassified' (tier unknown, flag respected)
UPDATE gs_entities
   SET community_controlled_tier = 'unclassified',
       cc_confidence = 3
 WHERE community_controlled_tier IS NULL
   AND is_community_controlled = true;

-- Verify
SELECT community_controlled_tier, cc_confidence, COUNT(*) as cnt
  FROM gs_entities
 WHERE community_controlled_tier IS NOT NULL
 GROUP BY community_controlled_tier, cc_confidence
 ORDER BY cnt DESC;
