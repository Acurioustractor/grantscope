-- ORIC rung 3, batch 0880 Nhulunbuy — Ben's verdicts 2026-08-09.
-- A (3): Milindji -> GAPUWIYAK, Rivers and Seas + Bawaka -> YIRRKALA (East Arnhem).
-- Skipped (10): NHULUNBUY-postal corps — the town itself is unincorporated (mining
--   lease outside East Arnhem RC; SAL multi-LGA, POA 66/34 Uninc NT/East Arnhem),
--   so in-town office vs homelands-PO cannot be told apart from the register.
--   Gazetteer follow-up. B: none — all 7 acnc placements agreed.
WITH targets(abn, floc, guard, stamp) AS (VALUES
  ('52218876520','GAPUWIYAK','','oric_register_address+abs_asgs'),
  ('84941672663','YIRRKALA','','oric_register_address+abs_asgs'),
  ('29136543626','YIRRKALA','','oric_register_address+abs_asgs')
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
  RETURNING e.abn, e.canonical_name, auth.floc, e.lga_name
)
SELECT 'A placed' AS action, lga_name AS council, count(*) AS orgs
  FROM updated GROUP BY 1, 2;

WITH targets(abn, stamp) AS (VALUES
  ('52218876520','oric_register_address+abs_asgs'),
  ('84941672663','oric_register_address+abs_asgs'),
  ('29136543626','oric_register_address+abs_asgs')
)
SELECT t.abn, e.canonical_name, COALESCE(e.lga_name,'(unplaced)') AS current_lga
  FROM targets t
  JOIN gs_entities e ON e.abn = t.abn
 WHERE e.lga_source IS DISTINCT FROM t.stamp;
