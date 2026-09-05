-- postcode 2052 is UNSW Sydney (Kensington campus), City of Randwick. It is stamped
-- 'Sydney'. #301 residue -- the second of the 11 no-ABS-evidence SA3-shaped rows to
-- fall, and with it the residue is CLOSED: the other 9 were adjudicated against
-- Australia Post on 2026-08-25 and every one is correct as stamped.
--
-- THE EVIDENCE (external, which is what #301 asked for):
--   - Australia Post: 2052 = "UNSW SYDNEY, NSW" (auspost.com.au/postcode/unsw-sydney).
--   - UNSW's own address: "UNSW Sydney, Kensington NSW 2052".
--   - Kensington's LGA is the City of Randwick (not City of Sydney).
--   - Internal corroboration, same shape as the 4072 UQ case: all 49 gs_entities at
--     2052 are UNSW campus organisations (AIESEC UNSW, 180 Degrees Consulting UNSW,
--     Brien Holden Vision Institute, Australian Pro Bono Centre...), every one
--     stamped 'Sydney' via lga_source 'registry_address'.
--
-- THE OTHER 9, verified correct against Australia Post 2026-08-25, stay untouched:
--   0831 Palmerston City boxes -> Palmerston OK      2001 Sydney GPO boxes -> Sydney OK
--   2002 World Square boxes -> Sydney OK             2006 University of Sydney -> Sydney OK
--   2057 Chatswood boxes -> Willoughby OK            2059 North Sydney boxes -> North Sydney OK
--   4029 Royal Brisbane Hospital -> Brisbane OK      4219 West Burleigh boxes -> Gold Coast OK
--   6231 Bunbury boxes -> Bunbury OK
--
-- Apply:
--   source .env && PGPASSWORD="$DATABASE_PASSWORD" psql -h aws-0-ap-southeast-2.pooler.supabase.com \
--     -p 5432 -U "postgres.tednluwflfhxyucgwigh" -d postgres \
--     -v ON_ERROR_STOP=1 -f migrations/2026-08-25-postcode-2052-unsw-randwick.sql

BEGIN;

CREATE TABLE IF NOT EXISTS _backup_pc2052_20260825 AS
SELECT id, gs_id, canonical_name, postcode, lga_name, lga_code, lga_source
FROM gs_entities WHERE postcode = '2052';

-- Abort rather than correct a number nobody measured.
DO $$
DECLARE n int;
BEGIN
  SELECT count(*) INTO n FROM gs_entities
   WHERE postcode = '2052' AND lga_name = 'Sydney';
  IF n NOT BETWEEN 40 AND 60 THEN
    RAISE EXCEPTION 'expected ~49 entities at 2052 stamped Sydney, found %', n;
  END IF;
END $$;

UPDATE postcode_geo
   SET lga_name = 'Randwick',
       lga_code = '16550'
 WHERE postcode = '2052' AND lga_name = 'Sydney';

-- Only rows still carrying the wrong value are touched: anything placed by a better
-- rung keeps its provenance.
UPDATE gs_entities
   SET lga_name = 'Randwick',
       lga_code = '16550',
       lga_source = 'sa3_residue_external_evidence'
 WHERE postcode = '2052' AND lga_name = 'Sydney';

COMMIT;
