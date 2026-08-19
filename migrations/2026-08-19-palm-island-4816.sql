-- Issue #301 — postcode 4816 is not Croydon, and the SA3 defect is 451 postcodes wide
--
-- Apply:
--   source .env && PGPASSWORD="$DATABASE_PASSWORD" psql -h aws-0-ap-southeast-2.pooler.supabase.com \
--     -p 5432 -U "postgres.tednluwflfhxyucgwigh" -d postgres \
--     -v ON_ERROR_STOP=1 -f migrations/2026-08-19-palm-island-4816.sql
--
-- The defect. postcode_geo's row for 4816 carries locality 'Townsville - South', which is an ABS
-- SA3 name, not a gazetted locality, and stamps lga_name='Croydon' (32600). Croydon Shire is in
-- the Gulf Country, roughly 700km away. 135 gs_entities on 4816 inherited it, including 20 Palm
-- Island organisations: Kootana Women's Centre, Bwgcolman Arts, Bwgcolman Hornets, Coolgaree,
-- Coonawarra Media, the Men's Business Group, the Community Justice Group, the Rodeo Corporation.
-- Only one row on the island is right, the Aboriginal Shire Council, placed by a different rung
-- (council_serves_shire).
--
-- Trap, and it is why this migration does not simply write 'Palm Island' across 4816: **4816
-- genuinely straddles two LGAs.** It covers Great Palm Island (Palm Island Aboriginal Shire,
-- 35790) AND mainland localities south of Townsville -- Alligator Creek, and entities naming
-- Cardwell, Burdekin, Hinchinbrook and Bowie also sit on it. So the postcode has no single right
-- answer, and asserting one would replace a wrong LGA with a differently wrong LGA.
--
-- Therefore: place only what name evidence supports, and unplace the rest rather than guess. That
-- follows the standing rule from the LGA attribution rebuild -- entities are deliberately left
-- unplaced rather than confidently wrong, and every row stays reason-coded.
--
-- Extent, measured 2026-08-19 and previously recorded as unknown: **451 postcode_geo rows carry
-- SA3/SA2-shaped locality names, across 446 postcodes holding 66,024 gs_entities.** In a random
-- sample of 12, at least 6 had verifiably wrong LGAs (Scottsdale-Bridport 7260 stamped Launceston
-- not Dorset; Beauty Point-Beaconsfield 7270 stamped Latrobe not West Tamar; Aldgate-Stirling 5153
-- stamped Alexandrina not Adelaide Hills; Southern Downs-East 4373 stamped Scenic Rim not Southern
-- Downs; Bourke-Brewarrina 2839 stamped Brewarrina not Bourke; Dilston-Lilydale 7268 stamped
-- Dorset). This migration fixes ONE of the 451. The rest need the ABS SA3-to-LGA correspondence
-- file and stay open on #301.

BEGIN;

CREATE TABLE _backup_gs_entities_4816_20260819 AS
SELECT id, gs_id, canonical_name, postcode, lga_name, lga_code, lga_source
FROM gs_entities WHERE postcode = '4816';

DO $$
DECLARE n int;
BEGIN
  SELECT count(*) INTO n FROM gs_entities WHERE postcode='4816' AND lga_name='Croydon';
  IF n <> 135 THEN
    RAISE EXCEPTION 'expected 135 entities on 4816 stamped Croydon, found %', n;
  END IF;
END $$;

-- 1. The source row. 4816 straddles Palm Island Aboriginal Shire and Townsville City, so it gets
--    no LGA at all rather than a wrong one. Leaving Croydon here would re-poison every rebuild.
UPDATE postcode_geo
SET lga_name = NULL, lga_code = NULL
WHERE postcode = '4816' AND lga_name = 'Croydon';

-- 2. Palm Island organisations, by name evidence. Bwgcolman is the people's name for the island;
--    Coolgaree and Kootana are Palm Island bodies. All verified against the entity list.
UPDATE gs_entities
SET lga_name = 'Palm Island', lga_code = '35790',
    lga_source = 'own_name_town+manual_verified'
WHERE postcode = '4816'
  AND lga_name = 'Croydon'
  AND canonical_name ~* 'palm island|bwgcolman|coolgaree|kootana';

-- 3. Everyone else on 4816. Mainland, multi-LGA, no name evidence: unplaced and reason-coded,
--    not guessed.
UPDATE gs_entities
SET lga_name = NULL, lga_code = NULL,
    lga_source = 'unresolved_multi_lga_postcode'
WHERE postcode = '4816' AND lga_name = 'Croydon';

COMMIT;
