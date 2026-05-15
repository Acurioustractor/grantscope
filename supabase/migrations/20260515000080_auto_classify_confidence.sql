-- Phase 3 — LLM auto-classification provenance
-- Adds confidence + reason columns so the triage UI can sort/filter low-confidence rows

ALTER TABLE alma_funding_opportunities
  ADD COLUMN IF NOT EXISTS auto_classify_confidence numeric(3,2),
  ADD COLUMN IF NOT EXISTS auto_classify_reason text,
  ADD COLUMN IF NOT EXISTS auto_classify_model text,
  ADD COLUMN IF NOT EXISTS auto_classify_at timestamptz;

CREATE INDEX IF NOT EXISTS alma_auto_classify_conf_idx
  ON alma_funding_opportunities (auto_classify_confidence)
  WHERE auto_classify_confidence IS NOT NULL;
