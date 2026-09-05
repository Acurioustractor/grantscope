-- Link grant_opportunities to foundations via exact name match (case-insensitive)
-- Only updates rows where foundation_id is currently NULL
-- Expected: ~3,272 grants linked from ~199 matching providers
-- Safe + idempotent — can be re-run without side effects

UPDATE grant_opportunities go
SET foundation_id = f.id
FROM foundations f
WHERE go.foundation_id IS NULL
  AND lower(go.provider) = lower(f.name);
