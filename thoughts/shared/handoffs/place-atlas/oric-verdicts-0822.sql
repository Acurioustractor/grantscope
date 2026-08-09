-- ORIC rung 3, batch 0822 Arnhem/Top End — Ben's grouped verdicts 2026-08-09.
-- A (21): unplaced corps, register locality has single-council authority, 8 councils.
-- Exceptions: Bamburrurrnga AC — INVERTED HUB (postal GALIWINKU is the community signal;
--   street line WINNELLIE/Darwin refused) -> East Arnhem via postal.
--   Nguiu Club AC — register BATHURST ISLAND (not in ABS SAL); Nguiu = Wurrumiyanga's
--   former official name, whole island is Tiwi Islands -> floc WURRUMIYANGA,
--   stamp community_name+abs_asgs (Oak Valley class).
-- B: none — all 33 acnc-placed ORIC corps agreed with the register (3 Winnellie<->Darwin
--   "confirmations" are hub-mail-on-both-sides; queued for the acnc hub-bias audit).
-- Guard: authority = abs_locality_lga bracket-stripped, NT, exactly one council; all
--   targets currently unplaced (guard ''); no match -> untouched.
WITH targets(abn, floc, guard, stamp) AS (VALUES
  ('77389678783','WURRUMIYANGA','','oric_register_address+abs_asgs'),
  ('51766207421','RAKULA','','oric_register_address+abs_asgs'),
  ('90147813911','GALIWINKU','','oric_register_address+abs_asgs'),
  ('49956541255','WARRUWI','','oric_register_address+abs_asgs'),
  ('86982744219','KAKADU','','oric_register_address+abs_asgs'),
  ('91962921592','WURRUMIYANGA','','oric_register_address+abs_asgs'),
  ('43575418203','WARRUWI','','oric_register_address+abs_asgs'),
  ('28945993918','RAKULA','','oric_register_address+abs_asgs'),
  ('48397677943','RAKULA','','oric_register_address+abs_asgs'),
  ('50934625764','PEPPIMENARTI','','oric_register_address+abs_asgs'),
  ('91758665749','NAUIYU','','oric_register_address+abs_asgs'),
  ('99769896975','PEPPIMENARTI','','oric_register_address+abs_asgs'),
  ('15293868481','BEES CREEK','','oric_register_address+abs_asgs'),
  ('90569456722','UMBAKUMBA','','oric_register_address+abs_asgs'),
  ('76863515565','RAMINGINING','','oric_register_address+abs_asgs'),
  ('28630059039','NGANMARRIYANGA','','oric_register_address+abs_asgs'),
  ('25915076539','ACACIA HILLS','','oric_register_address+abs_asgs'),
  ('79886254482','MILIKAPITI','','oric_register_address+abs_asgs'),
  ('31865408204','NAUIYU','','oric_register_address+abs_asgs'),
  ('57622614870','GUNBALANYA','','oric_register_address+abs_asgs'),
  ('67426476941','NAUIYU','','oric_register_address+abs_asgs'),
  ('40876209713','GALIWINKU','','oric_register_address+abs_asgs'), -- Bamburrurrnga: postal Galiwin'ku; street WINNELLIE refused (inverted hub)
  ('50795279768','WURRUMIYANGA','','community_name+abs_asgs')      -- Nguiu Club: register BATHURST ISLAND; Nguiu = Wurrumiyanga former name
),
auth AS (
  SELECT upper(regexp_replace(a.locality, '\s*\([^)]*\)\s*$', '')) AS floc,
         CASE a.state_name WHEN 'Northern Territory' THEN 'NT' END AS st,
         min(a.lga_name) AS lga_name, min(a.lga_code) AS lga_code
    FROM abs_locality_lga a
   WHERE a.state_name = 'Northern Territory'
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
  ('77389678783','WURRUMIYANGA','','oric_register_address+abs_asgs'),
  ('51766207421','RAKULA','','oric_register_address+abs_asgs'),
  ('90147813911','GALIWINKU','','oric_register_address+abs_asgs'),
  ('49956541255','WARRUWI','','oric_register_address+abs_asgs'),
  ('86982744219','KAKADU','','oric_register_address+abs_asgs'),
  ('91962921592','WURRUMIYANGA','','oric_register_address+abs_asgs'),
  ('43575418203','WARRUWI','','oric_register_address+abs_asgs'),
  ('28945993918','RAKULA','','oric_register_address+abs_asgs'),
  ('48397677943','RAKULA','','oric_register_address+abs_asgs'),
  ('50934625764','PEPPIMENARTI','','oric_register_address+abs_asgs'),
  ('91758665749','NAUIYU','','oric_register_address+abs_asgs'),
  ('99769896975','PEPPIMENARTI','','oric_register_address+abs_asgs'),
  ('15293868481','BEES CREEK','','oric_register_address+abs_asgs'),
  ('90569456722','UMBAKUMBA','','oric_register_address+abs_asgs'),
  ('76863515565','RAMINGINING','','oric_register_address+abs_asgs'),
  ('28630059039','NGANMARRIYANGA','','oric_register_address+abs_asgs'),
  ('25915076539','ACACIA HILLS','','oric_register_address+abs_asgs'),
  ('79886254482','MILIKAPITI','','oric_register_address+abs_asgs'),
  ('31865408204','NAUIYU','','oric_register_address+abs_asgs'),
  ('57622614870','GUNBALANYA','','oric_register_address+abs_asgs'),
  ('67426476941','NAUIYU','','oric_register_address+abs_asgs'),
  ('40876209713','GALIWINKU','','oric_register_address+abs_asgs'),
  ('50795279768','WURRUMIYANGA','','community_name+abs_asgs')
)
SELECT t.abn, e.canonical_name, t.floc, COALESCE(e.lga_name,'(unplaced)') AS current_lga
  FROM targets t
  JOIN gs_entities e ON e.abn = t.abn
 WHERE e.lga_source IS DISTINCT FROM t.stamp;
