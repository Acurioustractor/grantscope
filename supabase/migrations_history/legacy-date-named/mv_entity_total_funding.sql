-- mv_entity_total_funding.sql
-- Creates a materialized view that stacks ALL government funding sources
-- per entity (by ABN), giving a single "total government reliance" figure.
--
-- Sources: grants, austender_contracts, justice_funding, ndis_utilisation, political_donations
-- Run: source .env && PGPASSWORD="$DATABASE_PASSWORD" psql -h aws-0-ap-southeast-2.pooler.supabase.com -p 5432 -U "postgres.tednluwflfhxyucgwigh" -d postgres -f migrations/mv_entity_total_funding.sql

DROP MATERIALIZED VIEW IF EXISTS mv_entity_total_funding;

CREATE MATERIALIZED VIEW mv_entity_total_funding AS
WITH

-- 1. Grants won
grants AS (
  SELECT
    e.id AS entity_id,
    e.gs_id,
    e.canonical_name,
    e.abn,
    'grant' AS funding_type,
    e.state,
    e.postcode,
    e.remoteness,
    e.sector,
    e.is_community_controlled,
    COUNT(DISTINCT r.id) AS record_count,
    COALESCE(SUM(r.amount), 0) AS total_amount,
    MIN(r.start_date) AS earliest_date,
    MAX(r.last_seen) AS latest_date
  FROM gs_entities e
  JOIN gs_relationships r ON r.target_entity_id = e.id
  WHERE r.relationship_type = 'funder_to_recipient'
    AND r.amount IS NOT NULL
  GROUP BY e.id, e.gs_id, e.canonical_name, e.abn, e.state, e.postcode, e.remoteness, e.sector, e.is_community_controlled
),

-- 2. AusTender contracts (supplier side)
contracts AS (
  SELECT
    e.id AS entity_id,
    e.gs_id,
    e.canonical_name,
    e.abn,
    'contract' AS funding_type,
    e.state,
    e.postcode,
    e.remoteness,
    e.sector,
    e.is_community_controlled,
    COUNT(DISTINCT ac.id) AS record_count,
    COALESCE(SUM(ac.contract_value), 0) AS total_amount,
    MIN(ac.contract_start::date) AS earliest_date,
    MAX(ac.contract_end::date) AS latest_date
  FROM gs_entities e
  JOIN austender_contracts ac ON ac.supplier_abn = e.abn
  WHERE e.abn IS NOT NULL
  GROUP BY e.id, e.gs_id, e.canonical_name, e.abn, e.state, e.postcode, e.remoteness, e.sector, e.is_community_controlled
),

-- 3. Justice funding
justice AS (
  SELECT
    e.id AS entity_id,
    e.gs_id,
    e.canonical_name,
    e.abn,
    'justice_funding' AS funding_type,
    e.state,
    e.postcode,
    e.remoteness,
    e.sector,
    e.is_community_controlled,
    COUNT(DISTINCT jf.id) AS record_count,
    COALESCE(SUM(jf.amount_dollars), 0) AS total_amount,
    NULL::date AS earliest_date,
    NULL::date AS latest_date
  FROM gs_entities e
  JOIN justice_funding jf ON jf.recipient_abn = e.abn
  WHERE e.abn IS NOT NULL
  GROUP BY e.id, e.gs_id, e.canonical_name, e.abn, e.state, e.postcode, e.remoteness, e.sector, e.is_community_controlled
),

-- 4. Political donations (donor side — money flowing OUT)
donations AS (
  SELECT
    e.id AS entity_id,
    e.gs_id,
    e.canonical_name,
    e.abn,
    'political_donation' AS funding_type,
    e.state,
    e.postcode,
    e.remoteness,
    e.sector,
    e.is_community_controlled,
    COUNT(DISTINCT pd.id) AS record_count,
    COALESCE(SUM(pd.amount), 0) AS total_amount,
    NULL::date AS earliest_date,
    NULL::date AS latest_date
  FROM gs_entities e
  JOIN political_donations pd ON pd.donor_abn = e.abn
  WHERE e.abn IS NOT NULL
  GROUP BY e.id, e.gs_id, e.canonical_name, e.abn, e.state, e.postcode, e.remoteness, e.sector, e.is_community_controlled
),

-- Union all sources
all_sources AS (
  SELECT * FROM grants
  UNION ALL SELECT * FROM contracts
  UNION ALL SELECT * FROM justice
  UNION ALL SELECT * FROM donations
)

-- Final roll-up per entity
SELECT
  entity_id,
  gs_id,
  canonical_name,
  abn,
  state,
  postcode,
  remoteness,
  sector,
  is_community_controlled,

  -- Per-source totals
  COALESCE(SUM(CASE WHEN funding_type = 'grant' THEN total_amount END), 0) AS grants_total,
  COALESCE(SUM(CASE WHEN funding_type = 'contract' THEN total_amount END), 0) AS contracts_total,
  COALESCE(SUM(CASE WHEN funding_type = 'justice_funding' THEN total_amount END), 0) AS justice_total,
  COALESCE(SUM(CASE WHEN funding_type = 'political_donation' THEN total_amount END), 0) AS donations_total,

  -- Per-source record counts
  COALESCE(SUM(CASE WHEN funding_type = 'grant' THEN record_count END), 0)::int AS grants_count,
  COALESCE(SUM(CASE WHEN funding_type = 'contract' THEN record_count END), 0)::int AS contracts_count,
  COALESCE(SUM(CASE WHEN funding_type = 'justice_funding' THEN record_count END), 0)::int AS justice_count,
  COALESCE(SUM(CASE WHEN funding_type = 'political_donation' THEN record_count END), 0)::int AS donations_count,

  -- Grand totals
  SUM(total_amount) AS grand_total_funding,
  SUM(record_count)::int AS grand_total_records,

  -- Source diversity score (how many different funding types does this entity have)
  COUNT(DISTINCT funding_type) AS funding_source_diversity,

  NOW() AS computed_at

FROM all_sources
GROUP BY entity_id, gs_id, canonical_name, abn, state, postcode, remoteness, sector, is_community_controlled;

-- Indexes for fast entity lookups
CREATE UNIQUE INDEX ON mv_entity_total_funding (entity_id);
CREATE INDEX ON mv_entity_total_funding (abn) WHERE abn IS NOT NULL;
CREATE INDEX ON mv_entity_total_funding (gs_id);
CREATE INDEX ON mv_entity_total_funding (grand_total_funding DESC);
CREATE INDEX ON mv_entity_total_funding (state, remoteness);
CREATE INDEX ON mv_entity_total_funding (is_community_controlled) WHERE is_community_controlled = true;

-- Grant query access
GRANT SELECT ON mv_entity_total_funding TO anon, authenticated;

COMMENT ON MATERIALIZED VIEW mv_entity_total_funding IS
  'Per-entity rollup of all government funding sources: grants, contracts, justice funding, and political donations. Refresh daily.';
