-- Slice 8: owner_app — proposed from measured code references, confirmed by a human.
-- Apply: source .env && PGPASSWORD="$DATABASE_PASSWORD" psql -h aws-0-ap-southeast-2.pooler.supabase.com -p 5432 -U "postgres.tednluwflfhxyucgwigh" -d postgres -f migrations/2026-08-16-clarity-owner-app.sql
--
-- owner_app was 'neither' on all 1,479 — in a Supabase project shared by CivicGraph and
-- JusticeHub, the catalogue could not say which product owns a single object. The slice 6b
-- scanner is now repo-aware (clarity_code_ref.repo: civicgraph | justicehub), so ownership is a
-- MEASUREMENT: which codebase actually touches the object.
--
-- Rule: app + script references only. Migration references are excluded from the ownership
-- signal on purpose — migrations manage the shared database and prove custody of the schema,
-- not ownership of the thing. Both repos touch it → 'both'.
--
-- Same discipline as nouns: the rule PROPOSES (owner_app_proposed), a human CONFIRMS (the only
-- writer of owner_app != 'neither', via /api/clarity/owners, singly or en masse), and the
-- confirmation is stamped (owner_source, owner_set_by, owner_set_at).

BEGIN;

ALTER TABLE clarity_object
  ADD COLUMN IF NOT EXISTS owner_app_proposed text
    CHECK (owner_app_proposed IN ('civicgraph', 'justicehub', 'both')),
  ADD COLUMN IF NOT EXISTS owner_source text
    CHECK (owner_source IN ('code_refs_rule', 'human')),
  ADD COLUMN IF NOT EXISTS owner_set_by text,
  ADD COLUMN IF NOT EXISTS owner_set_at timestamptz;

WITH refs AS (
  SELECT object_key,
         count(*) FILTER (WHERE repo = 'civicgraph') AS cg,
         count(*) FILTER (WHERE repo = 'justicehub') AS jh
    FROM clarity_code_ref
   WHERE ref_class IN ('app', 'script')
   GROUP BY object_key
)
UPDATE clarity_object o
   SET owner_app_proposed = CASE
         WHEN r.cg > 0 AND r.jh > 0 THEN 'both'
         WHEN r.cg > 0 THEN 'civicgraph'
         WHEN r.jh > 0 THEN 'justicehub'
       END
  FROM refs r
 WHERE r.object_key = o.object_key
   AND (r.cg > 0 OR r.jh > 0);

-- The two-eyed scan invalidated some open orphan findings (an object JusticeHub reads is not an
-- orphan). A machine proposal that stopped being true and was never adjudicated is WITHDRAWN by
-- the machine — a human verdict, either way, is never touched.
DELETE FROM clarity_finding f
 WHERE f.detector = 'orphan'
   AND f.verdict IS NULL
   AND EXISTS (SELECT 1 FROM clarity_object o
                WHERE o.object_key = f.subject_object_key
                  AND (coalesce(o.refs_app, 0) > 0 OR coalesce(o.refs_script, 0) > 0
                       OR coalesce(o.refs_migration, 0) > 0));

-- The slice 2 column-scoped grant predates these columns; the owner write path needs them.
GRANT UPDATE (owner_app, owner_app_proposed, owner_source, owner_set_by, owner_set_at)
  ON clarity_object TO service_role;

COMMIT;
