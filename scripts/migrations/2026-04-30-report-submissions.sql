-- Submission flow for /get-a-report — captures EOI for investigative reports.
-- Used to learn the demand curve (price-signal field) and route applicants to
-- the "First 5 Free" campaign, paid one-off reports, or recurring subscriptions.

CREATE TABLE IF NOT EXISTS public.report_submissions (
  id uuid primary key default gen_random_uuid(),
  submitted_at timestamp with time zone default now(),

  -- Contact
  contact_name text,
  contact_email text not null,
  contact_org text,
  contact_role text,

  -- What they want investigated
  target_subject text not null,            -- e.g. "FECCA + ECCV", "VIC settlement sector", "Smith Family"
  target_type text,                        -- charity | peak_body | sector | network | program | individual
  research_questions text,                 -- free text — the questions they want the report to answer
  decision_driving text,                   -- what decision the report will inform (board / board funder / oversight / journalism)

  -- Pricing signal
  timeline_pref text,                      -- urgent | 4_weeks | 8_weeks | no_rush
  budget_signal text,                      -- 0 (free 5) | 500 | 1500 | 2500 | 5000 | 10000_plus
  free_5_apply boolean default false,
  permission_to_publish boolean default false,

  -- Provenance
  source text,                             -- linkedin | referral | direct | search | dashboard | longread | other
  raw_referrer text,
  notes text                               -- internal triage notes
);

CREATE INDEX IF NOT EXISTS idx_report_submissions_submitted_at ON public.report_submissions(submitted_at DESC);

COMMENT ON TABLE public.report_submissions IS
  'EOI submissions from /get-a-report — both free-5-campaign applicants and paid-tier inbound. Used for pricing discovery + funnel learning.';
