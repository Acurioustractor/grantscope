-- 20260905190000_grant_names_are_titles_not_abstracts.sql
-- 8,343 of 26,698 grant names are longer than 120 characters because the ingest put the whole abstract in the name
-- field: 5,598 from arc-grants, 1,878 from brisbane-grants, 734 from Lotterywest. Every surface that lists a grant
-- shows an abstract where a title belongs, including mv_search_index (7,418 of its rows).
--
-- The shape is "Title. Abstract...", so the title is the first sentence. Measured before writing:
--   5,758 of the 8,343 split cleanly at a sentence boundary (10-200 chars, ending . ! or ?, followed by a capital)
--   resulting titles run 12 to 197 characters, median 69
--   5,678 of those already have the remaining text in `description`; 54 rows have no description at all
--   0 of the new names collide with an existing row on (source, name) or on (name, source_id)
--   4 rows would collide with EACH OTHER (two pairs sharing a first sentence) and are excluded
-- The other 2,585 long names have no clean sentence boundary and are left exactly as they are.
--
-- NOTHING IS LOST AND IT IS REVERSIBLE: the full original goes to metadata->>'original_name', and a row that had no
-- description gets the original text as its description. The rollback is at the bottom of this file.
--
-- Renaming rows in this table is not cosmetic: two of its three unique indexes are on name, which is why the
-- collision checks above are in the WHERE clause and not just in the header.

BEGIN;

WITH candidate AS (
  SELECT id, source, source_id, name, description,
         regexp_replace(trim(substring(name from '^(.{10,200}?[.!?])\s+[A-Z"]')), '\.$', '') AS new_name
  FROM public.grant_opportunities
  WHERE length(name) > 120
),
shared_new_name AS (
  SELECT source, new_name FROM candidate
  WHERE new_name IS NOT NULL GROUP BY source, new_name HAVING count(*) > 1
),
usable AS (
  SELECT c.* FROM candidate c
  WHERE c.new_name IS NOT NULL
    AND length(c.new_name) >= 10
    AND c.new_name <> c.name
    AND NOT EXISTS (SELECT 1 FROM shared_new_name s WHERE s.source IS NOT DISTINCT FROM c.source AND s.new_name = c.new_name)
    AND NOT EXISTS (SELECT 1 FROM public.grant_opportunities g
                    WHERE g.id <> c.id AND g.name = c.new_name AND g.source IS NOT DISTINCT FROM c.source)
    AND NOT EXISTS (SELECT 1 FROM public.grant_opportunities g
                    WHERE g.id <> c.id AND g.name = c.new_name AND g.source_id IS NOT DISTINCT FROM c.source_id)
)
UPDATE public.grant_opportunities g
SET name = u.new_name,
    description = CASE WHEN g.description IS NULL OR trim(g.description) = '' THEN u.name ELSE g.description END,
    metadata = coalesce(g.metadata, '{}'::jsonb)
               || jsonb_build_object('original_name', u.name, 'name_trimmed_at', now()),
    updated_at = now()
FROM usable u
WHERE g.id = u.id;

COMMIT;

-- Post-check:
--   SELECT count(*) FROM grant_opportunities WHERE metadata ? 'original_name';          -- rows changed
--   SELECT count(*) FROM grant_opportunities WHERE length(name) > 120;                  -- what is left, all unsplittable
--   SELECT count(*) FROM grant_opportunities WHERE metadata ? 'original_name' AND (description IS NULL OR trim(description) = '');  -- expect 0
--   REFRESH MATERIALIZED VIEW CONCURRENTLY mv_search_index;                             -- so search shows titles too
--
-- Rollback (nothing else has to be undone):
--   UPDATE grant_opportunities SET name = metadata->>'original_name',
--          metadata = metadata - 'original_name' - 'name_trimmed_at'
--   WHERE metadata ? 'original_name';
