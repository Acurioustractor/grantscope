-- qld_bills — official bills register from QLD Parliament
-- Scraped via Playwright (parliament.qld.gov.au is JS-rendered).

CREATE TABLE IF NOT EXISTS public.qld_bills (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  source_url text UNIQUE NOT NULL,
  bill_name text NOT NULL,
  bill_year int,
  sponsor text,                        -- e.g. "Hon M Scanlon MP" or "Mr R Katter MP"
  sponsor_party text,                  -- inferred from sponsor + recent ministerial portfolio
  introduced_date date,
  status text,                         -- e.g. "Referred to Committee", "Assented", "Defeated"
  status_date date,
  parliament_session text,             -- e.g. "Bills this Parliament" / "Bills previous Parliaments"
  is_yj_relevant boolean DEFAULT false,
  topics text[],                       -- matched keywords e.g. {youth-justice, bail, sentencing}
  scraped_at timestamptz DEFAULT now(),
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_qld_bills_yj ON public.qld_bills (is_yj_relevant) WHERE is_yj_relevant = true;
CREATE INDEX IF NOT EXISTS idx_qld_bills_year ON public.qld_bills (bill_year DESC NULLS LAST);
CREATE INDEX IF NOT EXISTS idx_qld_bills_topics ON public.qld_bills USING gin (topics);
CREATE INDEX IF NOT EXISTS idx_qld_bills_status ON public.qld_bills (status);

COMMENT ON TABLE public.qld_bills IS 'QLD Parliament Bills register, scraped from parliament.qld.gov.au/Work-of-the-Assembly/Bills-and-Legislation. is_yj_relevant flag is set when name contains youth-justice / bail / sentencing / criminal code / community safety / making queensland safer keywords.';
