-- Wave B: expand theme_keywords + catch more revenue streams + re-fuzzy match
-- 2026-05-22

BEGIN;

-- ─────────────────────────────────────────────────────────────────────
-- 1. Catch revenue streams my Wave A regex missed
-- ─────────────────────────────────────────────────────────────────────
UPDATE org_pipeline SET
  opportunity_type = 'revenue_stream',
  notes = COALESCE(notes,'') || E'\n[auto-typed revenue_stream (round 2) · 2026-05-22]',
  updated_at = now()
WHERE opportunity_type = 'grant'
  AND status IN ('prospect','upcoming')
  AND (
    lower(coalesce(funder,'')) ~ '\m(families|individuals|community members|local market|paying customers|patrons|sales|commissions|art sales)\M'
    OR (
      funder IS NULL AND
      lower(name) ~ '\m(elders mystery school|mystery school)\M'
    )
  );

-- ─────────────────────────────────────────────────────────────────────
-- 2. SCHOLARSHIP type — individual fellowships/scholarships
-- ─────────────────────────────────────────────────────────────────────
UPDATE org_pipeline SET
  opportunity_type = 'scholarship',
  notes = COALESCE(notes,'') || E'\n[auto-typed scholarship · 2026-05-22]',
  updated_at = now()
WHERE opportunity_type = 'grant'
  AND lower(name) ~ '\m(scholarship)\M';

-- ─────────────────────────────────────────────────────────────────────
-- 3. Expand theme_keywords on each ACT project
-- ─────────────────────────────────────────────────────────────────────
UPDATE act_grant_recommendation_projects SET
  theme_keywords = ARRAY(
    SELECT DISTINCT unnest(theme_keywords || ARRAY[
      'aboriginal','first nations','indigenous','country','elder','elders',
      'palm island','acco','community-controlled','community controlled','torres strait',
      'cultural authority','consent','protocol'
    ])
  ),
  updated_at = now()
WHERE project_code = 'ACT-PI';

UPDATE act_grant_recommendation_projects SET
  theme_keywords = ARRAY(
    SELECT DISTINCT unnest(theme_keywords || ARRAY[
      'environment','ecosystem','biodiversity','clean energy','climate','climate change',
      'caring for country','restoration','regeneration','soil','seed','nature','natural',
      'water','catchment','reef','dry tropics'
    ])
  ),
  updated_at = now()
WHERE project_code = 'ACT-FM';

UPDATE act_grant_recommendation_projects SET
  theme_keywords = ARRAY(
    SELECT DISTINCT unnest(theme_keywords || ARRAY[
      'harvest','ecosystem services','food security','market garden','farm-to-table',
      'paddock','farmstay','farm enterprise','agritourism','cafe','restaurant','produce'
    ])
  ),
  updated_at = now()
WHERE project_code = 'ACT-HV';

UPDATE act_grant_recommendation_projects SET
  theme_keywords = ARRAY(
    SELECT DISTINCT unnest(theme_keywords || ARRAY[
      'circular','circular economy','indigenous procurement policy','ipp','innovation fund',
      'real innovation','social enterprise','micro business','nova peris','supply nation'
    ])
  ),
  updated_at = now()
WHERE project_code = 'ACT-GD';

UPDATE act_grant_recommendation_projects SET
  theme_keywords = ARRAY(
    SELECT DISTINCT unnest(theme_keywords || ARRAY[
      'connected communities','stem','innovation','asia','isif','apnic','telstra',
      'r&d','research and development','technology','digital','digital inclusion','cyber'
    ])
  ),
  updated_at = now()
WHERE project_code = 'ACT-IN';

UPDATE act_grant_recommendation_projects SET
  theme_keywords = ARRAY(
    SELECT DISTINCT unnest(theme_keywords || ARRAY[
      'parenting','teen','teens','expecting','brave foundation','early intervention',
      'prevention','intervention','support','at-risk','vulnerable','reintegration','re-entry'
    ])
  ),
  updated_at = now()
WHERE project_code = 'ACT-JH';

UPDATE act_grant_recommendation_projects SET
  theme_keywords = ARRAY(
    SELECT DISTINCT unnest(theme_keywords || ARRAY[
      'fellowship','artist','artist fellowship','storyteller','narrative sovereignty',
      'voice','third reality','memoir','documentary'
    ])
  ),
  updated_at = now()
WHERE project_code = 'ACT-EL';

UPDATE act_grant_recommendation_projects SET
  theme_keywords = ARRAY(
    SELECT DISTINCT unnest(theme_keywords || ARRAY[
      'boosting business','business innovation','social procurement','open data',
      'transparency','accountability','data infrastructure','dashboards','grant intelligence'
    ])
  ),
  updated_at = now()
WHERE project_code = 'ACT-CS';

UPDATE act_grant_recommendation_projects SET
  theme_keywords = ARRAY(
    SELECT DISTINCT unnest(theme_keywords || ARRAY[
      'mount isa','regional youth','north queensland','regional partnership','transport',
      'frrr','remote'
    ])
  ),
  updated_at = now()
WHERE project_code = 'ACT-MY';

UPDATE act_grant_recommendation_projects SET
  theme_keywords = ARRAY(
    SELECT DISTINCT unnest(theme_keywords || ARRAY[
      'tour','touring','festival','public engagement','experience','immersive',
      'art installation','public art'
    ])
  ),
  updated_at = now()
WHERE project_code = 'ACT-CN';

-- ─────────────────────────────────────────────────────────────────────
-- 4. Re-fuzzy: re-assign ACT-CORE grants that have project_code='ACT-CORE'
--    but were originally assigned by the keyword matcher to ACT-CORE.
--    Now with broader keywords, some should route to specific projects.
-- ─────────────────────────────────────────────────────────────────────
WITH targets AS (
  SELECT id, name, funder, lower(coalesce(name,'') || ' ' || coalesce(funder,'')) AS hay
  FROM org_pipeline
  WHERE project_code = 'ACT-CORE' AND opportunity_type = 'grant'
),
project_themes AS (
  SELECT project_code, theme_keywords, qbe_ready, readiness
  FROM act_grant_recommendation_projects WHERE in_scope = true AND project_code <> 'ACT-CORE'
),
scored AS (
  SELECT t.id, pt.project_code, pt.qbe_ready, pt.readiness,
    (SELECT COUNT(*) FROM unnest(pt.theme_keywords) AS k WHERE t.hay LIKE '%' || lower(k) || '%') AS score
  FROM targets t CROSS JOIN project_themes pt
),
ranked AS (
  SELECT DISTINCT ON (id) id, project_code
  FROM scored WHERE score > 0
  ORDER BY id, score DESC,
    CASE WHEN qbe_ready THEN 0 ELSE 1 END,
    CASE readiness WHEN 'live-proof' THEN 0 WHEN 'active' THEN 1 WHEN 'pitch-ready' THEN 2 WHEN 'needs-cleanup' THEN 3 ELSE 4 END
)
UPDATE org_pipeline op
SET project_code = r.project_code,
    notes = COALESCE(op.notes,'') || E'\n[re-routed from ACT-CORE via expanded keywords · 2026-05-22]',
    updated_at = now()
FROM ranked r
WHERE op.id = r.id;

-- Summary
SELECT project_code, opportunity_type, COUNT(*) AS rows
FROM org_pipeline
GROUP BY 1, 2 ORDER BY 1, 2;

COMMIT;
