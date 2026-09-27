SET statement_timeout = 0;
BEGIN;
CREATE TEMP TABLE k  AS
SELECT DISTINCT supplier_name, match_status, n,
  btrim(lower(regexp_replace(regexp_replace(n, '\m(Aboriginal|Torres Strait Islander|Corporation|Incorporated|Inc|Ltd|Limited|Pty|Co-operative|Association|Assoc|The|Of)\M', '', 'gi'), '[^a-zA-Z0-9 ]', '', 'g'))) AS nn
FROM (SELECT supplier_name, match_status, upper(btrim(regexp_replace(supplier_name, '\s*\(.*$', ''))) n FROM wa_supplier_entity_matches WHERE match_status IN ('unmatched','ambiguous')
      UNION SELECT supplier_name, match_status, upper(btrim(substring(supplier_name from '\(([^()]+)\)\s*$'))) FROM wa_supplier_entity_matches WHERE match_status IN ('unmatched','ambiguous')) x
WHERE n IS NOT NULL AND length(n) > 3;
SET enable_hashjoin = off;
CREATE TEMP TABLE c  AS
SELECT k.supplier_name, k.match_status, l.abn FROM k JOIN mv_abr_name_lookup l ON l.norm_name = k.nn AND l.upper_name = k.n;
WITH u1 AS (SELECT supplier_name, match_status, min(abn) abn FROM c GROUP BY 1,2 HAVING count(DISTINCT abn)=1)
SELECT m.match_status, count(*) components, count(DISTINCT m.state_tender_id) contracts,
  count(*) FILTER (WHERE e.id IS NOT NULL) in_gs_entities, count(*) FILTER (WHERE e.is_community_controlled) cc,
  count(*) FILTER (WHERE wc.is_kimberley) kimberley_components
FROM wa_supplier_entity_matches m JOIN u1 USING (supplier_name, match_status)
LEFT JOIN gs_entities e ON e.abn=u1.abn
LEFT JOIN wa_transition_candidates wc ON wc.state_tender_id=m.state_tender_id
GROUP BY 1;
ROLLBACK;
