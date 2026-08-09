-- ORIC rung 3, batch 4892 Cape York/Gulf — Ben's grouped verdicts 2026-08-09.
-- A (5): Pormpuraaw x2, Kowanyama x2, Laura->Cook (auth join).
-- Coen trio (3): Coen treated as in-catchment, not hub-postal — whole homeland catchment
--   is Cook Shire, SAL COEN single-council (Ben's call this batch).
-- Gununa four (4): DIRECT VALUES -> Mornington Shire 35250, stamp community_name+abs_asgs.
--   GUNUNA (Mornington Island community) absent from SAL; SAL "MORNINGTON" is a Mount Isa
--   suburb (35300) — a name-join would misplace by 800km, hence pinned values.
-- Lockhart pair (2): DIRECT VALUES -> Lockhart River 34570, own-name-town precedent
--   (SAL 2-LGA, same structure as Hope Vale earlier today).
WITH targets(abn, floc, guard, stamp) AS (VALUES
  ('76100827060','PORMPURAAW','','oric_register_address+abs_asgs'),
  ('32480446620','PORMPURAAW','','oric_register_address+abs_asgs'),
  ('99271543023','KOWANYAMA','','oric_register_address+abs_asgs'),
  ('75944320993','KOWANYAMA','','oric_register_address+abs_asgs'),
  ('88079295235','LAURA','','oric_register_address+abs_asgs'),
  ('11381982196','COEN','','oric_register_address+abs_asgs'),
  ('91456787292','COEN','','oric_register_address+abs_asgs'),
  ('64813275542','COEN','','oric_register_address+abs_asgs')
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
  RETURNING e.abn, auth.floc, e.lga_name
)
SELECT 'A placed' AS action, lga_name AS council, count(*) AS orgs
  FROM updated GROUP BY 1, 2 ORDER BY 3 DESC;

-- Gununa four: Mornington Island community -> Mornington Shire (NOT SAL MORNINGTON = Mount Isa).
UPDATE gs_entities SET lga_name='Mornington', lga_code='35250', lga_source='community_name+abs_asgs'
 WHERE abn='79820368838' AND lga_name IS NULL AND state='QLD';  -- Kaiadilt Aboriginal Corporation
UPDATE gs_entities SET lga_name='Mornington', lga_code='35250', lga_source='community_name+abs_asgs'
 WHERE abn='45664120124' AND lga_name IS NULL AND state='QLD';  -- Junkuri Laka Community Legal Centre AC
UPDATE gs_entities SET lga_name='Mornington', lga_code='35250', lga_source='community_name+abs_asgs'
 WHERE abn='54626633931' AND lga_name IS NULL AND state='QLD';  -- Mirndiyan Gununa Aboriginal Corporation
UPDATE gs_entities SET lga_name='Mornington', lga_code='35250', lga_source='community_name+abs_asgs'
 WHERE abn='86359040590' AND lga_name IS NULL AND state='QLD';  -- Rimirimi Aboriginal Corporation

-- Lockhart pair: own-name-town (register town = council's own name).
UPDATE gs_entities SET lga_name='Lockhart River', lga_code='34570', lga_source='own_name_town+abs_asgs'
 WHERE abn='17306901395' AND lga_name IS NULL AND state='QLD';  -- Angkum Aboriginal Corporation
UPDATE gs_entities SET lga_name='Lockhart River', lga_code='34570', lga_source='own_name_town+abs_asgs'
 WHERE abn='52436775991' AND lga_name IS NULL AND state='QLD';  -- Lockhart River Social Club AC

-- Verify all fourteen targets landed.
SELECT lga_name, lga_source, count(*) FROM gs_entities
 WHERE abn IN ('76100827060','32480446620','99271543023','75944320993','88079295235',
               '11381982196','91456787292','64813275542','79820368838','45664120124',
               '54626633931','86359040590','17306901395','52436775991')
 GROUP BY 1, 2 ORDER BY 3 DESC;
