-- Official NDIS market layer
-- Adds aggregate provider supply + market concentration data from NDIA provider datasets.

CREATE TABLE IF NOT EXISTS ndis_active_providers (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  report_date DATE NOT NULL,
  state_code TEXT NOT NULL,
  service_district_name TEXT NOT NULL,
  disability_group_name TEXT NOT NULL,
  age_band TEXT NOT NULL,
  support_class TEXT NOT NULL,
  provider_count INTEGER NOT NULL,
  source_page_url TEXT NOT NULL,
  source_file_url TEXT NOT NULL,
  source_file_title TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT ndis_active_providers_unique UNIQUE (
    report_date,
    state_code,
    service_district_name,
    disability_group_name,
    age_band,
    support_class
  )
);

CREATE INDEX IF NOT EXISTS idx_ndis_active_providers_report_date
  ON ndis_active_providers(report_date DESC);
CREATE INDEX IF NOT EXISTS idx_ndis_active_providers_state
  ON ndis_active_providers(state_code);
CREATE INDEX IF NOT EXISTS idx_ndis_active_providers_district
  ON ndis_active_providers(service_district_name);
CREATE INDEX IF NOT EXISTS idx_ndis_active_providers_support_class
  ON ndis_active_providers(support_class);

COMMENT ON TABLE ndis_active_providers IS
  'Official NDIA aggregate active provider counts by state, service district, disability group, age band, and support class.';

CREATE TABLE IF NOT EXISTS ndis_market_concentration (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  report_date DATE NOT NULL,
  state_code TEXT NOT NULL,
  service_district_name TEXT NOT NULL,
  support_class TEXT NOT NULL,
  payment_share_top10_pct NUMERIC(6,2),
  payment_band TEXT,
  source_page_url TEXT NOT NULL,
  source_file_url TEXT NOT NULL,
  source_file_title TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT ndis_market_concentration_unique UNIQUE (
    report_date,
    state_code,
    service_district_name,
    support_class
  )
);

CREATE INDEX IF NOT EXISTS idx_ndis_market_concentration_report_date
  ON ndis_market_concentration(report_date DESC);
CREATE INDEX IF NOT EXISTS idx_ndis_market_concentration_state
  ON ndis_market_concentration(state_code);
CREATE INDEX IF NOT EXISTS idx_ndis_market_concentration_district
  ON ndis_market_concentration(service_district_name);
CREATE INDEX IF NOT EXISTS idx_ndis_market_concentration_support_class
  ON ndis_market_concentration(support_class);
CREATE INDEX IF NOT EXISTS idx_ndis_market_concentration_share
  ON ndis_market_concentration(payment_share_top10_pct DESC NULLS LAST);

COMMENT ON TABLE ndis_market_concentration IS
  'Official NDIA market concentration data showing payment share held by the top 10 providers.';

DROP TRIGGER IF EXISTS ndis_active_providers_updated_at ON ndis_active_providers;
CREATE TRIGGER ndis_active_providers_updated_at
  BEFORE UPDATE ON ndis_active_providers
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

DROP TRIGGER IF EXISTS ndis_market_concentration_updated_at ON ndis_market_concentration;
CREATE TRIGGER ndis_market_concentration_updated_at
  BEFORE UPDATE ON ndis_market_concentration
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

CREATE OR REPLACE VIEW v_ndis_provider_supply_summary AS
SELECT
  report_date,
  state_code,
  service_district_name,
  provider_count
FROM ndis_active_providers
WHERE disability_group_name = 'ALL'
  AND age_band = 'ALL'
  AND support_class = 'ALL';

CREATE OR REPLACE VIEW v_ndis_support_class_supply AS
SELECT
  report_date,
  state_code,
  service_district_name,
  support_class,
  provider_count
FROM ndis_active_providers
WHERE disability_group_name = 'ALL'
  AND age_band = 'ALL'
  AND support_class <> 'ALL';

CREATE OR REPLACE VIEW v_ndis_market_concentration_hotspots AS
SELECT
  report_date,
  state_code,
  service_district_name,
  support_class,
  payment_share_top10_pct,
  payment_band
FROM ndis_market_concentration
WHERE support_class <> 'ALL'
ORDER BY payment_share_top10_pct DESC NULLS LAST, payment_band DESC NULLS LAST;

INSERT INTO agent_schedules (
  agent_id,
  interval_hours,
  enabled,
  freshness_threshold_hours,
  auto_create_task,
  priority,
  params
)
VALUES (
  'import-ndis-provider-market',
  168,
  true,
  336,
  false,
  5,
  '{"source":"official-ndia-provider-datasets"}'::jsonb
)
ON CONFLICT (agent_id) DO UPDATE SET
  interval_hours = EXCLUDED.interval_hours,
  enabled = EXCLUDED.enabled,
  freshness_threshold_hours = EXCLUDED.freshness_threshold_hours,
  auto_create_task = EXCLUDED.auto_create_task,
  priority = EXCLUDED.priority,
  params = EXCLUDED.params,
  updated_at = NOW();
