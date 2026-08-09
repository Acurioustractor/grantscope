-- Gazetteer round 1 — DRY RUN (SELECT only). Ben's verb "Apply the clean set" 2026-08-09.
-- Lists every row the migration will touch, current -> proposed.

\echo '=== 1. Entity placements (fresh, guard: lga_code IS NULL) ==='
SELECT e.gs_id, left(e.canonical_name,55) AS name, e.postcode, e.lga_source AS cur_source,
       p.lga_name AS to_lga, p.lga_code AS to_code, p.stamp
FROM (VALUES
  ('AU-ABN-96925664282','Central Desert','70620','oric_register_address+abs_asgs'), -- Lajamanu Progress (SAL 1.000)
  ('AU-ABN-46909257243','Central Desert','70620','oric_register_address+abs_asgs'), -- Wulaign Homelands (SAL 1.000)
  ('AU-ABN-32494962004','Central Desert','70620','oric_register_address+abs_asgs'), -- Kurdiji AC (community line LAJAMANU)
  ('AU-ORIC-2025','Anangu Pitjantjatjara Yankunytjatjara','40250','oric_register_address+abs_asgs'), -- PY Education Cttee twin (no-postcode class)
  ('AU-ABN-86778154824','Barkly','70420','oric_register_address+gazetteer'), -- Thangkenharenge @ BARROW CREEK
  ('AU-ABN-44335892243','Unincorporated SA','49399','oric_register_address+gazetteer'), -- Scotdesco @ BOOKABIE
  ('AU-ABN-49876891368','Torres Strait Island','36960','own_name_town+gazetteer'), -- Gebaralgal RNTBC
  ('AU-ABN-54650651522','Weipa','37300','acnc_town_city+gazetteer'), -- Mokwiri Nung
  ('AU-ABN-54737842050','Weipa','37300','acnc_town_city+gazetteer'), -- WCCT Central
  ('AU-ABN-63549473409','Weipa','37300','acnc_town_city+gazetteer'), -- WCCT Northern
  ('AU-ABN-57687065776','Weipa','37300','acnc_town_city+gazetteer'), -- WCCT Southern
  ('AU-ABN-47223656890','Weipa','37300','acnc_town_city+gazetteer'), -- Western Cape Communities Trust
  ('AU-ABN-50689692877','Napranum','35670','acnc_town_city+gazetteer'), -- Howard Christian College (town NAPRANUM)
  ('AU-ABN-19634798520','Napranum','35670','acnc_town_city+gazetteer'), -- Kluthuthu Christian College (town NAPRANUM)
  ('AU-ABN-42110700500','Napranum','35670','own_name_town+gazetteer'), -- Napranum Pal Group (own-name beats mail town WEIPA)
  ('AU-ABN-36388612170','Napranum','35670','own_name_town+gazetteer')  -- UCA-Napranum (own-name beats mail town WEIPA)
) AS p(gs_id, lga_name, lga_code, stamp)
JOIN gs_entities e USING (gs_id)
WHERE e.lga_code IS NULL
ORDER BY p.lga_code, e.gs_id;

\echo '=== 1b. Guard check: any of the 16 NOT null-lga (would be skipped) ==='
SELECT e.gs_id, left(e.canonical_name,55) AS name, e.lga_code, e.lga_source
FROM gs_entities e
WHERE e.gs_id IN ('AU-ABN-96925664282','AU-ABN-46909257243','AU-ABN-32494962004','AU-ORIC-2025',
  'AU-ABN-86778154824','AU-ABN-44335892243','AU-ABN-49876891368','AU-ABN-54650651522',
  'AU-ABN-54737842050','AU-ABN-63549473409','AU-ABN-57687065776','AU-ABN-47223656890',
  'AU-ABN-50689692877','AU-ABN-19634798520','AU-ABN-42110700500','AU-ABN-36388612170')
  AND e.lga_code IS NOT NULL;

\echo '=== 2. Correction: Pukatja Supermarket, Alice 70200 -> APY 40250 (own-name, hub-bias class) ==='
SELECT gs_id, left(canonical_name,55) AS name, postcode, lga_name, lga_code, lga_source
FROM gs_entities WHERE gs_id='AU-ABN-84659701312';

\echo '=== 3. Excluded on purpose (must NOT appear in any UPDATE) ==='
SELECT gs_id, left(canonical_name,55) AS name, lga_code, lga_source, 'Warnayaka: refusal stands (inverted hub)' AS why
FROM gs_entities WHERE abn='73813255877';

\echo '=== 4. postcode_geo repairs, current rows ==='
SELECT postcode, locality, state, lga_name, lga_code FROM postcode_geo
WHERE (postcode='0872' AND locality IN ('PUKATJA','ERNABELLA','ERNABELLA (PUKATJA)','BARROW CREEK'))
   OR (postcode='5690' AND locality='BOOKABIE')
   OR (postcode='4874' AND locality='NAPRANUM')
ORDER BY postcode, locality;

\echo '=== 5. Alias rows to insert (collision check: existing rows for these localities) ==='
SELECT locality, state_name, lga_name, lga_code, source FROM abs_locality_lga
WHERE upper(locality) IN ('WEIPA','NAPRANUM','BARROW CREEK','BOOKABIE','GEBAR');
