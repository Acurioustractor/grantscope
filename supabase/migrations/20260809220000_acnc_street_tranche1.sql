-- ACNC street-line tranche 1 — APPLY (Ben's grouped verdicts, 2026-08-09 night)
--
-- Verdicts ratified:
--   1. Place the core 644 (618 acnc_street_line+sal_ratio_dominant + 26 acnc_street_line+abs_asgs).
--   2. Nhulunbuy 12: place 11 in-town street rows -> Unincorporated NT; HOLD the
--      Nyinyikay homeland row (AU-ABN-65294398537 — homelands trap, belongs to the
--      street/geocode rung, likely East Arnhem).
--   3. Repair ALL 64 postcode_geo landmine pairs (SAL-guarded contradiction class;
--      incl. Warburton@6431 Kalgoorlie-Boulder->Ngaanyatjarraku, Derby@6728
--      Broome->Derby-West Kimberley, the 4352 Goondiwindi block -> Toowoomba/Lockyer).
--   4. Contamination audit of past postcode-derived placements in the 64 postcodes:
--      QUEUED next session (not in this migration).
--
-- Dry-run basis: thoughts/shared/handoffs/place-atlas/acnc-street-tranche1-dryrun.{sql,txt}
-- (final state: place 644 · hold_shared 61 · hold_pc_incoherent 8 · BEN_nhulunbuy 12 ·
--  not_resolvable 1,246). Guards live in the derivation: SAL one-per-name-in-state +
-- ratio >=0.9 + winning-LGA state-digit; shared-line <3 orgs; postcode coherence
-- against mapped postcodes only.
--
-- APPLY:
--   source .env && PGPASSWORD="$DATABASE_PASSWORD" psql -h aws-0-ap-southeast-2.pooler.supabase.com -p 5432 -U "postgres.tednluwflfhxyucgwigh" -d postgres -v ON_ERROR_STOP=1 -f supabase/migrations/20260809220000_acnc_street_tranche1.sql
--
-- Single transaction; every assertion failure aborts everything.

BEGIN;

-- ─── Re-derive the verdict set exactly as the final dry-run ─────────────────────
CREATE TEMP TABLE tmp_verdict ON COMMIT DROP AS
WITH sm(ab,fu) AS (VALUES
  ('NSW','New South Wales'),('VIC','Victoria'),('QLD','Queensland'),
  ('SA','South Australia'),('WA','Western Australia'),('TAS','Tasmania'),
  ('NT','Northern Territory'),('ACT','Australian Capital Territory')),
smd(ab,dg) AS (VALUES
  ('NSW','1'),('VIC','2'),('QLD','3'),('SA','4'),('WA','5'),('TAS','6'),('NT','7'),('ACT','8')),
pop AS MATERIALIZED (
  SELECT id, gs_id, abn, lga_source, postcode AS ent_pc
  FROM gs_entities
  WHERE lga_code IS NULL AND NULLIF(abn,'') IS NOT NULL
    AND ((postcode IS NOT NULL AND lga_source IN
          ('unresolved_multi_lga_postcode','unknown_postcode','postcode_unmapped_in_abs','state_conflict','no_state'))
         OR lga_source = 'registry_address')),
all_lines AS MATERIALIZED (
  SELECT abn,
         upper(regexp_replace(address_line_1, '[^A-Za-z0-9]+', ' ', 'g')) || ' @ ' || upper(coalesce(trim(town_city),'')) AS nline
  FROM acnc_charities
  WHERE address_line_1 IS NOT NULL
    AND address_line_1 !~* 'PO BOX|POBOX|GPO|LOCKED BAG|PMB|PRIVATE BAG|MAIL BAG|MAIL SERVICE|RMB|RSD|CMB|C/-|C/O|CARE OF'),
shared AS MATERIALIZED (
  SELECT nline, COUNT(DISTINCT abn) AS n_orgs FROM all_lines GROUP BY 1),
loc AS MATERIALIZED (
  SELECT upper(locality) AS town, state_name,
         COUNT(DISTINCT lga_code) AS n_lgas,
         MAX(lga_code) AS win_code, MAX(lga_name) AS win_name
  FROM abs_locality_lga GROUP BY 1,2),
sal3 AS MATERIALIZED (
  SELECT upper(regexp_replace(sal_name, ' \([^)]*\)$','')) AS town_base,
         COALESCE(substring(upper(replace(coalesce(substring(sal_name from '\(([^)]*)\)$'),''),'.','')) from '([A-Z]+)$'), '') AS st_grp,
         COUNT(DISTINCT sal_code) AS n_sals,
         MAX(ratio) AS max_ratio,
         (array_agg(left(lga_code,1) ORDER BY ratio DESC))[1] AS win_state_digit,
         (array_agg(lga_code ORDER BY ratio DESC))[1] AS win_code,
         (array_agg(lga_name ORDER BY ratio DESC))[1] AS win_name
  FROM abs_sal_lga_ratio GROUP BY 1,2),
cand AS MATERIALIZED (
  SELECT p.id, p.gs_id, p.lga_source, p.ent_pc, a.abn,
         upper(trim(a.town_city)) AS town, upper(trim(a.state)) AS st,
         s2.n_orgs
  FROM acnc_charities a
  JOIN pop p ON p.abn = a.abn
  JOIN all_lines al ON al.abn = a.abn
  JOIN shared s2 ON s2.nline = al.nline),
graded AS (
  SELECT c.*,
    CASE
      WHEN l.win_code IS NOT NULL AND l.n_lgas = 1 THEN 'town_unique_lga'
      WHEN s.win_code IS NOT NULL THEN 'sal_dominant'
    END AS path,
    CASE WHEN l.win_code IS NOT NULL AND l.n_lgas = 1 THEN l.win_code ELSE s.win_code END AS win_code,
    CASE WHEN l.win_code IS NOT NULL AND l.n_lgas = 1 THEN l.win_name ELSE s.win_name END AS win_name,
    CASE
      WHEN l.win_code IS NOT NULL AND l.n_lgas = 1 THEN 'acnc_street_line+abs_asgs'
      WHEN s.win_code IS NOT NULL THEN 'acnc_street_line+sal_ratio_dominant'
    END AS stamp,
    (c.n_orgs >= 3) AS shared_line,
    (c.town = 'NHULUNBUY') AS ben_nhulunbuy,
    (c.town IN ('ALICE SPRINGS','KATHERINE','THURSDAY ISLAND','COOKTOWN','TENNANT CREEK')) AS hub_town,
    (c.lga_source = 'unresolved_multi_lga_postcode'
     AND EXISTS (SELECT 1 FROM postcode_geo pg
                 WHERE pg.postcode = c.ent_pc AND pg.lga_code IS NOT NULL)
     AND NOT EXISTS (SELECT 1 FROM postcode_geo pg
                     WHERE pg.postcode = c.ent_pc AND upper(pg.locality) = c.town)
     AND NOT EXISTS (SELECT 1 FROM postcode_geo pg
                     WHERE pg.postcode = c.ent_pc
                       AND pg.lga_code = CASE WHEN l.win_code IS NOT NULL AND l.n_lgas = 1 THEN l.win_code ELSE s.win_code END)) AS pc_incoherent
  FROM cand c
  LEFT JOIN sm  ON sm.ab  = c.st
  LEFT JOIN smd ON smd.ab = c.st
  LEFT JOIN loc l ON l.town = c.town AND l.state_name = sm.fu
  LEFT JOIN sal3 s ON s.town_base = c.town
    AND (s.st_grp = '' OR s.st_grp = c.st)
    AND s.n_sals = 1 AND s.max_ratio >= 0.9
    AND s.win_state_digit = smd.dg)
SELECT *,
  CASE
    WHEN path IS NULL THEN 'not_resolvable'
    WHEN ben_nhulunbuy THEN 'BEN_nhulunbuy'
    WHEN shared_line THEN 'hold_shared_line'
    WHEN hub_town THEN 'hold_hub_town'
    WHEN pc_incoherent THEN 'hold_pc_incoherent'
    ELSE 'place'
  END AS verdict
FROM graded;

-- ─── Assert the world still matches the ratified dry-run ───────────────────────
DO $$
DECLARE n bigint;
BEGIN
  SELECT COUNT(*) INTO n FROM tmp_verdict WHERE verdict = 'place';
  IF n <> 644 THEN RAISE EXCEPTION 'place set is % (ratified 644) — world drifted, re-run dry-run', n; END IF;

  SELECT COUNT(*) INTO n FROM tmp_verdict WHERE verdict = 'BEN_nhulunbuy';
  IF n <> 12 THEN RAISE EXCEPTION 'nhulunbuy set is % (expected 12)', n; END IF;

  SELECT COUNT(*) INTO n FROM tmp_verdict WHERE verdict = 'BEN_nhulunbuy' AND gs_id = 'AU-ABN-65294398537';
  IF n <> 1 THEN RAISE EXCEPTION 'Nyinyikay hold row not found in nhulunbuy set'; END IF;

  SELECT COUNT(*) INTO n FROM tmp_verdict WHERE verdict = 'hold_shared_line';
  IF n <> 61 THEN RAISE EXCEPTION 'shared-line holds % (expected 61)', n; END IF;

  SELECT COUNT(*) INTO n FROM tmp_verdict WHERE verdict = 'hold_pc_incoherent';
  IF n <> 8 THEN RAISE EXCEPTION 'pc-incoherent holds % (expected 8)', n; END IF;

  SELECT COUNT(*) INTO n FROM tmp_verdict
  WHERE verdict IN ('place','BEN_nhulunbuy') AND (win_code IS NULL OR win_name IS NULL OR stamp IS NULL);
  IF n <> 0 THEN RAISE EXCEPTION '% write rows missing win/stamp values', n; END IF;
END $$;

-- ─── Entity placements: 644 core + 11 Nhulunbuy (Nyinyikay held) = 655 ─────────
DO $$
DECLARE n bigint;
BEGIN
  UPDATE gs_entities e
  SET lga_code = v.win_code, lga_name = v.win_name, lga_source = v.stamp
  FROM tmp_verdict v
  WHERE e.id = v.id AND e.lga_code IS NULL
    AND (v.verdict = 'place'
         OR (v.verdict = 'BEN_nhulunbuy' AND v.gs_id <> 'AU-ABN-65294398537'));
  GET DIAGNOSTICS n = ROW_COUNT;
  IF n <> 655 THEN RAISE EXCEPTION 'entity writes % (expected 655) — rolling back', n; END IF;
END $$;

-- ─── postcode_geo repairs: all 64 SAL-guarded landmine pairs ───────────────────
CREATE TEMP TABLE tmp_landmines ON COMMIT DROP AS
SELECT DISTINCT v.town, v.ent_pc, v.win_code, v.win_name
FROM tmp_verdict v
WHERE v.win_code IS NOT NULL
  AND EXISTS (SELECT 1 FROM postcode_geo pg
              WHERE pg.postcode = v.ent_pc AND upper(pg.locality) = v.town
                AND pg.lga_code IS NOT NULL AND pg.lga_code <> v.win_code);

DO $$
DECLARE pairs bigint; expected bigint; n bigint;
BEGIN
  SELECT COUNT(*) INTO pairs FROM tmp_landmines;
  IF pairs <> 64 THEN RAISE EXCEPTION 'landmine pairs % (ratified 64) — re-run the listing', pairs; END IF;

  SELECT COUNT(*) INTO expected
  FROM postcode_geo pg JOIN tmp_landmines lm
    ON pg.postcode = lm.ent_pc AND upper(pg.locality) = lm.town
   AND pg.lga_code IS NOT NULL AND pg.lga_code <> lm.win_code;

  UPDATE postcode_geo pg
  SET lga_code = lm.win_code, lga_name = lm.win_name
  FROM tmp_landmines lm
  WHERE pg.postcode = lm.ent_pc AND upper(pg.locality) = lm.town
    AND pg.lga_code IS NOT NULL AND pg.lga_code <> lm.win_code;
  GET DIAGNOSTICS n = ROW_COUNT;
  IF n <> expected THEN RAISE EXCEPTION 'pg repairs % (expected %) — rolling back', n, expected; END IF;
  RAISE NOTICE 'postcode_geo rows repaired: % (across % pairs)', n, pairs;
END $$;

-- ─── Post-conditions (single scan — four separate scans blew the 5-min shell cap
--     on a stressed pooler and rolled back the first apply attempt) ─────────────
DO $$
DECLARE r record;
BEGIN
  SELECT
    COUNT(*) FILTER (WHERE lga_source = 'acnc_street_line+sal_ratio_dominant') AS sal_n,
    COUNT(*) FILTER (WHERE lga_source = 'acnc_street_line+abs_asgs') AS abs_n,
    COUNT(*) FILTER (WHERE lga_code IS NULL AND postcode IS NOT NULL
      AND lga_source IN ('unresolved_multi_lga_postcode','unknown_postcode','postcode_unmapped_in_abs','state_conflict','no_state')) AS unpc,
    COUNT(*) FILTER (WHERE lga_code IS NULL AND lga_source = 'registry_address') AS reg
  INTO r FROM gs_entities;

  IF r.sal_n <> 629 THEN RAISE EXCEPTION 'sal_ratio stamp count % (expected 629 = 618+11)', r.sal_n; END IF;
  IF r.abs_n <> 26 THEN RAISE EXCEPTION 'abs_asgs stamp count % (expected 26)', r.abs_n; END IF;
  -- 621 writes come from the 5-reason with-pc classes: 600 multi_lga (594 + the
  -- Bull Creek 6 freed by the mapped-postcode gate refinement) + 11 Nhulunbuy
  -- + 5 unmapped + 4 unknown_pc + 1 state_conflict; the other 34 are registry rows.
  IF r.unpc <> 27796 THEN RAISE EXCEPTION 'unplaced_pc % (expected 27796 = 28417 - 621)', r.unpc; END IF;
  IF r.reg <> 12016 THEN RAISE EXCEPTION 'registry_address unplaced % (expected 12016 = 12050 - 34)', r.reg; END IF;
  RAISE NOTICE 'post-conditions green: sal % · abs % · unplaced_pc % · registry %', r.sal_n, r.abs_n, r.unpc, r.reg;
END $$;

COMMIT;

\echo 'tranche 1 applied: +655 placements (629 sal_ratio + 26 abs_asgs), 64 postcode_geo pairs repaired'
