-- One read path for ALMA interventions that honours the quarantine flag.
--
-- 242 rows carry data_quality = 'quarantined', but 51 of the 53 app files that
-- read alma_interventions never check it: /api/justice/interventions served 55
-- junk rows in 500 and the public Alice Springs report showed 2 in 29. Adding
-- the predicate at ~60 call sites would be forgotten by the next one, so readers
-- go through this view instead, and apps/web/src/lib/alma-readers.test.ts fails CI when
-- app code reads the raw table outside its allowlist (row counts, schema docs).
--
-- Also quarantines 10 rows still marked 'valid' that are scraped homepages
-- (name or description is page chrome: "Skip to main", image markdown, a
-- leading heading). Found by the page-furniture regex in
-- thoughts/shared/findings/alma-interventions-off-domain-2026-09-21.md.
--
-- NULL data_quality counts as valid (the column defaults to 'valid'); only an
-- explicit quarantine hides a row.
--
-- Apply AFTER this file is on main (.claude/skills/db-apply/SKILL.md step 5),
-- and BEFORE the reader change merges, or every ALMA reader 404s on the view:
--   scripts/db-apply.sh supabase/migrations/20260922120000_alma_interventions_valid_view.sql

BEGIN;

UPDATE alma_interventions SET data_quality = 'quarantined'
WHERE id IN (
  'ebf65ec2-4f8c-4707-aaa0-2980250c4ea1', -- Aboriginal Legal Rights Movement homepage
  '4b7af505-d4cb-4a5d-a6cc-b8823506817e', -- Legal Aid NSW homepage
  '1604ee52-6a4c-4c3a-af15-055952c04925', -- Mission Australia homepage
  'd9a02e03-7ae8-4ead-969f-9096fc4ce2dc', -- DJCS Victoria page
  'a934545d-6bd8-45d9-a397-407468abb704', -- NSW Communities and Justice homepage
  '162c59cd-5128-4ee3-9861-cbeff74b6445', -- Human Rights Law Centre homepage
  '9d528b0c-da3d-497c-898b-1b949dfbd970', -- Aboriginal Legal Service homepage
  '43bf2e72-6612-4dd5-93bf-3d744b30fd4e', -- NSW Health homepage
  'a27a74a9-b77f-45a6-a8a4-91d2fe9a52c1', -- Mission Australia services page
  '990483b7-30a3-430c-bc9d-2b9cd26fd3b9'  -- Youthlaw homepage
) AND data_quality IS DISTINCT FROM 'quarantined';

CREATE OR REPLACE VIEW alma_interventions_valid
WITH (security_invoker = true) AS
SELECT * FROM alma_interventions
WHERE data_quality IS DISTINCT FROM 'quarantined';

COMMENT ON VIEW alma_interventions_valid IS
  'alma_interventions minus quarantined rows. The read path for every app surface; see apps/web/src/lib/alma-readers.test.ts.';

REVOKE ALL ON alma_interventions_valid FROM anon, authenticated;
GRANT SELECT ON alma_interventions_valid TO anon, authenticated, service_role;

COMMIT;
