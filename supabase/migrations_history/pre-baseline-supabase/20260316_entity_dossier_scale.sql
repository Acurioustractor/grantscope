-- Entity Dossier Scale Fix: indexes for keyset pagination + enriched MV
-- Migration: 20260316_entity_dossier_scale.sql
-- Run with: source .env && PGPASSWORD="$DATABASE_PASSWORD" psql -h aws-0-ap-southeast-2.pooler.supabase.com -p 5432 -U "postgres.tednluwflfhxyucgwigh" -d postgres -f supabase/migrations/20260316_entity_dossier_scale.sql

-- 1. Composite indexes for keyset pagination (amount DESC, id DESC)
-- These turn 6.8s sorted queries into ~50ms for entities like Defence (348K rels)
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_gs_rel_source_type_amt
ON gs_relationships (source_entity_id, relationship_type, amount DESC NULLS LAST, id);

CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_gs_rel_target_type_amt
ON gs_relationships (target_entity_id, relationship_type, amount DESC NULLS LAST, id);

-- 2. Drop and recreate mv_gs_entity_stats with enriched columns
DROP MATERIALIZED VIEW IF EXISTS mv_gs_entity_stats;

CREATE MATERIALIZED VIEW mv_gs_entity_stats AS
WITH directional AS (
  SELECT
    source_entity_id AS entity_id,
    target_entity_id AS counterparty_id,
    relationship_type,
    amount,
    year,
    'outbound' AS direction
  FROM gs_relationships
  UNION ALL
  SELECT
    target_entity_id AS entity_id,
    source_entity_id AS counterparty_id,
    relationship_type,
    amount,
    year,
    'inbound' AS direction
  FROM gs_relationships
),
type_stats AS (
  SELECT
    entity_id,
    relationship_type,
    direction,
    COUNT(*) AS rel_count,
    COALESCE(SUM(amount), 0) AS rel_amount
  FROM directional
  GROUP BY entity_id, relationship_type, direction
),
year_stats AS (
  SELECT
    entity_id,
    year,
    COUNT(*) AS rel_count
  FROM directional
  WHERE year IS NOT NULL
  GROUP BY entity_id, year
),
counterparty_totals AS (
  SELECT
    entity_id,
    counterparty_id,
    SUM(COALESCE(amount, 0)) AS cp_total
  FROM directional
  GROUP BY entity_id, counterparty_id
),
concentration AS (
  SELECT
    entity_id,
    CASE WHEN SUM(cp_total) > 0
      THEN MAX(cp_total)::numeric / SUM(cp_total)::numeric
      ELSE 0
    END AS top_counterparty_share,
    COUNT(DISTINCT counterparty_id) AS distinct_counterparties
  FROM counterparty_totals
  GROUP BY entity_id
),
entity_agg AS (
  SELECT
    entity_id,
    SUM(CASE WHEN direction = 'outbound' THEN rel_count ELSE 0 END) AS outbound_count,
    SUM(CASE WHEN direction = 'inbound' THEN rel_count ELSE 0 END) AS inbound_count,
    SUM(CASE WHEN direction = 'outbound' THEN rel_amount ELSE 0 END) AS total_outbound_amount,
    SUM(CASE WHEN direction = 'inbound' THEN rel_amount ELSE 0 END) AS total_inbound_amount,
    ARRAY_AGG(DISTINCT relationship_type) FILTER (WHERE direction = 'outbound') AS outbound_types,
    ARRAY_AGG(DISTINCT relationship_type) FILTER (WHERE direction = 'inbound') AS inbound_types,
    jsonb_object_agg(
      relationship_type || ':' || direction,
      jsonb_build_object('count', rel_count, 'amount', rel_amount, 'direction', direction)
    ) AS type_breakdown
  FROM type_stats
  GROUP BY entity_id
),
year_agg AS (
  SELECT
    entity_id,
    jsonb_object_agg(year::text, rel_count) AS year_distribution
  FROM year_stats
  GROUP BY entity_id
)
SELECT
  e.id,
  e.gs_id,
  e.canonical_name,
  e.entity_type,
  e.abn,
  e.source_count,
  COALESCE(ea.outbound_count, 0) AS outbound_relationships,
  COALESCE(ea.inbound_count, 0) AS inbound_relationships,
  COALESCE(ea.outbound_count, 0) + COALESCE(ea.inbound_count, 0) AS total_relationships,
  COALESCE(ea.total_outbound_amount, 0) AS total_outbound_amount,
  COALESCE(ea.total_inbound_amount, 0) AS total_inbound_amount,
  ea.outbound_types,
  ea.inbound_types,
  COALESCE(ea.type_breakdown, '{}'::jsonb) AS type_breakdown,
  COALESCE(ya.year_distribution, '{}'::jsonb) AS year_distribution,
  COALESCE(c.top_counterparty_share, 0) AS top_counterparty_share,
  COALESCE(c.distinct_counterparties, 0) AS distinct_counterparties
FROM gs_entities e
INNER JOIN entity_agg ea ON e.id = ea.entity_id
LEFT JOIN year_agg ya ON e.id = ya.entity_id
LEFT JOIN concentration c ON e.id = c.entity_id
WHERE COALESCE(ea.outbound_count, 0) + COALESCE(ea.inbound_count, 0) > 0;

-- 3. Indexes on the materialized view
CREATE UNIQUE INDEX idx_mv_gs_es_id ON mv_gs_entity_stats(id);
CREATE INDEX idx_mv_gs_es_gs_id ON mv_gs_entity_stats(gs_id);
CREATE INDEX idx_mv_gs_es_total ON mv_gs_entity_stats(total_relationships DESC);
CREATE INDEX idx_mv_gs_es_abn ON mv_gs_entity_stats(abn) WHERE abn IS NOT NULL;
