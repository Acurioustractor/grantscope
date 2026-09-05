-- v_grant_place_capture: does grant money delivered into a place get received by an
-- organisation in that place?
--
-- Apply:
--   source .env && PGPASSWORD="$DATABASE_PASSWORD" psql -h aws-0-ap-southeast-2.pooler.supabase.com \
--     -p 5432 -U "postgres.tednluwflfhxyucgwigh" -d postgres \
--     -f migrations/2026-08-19-grant-place-capture.sql
--
-- grantconnect_awards carries delivery_postcode/delivery_state SEPARATE from
-- recipient_postcode/recipient_state. Nothing read them until 2026-08-19. This view is
-- the reusable form of that analysis so the exclusion rules cannot drift.
--
-- FOUR EXCLUSIONS, all load-bearing. Removing any one changes the answer materially:
--
--  1. delivery_postcode = 'Multiple'  (a literal string, 5,978 rows, $19.55bn)
--     Multi-site grants. They are not a place. Counting them as one made 'Multiple'
--     compare unequal to every recipient postcode, which inflated the "delivered
--     off-site" dollars from $22.91bn to $42.46bn and cross-state from $3.95bn to
--     $17.79bn. That was wrong by 4.5x on the cross-state figure.
--
--  2. aggregate-shaped recipient names (2,663 rows) and value_aud <= 0 (195 rows).
--
--  3. postcodes touching more than one LGA (521 of 2,859). Attributing them by
--     picking one arbitrarily is how you get a wrong answer that looks right. Same
--     discipline as the LGA attribution rebuild: unplaced beats confidently wrong.
--
--  4. postcode_geo rows whose "locality" is actually an SA3 name (443 with an LGA).
--     These carry WRONG LGAs. Postcode 4816 is recorded as locality "Townsville -
--     South" with lga_name 'Croydon', an LGA ~900km away in far north-west Queensland.
--     Left in, Croydon QLD appeared as the worst-capturing LGA in the country on
--     $72.9M of Palm Island money. It is an artefact, not a finding.
--     See the follow-up issue: postcode_geo needs these 443 rows repaired.
--
-- Coverage after all four: 85,898 awards, $33.75bn, out of 291,264 awards / $230bn.
-- This view is a well-measured MINORITY of the grant record, not the whole of it.
-- Any surface using it must say so.

CREATE OR REPLACE VIEW v_grant_place_capture AS
WITH pc AS (
  SELECT postcode,
         min(lga_name)        AS lga_name,
         min(state)           AS state,
         min(remoteness_2021) AS remoteness
    FROM postcode_geo
   WHERE lga_name IS NOT NULL
     AND locality NOT LIKE '% - %'      -- exclusion 4: SA3-shaped rows carry wrong LGAs
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
  '85,898 of 291,264 awards ($33.75bn of $230bn). captured_locally = the receiving org sits in the '
  'LGA the work was delivered into. Four exclusions apply, documented in '
  'migrations/2026-08-19-grant-place-capture.sql. Do not widen them without re-reading that header.';

GRANT SELECT ON v_grant_place_capture TO anon, authenticated, service_role;
