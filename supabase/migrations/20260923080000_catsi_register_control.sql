-- Community control by the CATSI register, not by judgement.
--
-- The community money finder's "money held in your name" (step 2) reported 93% of the $4.02bn
-- delivered in the NT as "not yet judged", including Central Australian Aboriginal Congress,
-- Miwatj Health, Mala'la, Katherine West and Tangentyere. None of them was a Jev failure: the
-- classifier's population is driven by acnc_ais, and these corporations are on the ACNC register
-- but have filed no Annual Information Statement since 2022, so Jev never saw them.
--
-- For an Aboriginal and Torres Strait Islander corporation the question does not need judging.
-- Registration under the Corporations (Aboriginal and Torres Strait Islander) Act 2006 requires a
-- majority of members to be Aboriginal or Torres Strait Islander people. That is a rule, so it
-- belongs in SQL, which is also cheaper and does not drift: 104 of the NT holders, $2.354bn, are
-- currently registered ORIC corporations.
--
-- Safe against what Jev already decided: of the 1,294 ACNC-registered ORIC corporations, Jev had
-- confidently called 64 community_controlled (agreeing) and disagreed with none. The only four
-- non-matching rows are 'cannot_tell' at 0.15 to 0.49 confidence, which this replaces.
--
-- Provenance is kept separate. model = 'rule:catsi-register' so a rule is never mistaken for a
-- judgement, and re-running the classifier must not overwrite it.
--
-- Apply: scripts/db-apply.sh supabase/migrations/20260923080000_catsi_register_control.sql

BEGIN;

CREATE TEMP TABLE catsi_abns ON COMMIT DROP AS
SELECT DISTINCT o.abn
  FROM oric_corporations o
  JOIN acnc_charities c ON c.abn = o.abn
 WHERE o.abn IS NOT NULL
   AND o.abn <> ''
   AND o.status ILIKE '%regist%'
   AND o.deregistered_on IS NULL;

-- Never overwrite a confident Jev judgement; the register only fills gaps and replaces uncertainty.
INSERT INTO gs_charity_classification (abn, control, control_conf, model, classified_at)
SELECT a.abn, 'community_controlled', 1.0, 'rule:catsi-register', now()
  FROM catsi_abns a
ON CONFLICT (abn) DO UPDATE
   SET control       = 'community_controlled',
       control_conf  = 1.0,
       model         = CASE
                         WHEN gs_charity_classification.model IS NULL
                           OR gs_charity_classification.model = 'rule:catsi-register'
                         THEN 'rule:catsi-register'
                         ELSE gs_charity_classification.model || '+rule:catsi-register'
                       END,
       classified_at = now()
 WHERE gs_charity_classification.control IS DISTINCT FROM 'community_controlled'
    OR gs_charity_classification.control_conf IS DISTINCT FROM 1.0;

COMMIT;
