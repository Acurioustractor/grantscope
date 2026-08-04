-- ============================================================================
-- STAGED - NOT APPLIED. Tier 3 (day-shift). Power map move A1-residue, STEP 2 of 2.
-- WRITES to justice_funding + political_donations. Run STEP 1 FIRST and inspect
-- the _a1_* tables before running this.
--
-- Safety properties:
--   - Only fills rows whose abn is currently NULL/empty (never overwrites).
--   - Reads exclusively from the _a1_* staging tables (which hold unambiguous,
--     quality-checked resolutions only).
--   - Wrapped in a single transaction. If the post-apply counts look wrong,
--     the whole thing can be rolled back (run inside a manual BEGIN; ... ROLLBACK
--     if you want a trial; as written it COMMITs).
--
-- APPLY:
--   source .env && PGPASSWORD="$DATABASE_PASSWORD" psql \
--     -h aws-0-ap-southeast-2.pooler.supabase.com -p 5432 \
--     -U "postgres.tednluwflfhxyucgwigh" -d postgres \
--     -f thoughts/shared/power-map/staged-sql/2026-06-20_power_a1_backfill_STEP2_apply.sql
-- ============================================================================

BEGIN;

-- guard: refuse to run if STEP 1 was not run
DO $$
BEGIN
    IF to_regclass('public._a1_jf_resolved') IS NULL
       OR to_regclass('public._a1_pd_resolved') IS NULL THEN
        RAISE EXCEPTION 'Staging tables missing - run STEP 1 first.';
    END IF;
END $$;

-- 1. justice_funding: backfill recipient_abn
UPDATE justice_funding jf
SET recipient_abn = r.resolved_abn
FROM _a1_jf_resolved r
WHERE jf.id = r.jf_id
  AND (jf.recipient_abn IS NULL OR jf.recipient_abn = '');

-- 2. justice_funding: backfill gs_entity_id where the resolved ABN maps to a
--    single gs_entities row (staged in STEP 1)
UPDATE justice_funding jf
SET gs_entity_id = r.gs_entity_id
FROM _a1_jf_resolved r
WHERE jf.id = r.jf_id
  AND r.gs_entity_id IS NOT NULL
  AND jf.gs_entity_id IS NULL;

-- 3. political_donations: backfill donor_abn
--    Scope B (chosen 2026-06-20): company/org donors only - exclude individual
--    (IND) matches, which carry the most name-collision risk on an unverified
--    matcher. IS DISTINCT FROM keeps null-type and org/trust types, drops IND.
UPDATE political_donations pd
SET donor_abn = r.matched_abn
FROM _a1_pd_resolved r
WHERE pd.id = r.pd_id
  AND (pd.donor_abn IS NULL OR pd.donor_abn = '')
  AND r.entity_type_code IS DISTINCT FROM 'IND';

-- ---- post-apply report ------------------------------------------------------
\echo '--- justice_funding null recipient_abn remaining (should drop by ~7,471) ---'
SELECT count(*) FILTER (WHERE recipient_abn IS NULL OR recipient_abn = '') AS still_null,
       count(*) FILTER (WHERE gs_entity_id IS NOT NULL) AS with_gs_entity_id
FROM justice_funding;

\echo '--- political_donations null donor_abn remaining ---'
SELECT count(*) FILTER (WHERE donor_abn IS NULL OR donor_abn = '') AS still_null
FROM political_donations;

COMMIT;

-- After verifying, the staging tables can be dropped:
--   DROP TABLE IF EXISTS _a1_jf_resolved, _a1_pd_resolved;
-- Then refresh the power index so the recovered rows enter it:
--   node --env-file=.env scripts/refresh-views-v2.mjs   (or just mv_entity_power_index + deps)
