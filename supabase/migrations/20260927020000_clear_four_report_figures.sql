-- Remove 4 values a model put in organisations' annual report facts that the report does not state, and put back
-- 2 annual report links cleared by mistake (JusticeHub, 2026-09-27).
--
-- JusticeHub's annual report reader saved what a model extracted from each report PDF with no check that the figure
-- was in the report. Checked on 2026-09-27 against the first 40,000 characters of each report (the text the model was
-- given; 12 of 14 PDFs matched by byte size), 4 of 297 saved values are stated nowhere in the report:
--   The Australia Institute  top_outcomes "82% of participants completed the program (n=156)": no such figure.
--   Cambodian Kids Foundation expenditure_aud 207817: not stated.
--   Duke of Edinburgh's Award staff_count 13: not stated.
--   Hundred School Project   people_served 148: the report says "up to 20" and "up to 128" students; 148 is the
--                            model's sum, and a maximum read as a count.
-- The reader now keeps only what the report contains (JusticeHub #519). Each removed value is also added to the
-- record's annual_report_facts.dropped_not_in_report list, the same place the fixed reader records what it refuses.
--
-- The 2 links: 20260927010000_clear_broken_report_links.sql cleared CREATE Foundation's and Hundred School Project's
-- report links as "not an annual report page". Both pages link to a real report PDF, which is where these facts came
-- from, so they are put back from organizations_broken_report_links_20260927, only where the link is still empty.
--
-- Backup: organizations_report_figures_cleared_20260927 (service role only). Stops unless exactly 4 values are
-- backed up and exactly 2 links restored. Asked for by Ben 2026-09-27 ("clear the four figures").
--
-- Apply AFTER this file is on main:
--   scripts/db-apply.sh supabase/migrations/20260927020000_clear_four_report_figures.sql
-- Undo (values): for each backup row, jsonb_set the value back at annual_report_facts.<field> (top_outcomes: append
--   old_value to the array), and remove the matching entry from dropped_not_in_report.
-- Undo (links): UPDATE organizations SET annual_report_url = NULL
--   WHERE id IN ('0ce96ca9-60fd-4c15-9cbf-3934d297bc7e','d248e9da-9dd7-4b5f-9737-03c339641a9f');

BEGIN;
SET LOCAL lock_timeout = '30s';

CREATE TABLE public.organizations_report_figures_cleared_20260927 AS
SELECT o.id, c.field, (o.acnc_data->'annual_report_facts'->c.field) AS old_value, c.why, now() AS cleared_at
  FROM (VALUES
  ('f8a0cd3c-6afd-4356-94f7-d476bc0fc907'::uuid, 'expenditure_aud', '207817'::jsonb, 'not stated in the report'),
  ('74470124-7936-4e25-98d6-f2761c0d176b'::uuid, 'staff_count',     '13'::jsonb,     'not stated in the report'),
  ('d248e9da-9dd7-4b5f-9737-03c339641a9f'::uuid, 'people_served',   '148'::jsonb,    'the report says up to 20 and up to 128; 148 is the model''s sum of two maximums')
  ) AS c(id, field, expected, why)
  JOIN organizations o ON o.id = c.id
   AND (CASE WHEN c.field = 'people_served' THEN o.acnc_data->'annual_report_facts'->'people_served'->'number'
             ELSE o.acnc_data->'annual_report_facts'->c.field END) = c.expected
UNION ALL
SELECT o.id, 'top_outcomes', to_jsonb('82% of participants completed the program (n=156)'::text),
       'no such figure anywhere in the report', now()
  FROM organizations o
 WHERE o.id = '6ba688f2-2102-4d22-b607-06db6a5d6dae'
   AND (o.acnc_data->'annual_report_facts'->'top_outcomes') @> to_jsonb(ARRAY['82% of participants completed the program (n=156)']);

DO $$
DECLARE n int;
BEGIN
  SELECT count(*) INTO n FROM organizations_report_figures_cleared_20260927;
  IF n <> 4 THEN RAISE EXCEPTION 'expected 4 unsupported values still in place, found %', n; END IF;
END $$;

ALTER TABLE public.organizations_report_figures_cleared_20260927 ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.organizations_report_figures_cleared_20260927 FROM anon, authenticated;
GRANT SELECT ON public.organizations_report_figures_cleared_20260927 TO service_role;

-- Scalar values and people_served: set to null, and record what was dropped.
UPDATE organizations o
   SET acnc_data = jsonb_set(
         jsonb_set(o.acnc_data, ARRAY['annual_report_facts', b.field], 'null'::jsonb),
         '{annual_report_facts,dropped_not_in_report}',
         coalesce(o.acnc_data->'annual_report_facts'->'dropped_not_in_report', '[]'::jsonb)
           || jsonb_build_array(jsonb_build_object('field', b.field, 'value', b.old_value, 'why', b.why, 'dropped_on', '2026-09-27')))
  FROM organizations_report_figures_cleared_20260927 b
 WHERE o.id = b.id AND b.field IN ('expenditure_aud', 'staff_count', 'people_served');

-- The outcome: remove that one element from the array, and record it.
UPDATE organizations o
   SET acnc_data = jsonb_set(
         jsonb_set(o.acnc_data, '{annual_report_facts,top_outcomes}',
           (SELECT coalesce(jsonb_agg(e), '[]'::jsonb)
              FROM jsonb_array_elements(o.acnc_data->'annual_report_facts'->'top_outcomes') e
             WHERE e <> b.old_value)),
         '{annual_report_facts,dropped_not_in_report}',
         coalesce(o.acnc_data->'annual_report_facts'->'dropped_not_in_report', '[]'::jsonb)
           || jsonb_build_array(jsonb_build_object('field', 'top_outcomes', 'value', b.old_value, 'why', b.why, 'dropped_on', '2026-09-27')))
  FROM organizations_report_figures_cleared_20260927 b
 WHERE o.id = b.id AND b.field = 'top_outcomes';

-- Put back the 2 links, only where still empty.
UPDATE organizations o SET annual_report_url = b.old_value
  FROM organizations_broken_report_links_20260927 b
 WHERE o.id = b.id
   AND o.id IN ('0ce96ca9-60fd-4c15-9cbf-3934d297bc7e', 'd248e9da-9dd7-4b5f-9737-03c339641a9f')
   AND o.annual_report_url IS NULL;

DO $$
DECLARE n int;
BEGIN
  SELECT count(*) INTO n FROM organizations
   WHERE id IN ('0ce96ca9-60fd-4c15-9cbf-3934d297bc7e', 'd248e9da-9dd7-4b5f-9737-03c339641a9f')
     AND annual_report_url IS NOT NULL;
  IF n <> 2 THEN RAISE EXCEPTION 'expected 2 report links restored, found %', n; END IF;
END $$;

COMMIT;
