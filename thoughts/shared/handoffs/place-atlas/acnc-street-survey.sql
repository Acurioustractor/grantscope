-- ACNC street-line survey pt 3 (READ-ONLY) — corrected SAL dominance:
--   a town NAME resolves only if exactly ONE SAL carries that name in-state,
--   that SAL is >=0.9 dominant in one LGA, and the winning LGA's state digit
--   matches the charity's state. Kills the Guildford class (LGA-qualified
--   metro SAL splits masquerading as dominance).

\echo '=== S8: corrected resolution paths x shared-line ==='
WITH smd(ab, dg) AS (VALUES
  ('NSW','1'),('VIC','2'),('QLD','3'),('SA','4'),('WA','5'),('TAS','6'),('NT','7'),('ACT','8')),
sm(ab,fu) AS (VALUES
  ('NSW','New South Wales'),('VIC','Victoria'),('QLD','Queensland'),
  ('SA','South Australia'),('WA','Western Australia'),('TAS','Tasmania'),
  ('NT','Northern Territory'),('ACT','Australian Capital Territory')),
pop AS MATERIALIZED (
  SELECT abn, lga_source FROM gs_entities
  WHERE lga_code IS NULL AND abn IS NOT NULL
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
  SELECT upper(locality) AS town, state_name, COUNT(DISTINCT lga_code) AS n_lgas
  FROM abs_locality_lga GROUP BY 1,2),
sal3 AS MATERIALIZED (
  SELECT upper(regexp_replace(sal_name, ' \([^)]*\)$','')) AS town_base,
         COALESCE(substring(upper(replace(coalesce(substring(sal_name from '\(([^)]*)\)$'),''),'.','')) from '([A-Z]+)$'), '') AS st_grp,
         COUNT(DISTINCT sal_code) AS n_sals,
         MAX(ratio) AS max_ratio,
         (array_agg(left(lga_code,1) ORDER BY ratio DESC))[1] AS win_state_digit,
         (array_agg(lga_name ORDER BY ratio DESC))[1] AS win_lga
  FROM abs_sal_lga_ratio
  GROUP BY 1,2),
cand AS MATERIALIZED (
  SELECT p.lga_source, a.abn,
         upper(trim(a.town_city)) AS town, upper(trim(a.state)) AS st,
         s2.n_orgs
  FROM acnc_charities a
  JOIN pop p ON p.abn = a.abn
  JOIN all_lines al ON al.abn = a.abn
  JOIN shared s2 ON s2.nline = al.nline),
graded AS MATERIALIZED (
  SELECT c.lga_source, c.abn, c.town, c.st, (c.n_orgs >= 3) AS shared_line,
    CASE
      WHEN NULLIF(c.town,'') IS NULL THEN 'no_town'
      WHEN EXISTS (SELECT 1 FROM loc l JOIN sm ON sm.fu = l.state_name
                   WHERE l.town = c.town AND sm.ab = c.st AND l.n_lgas = 1) THEN 'town_unique_lga'
      WHEN EXISTS (SELECT 1 FROM sal3 s JOIN smd ON smd.ab = c.st
                   WHERE s.town_base = c.town
                     AND (s.st_grp = '' OR s.st_grp = c.st)
                     AND s.n_sals = 1 AND s.max_ratio >= 0.9
                     AND s.win_state_digit = smd.dg) THEN 'sal_dominant'
      WHEN EXISTS (SELECT 1 FROM loc l JOIN sm ON sm.fu = l.state_name
                   WHERE l.town = c.town AND sm.ab = c.st)
        OR EXISTS (SELECT 1 FROM sal3 s WHERE s.town_base = c.town
                   AND (s.st_grp = '' OR s.st_grp = c.st)) THEN 'town_multi_lga'
      ELSE 'town_no_auth'
    END AS path
  FROM cand c)
SELECT path, COUNT(*) AS cands,
  COUNT(*) FILTER (WHERE NOT shared_line) AS clean_line,
  COUNT(*) FILTER (WHERE shared_line) AS shared_3plus,
  COUNT(*) FILTER (WHERE lga_source = 'unresolved_multi_lga_postcode') AS from_multi_lga,
  COUNT(*) FILTER (WHERE lga_source = 'registry_address') AS from_registry
FROM graded GROUP BY 1 ORDER BY 2 DESC;

\echo '=== S9: payload towns under the corrected test (clean line only) ==='
WITH smd(ab, dg) AS (VALUES
  ('NSW','1'),('VIC','2'),('QLD','3'),('SA','4'),('WA','5'),('TAS','6'),('NT','7'),('ACT','8')),
sm(ab,fu) AS (VALUES
  ('NSW','New South Wales'),('VIC','Victoria'),('QLD','Queensland'),
  ('SA','South Australia'),('WA','Western Australia'),('TAS','Tasmania'),
  ('NT','Northern Territory'),('ACT','Australian Capital Territory')),
pop AS MATERIALIZED (
  SELECT abn, lga_source FROM gs_entities
  WHERE lga_code IS NULL AND abn IS NOT NULL
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
  SELECT upper(locality) AS town, state_name, COUNT(DISTINCT lga_code) AS n_lgas
  FROM abs_locality_lga GROUP BY 1,2),
sal3 AS MATERIALIZED (
  SELECT upper(regexp_replace(sal_name, ' \([^)]*\)$','')) AS town_base,
         COALESCE(substring(upper(replace(coalesce(substring(sal_name from '\(([^)]*)\)$'),''),'.','')) from '([A-Z]+)$'), '') AS st_grp,
         COUNT(DISTINCT sal_code) AS n_sals,
         MAX(ratio) AS max_ratio,
         (array_agg(left(lga_code,1) ORDER BY ratio DESC))[1] AS win_state_digit,
         (array_agg(lga_name ORDER BY ratio DESC))[1] AS win_lga
  FROM abs_sal_lga_ratio
  GROUP BY 1,2),
cand AS MATERIALIZED (
  SELECT p.lga_source, a.abn,
         upper(trim(a.town_city)) AS town, upper(trim(a.state)) AS st,
         s2.n_orgs
  FROM acnc_charities a
  JOIN pop p ON p.abn = a.abn
  JOIN all_lines al ON al.abn = a.abn
  JOIN shared s2 ON s2.nline = al.nline)
SELECT c.town, c.st, COUNT(*) AS cands, MAX(s.win_lga) AS win_lga, round(MAX(s.max_ratio),3) AS ratio
FROM cand c
JOIN smd ON smd.ab = c.st
JOIN sal3 s ON s.town_base = c.town
  AND (s.st_grp = '' OR s.st_grp = c.st)
  AND s.n_sals = 1 AND s.max_ratio >= 0.9
  AND s.win_state_digit = smd.dg
WHERE c.n_orgs < 3
  AND NOT EXISTS (SELECT 1 FROM loc l JOIN sm ON sm.fu = l.state_name
                  WHERE l.town = c.town AND sm.ab = c.st AND l.n_lgas = 1)
GROUP BY 1,2 ORDER BY 3 DESC LIMIT 15;
