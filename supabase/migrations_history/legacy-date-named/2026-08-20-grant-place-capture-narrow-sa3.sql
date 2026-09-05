-- v_grant_place_capture: narrow exclusion 4 now that postcode_geo has been repaired. #301, #300.
--
-- Apply:
--   source .env && PGPASSWORD="$DATABASE_PASSWORD" psql -h aws-0-ap-southeast-2.pooler.supabase.com \
--     -p 5432 -U "postgres.tednluwflfhxyucgwigh" -d postgres \
--     -v ON_ERROR_STOP=1 -f migrations/2026-08-20-grant-place-capture-narrow-sa3.sql
--
-- WHY THIS CHANGES THE DAY IT SHIPPED.
--
-- The original view (migrations/2026-08-19-grant-place-capture.sql) refused EVERY SA3-shaped
-- postcode_geo row, because at least one of them was catastrophically wrong: postcode 4816 was
-- recorded as locality 'Townsville - South' with lga_name 'Croydon', a council ~900km away, and
-- it put Croydon QLD at the top of the worst-capturing table in Australia on $72.9M of Palm
-- Island money. With no way to tell the wrong rows from the right ones, refusing all 443 was the
-- honest move -- a refusal, not a repair, and #301 said so in those words.
--
-- #301 has since been repaired. migrations/2026-08-19-sa3-locality-lga-repair.sql adjudicated the
-- rows against `abs_poa_lga_ratio`, which was already in the warehouse -- the handoff note
-- claiming this needed an external ABS download was wrong. Verified 2026-08-20: 387 SA3-shaped
-- postcodes now agree with the ABS majority, 0 remain fixable, 0 remain to be unplaced, and 4816
-- carries no LGA at all rather than Croydon.
--
-- So the wholesale refusal now costs coverage to defuse a defect that no longer exists. What
-- remains is narrower and real: 16 SA3-shaped postcodes have NO row in abs_poa_lga_ratio, and 11
-- of those still carry an LGA stamp that nothing has checked. Those 11 are the actual risk, and
-- they are what this view now refuses.
--
-- MEASURED COST OF THE CHANGE, 2026-08-20:
--
--            awards     dollars
--   before   85,898     $33.75bn      all SA3-shaped rows refused
--   after   110,267     $42.37bn      only SA3-shaped rows with no ABS evidence refused
--   gain    +24,369     +$8.62bn      +28% of awards, +26% of dollars
--
-- The headline shares move with it, and both must be restated wherever they are quoted:
-- 85.1% -> 86.1% of awards and 59.6% -> 56.9% of dollars, measured on the whole base.
--
-- The other three exclusions are unchanged and still load-bearing. Read the original migration
-- header before touching any of them.

CREATE OR REPLACE VIEW v_grant_place_capture AS
WITH pc AS (
  SELECT postcode,
         min(lga_name)        AS lga_name,
         min(state)           AS state,
         min(remoteness_2021) AS remoteness
    FROM postcode_geo g
   WHERE lga_name IS NOT NULL
     -- exclusion 4, NARROWED (was: locality NOT LIKE '% - %' for every row).
     -- An SA3-shaped locality is admitted when ABS carries postcode-to-LGA ratio evidence for
     -- that postcode, because the repair adjudicated it against exactly that evidence. Without a
     -- ratio row there is nothing that checked the stamp, and it stays refused.
     AND (g.locality NOT LIKE '% - %'
          OR EXISTS (SELECT 1 FROM abs_poa_lga_ratio r WHERE r.poa_code = g.postcode))
   GROUP BY postcode
  HAVING count(DISTINCT lga_name) = 1   -- exclusion 3: single-LGA postcodes only
),
base AS (
  SELECT *
    FROM grantconnect_awards
   WHERE delivery_postcode IS NOT NULL
     AND recipient_postcode IS NOT NULL
     AND delivery_postcode <> 'Multiple'                        -- exclusion 1
     AND value_aud > 0                                          -- exclusion 2
     AND lower(trim(recipient_name)) NOT IN
         ('total','totals','various','n/a','na','unknown','other')
)
SELECT b.ga_id,
       b.value_aud,
       b.recipient_name,
       b.recipient_abn,
       b.approval_date,
       d.lga_name    AS delivery_lga,
       d.state       AS delivery_state,
       d.remoteness  AS delivery_remoteness,
       r.lga_name    AS recipient_lga,
       r.state       AS recipient_state,
       (d.lga_name = r.lga_name) AS captured_locally
  FROM base b
  JOIN pc d ON d.postcode = b.delivery_postcode
  LEFT JOIN pc r ON r.postcode = b.recipient_postcode;

COMMENT ON VIEW v_grant_place_capture IS
  'Grant awards where both delivery and recipient location resolve to a single, trustworthy LGA. '
  '110,267 of 291,264 awards ($42.37bn of $230bn) after the #301 postcode_geo repair widened it '
  'from 85,898 / $33.75bn. captured_locally = the receiving org sits in the LGA the work was '
  'delivered into. Four exclusions apply, documented in '
  'migrations/2026-08-19-grant-place-capture.sql and narrowed in '
  'migrations/2026-08-20-grant-place-capture-narrow-sa3.sql. Do not widen them without re-reading '
  'both headers.';

GRANT SELECT ON v_grant_place_capture TO anon, authenticated, service_role;
