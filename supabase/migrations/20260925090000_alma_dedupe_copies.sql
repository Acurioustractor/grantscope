-- Remove the duplicate copies in alma_funding_opportunities.
--
-- Why: promote-grant-opportunities-to-alma.mjs and promote-foundation-programs-to-alma.mjs built their
-- dedupe index from one unpaged select, so it held 1,000 of ~23,700 keys and every nightly run
-- re-inserted rounds it already had. Fixed in #522 (loadAlmaIndex pages). Measured 2026-09-25:
-- 23,705 rows, 3,300 distinct (lower(trim(name)), lower(trim(funder_name))) keys, 20,405 extra copies,
-- up to 37 copies of one round. Every ALMA-derived count (act_grant_recommendations, triage) is inflated.
--
-- Which copy survives, per key: the one most linked from act_grant_recommendation_decisions and
-- act_opportunity_benchmark_cases, then a verified one, then the oldest, then the lowest id.
-- Measured under that rule: 0 decisions sit on a dropped copy (all 89 stay where they are), 13
-- benchmark cases do. 11 of those repeat a case the kept copy already has (same benchmark_version and
-- project_code) and are dropped; the rest move to the kept copy. No other child table has a link on a
-- duplicated row (checked across all 12 FKs), so the cascades below delete nothing that matters.
--
-- Nothing fires on DELETE (the four triggers are INSERT/UPDATE only). act_grant_recommendations is a
-- matview over ALMA ids: it shrinks at its next scheduled refresh; not refreshed here.
--
-- Apply: scripts/db-apply.sh supabase/migrations/20260925090000_alma_dedupe_copies.sql  (Tier 3, Ben's verb)

BEGIN;

CREATE TEMP TABLE alma_dedupe_plan ON COMMIT DROP AS
WITH refs AS (
  SELECT opportunity_id AS id, count(*) AS c FROM (
    SELECT opportunity_id FROM act_grant_recommendation_decisions
    UNION ALL SELECT opportunity_id FROM act_opportunity_benchmark_cases
  ) x GROUP BY 1
), g AS (
  SELECT a.id,
         first_value(a.id) OVER (
           PARTITION BY lower(trim(a.name)), lower(trim(coalesce(a.funder_name, '')))
           ORDER BY coalesce(r.c, 0) DESC, (a.verification_status = 'verified') DESC, a.created_at ASC, a.id
         ) AS keep_id
  FROM alma_funding_opportunities a
  LEFT JOIN refs r ON r.id = a.id
)
SELECT id, keep_id FROM g WHERE id <> keep_id;

-- Guard: the plan must match what was measured, or stop.
DO $$
DECLARE n int;
BEGIN
  SELECT count(*) INTO n FROM alma_dedupe_plan;
  IF n < 19000 OR n > 21500 THEN
    RAISE EXCEPTION 'alma dedupe plan has % rows to drop; measured 20,405 on 2026-09-25. Re-measure before applying.', n;
  END IF;
  IF EXISTS (SELECT 1 FROM act_grant_recommendation_decisions d JOIN alma_dedupe_plan p ON p.id = d.opportunity_id) THEN
    RAISE EXCEPTION 'a grant decision sits on a copy that would be dropped; the keeper rule no longer holds.';
  END IF;
END $$;

-- Benchmark cases on dropped copies: keep one per (kept grant, benchmark_version, project_code),
-- preferring the case already on the kept copy, then drop the repeats and move the rest.
WITH c AS (
  SELECT b.id, coalesce(p.keep_id, b.opportunity_id) AS target,
         row_number() OVER (
           PARTITION BY coalesce(p.keep_id, b.opportunity_id), b.benchmark_version, b.project_code
           ORDER BY (p.id IS NULL) DESC, b.id
         ) AS rn
  FROM act_opportunity_benchmark_cases b
  LEFT JOIN alma_dedupe_plan p ON p.id = b.opportunity_id
  WHERE b.opportunity_id IN (SELECT id FROM alma_dedupe_plan UNION SELECT keep_id FROM alma_dedupe_plan)
)
DELETE FROM act_opportunity_benchmark_cases b USING c WHERE b.id = c.id AND c.rn > 1;

UPDATE act_opportunity_benchmark_cases b
SET opportunity_id = p.keep_id
FROM alma_dedupe_plan p
WHERE b.opportunity_id = p.id;

DELETE FROM alma_funding_opportunities a
USING alma_dedupe_plan p
WHERE a.id = p.id;

-- Post-check: one row per key.
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM alma_funding_opportunities
    GROUP BY lower(trim(name)), lower(trim(coalesce(funder_name, ''))) HAVING count(*) > 1
  ) THEN
    RAISE EXCEPTION 'duplicates remain after the dedupe';
  END IF;
END $$;

COMMIT;
