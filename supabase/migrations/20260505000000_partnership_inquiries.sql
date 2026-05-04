-- Partnership inquiries from /share/partner form
-- Mirrors report_feedback structure but captures partnership-shaped intent
-- (foundation co-funding, ACCO bespoke version, journalism, sector peak,
-- researcher dataset access, other) plus the originating share artefact.

CREATE TABLE IF NOT EXISTS public.partnership_inquiries (
  id                  uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  submitted_at        timestamptz NOT NULL DEFAULT now(),
  -- Provenance
  source_path         text,            -- /share/partner
  source_referrer     text,            -- where they came from before the form
  source_artefact     text,            -- ?ref= value, e.g. qld-youth-justice
  -- Inquiry shape
  partnership_types   text[],          -- ticked options
  partnership_other   text,            -- free text if "other" ticked
  message             text NOT NULL,   -- the actual ask, required
  budget_band         text,            -- optional self-reported budget
  timeline            text,            -- optional self-reported timeline
  -- Contact (required for partnership inquiries — unlike feedback)
  contact_name        text NOT NULL,
  contact_email       text NOT NULL,
  contact_org         text,
  contact_role        text,
  contact_phone       text,
  -- Telemetry
  user_agent          text
);

CREATE INDEX IF NOT EXISTS partnership_inquiries_submitted_at_idx
  ON public.partnership_inquiries (submitted_at DESC);

CREATE INDEX IF NOT EXISTS partnership_inquiries_source_artefact_idx
  ON public.partnership_inquiries (source_artefact)
  WHERE source_artefact IS NOT NULL;

COMMENT ON TABLE public.partnership_inquiries IS
  'Inbound partnership inquiries from /share/partner form. One row per submission. source_artefact ties the inquiry back to the report or share page that drove it.';
