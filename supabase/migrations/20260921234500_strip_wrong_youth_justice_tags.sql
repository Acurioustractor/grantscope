-- Remove the youth-justice topic tag from 64 rows where two independent signals agree it does not belong.
--
-- ── How 248 became 94 became 64 ─────────────────────────────────────────────
--
-- The guard in scripts/check-data-contradictions.mjs counted 248 rows with
-- `serves_youth_justice IS NOT TRUE` and a youth-justice tag. That query folds
-- NULL in with false, and 154 of the 248 have a NULL flag: nobody ever assessed
-- them. Unassessed is an abstention, not a contradiction. Conflating the two was
-- the exact mistake the guard exists to catch, made inside the guard.
--
-- The real contradiction is 94 rows where the flag is explicitly `false` and the
-- tag is present anyway.
--
-- ── Why a keyword rule was not enough ───────────────────────────────────────
--
-- 85 of the 94 have "youth" in the name without "justice", so a name rule would
-- strip those correctly. It would also keep "Climate Justice" and "Migration
-- Justice" from the Human Rights Law Centre, which match "justice" and are not
-- youth justice, and it would strip "Department of Children, Youth Justice and
-- Multicultural Affairs", where the FLAG is what looks wrong.
--
-- A single keyword match is how these tags were written in the first place. It
-- is not how they get removed. So the rule here needs two signals: the table's
-- own `serves_youth_justice = false`, AND a classifier confidently saying the
-- same thing.
--
-- Adjudicated 2026-09-21 by:
--   node --env-file=.env scripts/jev-check-loop.mjs --audit alma_yj_tag_dispute
--
--   93 rows asked, 65 confident at >= 0.90 (70% coverage, well above the 40%
--   line at which that script calls an audit underpowered)
--   64 confidently NOT youth justice: 58 "youth work, not justice"
--                                      6 "justice work, not youth"
--    1 confidently IS youth justice, and is LEFT ALONE:
--      "Youth Justice System Statistics - ROGS 2025" at 1.00. It is a
--      Productivity Commission report rather than a service, so the flag being
--      false is defensible, but the topic tag is correct and stays.
--   28 below the confidence threshold are untouched. An uncertain answer is not
--   a licence to delete.
--
-- What is stripped, verbatim: "Youth Worship Service (Sunday 3rd Service)",
-- "Pursue Youth Camp", "Youth group activities" (Trinity Church Unley),
-- "National Office for Youth - Promotion of STEM Youth Advisory Group",
-- "Youth Events Team Initiative".
--
-- ── Why it matters ──────────────────────────────────────────────────────────
--
-- The published report path reads the TAG, not the flag. report-service.ts
-- filters on `topics @> ARRAY['<topic>']`, and only five files under
-- apps/web/src mention serves_youth_justice at all against 145 references to
-- this table. A church Sunday service was reachable as a youth justice
-- intervention.
--
-- ── Reversibility ───────────────────────────────────────────────────────────
--
-- Exactly reversible: the 64 ids are listed below. To undo, run the same
-- statement with array_append instead of array_remove over the same list.
-- Only the 'youth-justice' element is touched; every other topic is preserved.
--
-- Apply: scripts/db-apply.sh supabase/migrations/20260921234500_strip_wrong_youth_justice_tags.sql

BEGIN;

UPDATE public.alma_interventions
   SET topics = array_remove(topics, 'youth-justice')
 WHERE id IN (
    '524a43df-873c-4d5b-a10d-af474bc6a3ed', 'cf8c405d-c599-4bfb-813d-f2a28f13f51a',
    'a922d04e-1829-4b46-8503-9445201903d5', '9cd4f437-5009-416e-92bc-34e0379c044b',
    '9f51de34-bd8c-4a7e-8c3f-a32e83e1dd77', '1c09a800-c259-4155-8074-7ef92d9493c9',
    '5a2f92eb-bb08-47b3-b4ed-5942169ab1f3', '14470881-8673-47d3-97ae-834f43a44723',
    'deedb923-82e9-47d4-ac6c-5faa6eaa5343', 'ab2b4bc3-c150-42a2-a9bc-7ae76de65b5e',
    '554918fc-5703-41d3-8f0c-1bb3fba7cad6', '4f67022e-df77-4ba0-884e-f15236640e3d',
    'f1856b56-5812-4f3f-8337-8f2e5d5a0140', '861c47e4-8d77-4f72-b4a8-fdfdb2532937',
    '668de31a-fd00-4f81-bfce-e4d3fff15a09', 'c54001d5-3108-41d3-ae59-99ad71d11aaa',
    'dd46d4c1-d9ea-45b4-91eb-c844263d19af', '402536a6-c7c2-4612-9970-0c3d4abe9f82',
    'ab731301-5563-4ae9-93dd-0dc008769013', '932acd80-04e9-4216-9fab-c3668fa1ed98',
    '2d5d1945-d3e0-4c3e-b4ef-af25c7cc9e07', '2bd58f73-340d-4fc0-82e2-7e6e150bc7c9',
    'b98f72b4-7cf0-4ea2-96f1-af65e17f6ba9', '268dcb15-fb24-4ef1-9982-a2284cb48f6c',
    '605352a0-6f44-4b22-b6d5-80196ea3adee', '57ae6f39-f1eb-416c-83b0-150eebd91f96',
    '83f93562-4355-467e-90ad-75d7afd473ef', 'cc5b6b33-0575-42a9-9595-fdae110f5a2d',
    'f15dc343-0f9c-497b-bd12-dd8bdb0a3e81', '79d6fc5f-04ef-4f0a-9c19-7cf0172fd659',
    '53b169e1-85d7-4359-ab9c-603fa5a78971', '6bcf0c08-0c17-4ba7-9831-56a84162a892',
    '3b89a507-184a-4d2e-ba15-8abee9141800', 'fc85cc32-8482-4112-bcf8-53f97681485c',
    '7b80f143-e298-4917-9c62-c840a2fe1d9b', '678a149d-0b0e-4d18-9b87-6b4fbcef0ec3',
    'cc460ae8-a78e-4054-b76f-3e03a9ff5762', '86af3a51-44cd-4a06-bb11-23c4aa12bc10',
    'bbe40c4e-b12b-498f-b82e-a9c666c16c2d', '29d04d56-d2ae-4367-b2ee-cccdd93a92b0',
    '517b1422-7fbd-49c1-8028-07d56435351f', '0bf85d03-7166-4a26-a215-e1503f6416e5',
    'fa0afe90-9649-4b4f-bd57-33a81ce81ac8', 'e8b8a5ac-9ee4-481c-aa24-2c88f8780179',
    'dd5299ed-ec5f-43ff-bd76-7edaf2e00276', '957601f5-d2a5-4aae-9608-bda7796b7f1d',
    'aa61e207-934f-4741-9dd1-b4c58928dac8', '284a16b2-c841-4d3c-a537-a94f44842621',
    'e54d81a7-42d7-4de3-bdd4-3400202b6dca', '16b87105-6d16-41f4-958b-95c90145a3e2',
    '3fd0bc2e-dd4b-4912-a4a1-44cddc4a5edf', 'a9f86e26-a2da-49bd-9df3-98737b382d19',
    '4bf786c2-b951-4802-9ef4-ecb680766cde', '73632bed-027c-41dd-9bc7-711cb2824b49',
    '2fa03c30-7f9b-4b7d-8a9b-1a61b0cb0c92', '43709d0a-3576-4049-bb37-3e6cb08e5ab5',
    '3790b459-5fa8-4613-b491-77f9011e550b', 'ecb52d83-45d3-4baf-a463-36c8a4746ccb',
    '7ead32e9-f6b0-4e0b-b1e7-dbcd4a758470', '7a64ad92-2b82-4641-9b02-d1c1934840c6',
    'd0a32268-27d7-4fa6-8991-e1f1a97b4ebc', '36b509a5-db3c-450b-8237-24df4cb7ce4c',
    'c2488379-f2c7-4781-9d5e-9eb0c92fd610', '7b138f00-ba02-411d-a937-cb851ad36f96'
   )
   AND topics @> ARRAY['youth-justice']::text[];

COMMIT;

-- Post-check:
--   SELECT count(*) FROM alma_interventions
--    WHERE serves_youth_justice = false AND topics @> ARRAY['youth-justice']::text[];
--   -- expect 30 (94 - 64), being the rows the classifier could not confidently judge
--   --  plus the one it confirmed
