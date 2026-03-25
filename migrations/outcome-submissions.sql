-- Outcome Submissions: partner-submitted outcomes for Governed Proof
-- Partners (e.g., Oonchiumpa) submit their program outcomes which get
-- reviewed, validated, and incorporated into proof bundles.

CREATE TABLE IF NOT EXISTS outcome_submissions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

  -- Who submitted
  submitted_by UUID REFERENCES auth.users(id),
  org_name TEXT NOT NULL,
  org_abn TEXT,
  gs_entity_id TEXT, -- links to gs_entities.gs_id
  contact_email TEXT,

  -- What they're reporting
  program_name TEXT NOT NULL,
  reporting_period TEXT NOT NULL, -- e.g., "Q1 2026", "FY 2025-26"

  -- Outcome data (flexible JSONB for different outcome types)
  outcomes JSONB NOT NULL DEFAULT '[]',
  -- Example outcomes array:
  -- [
  --   { "metric": "young_people_diverted", "value": 12, "unit": "people", "description": "Youth diverted from custody" },
  --   { "metric": "program_hours", "value": 480, "unit": "hours", "description": "Total program delivery hours" },
  --   { "metric": "community_satisfaction", "value": 4.2, "unit": "score_out_of_5", "description": "Community satisfaction survey" }
  -- ]

  -- Supporting evidence
  narrative TEXT, -- qualitative description of outcomes
  evidence_urls TEXT[], -- links to reports, evaluations, media
  methodology TEXT, -- how outcomes were measured

  -- Review workflow
  status TEXT NOT NULL DEFAULT 'submitted'
    CHECK (status IN ('draft', 'submitted', 'under_review', 'validated', 'rejected', 'published')),
  reviewer_notes TEXT,
  reviewed_by UUID REFERENCES auth.users(id),
  reviewed_at TIMESTAMPTZ,

  -- Proof bundle linkage
  proof_bundle_id UUID REFERENCES governed_proof_bundles(id),

  -- Place context
  postcode TEXT,
  lga_name TEXT,
  state TEXT,

  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- Index for common queries
CREATE INDEX IF NOT EXISTS idx_outcome_submissions_status ON outcome_submissions(status);
CREATE INDEX IF NOT EXISTS idx_outcome_submissions_entity ON outcome_submissions(gs_entity_id);
CREATE INDEX IF NOT EXISTS idx_outcome_submissions_org ON outcome_submissions(org_name);

-- RLS: users can see their own submissions + admins can see all
ALTER TABLE outcome_submissions ENABLE ROW LEVEL SECURITY;

CREATE POLICY outcome_submissions_own ON outcome_submissions
  FOR ALL USING (submitted_by = auth.uid());

-- Comment
COMMENT ON TABLE outcome_submissions IS 'Partner-submitted program outcomes for Governed Proof validation. Flows: draft → submitted → under_review → validated/rejected → published';
