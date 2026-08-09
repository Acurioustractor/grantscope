-- ORIC rung 3, batch 4875 Torres Strait — Ben's grouped verdicts 2026-08-09.
-- A (24): unplaced corps, register locality = outer island, all -> Torres Strait Island RC.
-- Alias (5): register uses former official names, ABS renamed — MURRAY->MER, YORKE->MASIG,
--   STEPHENS->UGAR, COCONUT->PORUMA (floc below is the current ABS name; all TSIRC either way).
-- Trio (3): community-name evidence, stamp community_name+abs_asgs — Kirriri Dorge Mudh
--   (Kirriri=Keriri/Hammond Is), TI Justice + TRAWQ (Tamwoy Rose Hill Aplin Waiben Quarantine
--   = Thursday Island's own communities).
-- B: none — all 6 acnc-placed ORIC corps agreed with the register.
-- Guard: authority = abs_locality_lga bracket-stripped, QLD, exactly one council; all targets
--   currently unplaced (guard ''); no match -> untouched.
WITH targets(abn, floc, guard, stamp) AS (VALUES
  ('46290179081','IAMA ISLAND','','oric_register_address+abs_asgs'),
  ('89635784005','SAIBAI ISLAND','','oric_register_address+abs_asgs'),
  ('42604307906','PORUMA ISLAND','','oric_register_address+abs_asgs'),
  ('74169042724','MABUIAG ISLAND','','oric_register_address+abs_asgs'),
  ('54264399290','DAUAN ISLAND','','oric_register_address+abs_asgs'),
  ('79715532710','MABUIAG ISLAND','','oric_register_address+abs_asgs'),
  ('22691180786','ERUB ISLAND','','oric_register_address+abs_asgs'),
  ('81931908062','MOA ISLAND','','oric_register_address+abs_asgs'),
  ('75127457436','MER ISLAND','','oric_register_address+abs_asgs'),
  ('53995136925','WARRABER ISLET','','oric_register_address+abs_asgs'),
  ('56498169808','BOIGU ISLAND','','oric_register_address+abs_asgs'),
  ('20733647538','BOIGU ISLAND','','oric_register_address+abs_asgs'),
  ('56640875392','MOA ISLAND','','oric_register_address+abs_asgs'),
  ('79680257690','ERUB ISLAND','','oric_register_address+abs_asgs'),
  ('65149216001','IAMA ISLAND','','oric_register_address+abs_asgs'),
  ('15727270235','ERUB ISLAND','','oric_register_address+abs_asgs'),
  ('65635845711','PORUMA ISLAND','','oric_register_address+abs_asgs'),
  ('53813600977','MER ISLAND','','oric_register_address+abs_asgs'),
  ('67412616318','SAIBAI ISLAND','','oric_register_address+abs_asgs'),
  ('84643090571','MABUIAG ISLAND','','oric_register_address+abs_asgs'),
  ('24210814755','ERUB ISLAND','','oric_register_address+abs_asgs'),
  ('40522947582','BADU ISLAND','','oric_register_address+abs_asgs'),
  ('33478259057','MABUIAG ISLAND','','oric_register_address+abs_asgs'),
  ('28200298381','MOA ISLAND','','oric_register_address+abs_asgs'),
  ('53464590791','MER ISLAND','','oric_register_address+abs_asgs'),      -- register: MURRAY ISLAND (Mer Gedkem Le RNTBC)
  ('56187419734','MASIG ISLAND','','oric_register_address+abs_asgs'),    -- register: YORKE ISLAND (Masigalgal RNTBC)
  ('19972491084','UGAR ISLAND','','oric_register_address+abs_asgs'),     -- register: STEPHENS ISLAND (Ugar Ged Kem Le RNTBC)
  ('46922601647','PORUMA ISLAND','','oric_register_address+abs_asgs'),   -- register: COCONUT ISLAND (Buthu Lagau Saral)
  ('80975529727','PORUMA ISLAND','','oric_register_address+abs_asgs'),   -- register: COCONUT ISLAND (Porumalgal RNTBC)
  ('16357676554','KERIRI ISLAND','','community_name+abs_asgs'),          -- Kirriri Dorge Mudh IC (Kirriri = Keriri/Hammond Is)
  ('65272208878','THURSDAY ISLAND','','community_name+abs_asgs'),        -- Thursday Island Justice TSI & Aboriginal Corp
  ('15520749060','THURSDAY ISLAND','','community_name+abs_asgs')         -- TRAWQ IC (TI communities)
),
auth AS (
  SELECT upper(regexp_replace(a.locality, '\s*\([^)]*\)\s*$', '')) AS floc,
         CASE a.state_name WHEN 'Queensland' THEN 'QLD' END AS st,
         min(a.lga_name) AS lga_name, min(a.lga_code) AS lga_code
    FROM abs_locality_lga a
   WHERE a.state_name = 'Queensland'
   GROUP BY 1, 2
  HAVING count(DISTINCT a.lga_code) = 1
),
updated AS (
  UPDATE gs_entities e
     SET lga_name = auth.lga_name, lga_code = auth.lga_code,
         lga_source = t.stamp
    FROM targets t
    JOIN auth ON auth.floc = t.floc
   WHERE e.abn = t.abn AND auth.st = e.state
     AND e.lga_name IS NOT DISTINCT FROM NULLIF(t.guard, '')
  RETURNING e.abn, e.canonical_name, auth.floc, e.lga_name, t.stamp
)
SELECT stamp, lga_name AS council, count(*) AS orgs
  FROM updated GROUP BY 1, 2 ORDER BY 1, 3 DESC;

-- Targets that did NOT update (guard failed / no authority): name them.
WITH targets(abn, floc, guard, stamp) AS (VALUES
  ('46290179081','IAMA ISLAND','','oric_register_address+abs_asgs'),
  ('89635784005','SAIBAI ISLAND','','oric_register_address+abs_asgs'),
  ('42604307906','PORUMA ISLAND','','oric_register_address+abs_asgs'),
  ('74169042724','MABUIAG ISLAND','','oric_register_address+abs_asgs'),
  ('54264399290','DAUAN ISLAND','','oric_register_address+abs_asgs'),
  ('79715532710','MABUIAG ISLAND','','oric_register_address+abs_asgs'),
  ('22691180786','ERUB ISLAND','','oric_register_address+abs_asgs'),
  ('81931908062','MOA ISLAND','','oric_register_address+abs_asgs'),
  ('75127457436','MER ISLAND','','oric_register_address+abs_asgs'),
  ('53995136925','WARRABER ISLET','','oric_register_address+abs_asgs'),
  ('56498169808','BOIGU ISLAND','','oric_register_address+abs_asgs'),
  ('20733647538','BOIGU ISLAND','','oric_register_address+abs_asgs'),
  ('56640875392','MOA ISLAND','','oric_register_address+abs_asgs'),
  ('79680257690','ERUB ISLAND','','oric_register_address+abs_asgs'),
  ('65149216001','IAMA ISLAND','','oric_register_address+abs_asgs'),
  ('15727270235','ERUB ISLAND','','oric_register_address+abs_asgs'),
  ('65635845711','PORUMA ISLAND','','oric_register_address+abs_asgs'),
  ('53813600977','MER ISLAND','','oric_register_address+abs_asgs'),
  ('67412616318','SAIBAI ISLAND','','oric_register_address+abs_asgs'),
  ('84643090571','MABUIAG ISLAND','','oric_register_address+abs_asgs'),
  ('24210814755','ERUB ISLAND','','oric_register_address+abs_asgs'),
  ('40522947582','BADU ISLAND','','oric_register_address+abs_asgs'),
  ('33478259057','MABUIAG ISLAND','','oric_register_address+abs_asgs'),
  ('28200298381','MOA ISLAND','','oric_register_address+abs_asgs'),
  ('53464590791','MER ISLAND','','oric_register_address+abs_asgs'),
  ('56187419734','MASIG ISLAND','','oric_register_address+abs_asgs'),
  ('19972491084','UGAR ISLAND','','oric_register_address+abs_asgs'),
  ('46922601647','PORUMA ISLAND','','oric_register_address+abs_asgs'),
  ('80975529727','PORUMA ISLAND','','oric_register_address+abs_asgs'),
  ('16357676554','KERIRI ISLAND','','community_name+abs_asgs'),
  ('65272208878','THURSDAY ISLAND','','community_name+abs_asgs'),
  ('15520749060','THURSDAY ISLAND','','community_name+abs_asgs')
)
SELECT t.abn, e.canonical_name, t.floc, COALESCE(e.lga_name,'(unplaced)') AS current_lga
  FROM targets t
  JOIN gs_entities e ON e.abn = t.abn
 WHERE e.lga_source IS DISTINCT FROM t.stamp;
