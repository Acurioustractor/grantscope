-- QLD coronial findings + parliamentary hansard signals
-- For the QLD Youth Justice flagship report (Volume 7).
-- Both tables follow the same source_id-uniqueness pattern as
-- civic_ministerial_statements; scrapers populate them daily.

CREATE TABLE IF NOT EXISTS public.qld_coroners_findings (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  source_id text UNIQUE NOT NULL,
  source_url text NOT NULL,
  title text,
  deceased_identifier text,            -- name / initials / protected-ID per QLD coronial-suppression rules
  age_at_death int,                    -- where reported
  date_of_death date,
  finding_date date,
  coroner_name text,
  location text,                       -- e.g. "Cleveland Youth Detention Centre, Townsville"
  cause_of_death_summary text,
  key_findings text,
  recommendations_count int,
  is_youth_justice boolean DEFAULT false,
  is_in_custody boolean DEFAULT false, -- watchhouse / detention / police custody
  topics text[],
  body_text text,
  scraped_at timestamptz DEFAULT now(),
  created_at timestamptz DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_qld_coroners_youth_justice ON public.qld_coroners_findings (is_youth_justice) WHERE is_youth_justice = true;
CREATE INDEX IF NOT EXISTS idx_qld_coroners_finding_date ON public.qld_coroners_findings (finding_date DESC NULLS LAST);
CREATE INDEX IF NOT EXISTS idx_qld_coroners_topics ON public.qld_coroners_findings USING gin (topics);

CREATE TABLE IF NOT EXISTS public.qld_hansard_signals (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  source_id text UNIQUE NOT NULL,
  source_url text,
  sitting_date date,
  speaker text,
  party text,
  electorate text,
  portfolio text,                      -- where applicable (Minister speeches)
  topic_keywords text[],               -- matched keywords e.g. {youth-justice, detention, watchhouse}
  excerpt text,                        -- short snippet for the dashboard card
  full_extract text,                   -- 5-paragraph snippet of the speech
  hansard_date_section text,           -- e.g. "2024-11-26 / Question Time"
  topics text[],
  scraped_at timestamptz DEFAULT now(),
  created_at timestamptz DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_qld_hansard_date ON public.qld_hansard_signals (sitting_date DESC NULLS LAST);
CREATE INDEX IF NOT EXISTS idx_qld_hansard_topics ON public.qld_hansard_signals USING gin (topics);
CREATE INDEX IF NOT EXISTS idx_qld_hansard_keywords ON public.qld_hansard_signals USING gin (topic_keywords);

COMMENT ON TABLE public.qld_coroners_findings IS 'QLD Coroners Court inquest findings, scraped from coronerscourt.qld.gov.au. Filtered to youth-justice and deaths-in-custody for the YJ report.';
COMMENT ON TABLE public.qld_hansard_signals IS 'QLD Parliament Hansard mentions of youth-justice / detention / watchhouse / bail keywords. Scraped from parliament.qld.gov.au.';
