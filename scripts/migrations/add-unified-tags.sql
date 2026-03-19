-- Add unified_tags to person_identity_map for cross-system tag sync
-- Tags use prefix:value format (role:funder, engagement:active, sector:youth-justice, etc.)

ALTER TABLE person_identity_map
  ADD COLUMN IF NOT EXISTS unified_tags text[] DEFAULT '{}';

CREATE INDEX IF NOT EXISTS idx_pim_unified_tags
  ON person_identity_map USING GIN (unified_tags);

COMMENT ON COLUMN person_identity_map.unified_tags IS 'Canonical tags merged from GHL, CivicGraph, and Notion. Format: prefix:value';
