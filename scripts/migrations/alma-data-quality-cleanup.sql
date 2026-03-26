-- ALMA Data Quality Cleanup
-- 2026-03-27
--
-- 1. Quarantine junk interventions (scraped pages, homepages, stats pages, malformed)
-- 2. Delete synthetic outcome links (40K cartesian product)
-- 3. Deduplicate outcomes (128 duplicates → canonical set)
-- 4. ANALYZE for pg_stat freshness

BEGIN;

-- ============================================================
-- PART 1: Quarantine junk interventions
-- ============================================================

-- 1a. Scraped pages, podcasts, magazine content, ads
UPDATE alma_interventions
SET data_quality = 'quarantined'
WHERE data_quality = 'needs_review'
  AND (
    name ILIKE '%404%'
    OR name ILIKE '%page not found%'
    OR name ILIKE '%ABC listen%'
    OR name ILIKE '%podcast%'
    OR name ILIKE '%magazine%'
    OR name ILIKE '%advertise%'
    OR name ILIKE '%subscribe%'
    OR name ILIKE '%newsletter%'
    OR name ILIKE 'Blue and Green Illustration%'
  );

-- 1b. Website homepages (not interventions)
UPDATE alma_interventions
SET data_quality = 'quarantined'
WHERE data_quality = 'needs_review'
  AND (
    name ILIKE 'Home - %'
    OR name ILIKE 'Home |%'
    OR name ILIKE 'Home Page - %'
    OR name ILIKE 'Homepage |%'
    OR name ILIKE 'Oxfam Australia |%'
    OR name ILIKE 'Research | Australian Institute%'
    OR name ILIKE 'NATSILS | National%'
  );

-- 1c. AIHW/stats overview pages
UPDATE alma_interventions
SET data_quality = 'quarantined'
WHERE data_quality = 'needs_review'
  AND (
    name ILIKE '%Overview - Australian Institute of Health%'
    OR name ILIKE '%About - Australian Institute of Health%'
    OR name ILIKE 'Youth Justice System Statistics - ROGS%'
    OR name ILIKE 'Imprisonment Rates for Aboriginal%Sentencing Council'
    OR name ILIKE 'The facts about Australia%The Guardian'
    OR name ILIKE 'Deaths in Custody Crisis%Statistics'
  );

-- 1d. Malformed entries (blank/whitespace names, NSW Health fragment)
UPDATE alma_interventions
SET data_quality = 'quarantined'
WHERE data_quality = 'needs_review'
  AND (
    TRIM(name) = ''
    OR name IS NULL
    OR TRIM(name) ILIKE 'NSW Health'
    OR name = 'Document'
    OR name = 'J Burnett'
    OR name ILIKE 'Community - ACT Government'
  );

-- 1e. SA Native Title content (not interventions)
UPDATE alma_interventions
SET data_quality = 'quarantined'
WHERE data_quality = 'needs_review'
  AND name ILIKE '%SA Native Title%';

-- ============================================================
-- PART 2: Delete synthetic outcome links
-- ============================================================
-- The 40K intervention_outcomes were bulk-seeded as a cartesian product.
-- Evidence: 275+ interventions each linked to identical "community safety" outcomes.
-- 142 interventions have 100+ outcome links — not real data.
--
-- Strategy: delete links where an intervention has >20 outcomes (synthetic),
-- keep the 479 interventions with 1-20 outcomes (plausibly real).

DELETE FROM alma_intervention_outcomes
WHERE intervention_id IN (
  SELECT intervention_id
  FROM alma_intervention_outcomes
  GROUP BY intervention_id
  HAVING COUNT(*) > 20
);

-- ============================================================
-- PART 3: Deduplicate outcomes
-- ============================================================
-- 610 outcomes, 482 unique names, 128 duplicates.
-- Keep the earliest-created row per LOWER(TRIM(name)), redirect links.

-- 3a. Redirect intervention_outcomes to canonical outcome_id
UPDATE alma_intervention_outcomes aio
SET outcome_id = canonical.keep_id
FROM (
  SELECT id as dupe_id, FIRST_VALUE(id) OVER (
    PARTITION BY LOWER(TRIM(name))
    ORDER BY created_at ASC
  ) as keep_id
  FROM alma_outcomes
) canonical
WHERE aio.outcome_id = canonical.dupe_id
  AND canonical.dupe_id != canonical.keep_id;

-- 3b. Delete duplicate outcome rows
DELETE FROM alma_outcomes
WHERE id NOT IN (
  SELECT DISTINCT ON (LOWER(TRIM(name))) id
  FROM alma_outcomes
  ORDER BY LOWER(TRIM(name)), created_at ASC
);

-- ============================================================
-- PART 4: Refresh pg_stat estimates
-- ============================================================
ANALYZE alma_interventions;
ANALYZE alma_outcomes;
ANALYZE alma_intervention_outcomes;
ANALYZE alma_intervention_evidence;

COMMIT;
