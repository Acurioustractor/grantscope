-- 2026-04-29 funding-tracking infrastructure
-- Closes the FECCA + ECCV blind spots and the broader "where is govt money landing" gap.
--
-- 1. grantconnect_awards — backing table for scripts/ingest-grantconnect.mjs (currently broken: writes to a missing table)
-- 2. vic_grants_awarded — net-new. VMC, DFFH, DPC, Creative Vic, Health Vic, RDV awarded grants
-- 3. v_entity_funding_mix — cross-source per-entity funder mix
--    (combines acnc_ais line items + austender + grantconnect + vic_grants_awarded)
-- 4. mv_entity_funding_concentration — same logic but materialized for /org pages

CREATE EXTENSION IF NOT EXISTS pg_trgm;

-- ── 1. grantconnect_awards ────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS grantconnect_awards (
  ga_id text PRIMARY KEY,
  parent_ga_id text,
  agency text,
  category text,
  go_id text,
  go_title text,
  recipient_name text,
  recipient_abn text,
  recipient_id text,
  pbs_program text,
  status text,
  value_aud numeric,
  variation_value_aud numeric,
  variation_reason text,
  approval_date date,
  start_date date,
  end_date date,
  publish_date date,
  variation_date date,
  selection_process text,
  description text,
  state text,
  gs_entity_id uuid REFERENCES gs_entities(id) ON DELETE SET NULL,
  imported_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS gca_recipient_abn_idx ON grantconnect_awards (recipient_abn) WHERE recipient_abn IS NOT NULL;
CREATE INDEX IF NOT EXISTS gca_recipient_name_trgm_idx ON grantconnect_awards USING gin (recipient_name gin_trgm_ops);
CREATE INDEX IF NOT EXISTS gca_agency_idx ON grantconnect_awards (agency);
CREATE INDEX IF NOT EXISTS gca_gs_entity_idx ON grantconnect_awards (gs_entity_id) WHERE gs_entity_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS gca_approval_date_idx ON grantconnect_awards (approval_date);
CREATE INDEX IF NOT EXISTS gca_pbs_program_idx ON grantconnect_awards (pbs_program);

COMMENT ON TABLE grantconnect_awards IS 'Awarded Commonwealth grants from grants.gov.au weekly export. Loaded by scripts/ingest-grantconnect.mjs.';

-- ── 2. vic_grants_awarded ─────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS vic_grants_awarded (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  source text NOT NULL CHECK (source IN ('vmc', 'dffh', 'dpc', 'creative_vic', 'health_vic', 'rdv', 'djsir', 'djcs', 'deeca', 'other')),
  agency text,
  program_name text,
  round_name text,
  recipient_name text,
  recipient_abn text,
  amount_aud numeric,
  approval_date date,
  start_date date,
  end_date date,
  financial_year text,
  description text,
  region text,
  state text DEFAULT 'VIC',
  source_url text,
  source_id text,
  gs_entity_id uuid REFERENCES gs_entities(id) ON DELETE SET NULL,
  imported_at timestamptz NOT NULL DEFAULT now(),
  raw jsonb
);

-- Soft uniqueness (some sources don't publish stable IDs, fall back to composite)
CREATE UNIQUE INDEX IF NOT EXISTS vga_natural_key_idx
  ON vic_grants_awarded (source, COALESCE(source_id, ''), COALESCE(recipient_name, ''), COALESCE(program_name, ''), COALESCE(financial_year, ''), COALESCE(amount_aud, 0));

CREATE INDEX IF NOT EXISTS vga_recipient_abn_idx ON vic_grants_awarded (recipient_abn) WHERE recipient_abn IS NOT NULL;
CREATE INDEX IF NOT EXISTS vga_recipient_name_trgm_idx ON vic_grants_awarded USING gin (recipient_name gin_trgm_ops);
CREATE INDEX IF NOT EXISTS vga_program_idx ON vic_grants_awarded (program_name);
CREATE INDEX IF NOT EXISTS vga_gs_entity_idx ON vic_grants_awarded (gs_entity_id) WHERE gs_entity_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS vga_fy_idx ON vic_grants_awarded (financial_year);
CREATE INDEX IF NOT EXISTS vga_source_idx ON vic_grants_awarded (source);

COMMENT ON TABLE vic_grants_awarded IS 'Awarded Victorian Government grants by source (VMC, DFFH, DPC, Creative Vic, etc). Loaded by scripts/import-vic-grants-awarded.mjs.';

-- ── 3. v_entity_funding_mix view ──────────────────────────────────────────
CREATE OR REPLACE VIEW v_entity_funding_mix AS
WITH ais_latest AS (
  SELECT DISTINCT ON (abn)
    abn, ais_year, revenue_from_government, donations_and_bequests,
    revenue_from_goods_services, revenue_from_investments, total_revenue
  FROM acnc_ais
  WHERE abn IS NOT NULL AND total_revenue IS NOT NULL
  ORDER BY abn, ais_year DESC
),
contracts_agg AS (
  SELECT supplier_abn AS abn,
         COUNT(*)::int AS contract_count,
         SUM(contract_value)::bigint AS contract_total
  FROM austender_contracts
  WHERE supplier_abn IS NOT NULL
  GROUP BY supplier_abn
),
gc_agg AS (
  SELECT recipient_abn AS abn,
         COUNT(*)::int AS gc_award_count,
         SUM(value_aud)::bigint AS gc_award_total
  FROM grantconnect_awards
  WHERE recipient_abn IS NOT NULL
  GROUP BY recipient_abn
),
vic_agg AS (
  SELECT recipient_abn AS abn,
         COUNT(*)::int AS vic_award_count,
         SUM(amount_aud)::bigint AS vic_award_total
  FROM vic_grants_awarded
  WHERE recipient_abn IS NOT NULL
  GROUP BY recipient_abn
)
SELECT
  e.gs_id,
  e.canonical_name,
  e.abn,
  e.entity_type,
  e.state,
  ais.ais_year                         AS latest_ais_year,
  ais.revenue_from_government::bigint  AS ais_govt_revenue,
  ais.donations_and_bequests::bigint   AS ais_donations,
  ais.revenue_from_goods_services::bigint AS ais_fees,
  ais.total_revenue::bigint            AS ais_total_revenue,
  CASE WHEN ais.total_revenue > 0
       THEN ROUND((ais.revenue_from_government / ais.total_revenue) * 100, 1)
  END                                  AS ais_govt_pct,
  c.contract_count                     AS austender_count,
  c.contract_total                     AS austender_total,
  gc.gc_award_count                    AS grantconnect_count,
  gc.gc_award_total                    AS grantconnect_total,
  v.vic_award_count,
  v.vic_award_total
FROM gs_entities e
LEFT JOIN ais_latest ais ON ais.abn = e.abn
LEFT JOIN contracts_agg c ON c.abn = e.abn
LEFT JOIN gc_agg gc ON gc.abn = e.abn
LEFT JOIN vic_agg v ON v.abn = e.abn
WHERE e.abn IS NOT NULL;

COMMENT ON VIEW v_entity_funding_mix IS
  'Cross-source funder mix per entity. Use ais_govt_pct to spot government-dependent orgs (>80% = high concentration risk).';
