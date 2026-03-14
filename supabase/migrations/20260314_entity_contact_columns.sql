-- Add contact fields to gs_entities for enrichment pipeline

ALTER TABLE gs_entities
  ADD COLUMN IF NOT EXISTS email text,
  ADD COLUMN IF NOT EXISTS phone text,
  ADD COLUMN IF NOT EXISTS contact_source text;

CREATE INDEX IF NOT EXISTS idx_gs_entities_email
  ON gs_entities(email) WHERE email IS NOT NULL;
