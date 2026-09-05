-- QLD Police watch-house twice-daily custody snapshots.
-- Source: https://www.police.qld.gov.au/qps-corporate-documents/reports-and-publications/watch-house-data

CREATE TABLE IF NOT EXISTS qld_watchhouse_snapshots (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  source_url text NOT NULL,
  source_pdf_url text NOT NULL,
  source_generated_at timestamptz NOT NULL,
  source_generated_date date NOT NULL,
  source_generated_time time NOT NULL,
  fetched_at timestamptz NOT NULL DEFAULT now(),
  fetch_status integer,
  content_type text,
  raw_pdf_sha256 text NOT NULL,
  total_people integer NOT NULL DEFAULT 0,
  total_adults integer NOT NULL DEFAULT 0,
  total_children integer NOT NULL DEFAULT 0,
  adult_first_nations integer NOT NULL DEFAULT 0,
  adult_non_indigenous integer NOT NULL DEFAULT 0,
  adult_other_status integer NOT NULL DEFAULT 0,
  child_first_nations integer NOT NULL DEFAULT 0,
  child_non_indigenous integer NOT NULL DEFAULT 0,
  child_other_status integer NOT NULL DEFAULT 0,
  adult_0_2_days integer NOT NULL DEFAULT 0,
  adult_3_7_days integer NOT NULL DEFAULT 0,
  adult_over_7_days integer NOT NULL DEFAULT 0,
  child_0_2_days integer NOT NULL DEFAULT 0,
  child_3_7_days integer NOT NULL DEFAULT 0,
  child_over_7_days integer NOT NULL DEFAULT 0,
  adult_longest_days integer,
  child_longest_days integer,
  child_watchhouse_count integer NOT NULL DEFAULT 0,
  raw_text text,
  metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT qld_watchhouse_snapshots_generated_unique UNIQUE (source_generated_at),
  CONSTRAINT qld_watchhouse_snapshots_hash_unique UNIQUE (raw_pdf_sha256)
);

CREATE INDEX IF NOT EXISTS idx_qld_watchhouse_snapshots_generated
  ON qld_watchhouse_snapshots(source_generated_at DESC);

CREATE INDEX IF NOT EXISTS idx_qld_watchhouse_snapshots_children
  ON qld_watchhouse_snapshots(total_children DESC, source_generated_at DESC);

CREATE TABLE IF NOT EXISTS qld_watchhouse_snapshot_rows (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  snapshot_id uuid NOT NULL REFERENCES qld_watchhouse_snapshots(id) ON DELETE CASCADE,
  source_generated_at timestamptz NOT NULL,
  watchhouse_name text NOT NULL,
  age_group text NOT NULL CHECK (age_group IN ('Adult', 'Child')),
  total_in_custody integer NOT NULL DEFAULT 0,
  male integer NOT NULL DEFAULT 0,
  female integer NOT NULL DEFAULT 0,
  other_gender integer NOT NULL DEFAULT 0,
  first_nations integer NOT NULL DEFAULT 0,
  non_indigenous integer NOT NULL DEFAULT 0,
  other_status integer NOT NULL DEFAULT 0,
  custody_0_2_days integer NOT NULL DEFAULT 0,
  custody_3_7_days integer NOT NULL DEFAULT 0,
  custody_over_7_days integer NOT NULL DEFAULT 0,
  longest_days integer,
  created_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT qld_watchhouse_snapshot_rows_unique
    UNIQUE (snapshot_id, watchhouse_name, age_group)
);

CREATE INDEX IF NOT EXISTS idx_qld_watchhouse_snapshot_rows_snapshot
  ON qld_watchhouse_snapshot_rows(snapshot_id);

CREATE INDEX IF NOT EXISTS idx_qld_watchhouse_snapshot_rows_child_locations
  ON qld_watchhouse_snapshot_rows(age_group, total_in_custody DESC, watchhouse_name)
  WHERE age_group = 'Child';

CREATE OR REPLACE VIEW v_qld_watchhouse_latest AS
SELECT
  s.*,
  COALESCE(rows_json.rows, '[]'::jsonb) AS rows
FROM (
  SELECT *
  FROM qld_watchhouse_snapshots
  ORDER BY source_generated_at DESC
  LIMIT 1
) s
LEFT JOIN LATERAL (
  SELECT jsonb_agg(
    jsonb_build_object(
      'watchhouse_name', r.watchhouse_name,
      'age_group', r.age_group,
      'total_in_custody', r.total_in_custody,
      'male', r.male,
      'female', r.female,
      'other_gender', r.other_gender,
      'first_nations', r.first_nations,
      'non_indigenous', r.non_indigenous,
      'other_status', r.other_status,
      'custody_0_2_days', r.custody_0_2_days,
      'custody_3_7_days', r.custody_3_7_days,
      'custody_over_7_days', r.custody_over_7_days,
      'longest_days', r.longest_days
    )
    ORDER BY r.age_group, r.watchhouse_name
  ) AS rows
  FROM qld_watchhouse_snapshot_rows r
  WHERE r.snapshot_id = s.id
) rows_json ON TRUE;

DROP TRIGGER IF EXISTS qld_watchhouse_snapshots_updated_at ON qld_watchhouse_snapshots;
CREATE TRIGGER qld_watchhouse_snapshots_updated_at
  BEFORE UPDATE ON qld_watchhouse_snapshots
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

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
  confidence_field,
  active
)
VALUES
  (
    'qld_watchhouse_snapshots',
    'youth-justice',
    'civicgraph',
    'Twice-daily QPS watch-house custody snapshot rollups parsed from the public QPS PDF.',
    true,
    'none',
    14,
    'source_generated_at',
    'source_pdf_url',
    NULL,
    true
  ),
  (
    'qld_watchhouse_snapshot_rows',
    'youth-justice',
    'civicgraph',
    'Per watch-house adult/child rows parsed from the QPS public custody PDF.',
    true,
    'none',
    14,
    'source_generated_at',
    'watchhouse_name',
    NULL,
    true
  )
ON CONFLICT (table_name) DO UPDATE
SET
  domain = EXCLUDED.domain,
  owner_team = EXCLUDED.owner_team,
  description = EXCLUDED.description,
  source_of_truth = EXCLUDED.source_of_truth,
  pii_level = EXCLUDED.pii_level,
  sla_hours = EXCLUDED.sla_hours,
  freshness_key = EXCLUDED.freshness_key,
  provenance_field = EXCLUDED.provenance_field,
  confidence_field = EXCLUDED.confidence_field,
  active = EXCLUDED.active,
  updated_at = now();
