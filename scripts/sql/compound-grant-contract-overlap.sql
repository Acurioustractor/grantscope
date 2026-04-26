-- mv_grant_contract_overlap
-- Compounds: justice_funding (grant winners) × austender_contracts (contract
-- winners). Identifies entities that both receive government grants AND win
-- government contracts — privileged access to public funding across two
-- separate channels.
--
-- Wrapped in BEGIN with extended statement_timeout because the per-ABN
-- aggregations across justice_funding (71K) and austender_contracts (770K)
-- can exceed Supabase's default 8s timeout.

DROP MATERIALIZED VIEW IF EXISTS mv_grant_contract_overlap CASCADE;

BEGIN;
SET LOCAL statement_timeout = '600s';

CREATE MATERIALIZED VIEW mv_grant_contract_overlap AS
WITH grant_totals AS (
  SELECT recipient_abn AS abn,
         (array_agg(recipient_name ORDER BY amount_dollars DESC NULLS LAST))[1] AS recipient_name,
         COUNT(*)::int AS grant_count,
         COALESCE(SUM(amount_dollars), 0)::bigint AS grant_total,
         MIN(financial_year) AS grant_first_year,
         MAX(financial_year) AS grant_last_year
    FROM justice_funding
   WHERE recipient_abn IS NOT NULL
   GROUP BY recipient_abn
),
contract_totals AS (
  SELECT supplier_abn AS abn,
         (array_agg(supplier_name ORDER BY contract_value DESC NULLS LAST))[1] AS supplier_name,
         COUNT(*)::int AS contract_count,
         COALESCE(SUM(contract_value), 0)::bigint AS contract_total,
         MIN(EXTRACT(YEAR FROM contract_start))::int AS contract_first_year,
         MAX(EXTRACT(YEAR FROM contract_start))::int AS contract_last_year
    FROM austender_contracts
   WHERE supplier_abn IS NOT NULL
   GROUP BY supplier_abn
)
SELECT g.abn,
       g.recipient_name,
       c.supplier_name,
       g.grant_count,
       g.grant_total,
       c.contract_count,
       c.contract_total,
       (g.grant_total + c.contract_total) AS combined_public_funding,
       g.grant_first_year,
       g.grant_last_year,
       c.contract_first_year,
       c.contract_last_year,
       CASE WHEN c.contract_total > g.grant_total THEN 'contract_heavy'
            WHEN g.grant_total > c.contract_total THEN 'grant_heavy'
            ELSE 'balanced'
       END AS funding_profile,
       e.gs_id,
       e.entity_type,
       e.state,
       e.is_community_controlled,
       e.community_controlled_tier
  FROM grant_totals g
  INNER JOIN contract_totals c ON c.abn = g.abn
  LEFT JOIN gs_entities e ON e.abn = g.abn;

COMMIT;

CREATE INDEX ON mv_grant_contract_overlap (combined_public_funding DESC);
CREATE INDEX ON mv_grant_contract_overlap (funding_profile);
CREATE INDEX ON mv_grant_contract_overlap (abn);

SELECT COUNT(*) AS entities_with_both,
       SUM(grant_total)::bigint AS total_grants,
       SUM(contract_total)::bigint AS total_contracts,
       COUNT(*) FILTER (WHERE is_community_controlled) AS indigenous_count
  FROM mv_grant_contract_overlap;
