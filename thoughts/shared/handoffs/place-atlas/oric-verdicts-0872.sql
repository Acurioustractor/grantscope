-- ORIC rung 3, batch 0872 — Ben's grouped verdicts 2026-08-09.
-- A: place unplaced community-named corps. B: correct Alice Springs hub-bias
-- placements to the register's community. Guard: authority = abs_locality_lga
-- bracket-stripped, state-matched, exactly one council; no match -> untouched.
WITH targets(abn, floc, guard) AS (VALUES
  ('48610810327','PAPUNYA','Alice Springs'),
  ('90806344073','YUENDUMU','Alice Springs'),
  ('43460372536','NYIRRIPI','Alice Springs'),
  ('40070916061','HAASTS BLUFF','Alice Springs'),
  ('52026417620','KINTORE','Alice Springs'),
  ('67393591843','BURT PLAIN',''),
  ('76210591710','AREYONGA','Alice Springs'),
  ('67393591843','BURT PLAIN',''),
  ('','AMPILATWATJA',''),
  ('','HUGH',''),
  ('22573724404','ATITJERE','Alice Springs'),
  ('','CANTEEN CREEK',''),
  ('34131576674','HERMANNSBURG','Alice Springs'),
  ('86778154824','BARROW CREEK',''),
  ('','HERMANNSBURG',''),
  ('89323716438','HERMANNSBURG',''),
  ('','ENGAWALA',''),
  ('','TI TREE',''),
  ('11067361505','HERMANNSBURG',''),
  ('92263130957','YULARA',''),
  ('87248340594','MOUNT ZEIL',''),
  ('','CANTEEN CREEK',''),
  ('37591766189','IMANPA','Alice Springs'),
  ('','IMANPA',''),
  ('','KINTORE',''),
  ('','MOUNT ZEIL',''),
  ('34177680886','TANAMI',''),
  ('21278078988','PAPUNYA','Alice Springs'),
  ('78594726562','FINKE',''),
  ('','WILLOWRA',''),
  ('25761017736','SANTA TERESA',''),
  ('56165075312','AMOONGUNA',''),
  ('','PETERMANN',''),
  ('','YUENDUMU',''),
  ('82432959384','YUELAMU',''),
  ('61919192149','TITJIKALA',''),
  ('17487552774','FINKE',''),
  ('18384055423','FINKE',''),
  ('','PUKATJA',''),
  ('15207170110','MUTITJULU',''),
  ('','YUENDUMU',''),
  ('67702970187','YUENDUMU',''),
  ('44640761085','LARAMBA','Alice Springs'),
  ('61415976074','HAASTS BLUFF','Alice Springs'),
  ('','HERMANNSBURG',''),
  ('53916725096','TITJIKALA','Alice Springs'),
  ('42702075522','SANDOVER','Alice Springs'),
  ('','MOUNT ZEIL',''),
  ('19706185693','HERMANNSBURG',''),
  ('42701311843','YUENDUMU',''),
  ('90315164312','ENGAWALA','Alice Springs'),
  ('','MUTITJULU',''),
  ('','MOUNT ZEIL','')
),
auth AS (
  SELECT upper(regexp_replace(a.locality, '\s*\([^)]*\)\s*$', '')) AS floc,
         CASE a.state_name WHEN 'Northern Territory' THEN 'NT'
                           WHEN 'South Australia' THEN 'SA'
                           WHEN 'Western Australia' THEN 'WA' END AS st,
         min(a.lga_name) AS lga_name, min(a.lga_code) AS lga_code
    FROM abs_locality_lga a
   WHERE a.state_name IN ('Northern Territory','South Australia','Western Australia')
   GROUP BY 1, 2
  HAVING count(DISTINCT a.lga_code) = 1
),
updated AS (
  UPDATE gs_entities e
     SET lga_name = auth.lga_name, lga_code = auth.lga_code,
         lga_source = 'oric_register_address+abs_asgs'
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
WITH targets(abn, floc, guard) AS (VALUES
  ('48610810327','PAPUNYA','Alice Springs'),
  ('90806344073','YUENDUMU','Alice Springs'),
  ('43460372536','NYIRRIPI','Alice Springs'),
  ('40070916061','HAASTS BLUFF','Alice Springs'),
  ('52026417620','KINTORE','Alice Springs'),
  ('67393591843','BURT PLAIN',''),
  ('76210591710','AREYONGA','Alice Springs'),
  ('67393591843','BURT PLAIN',''),
  ('','AMPILATWATJA',''),
  ('','HUGH',''),
  ('22573724404','ATITJERE','Alice Springs'),
  ('','CANTEEN CREEK',''),
  ('34131576674','HERMANNSBURG','Alice Springs'),
  ('86778154824','BARROW CREEK',''),
  ('','HERMANNSBURG',''),
  ('89323716438','HERMANNSBURG',''),
  ('','ENGAWALA',''),
  ('','TI TREE',''),
  ('11067361505','HERMANNSBURG',''),
  ('92263130957','YULARA',''),
  ('87248340594','MOUNT ZEIL',''),
  ('','CANTEEN CREEK',''),
  ('37591766189','IMANPA','Alice Springs'),
  ('','IMANPA',''),
  ('','KINTORE',''),
  ('','MOUNT ZEIL',''),
  ('34177680886','TANAMI',''),
  ('21278078988','PAPUNYA','Alice Springs'),
  ('78594726562','FINKE',''),
  ('','WILLOWRA',''),
  ('25761017736','SANTA TERESA',''),
  ('56165075312','AMOONGUNA',''),
  ('','PETERMANN',''),
  ('','YUENDUMU',''),
  ('82432959384','YUELAMU',''),
  ('61919192149','TITJIKALA',''),
  ('17487552774','FINKE',''),
  ('18384055423','FINKE',''),
  ('','PUKATJA',''),
  ('15207170110','MUTITJULU',''),
  ('','YUENDUMU',''),
  ('67702970187','YUENDUMU',''),
  ('44640761085','LARAMBA','Alice Springs'),
  ('61415976074','HAASTS BLUFF','Alice Springs'),
  ('','HERMANNSBURG',''),
  ('53916725096','TITJIKALA','Alice Springs'),
  ('42702075522','SANDOVER','Alice Springs'),
  ('','MOUNT ZEIL',''),
  ('19706185693','HERMANNSBURG',''),
  ('42701311843','YUENDUMU',''),
  ('90315164312','ENGAWALA','Alice Springs'),
  ('','MUTITJULU',''),
  ('','MOUNT ZEIL','')
)
SELECT t.abn, e.canonical_name, t.floc, COALESCE(e.lga_name,'(unplaced)') AS current_lga
  FROM targets t
  JOIN gs_entities e ON e.abn = t.abn
 WHERE e.lga_source IS DISTINCT FROM 'oric_register_address+abs_asgs'
    OR e.lga_source IS NULL;
