-- Data catalog + nightly snapshots for clarity and trust diagnostics.
-- Frontend can use this to show what is live, stale, or weak by provenance/confidence.

CREATE TABLE IF NOT EXISTS data_catalog (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  table_name text NOT NULL UNIQUE,
  domain text NOT NULL,
  owner_team text NOT NULL DEFAULT 'platform',
  description text,
  source_of_truth boolean NOT NULL DEFAULT false,
  pii_level text NOT NULL DEFAULT 'none',
  sla_hours integer NOT NULL DEFAULT 168,
  freshness_key text,
  provenance_field text,
  confidence_field text,
  active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT data_catalog_pii_level_check CHECK (pii_level IN ('none', 'low', 'medium', 'high'))
);

CREATE INDEX IF NOT EXISTS idx_data_catalog_domain ON data_catalog(domain);
CREATE INDEX IF NOT EXISTS idx_data_catalog_active ON data_catalog(active);

CREATE TABLE IF NOT EXISTS data_catalog_snapshots (
  id bigserial PRIMARY KEY,
  snapshot_at timestamptz NOT NULL DEFAULT now(),
  table_name text NOT NULL REFERENCES data_catalog(table_name) ON DELETE CASCADE,
  row_count bigint NOT NULL DEFAULT 0,
  freshness_hours numeric(12,2),
  provenance_coverage_pct numeric(6,2),
  confidence_coverage_pct numeric(6,2),
  notes text
);

CREATE INDEX IF NOT EXISTS idx_data_catalog_snapshots_table_time
  ON data_catalog_snapshots(table_name, snapshot_at DESC);
CREATE INDEX IF NOT EXISTS idx_data_catalog_snapshots_time
  ON data_catalog_snapshots(snapshot_at DESC);

CREATE OR REPLACE VIEW v_data_catalog_latest AS
SELECT DISTINCT ON (dc.table_name)
  dc.table_name,
  dc.domain,
  dc.owner_team,
  dc.description,
  dc.source_of_truth,
  dc.pii_level,
  dc.sla_hours,
  dc.freshness_key,
  dc.provenance_field,
  dc.confidence_field,
  dc.active,
  dcs.snapshot_at,
  dcs.row_count,
  dcs.freshness_hours,
  dcs.provenance_coverage_pct,
  dcs.confidence_coverage_pct
FROM data_catalog dc
LEFT JOIN data_catalog_snapshots dcs ON dcs.table_name = dc.table_name
ORDER BY dc.table_name, dcs.snapshot_at DESC NULLS LAST;

CREATE OR REPLACE FUNCTION snapshot_data_catalog()
RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  rec record;
  snap_at timestamptz := now();
  inserted_count integer := 0;
  row_total bigint;
  freshness numeric(12,2);
  provenance_pct numeric(6,2);
  confidence_pct numeric(6,2);
BEGIN
  FOR rec IN
    SELECT table_name, freshness_key, provenance_field, confidence_field
    FROM data_catalog
    WHERE active = true
  LOOP
    row_total := 0;
    freshness := NULL;
    provenance_pct := NULL;
    confidence_pct := NULL;

    BEGIN
      SELECT COALESCE(
        NULLIF(c.reltuples::bigint, 0),
        NULLIF(s.n_live_tup::bigint, 0),
        0
      )
      INTO row_total
      FROM pg_class c
      LEFT JOIN pg_stat_user_tables s
        ON s.schemaname = 'public'
       AND s.relname = c.relname
      WHERE c.relnamespace = 'public'::regnamespace
        AND c.relkind = 'r'
        AND c.relname = rec.table_name;

      row_total := COALESCE(row_total, 0);
    EXCEPTION WHEN OTHERS THEN
      row_total := 0;
    END;

    IF row_total <= 250000 AND rec.freshness_key IS NOT NULL AND btrim(rec.freshness_key) <> '' THEN
      BEGIN
        EXECUTE format(
          'SELECT CASE WHEN COUNT(*) = 0 THEN NULL ELSE ROUND(EXTRACT(EPOCH FROM (now() - MAX(%I))) / 3600.0, 2) END FROM %I',
          rec.freshness_key,
          rec.table_name
        ) INTO freshness;
      EXCEPTION WHEN OTHERS THEN
        freshness := NULL;
      END;
    END IF;

    IF row_total <= 250000 AND rec.provenance_field IS NOT NULL AND btrim(rec.provenance_field) <> '' THEN
      BEGIN
        EXECUTE format(
          'SELECT CASE WHEN COUNT(*) = 0 THEN NULL ELSE ROUND(100.0 * COUNT(*) FILTER (WHERE %I IS NOT NULL AND btrim(%I::text) <> '''') / COUNT(*), 2) END FROM %I',
          rec.provenance_field,
          rec.provenance_field,
          rec.table_name
        ) INTO provenance_pct;
      EXCEPTION WHEN OTHERS THEN
        provenance_pct := NULL;
      END;
    END IF;

    IF row_total <= 250000 AND rec.confidence_field IS NOT NULL AND btrim(rec.confidence_field) <> '' THEN
      BEGIN
        EXECUTE format(
          'SELECT CASE WHEN COUNT(*) = 0 THEN NULL ELSE ROUND(100.0 * COUNT(*) FILTER (WHERE %I IS NOT NULL AND btrim(%I::text) <> '''') / COUNT(*), 2) END FROM %I',
          rec.confidence_field,
          rec.confidence_field,
          rec.table_name
        ) INTO confidence_pct;
      EXCEPTION WHEN OTHERS THEN
        confidence_pct := NULL;
      END;
    END IF;

    INSERT INTO data_catalog_snapshots (
      snapshot_at,
      table_name,
      row_count,
      freshness_hours,
      provenance_coverage_pct,
      confidence_coverage_pct
    )
    VALUES (
      snap_at,
      rec.table_name,
      row_total,
      freshness,
      provenance_pct,
      confidence_pct
    );

    inserted_count := inserted_count + 1;
  END LOOP;

  RETURN inserted_count;
END;
$$;

INSERT INTO data_catalog (
  table_name,
  domain,
  owner_team,
  description,
  source_of_truth,
  pii_level,
  sla_hours,
  freshness_key,
  provenance_field,
  confidence_field
)
VALUES
  ('gs_entities', 'entity_graph', 'graph', 'Canonical entity registry keyed by GS ID and ABN.', true, 'low', 24, 'updated_at', null, 'source_count'),
  ('gs_relationships', 'entity_graph', 'graph', 'Cross-system relationships between entities.', true, 'low', 24, null, 'source_url', null),
  ('austender_contracts', 'procurement', 'procurement', 'Federal procurement contracts (supplier/buyer).', true, 'none', 72, null, null, null),
  ('political_donations', 'influence', 'governance', 'AEC political donations linked to donor entities.', true, 'none', 168, null, null, null),
  ('justice_funding', 'funding', 'justice', 'Justice funding records linked to recipient organisations.', true, 'none', 72, null, null, null),
  ('acnc_charities', 'registries', 'registry', 'ACNC charity register.', true, 'none', 168, null, null, null),
  ('ato_tax_transparency', 'registries', 'registry', 'ATO tax transparency disclosures.', true, 'none', 168, null, null, null),
  ('foundations', 'funding', 'funding', 'Foundation profiles and giving metadata.', true, 'none', 72, 'updated_at', 'website', 'profile_confidence'),
  ('grant_opportunities', 'funding', 'funding', 'National grants index across government and philanthropy.', true, 'none', 24, 'updated_at', 'url', 'last_verified_at'),
  ('entity_identifiers', 'entity_graph', 'graph', 'Auxiliary identifiers mapped to entities.', true, 'none', 72, null, null, null),
  ('goods_communities', 'goods', 'goods', 'Community-level need, demand, and delivery context for Goods workspace.', true, 'none', 24, 'updated_at', 'known_buyer_name', 'data_quality_score'),
  ('goods_procurement_entities', 'goods', 'goods', 'Buyer and partner candidates linked to communities.', true, 'none', 24, 'updated_at', 'website', 'fit_score'),
  ('goods_procurement_signals', 'goods', 'goods', 'Procurement signal records (buyer/capital/partner).', true, 'none', 24, 'updated_at', 'source_agent', null),
  ('procurement_shortlists', 'procurement', 'procurement', 'User shortlists and decision controls.', true, 'low', 12, 'updated_at', null, null),
  ('procurement_shortlist_items', 'procurement', 'procurement', 'Entities saved to shortlist with tags and notes.', true, 'low', 12, 'updated_at', null, null),
  ('procurement_tasks', 'procurement', 'procurement', 'Manual + agent-generated procurement review tasks.', true, 'low', 12, 'updated_at', null, null),
  ('procurement_workflow_runs', 'procurement', 'procurement', 'Discover/enrich/pack run history.', true, 'none', 24, 'started_at', null, null),
  ('ghl_contacts', 'crm', 'goods', 'Contacts mirrored to/from GHL.', true, 'medium', 24, 'updated_at', 'email', null),
  ('ghl_opportunities', 'crm', 'goods', 'Pipeline opportunities mirrored to/from GHL.', true, 'low', 24, 'updated_at', null, null),
  ('ghl_sync_log', 'crm', 'goods', 'GHL sync audit log.', true, 'none', 24, 'created_at', null, null)
ON CONFLICT (table_name) DO UPDATE SET
  domain = EXCLUDED.domain,
  owner_team = EXCLUDED.owner_team,
  description = EXCLUDED.description,
  source_of_truth = EXCLUDED.source_of_truth,
  pii_level = EXCLUDED.pii_level,
  sla_hours = EXCLUDED.sla_hours,
  freshness_key = EXCLUDED.freshness_key,
  provenance_field = EXCLUDED.provenance_field,
  confidence_field = EXCLUDED.confidence_field,
  updated_at = now();

-- Run initial snapshot to seed UI/API immediately after migration.
SELECT snapshot_data_catalog();

-- Ensure nightly scheduler includes catalog snapshots.
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
  'snapshot-data-catalog',
  24,
  true,
  26,
  false,
  2,
  '{}'::jsonb
)
ON CONFLICT (agent_id) DO UPDATE SET
  interval_hours = EXCLUDED.interval_hours,
  enabled = EXCLUDED.enabled,
  freshness_threshold_hours = EXCLUDED.freshness_threshold_hours,
  auto_create_task = EXCLUDED.auto_create_task,
  priority = EXCLUDED.priority,
  params = EXCLUDED.params,
  updated_at = now();
