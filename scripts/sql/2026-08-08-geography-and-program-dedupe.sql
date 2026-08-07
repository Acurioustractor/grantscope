-- Geography exclusion + near-duplicate program collapse.
-- Follows scripts/sql/2026-08-07-tighten-grant-ranking.sql. Applied via Supabase MCP.
--
-- Two defects Ben found in PICC's list:
--
-- 1. GEOGRAPHY LEAKED. geography_score adds points but never excludes, so a
--    Victoria-only round reaching a Palm Island organisation merely scored lower
--    instead of dropping out. Verified against ACT-PI (QLD + NT + National): the
--    rule removes Environmental Restoration NSW, Geelong Community Foundation,
--    State Trustees VIC, the SA Greek Language Grant and Hunter Local Land
--    Services, with no false positives.
--
--    94% of rows declare no jurisdiction, so the funder name is the fallback:
--    176 opportunities carry a state-declaring government funder with an empty
--    jurisdictions array (TAS 55, NSW 46, WA 37, NT 33, VIC 4, SA 1). A state
--    government grant is for that state. Where neither is known the row stays —
--    unknown is not the same as wrong.
--
--    `jurisdictions` mixes 'QLD' and 'AU-QLD', so the prefix is normalised.
--
-- 2. NEAR-DUPLICATE PROGRAMS SURVIVED DEDUP. Paul Ramsay's Just Futures appeared
--    three times: "Just Futures", "Just Futures (New Open Grant Round to Help
--    Prevent Contact with the Justice System)", "Just Futures: National Open
--    Grant Round". The earlier pass keyed on exact (name, funder). Collapsing on
--    a name stem — parentheticals and post-colon qualifiers stripped — folds them
--    into one, keeping the best-scoring row.
--
-- Effect: per-project lists now differ from each other, which they did not before
-- (every project saw an identical 1,535). PICC 697 opportunities / 16 strong;
-- Goods 794 / 7; Mounty Yarns 697 / 5.
--
-- Rollback: see the previous file's view definition.
;

CREATE OR REPLACE VIEW act_grant_recommendations_current AS
WITH proj AS (
  SELECT project_code,
         ARRAY(SELECT upper(s) FROM unnest(COALESCE(home_states,'{}') || COALESCE(secondary_states,'{}')) s)
           AS ok_states
  FROM act_grant_recommendation_projects
),
tagged AS (
  SELECT rec.*, cs.feed_status, p.ok_states,
         CASE
           WHEN rec.funder_name ~* '(victorian government|government of victoria)'            THEN 'VIC'
           WHEN rec.funder_name ~* '(nsw government|government of new south wales)'           THEN 'NSW'
           WHEN rec.funder_name ~* '(queensland government|qld government)'                   THEN 'QLD'
           WHEN rec.funder_name ~* '(south australian government|government of south australia)' THEN 'SA'
           WHEN rec.funder_name ~* '(western australian government|government of western australia)' THEN 'WA'
           WHEN rec.funder_name ~* '(tasmanian government|government of tasmania)'            THEN 'TAS'
           WHEN rec.funder_name ~* '(northern territory government|nt government)'            THEN 'NT'
         END AS funder_state
  FROM act_grant_recommendations rec
  JOIN act_funding_opportunity_current_status cs ON cs.opportunity_id = rec.opportunity_id
  LEFT JOIN proj p ON p.project_code = rec.project_code
  WHERE cs.feed_status IN ('apply_now', 'rolling')
    AND (rec.max_grant_amount IS NULL OR rec.max_grant_amount >= 5000)
),
eligible AS (
  SELECT * FROM tagged
  WHERE ok_states IS NULL
     OR COALESCE(is_national, false)
     OR (
       CASE WHEN jurisdictions IS NOT NULL AND cardinality(jurisdictions) > 0 THEN
         EXISTS (SELECT 1 FROM unnest(jurisdictions) j
                 WHERE upper(replace(j,'AU-','')) = ANY (ok_states)
                    OR upper(replace(j,'AU-','')) = 'NATIONAL')
       WHEN funder_state IS NOT NULL THEN funder_state = ANY (ok_states)
       ELSE true END
     )
),
stemmed AS (
  SELECT eligible.*,
         ROW_NUMBER() OVER (
           PARTITION BY project_code,
             lower(trim(coalesce(funder_name, ''))),
             trim(regexp_replace(
               regexp_replace(lower(coalesce(opportunity_name, '')), '\s*\(.*?\)', '', 'g'),
               '\s*[:–—-]\s.*$', ''))
           ORDER BY fit_score DESC NULLS LAST, deadline NULLS LAST, opportunity_id
         ) AS program_rn
  FROM eligible
)
SELECT
  project_code, project_name, opportunity_id, opportunity_name, funder_name,
  deadline, opens_at, min_grant_amount, max_grant_amount, is_national,
  jurisdictions, eligible_org_types, focus_areas, keywords, source_url,
  application_url, opportunity_type, verification_status, verified_at,
  theme_score, geography_score, eligibility_score, timing_score,
  track_record_score, won_funder, fit_score,
  (is_strong_fit
    AND (COALESCE(geography_score, 0) > 0
         OR COALESCE(max_grant_amount, 0) >= 50000
         OR won_funder))                          AS is_strong_fit,
  tag_density_penalised, funder_avg_tags, flags, computed_at, feed_status
FROM stemmed
WHERE program_rn = 1;
