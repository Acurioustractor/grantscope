-- ORIC rung 3, batch 5690 — Ben's verdicts 2026-08-09 (4 orgs; Scotdesco skipped: no authority holds Bookabie)
UPDATE gs_entities SET lga_name='Unincorporated SA', lga_code='49399', lga_source='oric_register_address+abs_asgs'
 WHERE abn='23404857519' AND lga_name='Ceduna';  -- Yalata Anangu AC: hub error corrected
UPDATE gs_entities SET lga_name='Maralinga Tjarutja', lga_code='44000', lga_source='community_name+abs_asgs'
 WHERE abn='19598209330' AND lga_name='Ceduna';  -- Oak Valley (Maralinga) AC: community-name evidence
UPDATE gs_entities SET lga_name='Ceduna', lga_code='41010', lga_source='oric_register_address+abs_asgs'
 WHERE abn='62300583197' AND lga_name IS NULL;   -- Bullinda AC: WANDANA (SA) → Ceduna
SELECT abn, canonical_name, lga_name, lga_source FROM gs_entities
 WHERE abn IN ('23404857519','19598209330','62300583197','44335892243') ORDER BY canonical_name;
