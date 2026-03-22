-- Charity impact reports extracted from annual reports via LLM
CREATE TABLE IF NOT EXISTS charity_impact_reports (
  id SERIAL PRIMARY KEY,
  abn TEXT NOT NULL,
  charity_name TEXT,
  report_year INT,
  source_url TEXT,
  source_type TEXT CHECK (source_type IN ('acnc_pdf', 'website_pdf', 'website_page', 'manual')),

  -- Participation metrics
  total_beneficiaries INT,
  youth_beneficiaries INT,
  indigenous_beneficiaries INT,
  programs_delivered INT,

  -- Outcome metrics (extracted from report text)
  reports_recidivism BOOLEAN DEFAULT FALSE,
  recidivism_metric TEXT,
  reports_employment BOOLEAN DEFAULT FALSE,
  employment_metric TEXT,
  reports_housing BOOLEAN DEFAULT FALSE,
  housing_metric TEXT,
  reports_education BOOLEAN DEFAULT FALSE,
  education_metric TEXT,
  reports_cultural_connection BOOLEAN DEFAULT FALSE,
  cultural_metric TEXT,
  reports_mental_health BOOLEAN DEFAULT FALSE,
  mental_health_metric TEXT,
  reports_family_reunification BOOLEAN DEFAULT FALSE,
  family_metric TEXT,

  -- Evidence quality
  has_quantitative_outcomes BOOLEAN DEFAULT FALSE,
  has_external_evaluation BOOLEAN DEFAULT FALSE,
  has_closing_the_gap BOOLEAN DEFAULT FALSE,
  evidence_quality TEXT CHECK (evidence_quality IN ('none', 'narrative_only', 'basic_counts', 'outcome_metrics', 'evaluated')),

  -- Raw extraction
  impact_summary TEXT,
  key_quotes TEXT[],
  programs_mentioned TEXT[],
  extraction_model TEXT,
  extraction_confidence NUMERIC,

  -- Metadata
  pdf_pages INT,
  extracted_text_chars INT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_charity_impact_abn ON charity_impact_reports(abn);
CREATE INDEX IF NOT EXISTS idx_charity_impact_year ON charity_impact_reports(report_year);
CREATE INDEX IF NOT EXISTS idx_charity_impact_quality ON charity_impact_reports(evidence_quality);
CREATE INDEX IF NOT EXISTS idx_charity_impact_quant ON charity_impact_reports(has_quantitative_outcomes) WHERE has_quantitative_outcomes = TRUE;
