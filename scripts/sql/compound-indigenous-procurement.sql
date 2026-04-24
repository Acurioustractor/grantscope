-- mv_indigenous_procurement_score
-- Compounds: gs_entities (Indigenous flags) × austender_contracts × agency buyer
-- Per buyer agency: total contract spend, Indigenous-supplier contract spend,
-- IPP (Indigenous Procurement Policy) performance ratio.
--
-- Agency meets IPP target if indigenous_share >= 3% (federal target).
-- Indigenous supplier = is_community_controlled OR is_supply_nation_certified
-- OR entity_type='indigenous_corp' OR 'bbf-listed' IN tags.

DROP MATERIALIZED VIEW IF EXISTS mv_indigenous_procurement_score CASCADE;

CREATE MATERIALIZED VIEW mv_indigenous_procurement_score AS
WITH indigenous_entities AS (
  SELECT abn
    FROM gs_entities
   WHERE abn IS NOT NULL
     AND (
       is_community_controlled = true
       OR is_supply_nation_certified = true
       OR entity_type = 'indigenous_corp'
       OR 'bbf-listed' = ANY(tags)
     )
),
agency_totals AS (
  SELECT buyer_name AS agency,
         EXTRACT(YEAR FROM contract_start)::int AS year,
         COUNT(*) AS total_contracts,
         COALESCE(SUM(contract_value), 0) AS total_value,
         COUNT(*) FILTER (
           WHERE supplier_abn IN (SELECT abn FROM indigenous_entities)
         ) AS indigenous_contracts,
         COALESCE(SUM(contract_value) FILTER (
           WHERE supplier_abn IN (SELECT abn FROM indigenous_entities)
         ), 0) AS indigenous_value
    FROM austender_contracts
   WHERE buyer_name IS NOT NULL
     AND contract_start IS NOT NULL
     AND EXTRACT(YEAR FROM contract_start) >= 2019
   GROUP BY buyer_name, EXTRACT(YEAR FROM contract_start)
)
SELECT agency,
       year,
       total_contracts,
       total_value::bigint,
       indigenous_contracts,
       indigenous_value::bigint,
       CASE WHEN total_value > 0
         THEN ROUND((indigenous_value::numeric / total_value::numeric) * 100, 2)
         ELSE 0
       END AS indigenous_share_pct,
       CASE WHEN total_contracts > 0
         THEN ROUND((indigenous_contracts::numeric / total_contracts::numeric) * 100, 2)
         ELSE 0
       END AS indigenous_contract_pct,
       CASE WHEN total_value > 0 AND (indigenous_value::numeric / total_value::numeric) >= 0.03
         THEN 'meets_ipp_target'
         ELSE 'below_ipp_target'
       END AS ipp_status
  FROM agency_totals
 WHERE total_value > 100000;  -- filter out tiny agencies for signal

CREATE INDEX ON mv_indigenous_procurement_score (year, indigenous_share_pct);
CREATE INDEX ON mv_indigenous_procurement_score (agency, year);
CREATE INDEX ON mv_indigenous_procurement_score (ipp_status, year);

-- Quick sanity check
SELECT year, COUNT(*) AS agencies,
       COUNT(*) FILTER (WHERE ipp_status = 'meets_ipp_target') AS meeting_target,
       SUM(total_value)::bigint AS total_contract_spend,
       SUM(indigenous_value)::bigint AS indigenous_spend
  FROM mv_indigenous_procurement_score
 GROUP BY year
 ORDER BY year DESC
 LIMIT 10;
