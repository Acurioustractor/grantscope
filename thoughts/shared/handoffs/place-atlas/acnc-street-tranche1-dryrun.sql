-- ACNC street-line tranche 1 — DRY RUN (reads + temp tables only, zero writes)
-- 2026-08-09. Survey basis: acnc-street-survey.sql beside this file.
-- Payload expectation from survey: 637 sal_dominant clean + 27 town_unique clean = 664
-- before the postcode-coherence and hub gates (applied here for the first time).
--
-- RUN: source .env && PGPASSWORD="$DATABASE_PASSWORD" psql -h aws-0-ap-southeast-2.pooler.supabase.com -p 5432 -U "postgres.tednluwflfhxyucgwigh" -d postgres -f thoughts/shared/handoffs/place-atlas/acnc-street-tranche1-dryrun.sql

\set QUIET on
\pset footer off

CREATE TEMP TABLE tmp_graded AS
WITH sm(ab,fu) AS (VALUES
  ('NSW','New South Wales'),('VIC','Victoria'),('QLD','Queensland'),
  ('SA','South Australia'),('WA','Western Australia'),('TAS','Tasmania'),
  ('NT','Northern Territory'),('ACT','Australian Capital Territory')),
smd(ab,dg) AS (VALUES
  ('NSW','1'),('VIC','2'),('QLD','3'),('SA','4'),('WA','5'),('TAS','6'),('NT','7'),('ACT','8')),
pop AS MATERIALIZED (
  SELECT id, gs_id, abn, lga_source, postcode AS ent_pc
  FROM gs_entities
  WHERE lga_code IS NULL AND NULLIF(abn,'') IS NOT NULL
    AND ((postcode IS NOT NULL AND lga_source IN
          ('unresolved_multi_lga_postcode','unknown_postcode','postcode_unmapped_in_abs','state_conflict','no_state'))
         OR lga_source = 'registry_address')),
all_lines AS MATERIALIZED (
  SELECT abn,
         upper(regexp_replace(address_line_1, '[^A-Za-z0-9]+', ' ', 'g')) || ' @ ' || upper(coalesce(trim(town_city),'')) AS nline
  FROM acnc_charities
  WHERE address_line_1 IS NOT NULL
    AND address_line_1 !~* 'PO BOX|POBOX|GPO|LOCKED BAG|PMB|PRIVATE BAG|MAIL BAG|MAIL SERVICE|RMB|RSD|CMB|C/-|C/O|CARE OF'),
shared AS MATERIALIZED (
  SELECT nline, COUNT(DISTINCT abn) AS n_orgs FROM all_lines GROUP BY 1),
loc AS MATERIALIZED (
  SELECT upper(locality) AS town, state_name,
         COUNT(DISTINCT lga_code) AS n_lgas,
         MAX(lga_code) AS win_code, MAX(lga_name) AS win_name
  FROM abs_locality_lga GROUP BY 1,2),
sal3 AS MATERIALIZED (
  SELECT upper(regexp_replace(sal_name, ' \([^)]*\)$','')) AS town_base,
         COALESCE(substring(upper(replace(coalesce(substring(sal_name from '\(([^)]*)\)$'),''),'.','')) from '([A-Z]+)$'), '') AS st_grp,
         COUNT(DISTINCT sal_code) AS n_sals,
         MAX(ratio) AS max_ratio,
         (array_agg(left(lga_code,1) ORDER BY ratio DESC))[1] AS win_state_digit,
         (array_agg(lga_code ORDER BY ratio DESC))[1] AS win_code,
         (array_agg(lga_name ORDER BY ratio DESC))[1] AS win_name
  FROM abs_sal_lga_ratio GROUP BY 1,2),
cand AS MATERIALIZED (
  SELECT p.id, p.gs_id, p.lga_source, p.ent_pc, a.abn, a.name,
         left(a.address_line_1, 44) AS line1,
         upper(trim(a.town_city)) AS town, upper(trim(a.state)) AS st,
         s2.n_orgs
  FROM acnc_charities a
  JOIN pop p ON p.abn = a.abn
  JOIN all_lines al ON al.abn = a.abn
  JOIN shared s2 ON s2.nline = al.nline)
SELECT c.*,
  CASE
    WHEN l.win_code IS NOT NULL AND l.n_lgas = 1 THEN 'town_unique_lga'
    WHEN s.win_code IS NOT NULL THEN 'sal_dominant'
  END AS path,
  -- winner must be path-scoped: a 2-LGA locality-table match must never donate
  -- its meaningless MAX(lga) when SAL dominance is what resolved the town
  CASE WHEN l.win_code IS NOT NULL AND l.n_lgas = 1 THEN l.win_code ELSE s.win_code END AS win_code,
  CASE WHEN l.win_code IS NOT NULL AND l.n_lgas = 1 THEN l.win_name ELSE s.win_name END AS win_name,
  CASE
    WHEN l.win_code IS NOT NULL AND l.n_lgas = 1 THEN 'acnc_street_line+abs_asgs'
    WHEN s.win_code IS NOT NULL THEN 'acnc_street_line+sal_ratio_dominant'
  END AS stamp,
  (c.n_orgs >= 3) AS shared_line,
  (c.town = 'NHULUNBUY') AS ben_nhulunbuy,
  (c.town IN ('ALICE SPRINGS','KATHERINE','THURSDAY ISLAND','COOKTOWN','TENNANT CREEK')) AS hub_town,
  -- coherent when the resolved town is itself a locality of the entity postcode
  -- (SAL authority outranks postcode_geo's legacy lga opinion), or the winning
  -- LGA appears anywhere in the postcode; hold only when NEITHER
  (c.lga_source = 'unresolved_multi_lga_postcode'
   AND EXISTS (SELECT 1 FROM postcode_geo pg
               WHERE pg.postcode = c.ent_pc AND pg.lga_code IS NOT NULL)
   AND NOT EXISTS (SELECT 1 FROM postcode_geo pg
                   WHERE pg.postcode = c.ent_pc AND upper(pg.locality) = c.town)
   AND NOT EXISTS (SELECT 1 FROM postcode_geo pg
                   WHERE pg.postcode = c.ent_pc
                     AND pg.lga_code = CASE WHEN l.win_code IS NOT NULL AND l.n_lgas = 1 THEN l.win_code ELSE s.win_code END)) AS pc_incoherent,
  -- postcode_geo landmine: town IS a locality of the postcode but postcode_geo
  -- pins that locality to a DIFFERENT lga than the SAL/locality authority
  EXISTS (SELECT 1 FROM postcode_geo pg
          WHERE pg.postcode = c.ent_pc AND upper(pg.locality) = c.town
            AND pg.lga_code IS NOT NULL
            AND pg.lga_code <> CASE WHEN l.win_code IS NOT NULL AND l.n_lgas = 1 THEN l.win_code ELSE s.win_code END) AS pg_landmine
FROM cand c
LEFT JOIN sm  ON sm.ab  = c.st
LEFT JOIN smd ON smd.ab = c.st
LEFT JOIN loc l ON l.town = c.town AND l.state_name = sm.fu
LEFT JOIN sal3 s ON s.town_base = c.town
  AND (s.st_grp = '' OR s.st_grp = c.st)
  AND s.n_sals = 1 AND s.max_ratio >= 0.9
  AND s.win_state_digit = smd.dg;

CREATE TEMP TABLE tmp_verdict AS
SELECT *,
  CASE
    WHEN path IS NULL THEN 'not_resolvable'
    WHEN ben_nhulunbuy THEN 'BEN_nhulunbuy'
    WHEN shared_line THEN 'hold_shared_line'
    WHEN hub_town THEN 'hold_hub_town'
    WHEN pc_incoherent THEN 'hold_pc_incoherent'
    ELSE 'place'
  END AS verdict
FROM tmp_graded;

\set QUIET off

\echo '=== A. verdict x path ==='
SELECT verdict, path, COUNT(*) FROM tmp_verdict GROUP BY 1,2 ORDER BY 1,2;

\echo '=== B. place: by stamp and source class ==='
SELECT stamp, lga_source, COUNT(*) FROM tmp_verdict WHERE verdict='place' GROUP BY 1,2 ORDER BY 3 DESC;

\echo '=== C. place: top 20 towns ==='
SELECT town, st, win_name, COUNT(*) FROM tmp_verdict WHERE verdict='place' GROUP BY 1,2,3 ORDER BY 4 DESC LIMIT 20;

\echo '=== D. the Nhulunbuy group (Ben verdict) ==='
SELECT gs_id, left(name,40) AS name, line1, ent_pc, lga_source, path FROM tmp_verdict WHERE ben_nhulunbuy AND path IS NOT NULL ORDER BY name;

\echo '=== E1. hold_pc_incoherent (town not in postcode AND lga not in postcode) ==='
SELECT gs_id, left(name,36) AS name, town, st, ent_pc, win_name FROM tmp_verdict WHERE verdict='hold_pc_incoherent' ORDER BY town, name LIMIT 25;

\echo '=== E2. postcode_geo landmines surfaced (placed per SAL; queue pg repair) ==='
SELECT town, st, ent_pc, win_name AS sal_says, COUNT(*) AS cands,
       (SELECT string_agg(DISTINCT pg.lga_name, ', ') FROM postcode_geo pg
         WHERE pg.postcode = tmp_verdict.ent_pc AND upper(pg.locality) = tmp_verdict.town
           AND pg.lga_code IS NOT NULL) AS postcode_geo_says
FROM tmp_verdict WHERE pg_landmine AND verdict IN ('place','BEN_nhulunbuy')
GROUP BY 1,2,3,4 ORDER BY 5 DESC LIMIT 12;

\echo '=== F. hold_shared_line: top lines ==='
SELECT t.town, t.st, t.n_orgs, COUNT(*) AS cands, MAX(left(t.line1,34)) AS sample_line
FROM tmp_verdict t WHERE t.verdict='hold_shared_line' GROUP BY 1,2,3 ORDER BY 3 DESC LIMIT 10;

\echo '=== G. hold_hub_town ==='
SELECT gs_id, left(name,40) AS name, town, line1, ent_pc FROM tmp_verdict WHERE verdict='hold_hub_town' ORDER BY town LIMIT 15;

\echo '=== H. totals ==='
SELECT verdict, COUNT(*) FROM tmp_verdict GROUP BY 1 ORDER BY 2 DESC;
