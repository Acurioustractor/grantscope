-- STEP 2b - political_donations only (scope B: company/org donors, IND excluded).
-- This is the ~414K-row write that hung on lock contention before. lock_timeout
-- makes it FAIL FAST (20s) if political_donations is locked by another session,
-- instead of waiting forever and starving a pool slot. Reads _a1_pd_resolved.
-- Tier 3. If it errors with "canceling statement due to lock_timeout", something
-- else holds a lock on political_donations - check pg_locks, then retry.
BEGIN;
SET LOCAL lock_timeout = '20s';
SET LOCAL statement_timeout = '600s';

DO $$
BEGIN
    IF to_regclass('public._a1_pd_resolved') IS NULL THEN
        RAISE EXCEPTION 'Staging table _a1_pd_resolved missing - re-run STEP 1.';
    END IF;
END $$;

UPDATE political_donations pd
SET donor_abn = r.matched_abn
FROM _a1_pd_resolved r
WHERE pd.id = r.pd_id
  AND (pd.donor_abn IS NULL OR pd.donor_abn = '')
  AND r.entity_type_code IS DISTINCT FROM 'IND';

\echo '--- political_donations null donor_abn remaining ---'
SELECT count(*) FILTER (WHERE donor_abn IS NULL OR donor_abn = '') AS still_null FROM political_donations;

COMMIT;
