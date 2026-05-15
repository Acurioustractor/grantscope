-- Phase 4 — field-backfill provenance for alma_funding_opportunities
-- Tracks which fields came from LLM extraction vs scraper vs manual

ALTER TABLE alma_funding_opportunities
  ADD COLUMN IF NOT EXISTS fields_backfilled_at timestamptz,
  ADD COLUMN IF NOT EXISTS fields_backfilled_by text,
  ADD COLUMN IF NOT EXISTS fields_backfilled_reason text;

CREATE INDEX IF NOT EXISTS alma_backfill_idx
  ON alma_funding_opportunities (fields_backfilled_at)
  WHERE fields_backfilled_at IS NOT NULL;
