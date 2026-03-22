-- GrantConnect Awarded Grants
-- Source: grants.gov.au weekly export (manual download required — CloudFront blocks automated access)
-- Fields based on GrantConnect GA Weekly Export format

CREATE TABLE IF NOT EXISTS grantconnect_awards (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  ga_id TEXT,
  parent_ga_id TEXT,
  agency TEXT,
  category TEXT,
  go_id TEXT,                    -- Grant Opportunity ID
  go_title TEXT,                 -- Grant Opportunity title
  recipient_name TEXT,
  recipient_abn TEXT,
  recipient_id TEXT,             -- GrantConnect recipient ID
  pbs_program TEXT,              -- PBS Program name
  status TEXT,
  value_aud NUMERIC,
  variation_value_aud NUMERIC,
  variation_reason TEXT,
  approval_date DATE,
  start_date DATE,
  end_date DATE,
  publish_date TIMESTAMPTZ,
  variation_date TIMESTAMPTZ,
  selection_process TEXT,
  description TEXT,
  state TEXT,                    -- Derived from recipient location if available
  gs_entity_id UUID REFERENCES gs_entities(id),
  created_at TIMESTAMPTZ DEFAULT NOW(),

  UNIQUE(ga_id)
);

CREATE INDEX IF NOT EXISTS idx_grantconnect_awards_abn ON grantconnect_awards(recipient_abn);
CREATE INDEX IF NOT EXISTS idx_grantconnect_awards_agency ON grantconnect_awards(agency);
CREATE INDEX IF NOT EXISTS idx_grantconnect_awards_entity ON grantconnect_awards(gs_entity_id);
CREATE INDEX IF NOT EXISTS idx_grantconnect_awards_go_id ON grantconnect_awards(go_id);
