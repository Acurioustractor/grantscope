-- Send the 1,131 funding opportunities that an unmeasured model marked 'verified' back to review.
--
-- scripts/auto-classify-llm.mjs applied a model's classification whenever it was 0.7 confident. Only
-- Jev had to pass Ben's check first (20 answers judged, 18 right, scripts/jev-gates.json). Every other
-- model applied its own answer, and for an open grant that meant verification_status = 'verified',
-- which GrantScope counts as a real open grant. Measured 2026-09-25, rows still 'verified' from a
-- model other than the measured jev-1.13.0: gemini-2.5-flash 671, claude-haiku-4-5 301, gpt-oss:20b 95,
-- openai/gpt-oss-120b 36, llama-3.3-70b 17, llama-3.1-8b 11. Of the 1,131, 463 carry only the
-- classifier's note and 668 were touched later by the automated link checker ("Auto-check: refresh
-- at ..."); none carries a person's triage note ("[email] ..."). The script now gates every model
-- (scripts/lib/classify-gate.mjs); this undoes what unmeasured models already applied.
--
-- What this does: copies id, opportunity_type, verification_status, verified_at and
-- verification_notes to alma_funding_opportunities_unmeasured_20260925, then sets opportunity_type
-- and verification_status to 'unverified', clears verified_at, and prefixes the note. The model's
-- answer stays in auto_classify_* for the triage page. Jev's 110 rows are untouched. Stops unless the
-- count is exactly 1,131 and none has a person's note.
--
-- Asked for by Ben 2026-09-25 ("gate every model").
--
-- Apply AFTER this file is on main (.claude/skills/db-apply/SKILL.md step 5):
--   scripts/db-apply.sh supabase/migrations/20260924235806_unmeasured_model_verdicts_back_to_review.sql
-- Undo: UPDATE alma_funding_opportunities o SET opportunity_type = b.opportunity_type,
--         verification_status = b.verification_status, verified_at = b.verified_at,
--         verification_notes = b.verification_notes
--       FROM alma_funding_opportunities_unmeasured_20260925 b WHERE o.id = b.id;

BEGIN;
SET LOCAL lock_timeout = '30s';

CREATE TABLE public.alma_funding_opportunities_unmeasured_20260925 AS
SELECT id, auto_classify_model, opportunity_type, verification_status, verified_at, verification_notes,
       now() AS sent_back_at
  FROM alma_funding_opportunities
 WHERE verification_status = 'verified'
   AND auto_classify_model IS NOT NULL
   AND auto_classify_model <> 'jev-1.13.0';

DO $$
DECLARE n int; person int;
BEGIN
  SELECT count(*) INTO n FROM alma_funding_opportunities_unmeasured_20260925;
  IF n <> 1131 THEN
    RAISE EXCEPTION 'expected 1,131 rows verified by an unmeasured model, found %', n;
  END IF;
  SELECT count(*) INTO person FROM alma_funding_opportunities_unmeasured_20260925
   WHERE verification_notes ~ '^\[[^]]*@[^]]*\]';
  IF person <> 0 THEN
    RAISE EXCEPTION '% of these carry a person''s triage note; not sending them back', person;
  END IF;
END $$;

ALTER TABLE public.alma_funding_opportunities_unmeasured_20260925 ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.alma_funding_opportunities_unmeasured_20260925 FROM anon, authenticated;
GRANT SELECT ON public.alma_funding_opportunities_unmeasured_20260925 TO service_role;

UPDATE alma_funding_opportunities o
   SET opportunity_type = 'unverified',
       verification_status = 'unverified',
       verified_at = NULL,
       verification_notes = '[2026-09-25: classified by ' || b.auto_classify_model
                            || ', a model Ben has not measured; back to review] '
                            || coalesce(b.verification_notes, ''),
       updated_at = now()
  FROM alma_funding_opportunities_unmeasured_20260925 b
 WHERE o.id = b.id;

COMMIT;
