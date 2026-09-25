-- Gemini passed Ben's check: put its answers back, and apply Ben's two corrections.
--
-- 20260924235806 sent 1,131 funding opportunities back to review because the model that classified
-- them had never been measured. On 2026-09-25 Ben judged a random sample of 20 of the 1,109 answers
-- gemini-2.5-flash applied (each card quoted the grant's own page): 18 right, the same bar Jev met.
-- The sample and his marks: https://claude.ai/artifact/3uLbFLLy39y8WReJvNfva5. scripts/jev-gates.json
-- now lists gemini-2.5-flash as measured, so scripts/lib/classify-gate.mjs lets its answers apply.
--
-- What this does:
--   1. copies the current values of every row it changes to alma_funding_opportunities_gemini_restore_20260925;
--   2. restores Gemini's 670 rows from alma_funding_opportunities_unmeasured_20260925 (all 671 except #5,
--      which Ben corrected), only where the row is still exactly as 20260924235806 left it;
--   3. #5 CHSP Emergency and Critical Need (fcccd280): Gemini said open_grant, Ben says invitation_only;
--      #4 City of Greater Geraldton events (ed6ab727): Gemini said invitation_only, Ben says open_grant;
--   4. notes on the 18 Ben marked right that he confirmed them.
-- The other models' 460 rows stay in review. Stops unless the counts are exactly as measured.
--
-- Asked for by Ben 2026-09-25 ("gemini marked", then "restore gemini").
--
-- Apply AFTER this file is on main (.claude/skills/db-apply/SKILL.md step 5):
--   scripts/db-apply.sh supabase/migrations/20260925003950_gemini_measured_restore_its_answers.sql
-- Undo: UPDATE alma_funding_opportunities o SET opportunity_type = b.opportunity_type,
--         verification_status = b.verification_status, verified_at = b.verified_at,
--         verification_notes = b.verification_notes
--       FROM alma_funding_opportunities_gemini_restore_20260925 b WHERE o.id = b.id;

BEGIN;
SET LOCAL lock_timeout = '30s';

CREATE TEMP TABLE gemini_restore ON COMMIT DROP AS
SELECT b.*
  FROM alma_funding_opportunities_unmeasured_20260925 b
  JOIN alma_funding_opportunities o ON o.id = b.id
 WHERE b.auto_classify_model = 'gemini-2.5-flash'
   AND b.id <> 'fcccd280-875d-4cd1-be4a-45ecde87841c'
   AND o.verification_status = 'unverified'
   AND o.verification_notes LIKE '[2026-09-25: classified by gemini-2.5-flash, a model Ben has not measured; back to review]%';

CREATE TEMP TABLE ben_right ON COMMIT DROP AS
SELECT unnest(ARRAY[
  'd92b6c31-be83-4733-8e2f-4b81214178e4',
  '54ab78d8-92db-4fd0-9455-2d06168560d2',
  '740abf8b-ddc1-4d27-bf11-9769e8892868',
  '31502dab-aee4-4b7b-80f0-a2fdd14643d8',
  'd3df3c87-40a7-4589-ace4-42ea5c120b67',
  '39d5fb44-bab7-4f9b-a727-6951bae4ebc4',
  '643a8c25-eab9-468f-931a-5bb1bdbcb29d',
  '0f8df761-8714-427d-b87c-26484e57e638',
  'cd9d09f6-c1b8-4082-bcbe-d7ac051ebb8a',
  '4a702846-5dda-43d7-ac6f-a9f9882e9931',
  '64566aed-fce2-45ae-bcf9-0e1b83574fdf',
  '02d93427-5cd2-4bba-9cae-5eed6fa95990',
  '8f0913ea-7768-41cb-8c4a-258396ec280b',
  'dd4ad7a7-8fad-4d08-bb73-fefc73254096',
  'd285dd4a-484d-463e-a27b-e31b6198be05',
  '8113dc71-0a27-440a-a86a-46963f02db1c',
  '077b1f84-3f78-4982-ac95-9fadf15f34f7',
  '6a772547-befc-4693-a468-1025e00213b9'
]::uuid[]) AS id;

DO $$
DECLARE n int; r int; c int;
BEGIN
  SELECT count(*) INTO n FROM gemini_restore;
  IF n <> 670 THEN RAISE EXCEPTION 'expected 670 Gemini rows to restore, found %', n; END IF;
  SELECT count(*) INTO r FROM alma_funding_opportunities WHERE id IN (SELECT id FROM ben_right);
  IF r <> 18 THEN RAISE EXCEPTION 'expected the 18 rows Ben marked right, found %', r; END IF;
  SELECT count(*) INTO c FROM alma_funding_opportunities
   WHERE (id = 'fcccd280-875d-4cd1-be4a-45ecde87841c' AND verification_status = 'unverified')
      OR (id = 'ed6ab727-1e47-47dc-8297-8cc79ff199ff' AND opportunity_type = 'invitation_only');
  IF c <> 2 THEN RAISE EXCEPTION 'the two corrected rows are not as measured (found %)', c; END IF;
END $$;

CREATE TABLE public.alma_funding_opportunities_gemini_restore_20260925 AS
SELECT id, opportunity_type, verification_status, verified_at, verification_notes, now() AS changed_at
  FROM alma_funding_opportunities
 WHERE id IN (SELECT id FROM gemini_restore)
    OR id IN (SELECT id FROM ben_right)
    OR id IN ('fcccd280-875d-4cd1-be4a-45ecde87841c', 'ed6ab727-1e47-47dc-8297-8cc79ff199ff');
ALTER TABLE public.alma_funding_opportunities_gemini_restore_20260925 ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.alma_funding_opportunities_gemini_restore_20260925 FROM anon, authenticated;
GRANT SELECT ON public.alma_funding_opportunities_gemini_restore_20260925 TO service_role;

UPDATE alma_funding_opportunities o
   SET opportunity_type = g.opportunity_type,
       verification_status = g.verification_status,
       verified_at = g.verified_at,
       verification_notes = g.verification_notes
  FROM gemini_restore g
 WHERE o.id = g.id;

UPDATE alma_funding_opportunities
   SET opportunity_type = 'invitation_only', verification_status = 'placeholder', verified_at = NULL,
       verification_notes = '[Ben, 2026-09-25, Gemini sample #5: invitation only, not an open grant] '
                            || coalesce(verification_notes, '')
 WHERE id = 'fcccd280-875d-4cd1-be4a-45ecde87841c';

UPDATE alma_funding_opportunities
   SET opportunity_type = 'open_grant', verification_status = 'verified', verified_at = now(),
       verification_notes = '[Ben, 2026-09-25, Gemini sample #4: an open grant, not invitation only] '
                            || coalesce(verification_notes, '')
 WHERE id = 'ed6ab727-1e47-47dc-8297-8cc79ff199ff';

UPDATE alma_funding_opportunities
   SET verification_notes = '[Ben, 2026-09-25, Gemini sample: label confirmed] ' || coalesce(verification_notes, '')
 WHERE id IN (SELECT id FROM ben_right);

COMMIT;
