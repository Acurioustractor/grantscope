-- link-donation-abns-backfill.sql
-- Backfill donor_abn on political_donations where name matches gs_entities

BEGIN;

-- Phase 1: Exact name match (case-insensitive)
UPDATE political_donations pd
SET donor_abn = ge.abn
FROM gs_entities ge
WHERE lower(trim(pd.donor_name)) = lower(trim(ge.canonical_name))
  AND pd.donor_abn IS NULL
  AND ge.abn IS NOT NULL
  AND length(pd.donor_name) > 3;

COMMIT;
