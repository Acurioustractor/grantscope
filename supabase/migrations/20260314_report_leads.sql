-- Report lead capture: emails from visitors requesting full datasets
CREATE TABLE IF NOT EXISTS report_leads (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  email TEXT NOT NULL,
  report_slug TEXT NOT NULL,
  source TEXT,               -- e.g. 'dataset_download', 'share_click'
  metadata JSONB DEFAULT '{}',
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Index for dedup checks and analytics
CREATE INDEX idx_report_leads_email_report ON report_leads (email, report_slug);
CREATE INDEX idx_report_leads_created ON report_leads (created_at DESC);

-- RLS: service role only (no client access)
ALTER TABLE report_leads ENABLE ROW LEVEL SECURITY;
