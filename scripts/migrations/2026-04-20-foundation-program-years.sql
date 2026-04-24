BEGIN;

ALTER TABLE public.foundation_programs
  ADD COLUMN IF NOT EXISTS slug text,
  ADD COLUMN IF NOT EXISTS metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
  ADD COLUMN IF NOT EXISTS thematic_focus text[] NOT NULL DEFAULT '{}'::text[],
  ADD COLUMN IF NOT EXISTS place_focus text[] NOT NULL DEFAULT '{}'::text[],
  ADD COLUMN IF NOT EXISTS source_urls text[] NOT NULL DEFAULT '{}'::text[],
  ADD COLUMN IF NOT EXISTS application_mode text;

CREATE INDEX IF NOT EXISTS foundation_programs_foundation_status_idx
  ON public.foundation_programs (foundation_id, status);
CREATE INDEX IF NOT EXISTS foundation_programs_slug_idx
  ON public.foundation_programs (slug)
  WHERE slug IS NOT NULL;

CREATE TABLE IF NOT EXISTS public.foundation_program_years (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  foundation_program_id uuid NOT NULL REFERENCES public.foundation_programs(id) ON DELETE CASCADE,
  foundation_id uuid NOT NULL REFERENCES public.foundations(id) ON DELETE CASCADE,
  report_year integer,
  fiscal_year text,
  summary text,
  reported_amount numeric,
  partners jsonb NOT NULL DEFAULT '[]'::jsonb,
  places jsonb NOT NULL DEFAULT '[]'::jsonb,
  outcomes jsonb NOT NULL DEFAULT '[]'::jsonb,
  source_report_url text,
  metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT foundation_program_years_program_year_unique UNIQUE (foundation_program_id, fiscal_year)
);

CREATE INDEX IF NOT EXISTS foundation_program_years_foundation_idx
  ON public.foundation_program_years (foundation_id, report_year DESC NULLS LAST);
CREATE INDEX IF NOT EXISTS foundation_program_years_program_idx
  ON public.foundation_program_years (foundation_program_id, fiscal_year);

DROP TRIGGER IF EXISTS update_foundation_program_years_updated_at ON public.foundation_program_years;
CREATE TRIGGER update_foundation_program_years_updated_at
  BEFORE UPDATE ON public.foundation_program_years
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

COMMENT ON TABLE public.foundation_program_years IS
  'Year-specific memory for foundation programs, preserving reported partners, places, outcomes, and amounts from annual reports.';

COMMIT;
