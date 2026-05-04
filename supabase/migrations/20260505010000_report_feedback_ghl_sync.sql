-- Add GHL sync tracking + data_interactions to report_feedback
-- so the /pricing form (now a structured value-conversation) can:
--   1. Push leads into GoHighLevel with rich tags
--   2. Capture how respondents want to interact with procurement / grants /
--      donations / contracts data (separate from generic topics_wanted)

ALTER TABLE public.report_feedback ADD COLUMN IF NOT EXISTS data_interactions text[];
ALTER TABLE public.report_feedback ADD COLUMN IF NOT EXISTS ghl_synced_at timestamptz;
ALTER TABLE public.report_feedback ADD COLUMN IF NOT EXISTS ghl_contact_id text;

-- Partial index for backfill: rows pending GHL sync
CREATE INDEX IF NOT EXISTS report_feedback_ghl_unsynced_idx
  ON public.report_feedback (ghl_synced_at)
  WHERE ghl_synced_at IS NULL;
