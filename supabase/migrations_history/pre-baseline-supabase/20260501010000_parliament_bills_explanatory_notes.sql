-- Add explanatory note + statement of compatibility URLs and PDF-extracted text
-- to parliament_bills so the QLD YJ flagship report can surface what bills
-- ACTUALLY say (not just their listing-row metadata).

ALTER TABLE public.parliament_bills
  ADD COLUMN IF NOT EXISTS explanatory_note_url           text,
  ADD COLUMN IF NOT EXISTS statement_of_compatibility_url text,
  ADD COLUMN IF NOT EXISTS explanatory_note_text          text,
  ADD COLUMN IF NOT EXISTS explanatory_note_fetched_at    timestamptz,
  ADD COLUMN IF NOT EXISTS explanatory_note_chars         integer;

CREATE INDEX IF NOT EXISTS parliament_bills_yj_exp_note_idx
  ON public.parliament_bills (is_yj_relevant, explanatory_note_url)
  WHERE is_yj_relevant = true AND explanatory_note_url IS NOT NULL;

-- Recreate the qld_bills view to expose new columns to PostgREST.
CREATE OR REPLACE VIEW public.qld_bills AS
SELECT * FROM public.parliament_bills WHERE jurisdiction = 'QLD';

COMMENT ON COLUMN public.parliament_bills.explanatory_note_text IS
  'Text extracted from the Explanatory Note PDF via pdftotext. Truncated to ~200KB.';
