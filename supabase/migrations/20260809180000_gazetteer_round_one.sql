-- Gazetteer round 1 — the "clean set" (Ben's verb 2026-08-09: "Apply the clean set.")
-- Dry-run: thoughts/shared/handoffs/place-atlas/gazetteer-round1-dryrun.txt (16 placements + 1 correction, all guards clean)
-- Findings + sources: thoughts/shared/handoffs/place-atlas/current.md "Gazetteer round — findings"
--
-- APPLY:
--   source .env && PGPASSWORD="$DATABASE_PASSWORD" psql -h aws-0-ap-southeast-2.pooler.supabase.com \
--     -p 5432 -U "postgres.tednluwflfhxyucgwigh" -d postgres -f supabase/migrations/20260809180000_gazetteer_round_one.sql
--
-- Contents:
--   1. abs_locality_lga: 5 alias/gazetteer rows (distinct source prefix 'gazetteer_r1:')
--   2. postcode_geo: 3 NULL repairs (ERNABELLA x2 -> APY, BARROW CREEK -> Barkly)
--      + 2 landmine fixes (NAPRANUM Aurukun->Napranum, BOOKABIE Maralinga Tjarutja->Unincorporated SA)
--   3. gs_entities: 16 placements (guard lga_code IS NULL) + 1 hub-bias correction
--      (Pukatja Supermarket 70200->40250, own-name beats ACNC mail town — rung-3 B-class)
--   Excluded on purpose: Warnayaka Art (Ben's inverted-hub refusal stands);
--   Tjirrkarli + Nhulunbuy re-opens NOT in this set (separate verbs).
--   Assertion block rolls back the whole transaction on any count mismatch.

BEGIN;

-- 1. Alias / gazetteer authority rows ---------------------------------------
INSERT INTO abs_locality_lga (locality, state_name, lga_code, lga_name, lga_count, source) VALUES
  ('WEIPA','Queensland','37300','Weipa',1,
   'gazetteer_r1: alias — all Weipa suburb SALs (Evans Landing/Nanum/Trunding/Rocky Point/Weipa Airport) -> 37300 @1.000 ABS Ed3'),
  ('NAPRANUM','Queensland','35670','Napranum',1,
   'gazetteer_r1: alias — Mission River SAL 0.908 -> 35670 ABS Ed3; ORIC-ratified pinned value 2026-08-09'),
  ('BARROW CREEK','Northern Territory','70420','Barkly',1,
   'gazetteer_r1: NT locality in Barkly Region (Wikipedia/mindat; durable cite NT Place Names Register)'),
  ('BOOKABIE','South Australia','49399','Unincorporated SA',1,
   'gazetteer_r1: SA locality, Pastoral Unincorporated Area (Wikipedia; durable cite Location SA)'),
  ('GEBAR','Queensland','36960','Torres Strait Island',1,
   'gazetteer_r1: Gebar Island, Torres Strait — native title Gebaralgal people of Iama (NNTT consent det. 2004); TSIRC');

-- 2. postcode_geo repairs ----------------------------------------------------
-- NULL repairs (post-wipe rows; state was NULL)
UPDATE postcode_geo SET state='SA', lga_name='Anangu Pitjantjatjara Yankunytjatjara', lga_code='40250'
WHERE postcode='0872' AND locality IN ('ERNABELLA','ERNABELLA (PUKATJA)') AND lga_code IS NULL;

UPDATE postcode_geo SET state='NT', lga_name='Barkly', lga_code='70420'
WHERE postcode='0872' AND locality='BARROW CREEK' AND lga_code IS NULL;

-- Landmine fixes (guards assert the wrong value we found, so a drifted row refuses)
UPDATE postcode_geo SET lga_name='Napranum', lga_code='35670'
WHERE postcode='4874' AND locality='NAPRANUM' AND lga_code='30250';

UPDATE postcode_geo SET lga_name='Unincorporated SA', lga_code='49399'
WHERE postcode='5690' AND locality='BOOKABIE' AND lga_code='44000';

-- 3. Entity placements (16, guard lga_code IS NULL) ---------------------------
UPDATE gs_entities e
SET lga_name = p.lga_name, lga_code = p.lga_code, lga_source = p.stamp
FROM (VALUES
  ('AU-ABN-96925664282','Central Desert','70620','oric_register_address+abs_asgs'), -- Lajamanu Progress AC (SAL Lajamanu 1.000 CD)
  ('AU-ABN-46909257243','Central Desert','70620','oric_register_address+abs_asgs'), -- Wulaign Homelands Council AC (SAL Lajamanu 1.000 CD)
  ('AU-ABN-32494962004','Central Desert','70620','oric_register_address+abs_asgs'), -- Kurdiji AC (community line LAJAMANU beats postal KATHERINE)
  ('AU-ORIC-2025','Anangu Pitjantjatjara Yankunytjatjara','40250','oric_register_address+abs_asgs'), -- PY Education Cttee twin (no-postcode class; ABN twin already 40250)
  ('AU-ABN-86778154824','Barkly','70420','oric_register_address+gazetteer'), -- Thangkenharenge AC @ BARROW CREEK
  ('AU-ABN-44335892243','Unincorporated SA','49399','oric_register_address+gazetteer'), -- Scotdesco AC @ BOOKABIE
  ('AU-ABN-49876891368','Torres Strait Island','36960','own_name_town+gazetteer'), -- Gebaralgal RNTBC (own-name Gebar + native title; TI postal refused)
  ('AU-ABN-54650651522','Weipa','37300','acnc_town_city+gazetteer'), -- Mokwiri Nung Ltd
  ('AU-ABN-54737842050','Weipa','37300','acnc_town_city+gazetteer'), -- WCCT Central Sub-Regional Trust
  ('AU-ABN-63549473409','Weipa','37300','acnc_town_city+gazetteer'), -- WCCT Northern Sub-Regional Trust
  ('AU-ABN-57687065776','Weipa','37300','acnc_town_city+gazetteer'), -- WCCT Southern Sub-Regional Trust
  ('AU-ABN-47223656890','Weipa','37300','acnc_town_city+gazetteer'), -- Western Cape Communities Trust
  ('AU-ABN-50689692877','Napranum','35670','acnc_town_city+gazetteer'), -- Howard Christian College (ACNC town NAPRANUM)
  ('AU-ABN-19634798520','Napranum','35670','acnc_town_city+gazetteer'), -- Kluthuthu Christian College (ACNC town NAPRANUM)
  ('AU-ABN-42110700500','Napranum','35670','own_name_town+gazetteer'), -- Napranum Pal Group (own-name beats mail town WEIPA)
  ('AU-ABN-36388612170','Napranum','35670','own_name_town+gazetteer')  -- UCA-Napranum Uniting Church (own-name beats mail town WEIPA)
) AS p(gs_id, lga_name, lga_code, stamp)
WHERE e.gs_id = p.gs_id AND e.lga_code IS NULL;

-- Correction: Pukatja Supermarket & Associated Stores AC — own-name Pukatja beats
-- ACNC mail town Alice Springs (hub-bias, rung-3 B-class). Guard asserts current wrong value.
UPDATE gs_entities
SET lga_name='Anangu Pitjantjatjara Yankunytjatjara', lga_code='40250', lga_source='own_name_town+abs_asgs'
WHERE gs_id='AU-ABN-84659701312' AND lga_code='70200';

-- 4. Assertions — any mismatch rolls back everything --------------------------
DO $$
DECLARE
  n_alias int; n_gaz int; n_super int; n_pg int; n_warnayaka int;
BEGIN
  SELECT count(*) INTO n_alias FROM abs_locality_lga WHERE source LIKE 'gazetteer_r1:%';
  IF n_alias <> 5 THEN RAISE EXCEPTION 'alias rows: expected 5, got %', n_alias; END IF;

  SELECT count(*) INTO n_gaz FROM gs_entities WHERE lga_source LIKE '%+gazetteer';
  IF n_gaz <> 12 THEN RAISE EXCEPTION 'gazetteer-stamped entities: expected 12, got %', n_gaz; END IF;

  SELECT count(*) INTO n_super FROM gs_entities
  WHERE gs_id='AU-ABN-84659701312' AND lga_code='40250' AND lga_source='own_name_town+abs_asgs';
  IF n_super <> 1 THEN RAISE EXCEPTION 'Pukatja Supermarket correction did not land'; END IF;

  SELECT count(*) INTO n_pg FROM postcode_geo WHERE
    (postcode='0872' AND locality IN ('ERNABELLA','ERNABELLA (PUKATJA)') AND lga_code='40250' AND state='SA')
    OR (postcode='0872' AND locality='BARROW CREEK' AND lga_code='70420' AND state='NT')
    OR (postcode='4874' AND locality='NAPRANUM' AND lga_code='35670')
    OR (postcode='5690' AND locality='BOOKABIE' AND lga_code='49399');
  IF n_pg <> 5 THEN RAISE EXCEPTION 'postcode_geo repairs: expected 5 rows, got %', n_pg; END IF;

  -- Warnayaka must remain untouched (refusal stands)
  SELECT count(*) INTO n_warnayaka FROM gs_entities WHERE abn='73813255877' AND lga_code IS NULL;
  IF n_warnayaka <> 1 THEN RAISE EXCEPTION 'Warnayaka was touched — refusal violated'; END IF;
END $$;

COMMIT;

-- Post-apply verification (informational)
SELECT lga_source, count(*) AS n FROM gs_entities
WHERE lga_source IN ('oric_register_address+abs_asgs','own_name_town+abs_asgs',
                     'acnc_town_city+gazetteer','own_name_town+gazetteer','oric_register_address+gazetteer')
GROUP BY 1 ORDER BY 1;

SELECT count(*) AS unplaced_with_postcode FROM gs_entities WHERE lga_code IS NULL AND postcode IS NOT NULL;
SELECT count(*) AS no_postcode_pool FROM gs_entities WHERE lga_code IS NULL AND postcode IS NULL;
