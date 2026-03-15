-- Add metadata jsonb column to gs_entities for enrichment data
-- (logos, social media, photos, videos, annual reports)
ALTER TABLE gs_entities ADD COLUMN IF NOT EXISTS metadata jsonb DEFAULT '{}';
CREATE INDEX IF NOT EXISTS idx_gs_entities_metadata ON gs_entities USING gin (metadata) WHERE metadata IS NOT NULL AND metadata != '{}';
