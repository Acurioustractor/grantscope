-- Take the 27 cases and 6 campaigns a model wrote from web pages off the public Justice Matrix, and
-- put them back in the review queue for a person.
--
-- JusticeHub's auto-publish cron promoted staged discoveries into justice_matrix_cases and
-- justice_matrix_campaigns with no review. Measured 2026-09-24: of the 292 cases it published, 259
-- came from JSON court databases (HUDOC, CourtListener, CURIA, CanLII, EDAL), mapped field by field
-- with no model. 27 cases and 6 campaigns came from sources with data_format = 'html', where a model
-- read the page and wrote the record. 15 of those 27 cases also carry facts or reasoning filled by the
-- facts-backfill cron, which told the model to "fall back to training knowledge" when a page was
-- empty. JusticeHub #503 stops this happening again; this removes what already went out.
--
-- Checked before writing: none of the 33 is human_confirmed, and none has a linked row in
-- justice_matrix_case_campaigns, case_attestations, case_corrections or jm_external_ids (all four
-- cascade on delete). No triggers, no generated columns. The file re-checks all of that and stops.
--
-- What this does:
--   1. copies the rows, unchanged, to justice_matrix_cases_withheld_20260925 and
--      justice_matrix_campaigns_withheld_20260925, adding discovered_id, withheld_at, withheld_reason;
--   2. puts each discovery back to status 'pending' with approved_*_id cleared, so it appears in the
--      review queue at /admin/justice-matrix/discoveries, where a person approves or rejects it
--      (auto-publish no longer promotes html-source discoveries, JusticeHub #503);
--   3. deletes the 33 live rows. Every public read, search function and export stops finding them.
--
-- Asked for by Ben 2026-09-25 ("hide the 33").
--
-- Apply AFTER this file is on main (.claude/skills/db-apply/SKILL.md step 5):
--   scripts/db-apply.sh supabase/migrations/20260924210554_withhold_model_written_matrix_records.sql
-- Undo, per table: INSERT INTO justice_matrix_cases (<its columns>) SELECT <those columns> FROM
--   justice_matrix_cases_withheld_20260925; then for each row
--   UPDATE justice_matrix_discovered SET approved_case_id = <id>, status = 'approved' WHERE id = discovered_id.
--   Same for campaigns (approved_campaign_id).

BEGIN;
SET LOCAL lock_timeout = '30s';

CREATE TEMP TABLE withhold_cases ON COMMIT DROP AS
SELECT d.id AS discovered_id, d.approved_case_id AS case_id
  FROM justice_matrix_discovered d
  JOIN justice_matrix_sources s ON s.id = d.source_id
 WHERE s.data_format = 'html' AND d.approved_case_id IS NOT NULL;

CREATE TEMP TABLE withhold_campaigns ON COMMIT DROP AS
SELECT d.id AS discovered_id, d.approved_campaign_id AS campaign_id
  FROM justice_matrix_discovered d
  JOIN justice_matrix_sources s ON s.id = d.source_id
 WHERE s.data_format = 'html' AND d.approved_campaign_id IS NOT NULL;

DO $$
DECLARE nc int; np int; nh int; ndep int;
BEGIN
  SELECT count(*) INTO nc FROM withhold_cases;
  SELECT count(*) INTO np FROM withhold_campaigns;
  IF nc <> 27 OR np <> 6 THEN
    RAISE EXCEPTION 'expected 27 cases and 6 campaigns, found % and %', nc, np;
  END IF;
  SELECT count(*) INTO nh FROM justice_matrix_cases
   WHERE id IN (SELECT case_id FROM withhold_cases) AND human_confirmed;
  IF nh <> 0 THEN
    RAISE EXCEPTION '% of these cases were confirmed by a person; not withholding', nh;
  END IF;
  SELECT (SELECT count(*) FROM justice_matrix_case_campaigns
           WHERE case_id IN (SELECT case_id FROM withhold_cases)
              OR campaign_id IN (SELECT campaign_id FROM withhold_campaigns))
       + (SELECT count(*) FROM case_attestations WHERE case_id IN (SELECT case_id FROM withhold_cases))
       + (SELECT count(*) FROM case_corrections WHERE case_id IN (SELECT case_id FROM withhold_cases))
       + (SELECT count(*) FROM jm_external_ids WHERE record_id IN (SELECT case_id FROM withhold_cases))
    INTO ndep;
  IF ndep <> 0 THEN
    RAISE EXCEPTION '% linked rows would cascade away with these records; archive them first', ndep;
  END IF;
END $$;

CREATE TABLE public.justice_matrix_cases_withheld_20260925 AS
SELECT c.*, w.discovered_id, now() AS withheld_at,
       'model-written from a web page and auto-published without review'::text AS withheld_reason
  FROM justice_matrix_cases c
  JOIN withhold_cases w ON w.case_id = c.id;

CREATE TABLE public.justice_matrix_campaigns_withheld_20260925 AS
SELECT p.*, w.discovered_id, now() AS withheld_at,
       'model-written from a web page and auto-published without review'::text AS withheld_reason
  FROM justice_matrix_campaigns p
  JOIN withhold_campaigns w ON w.campaign_id = p.id;

ALTER TABLE public.justice_matrix_cases_withheld_20260925 ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.justice_matrix_campaigns_withheld_20260925 ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.justice_matrix_cases_withheld_20260925 FROM anon, authenticated;
REVOKE ALL ON public.justice_matrix_campaigns_withheld_20260925 FROM anon, authenticated;
GRANT SELECT ON public.justice_matrix_cases_withheld_20260925 TO service_role;
GRANT SELECT ON public.justice_matrix_campaigns_withheld_20260925 TO service_role;

UPDATE justice_matrix_discovered d
   SET approved_case_id = NULL,
       status = 'pending',
       reviewed_at = NULL,
       review_notes = 'withheld 2026-09-25: a model wrote this from a web page and it went live unreviewed; '
                      || 'waiting for a person. Was: ' || coalesce(d.review_notes, '')
  FROM withhold_cases w
 WHERE d.id = w.discovered_id;

UPDATE justice_matrix_discovered d
   SET approved_campaign_id = NULL,
       status = 'pending',
       reviewed_at = NULL,
       review_notes = 'withheld 2026-09-25: a model wrote this from a web page and it went live unreviewed; '
                      || 'waiting for a person. Was: ' || coalesce(d.review_notes, '')
  FROM withhold_campaigns w
 WHERE d.id = w.discovered_id;

DELETE FROM justice_matrix_cases WHERE id IN (SELECT case_id FROM withhold_cases);
DELETE FROM justice_matrix_campaigns WHERE id IN (SELECT campaign_id FROM withhold_campaigns);

COMMIT;
