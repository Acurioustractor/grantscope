-- Make qld_bills + qld_coroners_findings jurisdiction-aware so NSW/VIC/WA
-- can write to the same schema. Renames tables, adds jurisdiction column,
-- backfills existing rows to 'QLD', preserves indexes.

-- ── qld_bills → parliament_bills ────────────────────────────────────────
ALTER TABLE IF EXISTS public.qld_bills RENAME TO parliament_bills;

ALTER TABLE IF EXISTS public.parliament_bills
  ADD COLUMN IF NOT EXISTS jurisdiction text DEFAULT 'QLD' NOT NULL;

UPDATE public.parliament_bills SET jurisdiction = 'QLD' WHERE jurisdiction IS NULL OR jurisdiction = '';

CREATE INDEX IF NOT EXISTS idx_parliament_bills_jurisdiction
  ON public.parliament_bills (jurisdiction);

-- Rename the existing yj-flag index just to keep it consistent with the new table name.
-- (idx_qld_bills_yj already exists; pg_get_indexdef shows the table reference is by oid
--  so the rename works without breaking the index.)

COMMENT ON TABLE public.parliament_bills IS
  'Australian state-and-territory Parliament Bills register. Scraped via Playwright per jurisdiction. is_yj_relevant=true when name matches youth-justice/bail/sentencing/criminal-code/community-safety keywords. jurisdiction values: QLD, NSW, VIC, WA, SA, NT, TAS, ACT.';

-- ── qld_coroners_findings → coroners_findings ───────────────────────────
ALTER TABLE IF EXISTS public.qld_coroners_findings RENAME TO coroners_findings;

ALTER TABLE IF EXISTS public.coroners_findings
  ADD COLUMN IF NOT EXISTS jurisdiction text DEFAULT 'QLD' NOT NULL;

UPDATE public.coroners_findings SET jurisdiction = 'QLD' WHERE jurisdiction IS NULL OR jurisdiction = '';

CREATE INDEX IF NOT EXISTS idx_coroners_findings_jurisdiction
  ON public.coroners_findings (jurisdiction);

COMMENT ON TABLE public.coroners_findings IS
  'Australian Coroners Court inquest findings register. Scraped per jurisdiction. is_youth_justice/is_in_custody flags set by keyword classifier. jurisdiction values: QLD, NSW, VIC, WA, SA, NT, TAS, ACT.';

-- Backwards-compat views so the existing dashboard queries keep working
-- while we migrate the codebase.
CREATE OR REPLACE VIEW public.qld_bills AS
  SELECT * FROM public.parliament_bills WHERE jurisdiction = 'QLD';

CREATE OR REPLACE VIEW public.qld_coroners_findings AS
  SELECT * FROM public.coroners_findings WHERE jurisdiction = 'QLD';

-- Update v_qld_yj_bills_active to keep working (it referenced civic_hansard
-- not qld_bills, so no change needed there)
