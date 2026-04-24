-- mv_lga_indigenous_proxy_score
-- Compounds: justice_funding × gs_entities (Indigenous flags) × place
-- (LGA). Per-LGA aggregation of Indigenous-tagged funding showing how
-- much reaches community-controlled orgs vs. proxy orgs.
--
-- Surfaces the Indigenous Proxy Problem story at place-level — "in LGA X,
-- $Y was tagged Indigenous, but only $Z% reached community-controlled
-- organisations."

DROP MATERIALIZED VIEW IF EXISTS mv_lga_indigenous_proxy_score CASCADE;

CREATE MATERIALIZED VIEW mv_lga_indigenous_proxy_score AS
SELECT jf.state,
       ge.lga_name,
       COUNT(DISTINCT jf.recipient_abn) AS unique_recipients,
       COUNT(DISTINCT jf.recipient_abn) FILTER (WHERE ge.is_community_controlled) AS indigenous_recipients,
       COUNT(DISTINCT jf.recipient_abn) FILTER (WHERE NOT ge.is_community_controlled) AS non_indigenous_recipients,
       COALESCE(SUM(jf.amount_dollars), 0)::bigint AS total_indigenous_tagged_funding,
       COALESCE(SUM(jf.amount_dollars) FILTER (WHERE ge.is_community_controlled), 0)::bigint AS to_community_controlled,
       COALESCE(SUM(jf.amount_dollars) FILTER (WHERE NOT ge.is_community_controlled), 0)::bigint AS to_proxy_orgs,
       CASE WHEN SUM(jf.amount_dollars) > 0
         THEN ROUND((SUM(jf.amount_dollars) FILTER (WHERE ge.is_community_controlled)::numeric
                     / SUM(jf.amount_dollars)::numeric) * 100, 1)
         ELSE 0
       END AS community_controlled_share_pct,
       CASE WHEN SUM(jf.amount_dollars) > 0
         THEN ROUND((SUM(jf.amount_dollars) FILTER (WHERE NOT ge.is_community_controlled)::numeric
                     / SUM(jf.amount_dollars)::numeric) * 100, 1)
         ELSE 0
       END AS proxy_share_pct
  FROM justice_funding jf
  JOIN gs_entities ge ON ge.id = jf.gs_entity_id
 WHERE jf.topics @> ARRAY['indigenous']::text[]
   AND jf.source NOT IN ('austender-direct')
   AND jf.program_name NOT LIKE 'ROGS%'
   AND jf.program_name NOT LIKE 'Total%'
   AND ge.lga_name IS NOT NULL
   AND jf.state IS NOT NULL
 GROUP BY jf.state, ge.lga_name
HAVING SUM(jf.amount_dollars) > 10000;

CREATE INDEX ON mv_lga_indigenous_proxy_score (state, community_controlled_share_pct);
CREATE INDEX ON mv_lga_indigenous_proxy_score (proxy_share_pct DESC);
CREATE INDEX ON mv_lga_indigenous_proxy_score (total_indigenous_tagged_funding DESC);

-- Quick preview: worst 10 LGAs for Indigenous Proxy
SELECT state, lga_name,
       (total_indigenous_tagged_funding / 1000000.0)::numeric(10,2) AS total_m,
       community_controlled_share_pct AS cc_pct,
       proxy_share_pct,
       unique_recipients
  FROM mv_lga_indigenous_proxy_score
 WHERE total_indigenous_tagged_funding > 1000000
 ORDER BY proxy_share_pct DESC
 LIMIT 10;
