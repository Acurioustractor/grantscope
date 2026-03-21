-- API Keys + Usage Tracking for Agent Commerce
-- Run: source .env && PGPASSWORD="$DATABASE_PASSWORD" psql -h aws-0-ap-southeast-2.pooler.supabase.com -p 6543 -U "postgres.tednluwflfhxyucgwigh" -d postgres -f scripts/migrations/create-api-keys.sql

BEGIN;

-- Drop old (empty) table from previous attempt
DROP TABLE IF EXISTS api_usage CASCADE;
DROP MATERIALIZED VIEW IF EXISTS mv_api_usage_daily CASCADE;
DROP TABLE IF EXISTS api_keys CASCADE;

-- API Keys table
CREATE TABLE api_keys (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  -- Owner (nullable — keys can exist before org signup)
  org_id UUID REFERENCES org_profiles(id) ON DELETE CASCADE,
  -- Key identification
  name TEXT NOT NULL DEFAULT 'Default',
  key_prefix TEXT NOT NULL,  -- first 12 chars of raw key for display (cg_live_XXXX)
  key_hash TEXT NOT NULL UNIQUE,  -- SHA-256 of full key
  -- Rate limiting
  rate_limit_per_min INT NOT NULL DEFAULT 60,
  -- Lifecycle
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  last_used_at TIMESTAMPTZ,
  revoked_at TIMESTAMPTZ,
  -- Usage counters (updated via trigger, not per-request for perf)
  total_requests BIGINT NOT NULL DEFAULT 0,
  total_errors BIGINT NOT NULL DEFAULT 0
);

CREATE INDEX idx_api_keys_hash ON api_keys (key_hash) WHERE revoked_at IS NULL;
CREATE INDEX idx_api_keys_org ON api_keys (org_id) WHERE revoked_at IS NULL;

-- API Usage log (append-only, for billing + analytics)
CREATE TABLE api_usage (
  id BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  key_id UUID REFERENCES api_keys(id) ON DELETE SET NULL,
  action TEXT NOT NULL,
  response_ms INT,
  status_code SMALLINT NOT NULL DEFAULT 200,
  ip_address TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_api_usage_created ON api_usage (created_at DESC);
CREATE INDEX idx_api_usage_key ON api_usage (key_id, created_at DESC);

-- Trigger to update api_keys counters on each usage insert
CREATE OR REPLACE FUNCTION update_api_key_counters()
RETURNS TRIGGER AS $$
BEGIN
  IF NEW.key_id IS NOT NULL THEN
    UPDATE api_keys SET
      total_requests = total_requests + 1,
      total_errors = total_errors + CASE WHEN NEW.status_code >= 400 THEN 1 ELSE 0 END,
      last_used_at = NEW.created_at
    WHERE id = NEW.key_id;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trg_api_usage_counters
  AFTER INSERT ON api_usage
  FOR EACH ROW
  EXECUTE FUNCTION update_api_key_counters();

-- Daily usage summary MV (for dashboard)
CREATE MATERIALIZED VIEW mv_api_usage_daily AS
SELECT
  key_id,
  DATE(created_at) AS day,
  action,
  COUNT(*) AS request_count,
  COUNT(*) FILTER (WHERE status_code >= 400) AS error_count,
  AVG(response_ms)::INT AS avg_response_ms,
  PERCENTILE_CONT(0.95) WITHIN GROUP (ORDER BY response_ms)::INT AS p95_response_ms
FROM api_usage
GROUP BY key_id, DATE(created_at), action;

CREATE UNIQUE INDEX idx_mv_api_usage_daily ON mv_api_usage_daily (key_id, day, action);

-- RLS policies
ALTER TABLE api_keys ENABLE ROW LEVEL SECURITY;
ALTER TABLE api_usage ENABLE ROW LEVEL SECURITY;

-- Service role can do everything
CREATE POLICY api_keys_service ON api_keys FOR ALL TO service_role USING (true) WITH CHECK (true);
CREATE POLICY api_usage_service ON api_usage FOR ALL TO service_role USING (true) WITH CHECK (true);

-- Authenticated users can see their own keys
CREATE POLICY api_keys_owner_select ON api_keys FOR SELECT TO authenticated
  USING (org_id IN (SELECT id FROM org_profiles WHERE user_id = auth.uid()));

CREATE POLICY api_keys_owner_insert ON api_keys FOR INSERT TO authenticated
  WITH CHECK (org_id IN (SELECT id FROM org_profiles WHERE user_id = auth.uid()));

CREATE POLICY api_keys_owner_update ON api_keys FOR UPDATE TO authenticated
  USING (org_id IN (SELECT id FROM org_profiles WHERE user_id = auth.uid()));

-- Users can see usage for their own keys
CREATE POLICY api_usage_owner_select ON api_usage FOR SELECT TO authenticated
  USING (key_id IN (
    SELECT ak.id FROM api_keys ak
    JOIN org_profiles op ON op.id = ak.org_id
    WHERE op.user_id = auth.uid()
  ));

COMMIT;
