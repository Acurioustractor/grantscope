-- Official NDIS registered provider layer
-- Adds row-level registered provider records from the NDIS Commission provider register.

CREATE TABLE IF NOT EXISTS ndis_registered_providers (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  report_date DATE NOT NULL,
  provider_detail_id BIGINT NOT NULL,
  provider_name TEXT NOT NULL,
  legal_name TEXT,
  abn TEXT,
  head_office_address TEXT,
  suburb TEXT,
  state_code TEXT,
  postcode TEXT,
  website TEXT,
  registration_status TEXT NOT NULL,
  source_page_url TEXT NOT NULL,
  source_detail_url TEXT NOT NULL,
  source_search_url TEXT NOT NULL,
  source_page_number INTEGER NOT NULL DEFAULT 0,
  source_summary_total INTEGER,
  detail_enriched_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT ndis_registered_providers_unique UNIQUE (
    report_date,
    provider_detail_id
  )
);

CREATE INDEX IF NOT EXISTS idx_ndis_registered_providers_report_date
  ON ndis_registered_providers(report_date DESC);
CREATE INDEX IF NOT EXISTS idx_ndis_registered_providers_status
  ON ndis_registered_providers(registration_status);
CREATE INDEX IF NOT EXISTS idx_ndis_registered_providers_state
  ON ndis_registered_providers(state_code);
CREATE INDEX IF NOT EXISTS idx_ndis_registered_providers_postcode
  ON ndis_registered_providers(postcode);
CREATE INDEX IF NOT EXISTS idx_ndis_registered_providers_abn
  ON ndis_registered_providers(abn);
CREATE INDEX IF NOT EXISTS idx_ndis_registered_providers_provider_name
  ON ndis_registered_providers(provider_name);

COMMENT ON TABLE ndis_registered_providers IS
  'Official NDIS Commission registered-provider rows scraped from the public provider register via the Drupal AJAX view.';

DROP TRIGGER IF EXISTS ndis_registered_providers_updated_at ON ndis_registered_providers;
CREATE TRIGGER ndis_registered_providers_updated_at
  BEFORE UPDATE ON ndis_registered_providers
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

CREATE OR REPLACE VIEW v_ndis_registered_provider_status_summary AS
WITH latest AS (
  SELECT MAX(report_date) AS report_date
  FROM ndis_registered_providers
)
SELECT
  r.report_date,
  r.registration_status,
  COUNT(*) AS provider_count
FROM ndis_registered_providers r
JOIN latest l ON l.report_date = r.report_date
GROUP BY r.report_date, r.registration_status
ORDER BY provider_count DESC, registration_status;

CREATE OR REPLACE VIEW v_ndis_registered_provider_state_supply AS
WITH latest AS (
  SELECT MAX(report_date) AS report_date
  FROM ndis_registered_providers
)
SELECT
  r.report_date,
  r.registration_status,
  COALESCE(NULLIF(r.state_code, ''), 'Unknown') AS state_code,
  COUNT(*) AS provider_count
FROM ndis_registered_providers r
JOIN latest l ON l.report_date = r.report_date
GROUP BY
  r.report_date,
  r.registration_status,
  COALESCE(NULLIF(r.state_code, ''), 'Unknown')
ORDER BY provider_count DESC, state_code;

CREATE OR REPLACE VIEW v_ndis_registered_provider_graph_match AS
WITH latest AS (
  SELECT MAX(report_date) AS report_date
  FROM ndis_registered_providers
),
entity_abns AS (
  SELECT DISTINCT regexp_replace(abn, '\D', '', 'g') AS abn_norm
  FROM gs_entities
  WHERE abn IS NOT NULL AND regexp_replace(abn, '\D', '', 'g') <> ''
)
SELECT
  r.report_date,
  r.registration_status,
  COUNT(*) AS provider_count,
  COUNT(e.abn_norm) AS matched_entity_count,
  ROUND(100.0 * COUNT(e.abn_norm) / NULLIF(COUNT(*), 0), 1) AS matched_entity_pct
FROM ndis_registered_providers r
JOIN latest l ON l.report_date = r.report_date
LEFT JOIN entity_abns e
  ON e.abn_norm = regexp_replace(COALESCE(r.abn, ''), '\D', '', 'g')
GROUP BY r.report_date, r.registration_status
ORDER BY provider_count DESC, registration_status;

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
  'import-ndis-provider-register',
  168,
  true,
  336,
  false,
  4,
  '{"source":"official-ndis-commission-provider-register","statuses":["Approved","Revoked","Banned"]}'::jsonb
)
ON CONFLICT (agent_id) DO UPDATE SET
  interval_hours = EXCLUDED.interval_hours,
  enabled = EXCLUDED.enabled,
  freshness_threshold_hours = EXCLUDED.freshness_threshold_hours,
  auto_create_task = EXCLUDED.auto_create_task,
  priority = EXCLUDED.priority,
  params = EXCLUDED.params,
  updated_at = NOW();
