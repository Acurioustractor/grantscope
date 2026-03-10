-- Tender Intelligence usage metering table
CREATE TABLE IF NOT EXISTS ti_usage_log (
  id BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  user_id UUID NOT NULL,
  endpoint TEXT NOT NULL,  -- 'discover', 'enrich', 'compliance', 'pack'
  filters JSONB DEFAULT '{}',
  result_count INT DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_ti_usage_user ON ti_usage_log(user_id);
CREATE INDEX idx_ti_usage_endpoint ON ti_usage_log(endpoint, created_at);
CREATE INDEX idx_ti_usage_created ON ti_usage_log(created_at);

-- RLS: users can only see their own usage
ALTER TABLE ti_usage_log ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own usage" ON ti_usage_log
  FOR SELECT USING (auth.uid() = user_id);

-- Service role can insert (API routes use service key)
CREATE POLICY "Service can insert usage" ON ti_usage_log
  FOR INSERT WITH CHECK (true);
