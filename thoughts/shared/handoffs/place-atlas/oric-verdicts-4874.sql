-- ORIC rung 3, batch 4874 Western Cape — Ben's verdicts 2026-08-09.
-- Own-name five, DIRECT VALUES (SAL fails all three towns: NAPRANUM and WEIPA absent
-- from SAL, MAPOON 2-LGA — Hope Vale class). Register town = council's own name.
-- Codes verified in abs_locality_lga LGA registry 2026-08-09.
UPDATE gs_entities SET lga_name='Napranum', lga_code='35670', lga_source='own_name_town+abs_asgs'
 WHERE abn='85970140523' AND lga_name IS NULL AND state='QLD';  -- TWAL Justice Indigenous Corporation
UPDATE gs_entities SET lga_name='Napranum', lga_code='35670', lga_source='own_name_town+abs_asgs'
 WHERE abn='91389058046' AND lga_name IS NULL AND state='QLD';  -- Ruguupyne Aboriginal Corporation
UPDATE gs_entities SET lga_name='Mapoon', lga_code='34830', lga_source='own_name_town+abs_asgs'
 WHERE abn='96771735851' AND lga_name IS NULL AND state='QLD';  -- Wei'Num Arts and Crafts A&TSI Corporation
UPDATE gs_entities SET lga_name='Mapoon', lga_code='34830', lga_source='own_name_town+abs_asgs'
 WHERE abn='80448710878' AND lga_name IS NULL AND state='QLD';  -- Taepathiggi Batavia Clan Group AC
UPDATE gs_entities SET lga_name='Weipa', lga_code='37300', lga_source='own_name_town+abs_asgs'
 WHERE abn='74698153176' AND lga_name IS NULL AND state='QLD';  -- Mokwiri Aboriginal Corporation RNTBC

SELECT abn, canonical_name, lga_name, lga_code, lga_source FROM gs_entities
 WHERE abn IN ('85970140523','91389058046','96771735851','80448710878','74698153176')
 ORDER BY lga_name, canonical_name;
