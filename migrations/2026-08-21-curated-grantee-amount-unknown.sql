-- 152 curated grantee rows never had a per-grant source. Mark them amount_unknown. #291, #285.
--
-- APPLIED 2026-08-21 to tednluwflfhxyucgwigh, on Ben's explicit authorization, at the full
-- 152-row scope (see SCOPE below).
--   INSERT 152 (backup) / UPDATE 152. Guards passed: exactly 7 VFFF rows, 0 rows carrying
--   evidence other than a Focus tag.
--   Verified after: all 7 VFFF rows marked, and the backfill queue for this method is now
--   445 rows -- every one from a surface that does publish amounts.
--
-- Apply:
--   source .env && PGPASSWORD="$DATABASE_PASSWORD" psql -h aws-0-ap-southeast-2.pooler.supabase.com \
--     -p 5432 -U "postgres.tednluwflfhxyucgwigh" -d postgres \
--     -v ON_ERROR_STOP=1 -f migrations/2026-08-21-curated-grantee-amount-unknown.sql
--
-- WHAT #291 ASKED. VFFF is 7 dollar-less rows and the test case for the band around it. #285 put
-- `official_grantee_surface_backfill` in the BACKFILL class on the grounds that the method is only
-- 16.2% dollar-less, so a missing amount is plausibly our miss rather than the funder's silence.
--
-- THE 16.2% IS AN AVERAGE OVER TWO POPULATIONS THAT BEHAVE NOTHING ALIKE. Measured 2026-08-21:
--
--                                        rows    with amount    dollar-less
--     non-curated                       3,523          3,078          12.6%
--     curated (metadata source=curated)   153              1          99.3%
--
-- The premise holds for the first and fails completely for the second. VFFF's 7 rows are curated.
--
-- WHY THE CURATED ROWS CANNOT BE BACKFILLED. They were never extracted from a grants surface.
-- Every one of the 152 dollar-less curated rows carries:
--   * source_url        = the foundation's HOMEPAGE (https://reports.vfff.org.au/), not a grant page
--   * source_document_url = the same homepage
--   * evidence_text     = 'Focus: community' / 'Focus: arts' / 'Focus: indigenous' -- a THEME TAG.
--                         All 152 of them. Not one carries grant-level evidence.
-- They are curated foundation-to-grantee associations with a category attached. There is no
-- per-grantee amount to recover because there was never a per-grantee record.
--
-- AND THE FUNDER DOES NOT PUBLISH THEM EITHER. Checked https://reports.vfff.org.au/2024/ on
-- 2026-08-21: the 2024 report gives aggregates only -- 'The Grants Committee approved $850,000
-- across 17 grants' and '$10m in new grants this year'. No per-grantee amounts anywhere. So both
-- tests in #291 step 1 fail: we did not miss an amount, and the funder did not publish one.
--
-- WHAT THIS DOES TO THE BAND. #291 worried the finding might condemn "~590 other rows". It does
-- not. The 597 dollar-less rows split cleanly:
--
--     152  curated      -> amount_unknown. No source ever existed. This migration.
--     445  non-curated  -> backfill stands. #285's policy is right for these.
--
-- That is a better answer than either "backfill all 600" or "mark all 600 unknown", and it cost
-- seven rows to find, which is exactly what #291 hoped for.
--
-- SCOPE. #291 deliberately scoped itself to VFFF's 7 and named the rest as a follow-on, because
-- nobody knew whether the band was backfillable. That uncertainty is now resolved for the curated
-- subset: all 152 share one evidence shape and one defect. Marking only 7 of 152 identical rows
-- would leave 145 known-unbackfillable rows sitting in the backfill queue. If you want the narrow
-- version, change the WHERE below to `foundation_name ILIKE '%Vincent Fairfax%'` and the guard to 7.

BEGIN;

CREATE TABLE IF NOT EXISTS _backup_curated_amount_unknown_20260821 AS
SELECT id, foundation_name, grantee_name, grant_amount, amount_unknown, evidence_text, source_url
  FROM foundation_grantees WHERE false;

INSERT INTO _backup_curated_amount_unknown_20260821
SELECT id, foundation_name, grantee_name, grant_amount, amount_unknown, evidence_text, source_url
  FROM foundation_grantees
 WHERE extraction_method = 'official_grantee_surface_backfill'
   AND grant_amount IS NULL
   AND metadata::text ILIKE '%curated%';

DO $$
DECLARE n int; n_vfff int; n_evidence int;
BEGIN
  SELECT count(*) INTO n FROM _backup_curated_amount_unknown_20260821;
  SELECT count(*) INTO n_vfff FROM _backup_curated_amount_unknown_20260821
   WHERE foundation_name ILIKE '%Vincent Fairfax%';
  -- Every row must be evidence-tagged 'Focus: ...'. If one is not, it may carry real grant
  -- evidence and must not be swept into amount_unknown with the rest.
  SELECT count(*) INTO n_evidence FROM _backup_curated_amount_unknown_20260821
   WHERE evidence_text NOT ILIKE 'Focus:%';
  RAISE NOTICE 'marking % curated rows amount_unknown (% of them VFFF)', n, n_vfff;
  IF n NOT BETWEEN 140 AND 165 THEN
    RAISE EXCEPTION 'expected ~152 curated dollar-less rows, found %. Re-measure first.', n;
  END IF;
  IF n_vfff <> 7 THEN
    RAISE EXCEPTION 'expected exactly 7 VFFF rows, found % -- the #291 test case has moved', n_vfff;
  END IF;
  IF n_evidence <> 0 THEN
    RAISE EXCEPTION '% rows carry evidence other than a Focus tag -- refusing to sweep them', n_evidence;
  END IF;
END $$;

UPDATE foundation_grantees
   SET amount_unknown = true
 WHERE extraction_method = 'official_grantee_surface_backfill'
   AND grant_amount IS NULL
   AND metadata::text ILIKE '%curated%';

COMMIT;

-- After applying:
--   1. The backfill queue for this method is 445 rows, not 597, and every one of them comes from a
--      surface that does publish amounts.
--   2. amount_unknown means "the funder did not publish this", which is now true of these rows by
--      evidence rather than by assumption.
--   3. #291 is answerable: VFFF's amounts are not published, the 7 are marked, and the band is
--      split 152 / 445 rather than condemned wholesale.
