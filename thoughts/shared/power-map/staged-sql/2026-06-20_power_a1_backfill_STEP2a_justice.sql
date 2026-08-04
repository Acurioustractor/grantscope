-- STEP 2a - justice_funding only. Fast, proven (ran in seconds before the
-- donations step hung). Reads from _a1_jf_resolved (from STEP 1). Tier 3.
-- Fails fast on lock/slowness instead of hanging.
BEGIN;
SET LOCAL lock_timeout = '20s';
SET LOCAL statement_timeout = '120s';

DO $$
BEGIN
    IF to_regclass('public._a1_jf_resolved') IS NULL THEN
        RAISE EXCEPTION 'Staging table _a1_jf_resolved missing - re-run STEP 1.';
    END IF;
END $$;

UPDATE justice_funding jf
SET recipient_abn = r.resolved_abn
FROM _a1_jf_resolved r
WHERE jf.id = r.jf_id AND (jf.recipient_abn IS NULL OR jf.recipient_abn = '');

UPDATE justice_funding jf
SET gs_entity_id = r.gs_entity_id
FROM _a1_jf_resolved r
WHERE jf.id = r.jf_id AND r.gs_entity_id IS NOT NULL AND jf.gs_entity_id IS NULL;

\echo '--- justice_funding null recipient_abn remaining ---'
SELECT count(*) FILTER (WHERE recipient_abn IS NULL OR recipient_abn = '') AS still_null,
       count(*) FILTER (WHERE gs_entity_id IS NOT NULL) AS with_gs_entity_id
FROM justice_funding;

COMMIT;
