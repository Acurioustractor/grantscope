-- ORIC rung 3, batch 4895 Hope Vale/Cooktown — Ben's grouped verdicts 2026-08-09.
-- A (1): Dabu Jajikal -> Cook via ROSSVILLE community line (auth join).
-- Hope Vale trio (3): register town = council's own name (Hope Vale Aboriginal Shire
--   33830, own-name-town precedent; SAL polygon is 2-LGA so the strict auth join cannot
--   derive it — direct values, stamp own_name_town+abs_asgs per Ben, ORIC provenance here).
-- Skipped: Bloomfield pair (SAL multi-LGA; Lundinwarra's community line names Bloomfield —
--   gazetteer follow-up), Rinyirru (no locality parsed), 5 Cooktown-postal C-skips.
WITH targets(abn, floc, guard, stamp) AS (VALUES
  ('40559743474','ROSSVILLE','','oric_register_address+abs_asgs')
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
  RETURNING e.abn, e.canonical_name, auth.floc, e.lga_name
)
SELECT 'A placed' AS action, lga_name AS council, count(*) AS orgs
  FROM updated GROUP BY 1, 2;

-- Hope Vale trio: own-name-town direct (register locality HOPE VALE = council's own name).
UPDATE gs_entities SET lga_name='Hope Vale', lga_code='33830', lga_source='own_name_town+abs_asgs'
 WHERE abn='56436124591' AND lga_name IS NULL AND state='QLD';  -- Waarnthuurr-iin Aboriginal Corporation
UPDATE gs_entities SET lga_name='Hope Vale', lga_code='33830', lga_source='own_name_town+abs_asgs'
 WHERE abn='97362475098' AND lga_name IS NULL AND state='QLD';  -- TDT Aboriginal Corporation
UPDATE gs_entities SET lga_name='Hope Vale', lga_code='33830', lga_source='own_name_town+abs_asgs'
 WHERE abn='98633593832' AND lga_name IS NULL AND state='QLD';  -- Hopevale Thurrpiil Community Justice Group AC

-- Verify all four targets landed.
SELECT abn, canonical_name, lga_name, lga_code, lga_source FROM gs_entities
 WHERE abn IN ('40559743474','56436124591','97362475098','98633593832')
 ORDER BY canonical_name;
