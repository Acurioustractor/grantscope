-- ORIC rung 3, batch 0852 Katherine region — Ben's grouped verdicts 2026-08-09.
-- B (4): correct Katherine hub-bias to ORIC community lines (guard 'Katherine') —
--   Nitjpurru->Pigeon Hole, Bagala->Barunga, Gulin Gulin->Bulman Weemol,
--   Mungoorbada->Robinson River. First Yalata-class batch since 5690.
-- A (5): place unplaced corps at register localities (guard '').
-- Exception: Nyanyalindiyi Burrunju — register "NGUKURR COMMUNITY" (ORIC phrasing),
--   floc NGUKURR (single-council Roper Gulf).
-- Skipped: Warnayaka Art (inverted hub: postal LAJAMANU 2-LGA, street Katherine refused);
--   3 more Lajamanu corps NOAUTH -> Lajamanu gazetteer follow-up (Central Desert boundary).
-- Guard: authority = abs_locality_lga bracket-stripped, NT, exactly one council;
--   no match -> untouched.
WITH targets(abn, floc, guard, stamp) AS (VALUES
  ('43642438547','PIGEON HOLE','Katherine','oric_register_address+abs_asgs'),
  ('76269261597','BARUNGA','Katherine','oric_register_address+abs_asgs'),
  ('55148423932','BULMAN WEEMOL','Katherine','oric_register_address+abs_asgs'),
  ('13837964081','ROBINSON RIVER','Katherine','oric_register_address+abs_asgs'),
  ('98818272261','KALKARINDJI','','oric_register_address+abs_asgs'),
  ('45545443599','MATARANKA','','oric_register_address+abs_asgs'),
  ('84767971312','BAINES','','oric_register_address+abs_asgs'),
  ('72970745626','NGUKURR','','oric_register_address+abs_asgs'),
  ('42268380273','TIMBER CREEK','','oric_register_address+abs_asgs'),
  ('21898583680','NGUKURR','','oric_register_address+abs_asgs')  -- Nyanyalindiyi Burrunju: register "NGUKURR COMMUNITY"
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
  RETURNING e.abn, e.canonical_name, auth.floc, e.lga_name, t.guard
)
SELECT CASE WHEN guard = '' THEN 'A placed' ELSE 'B corrected' END AS action,
       lga_name AS council, count(*) AS orgs
  FROM updated GROUP BY 1, 2 ORDER BY 1, 3 DESC;

-- Targets that did NOT update (guard failed / no authority): name them.
WITH targets(abn, floc, guard, stamp) AS (VALUES
  ('43642438547','PIGEON HOLE','Katherine','oric_register_address+abs_asgs'),
  ('76269261597','BARUNGA','Katherine','oric_register_address+abs_asgs'),
  ('55148423932','BULMAN WEEMOL','Katherine','oric_register_address+abs_asgs'),
  ('13837964081','ROBINSON RIVER','Katherine','oric_register_address+abs_asgs'),
  ('98818272261','KALKARINDJI','','oric_register_address+abs_asgs'),
  ('45545443599','MATARANKA','','oric_register_address+abs_asgs'),
  ('84767971312','BAINES','','oric_register_address+abs_asgs'),
  ('72970745626','NGUKURR','','oric_register_address+abs_asgs'),
  ('42268380273','TIMBER CREEK','','oric_register_address+abs_asgs'),
  ('21898583680','NGUKURR','','oric_register_address+abs_asgs')
)
SELECT t.abn, e.canonical_name, t.floc, COALESCE(e.lga_name,'(unplaced)') AS current_lga
  FROM targets t
  JOIN gs_entities e ON e.abn = t.abn
 WHERE e.lga_source IS DISTINCT FROM t.stamp;
