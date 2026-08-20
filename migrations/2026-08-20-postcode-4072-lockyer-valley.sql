-- postcode 4072 is St Lucia, Brisbane. It is stamped 'Lockyer Valley'. #301 residue.
--
-- APPLIED 2026-08-20 to tednluwflfhxyucgwigh, on Ben's explicit authorization.
--   UPDATE 1 (postcode_geo) / UPDATE 29 (gs_entities), backed up to _backup_pc4072_20260820.
--   Verified after: 4072 -> Brisbane (lga_code 31000), all 29 entities re-stamped
--   lga_source 'sa3_residue_entity_evidence', and 440 entities remain in Lockyer Valley --
--   the ones that genuinely belong there, so the correction did not over-reach.
--
-- Apply:
--   source .env && PGPASSWORD="$DATABASE_PASSWORD" psql -h aws-0-ap-southeast-2.pooler.supabase.com \
--     -p 5432 -U "postgres.tednluwflfhxyucgwigh" -d postgres \
--     -v ON_ERROR_STOP=1 -f migrations/2026-08-20-postcode-4072-lockyer-valley.sql
--
-- WHERE THIS CAME FROM. The #301 repair adjudicated 435 of the 451 SA3-shaped postcode_geo rows
-- against abs_poa_lga_ratio. 16 postcodes have no ratio row and were left untouched; 11 of those
-- still carry an LGA stamp nothing has checked. This is one of them, and it is wrong.
--
-- THE EVIDENCE, and why it needed no external file. Two instruments were tried and both failed
-- before the obvious one worked:
--
--   1. Coordinates. postcode_geo carries latitude/longitude, and the Croydon error was ~900km, so
--      a distance test against the council's other postcodes should have caught this class.
--      It cannot: latitude and longitude are NULL on all 11 of these rows.
--   2. The locality name. 'Bellbowrie - Moggill' contains real suburb names that appear elsewhere
--      in postcode_geo with their own councils. This produces FALSE FRIENDS -- 'Darlington' in
--      2052 matches a Hawkesbury locality, 'Durack' in 0831 exists in both Palmerston and
--      Litchfield. Only 5 of the 11 got any evidence and 4 of those were false-friend
--      disagreements. The instrument is not trustworthy and was abandoned.
--   3. The ENTITIES THEMSELVES. All 29 gs_entities at postcode 4072 are University of Queensland
--      St Lucia campus organisations, every one stamped 'Lockyer Valley' via lga_source
--      'registry_address':
--
--        Campus Kindergarten Limited
--        Brisbane-Asian Student Association International
--        Occupational Therapy Student Association
--        Association of Postgraduate Students Inc.
--        Australasian Macroeconomics Society
--
--      One of them has 'Brisbane' in its NAME while sitting in a rural council 60km west.
--      4072 is St Lucia; Bellbowrie and Moggill are also Brisbane City. Every reading of this
--      postcode lands in Brisbane City and none of them lands in Lockyer Valley.
--
-- SCOPE. This corrects ONE postcode, the only one of the 11 that internal evidence can settle.
-- The other 10 stay stamped and stay flagged on #301 -- most look plausible (2001/2002/2006 Sydney,
-- 6231 Bunbury, 4029 Brisbane, 4219 Gold Coast) but "looks plausible" is what Croydon looked like,
-- and guessing is the thing this codebase does not do. They need an external source.
--
-- v_grant_place_capture is NOT affected: it already refuses every SA3-shaped postcode with no ABS
-- ratio row, which is all 11 of these. This is about entity placement, which the Atlas and every
-- per-council figure read.

BEGIN;

CREATE TABLE IF NOT EXISTS _backup_pc4072_20260820 AS
SELECT id, gs_id, canonical_name, postcode, lga_name, lga_code, lga_source
FROM gs_entities WHERE postcode = '4072';

-- Abort rather than correct a number nobody measured.
DO $$
DECLARE n int;
BEGIN
  SELECT count(*) INTO n FROM gs_entities
   WHERE postcode = '4072' AND lga_name = 'Lockyer Valley';
  IF n NOT BETWEEN 20 AND 40 THEN
    RAISE EXCEPTION 'expected ~29 entities at 4072 stamped Lockyer Valley, found %', n;
  END IF;
END $$;

UPDATE postcode_geo
   SET lga_name = 'Brisbane',
       lga_code = (SELECT lga_code FROM postcode_geo
                    WHERE lga_name = 'Brisbane' AND lga_code IS NOT NULL LIMIT 1)
 WHERE postcode = '4072' AND lga_name = 'Lockyer Valley';

-- Only rows still carrying the wrong value are touched: anything placed by a better rung
-- (street address, ORIC register, own-name evidence) keeps its provenance.
UPDATE gs_entities
   SET lga_name = 'Brisbane',
       lga_code = (SELECT lga_code FROM postcode_geo
                    WHERE lga_name = 'Brisbane' AND lga_code IS NOT NULL LIMIT 1),
       lga_source = 'sa3_residue_entity_evidence'
 WHERE postcode = '4072' AND lga_name = 'Lockyer Valley';

COMMIT;
