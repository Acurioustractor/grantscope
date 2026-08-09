-- Derby cluster correction — 166 registry_address rows @ 6728 placed to Broome
-- by the registry lane reading the pre-repair postcode_geo DERBY@6728 row
-- (repaired to Derby-West Kimberley by 20260809220000). Contamination audit
-- 2026-08-09 night: org names confirm Derby (Anglican Parish Of Derby, BOAB
-- FESTIVAL AT DERBY, Balginjirr/Bidan ACs); 8 of 9 localities of 6728 map to
-- Derby-West Kimberley in both authorities; Broome is reachable from none.
-- lga_source stays 'registry_address' — same lane, corrected input.
-- Ben's verdict: "Fix the 166 now" (audit follow-ons queued: 8 scattered
-- registry rows on other old values; systematic pg-vs-ABS contradiction sweep).
--
-- APPLY:
--   source .env && PGPASSWORD="$DATABASE_PASSWORD" psql -h aws-0-ap-southeast-2.pooler.supabase.com -p 5432 -U "postgres.tednluwflfhxyucgwigh" -d postgres -v ON_ERROR_STOP=1 -f supabase/migrations/20260809230000_derby_cluster_correction.sql

BEGIN;

DO $$
DECLARE auth record; n bigint; codes bigint; old_code text;
BEGIN
  -- Authority: the repaired DERBY@6728 row must name Derby-West Kimberley.
  SELECT lga_code, lga_name INTO auth
  FROM postcode_geo WHERE postcode = '6728' AND upper(locality) = 'DERBY';
  IF auth.lga_name IS DISTINCT FROM 'Derby-West Kimberley' THEN
    RAISE EXCEPTION 'authority row says % — expected Derby-West Kimberley', auth.lga_name;
  END IF;

  -- Target set: exactly the audited 166, all on one uniform old value.
  SELECT COUNT(*), COUNT(DISTINCT lga_code), MIN(lga_code) INTO n, codes, old_code
  FROM gs_entities
  WHERE postcode = '6728' AND lga_name = 'Broome' AND lga_source = 'registry_address';
  IF n <> 166 THEN RAISE EXCEPTION 'target set is % rows (audited 166) — re-audit', n; END IF;
  IF codes <> 1 THEN RAISE EXCEPTION '% distinct old lga_codes in target (expected 1)', codes; END IF;
  RAISE NOTICE 'reversal record: 166 rows leaving Broome (old lga_code %) -> % (%)', old_code, auth.lga_name, auth.lga_code;

  UPDATE gs_entities
  SET lga_code = auth.lga_code, lga_name = auth.lga_name
  WHERE postcode = '6728' AND lga_name = 'Broome' AND lga_source = 'registry_address';
  GET DIAGNOSTICS n = ROW_COUNT;
  IF n <> 166 THEN RAISE EXCEPTION 'updated % rows (expected 166) — rolling back', n; END IF;

  -- Post-condition, single scan over the postcode.
  SELECT COUNT(*) FILTER (WHERE lga_name = 'Broome' AND lga_source = 'registry_address'),
         COUNT(*) FILTER (WHERE lga_name = 'Derby-West Kimberley')
  INTO codes, n
  FROM gs_entities WHERE postcode = '6728';
  IF codes <> 0 THEN RAISE EXCEPTION '% Broome registry rows remain at 6728', codes; END IF;
  RAISE NOTICE 'post: 6728 now has % Derby-West Kimberley rows, zero Broome registry rows', n;
END $$;

COMMIT;

\echo 'derby cluster correction applied: 166 rows Broome -> Derby-West Kimberley'
