-- P2: Fit-score alma_funding_opportunities × 6 ACT projects.
--
-- Scope (locked with user 2026-05-15): ONLY these 6 codes —
--   ACT-HV (Harvest), ACT-EL (Empathy Ledger), ACT-JH (JusticeHub),
--   ACT-GD (Goods), ACT-CORE (Regenerative Studio — incl. former ACT-IN),
--   ACT-FM (Farm).
-- ACT-IN folded into ACT-CORE (same A Curious Tractor studio/advisory layer).
-- All other ACT-XX codes explicitly excluded. Re-scope by adding rows to
-- act_grant_recommendation_projects with in_scope=true.
--
-- Scoring (0–100):
--   theme       (0–50) — opp focus_areas/keywords overlap with project theme dict,
--                        both sides ≥ 4 chars to avoid state-code substring false positives
--   geography   (0–15) — national / home-state / secondary-state
--   eligibility (0–20) — ACT can apply solo / needs Aboriginal partner / blocked
--   timing      (0–15) — deadline window
--
-- is_strong_fit = theme_score > 0 AND fit_score ≥ 55 — consumer-facing filter.
-- Generic 60-baseline matches (theme=0) drop out of "must look at" lists.
--
-- Flags: requires_dgr, partner_required, tight_deadline, national, large_grant, small_grant.


-- Seed table: per-project config. Edit + refresh MV to re-scope.
CREATE TABLE IF NOT EXISTS act_grant_recommendation_projects (
  project_code text PRIMARY KEY,
  theme_keywords text[] NOT NULL,
  home_states text[] NOT NULL DEFAULT ARRAY['QLD']::text[],
  secondary_states text[] NOT NULL DEFAULT ARRAY['NT','NSW']::text[],
  in_scope boolean NOT NULL DEFAULT true,
  notes text,
  updated_at timestamptz NOT NULL DEFAULT now()
);

COMMENT ON TABLE act_grant_recommendation_projects IS
  'Per-project fit-scoring config for act_grant_recommendations MV. Edit and refresh MV to re-scope.';

INSERT INTO act_grant_recommendation_projects (project_code, theme_keywords, home_states, secondary_states, in_scope, notes) VALUES
  ('ACT-HV', ARRAY[
    'food','farm','farming','agriculture','regenerative','land','harvest','witta',
    'sustainable','sustainability','permaculture','traditional owners','on-country',
    'rural','food security','biodiversity','climate','climate adaptation',
    'community food','land healing','land regeneration','first nations food'
  ], ARRAY['QLD'], ARRAY['NT','NSW'], true, 'The Harvest Witta — regenerative food systems'),
  ('ACT-EL', ARRAY[
    'storytelling','narrative','voice','listen','amplify','communication','media','journalism',
    'documentary','arts','first nations'
  ], ARRAY['QLD','NT'], ARRAY['NSW','VIC','WA','SA'], true, 'Empathy Ledger — storytelling platform'),
  ('ACT-JH', ARRAY[
    'justice','youth justice','legal','court','prison','recidivism','diversion','first nations',
    'indigenous','aboriginal','reform','community-controlled','healing'
  ], ARRAY['QLD','NT'], ARRAY['NSW','WA','SA','VIC'], true, 'JusticeHub — youth justice reform'),
  ('ACT-GD', ARRAY[
    'housing','community','economic','employment','social enterprise','goods','procurement',
    'disadvantage','wellbeing','vulnerable youth','place-based'
  ], ARRAY['QLD'], ARRAY['NSW','NT'], true, 'Goods — community economic infrastructure'),
  ('ACT-CORE', ARRAY[
    'ecosystem','infrastructure','operations','platform','capacity','sector strengthening',
    'community-controlled','closing the gap','backbone','intermediary','ecosystem-building',
    'partnership infrastructure','sector capacity','organisational capacity','collective impact',
    'community-led infrastructure','sector building','intermediary funding','advisory',
    'consulting','project work','strategic partnership','systems change','place-based',
    'collective action','philanthropic infrastructure','funder collaboration'
  ], ARRAY['QLD','NT'], ARRAY['NSW','VIC','WA','SA','TAS','ACT'], true, 'ACT Regenerative Studio — umbrella for A Curious Tractor cross-cutting / advisory / project work. Absorbed ACT-IN 2026-05-15.'),
  ('ACT-FM', ARRAY[
    'land','farm','agriculture','regenerative','country','traditional owners','healing',
    'cultural authority','on-country','rural','biodiversity','environment','climate',
    'sustainability','indigenous land','sea country','first nations land','caring for country'
  ], ARRAY['QLD'], ARRAY['NT','NSW'], true, 'The Farm — land healing program'),
  -- Out of scope, kept for migration history
  ('ACT-IN', ARRAY['infrastructure'], ARRAY['QLD','NT'], ARRAY['NSW','WA','SA','VIC','TAS','ACT'], false,
   'Merged into ACT-CORE 2026-05-15 (both = A Curious Tractor studio/advisory layer).')
ON CONFLICT (project_code) DO UPDATE SET
  theme_keywords = EXCLUDED.theme_keywords,
  home_states = EXCLUDED.home_states,
  secondary_states = EXCLUDED.secondary_states,
  in_scope = EXCLUDED.in_scope,
  notes = EXCLUDED.notes,
  updated_at = now();


-- Materialized view. Refresh nightly (P4 will pin into discovery job).
CREATE MATERIALIZED VIEW IF NOT EXISTS act_grant_recommendations AS
WITH project_themes AS (
  SELECT
    arp.project_code,
    p.name AS project_name,
    arp.theme_keywords,
    arp.home_states,
    arp.secondary_states
  FROM act_grant_recommendation_projects arp
  JOIN projects p ON p.code = arp.project_code
  WHERE arp.in_scope = true
),
opps AS (
  SELECT *
  FROM alma_funding_opportunities
  WHERE COALESCE(status, 'open') NOT IN ('archived','closed','cancelled','rejected')
    AND (deadline IS NULL OR deadline >= now())
),
scored AS (
  SELECT
    pt.project_code,
    pt.project_name,
    o.id AS opportunity_id,
    o.name AS opportunity_name,
    o.funder_name,
    o.deadline,
    o.opens_at,
    o.min_grant_amount,
    o.max_grant_amount,
    o.is_national,
    o.jurisdictions,
    o.eligible_org_types,
    o.focus_areas,
    o.keywords,
    o.source_url,
    o.application_url,

    LEAST(50,
      (SELECT COUNT(DISTINCT pk) * 10
       FROM unnest(pt.theme_keywords) pk
       WHERE length(pk) >= 4
         AND EXISTS (
           SELECT 1
           FROM unnest(COALESCE(o.focus_areas, '{}'::text[]) || COALESCE(o.keywords, '{}'::text[])) okw
           WHERE length(okw) >= 4
             AND (lower(okw) LIKE '%' || lower(pk) || '%'
               OR lower(pk)  LIKE '%' || lower(okw) || '%')
         ))
    )::int AS theme_score,

    CASE
      WHEN o.is_national THEN 15
      WHEN o.jurisdictions && pt.home_states THEN 15
      WHEN o.jurisdictions && pt.secondary_states THEN 9
      ELSE 0
    END AS geography_score,

    CASE
      WHEN o.eligible_org_types && ARRAY['charity','company','community_organisation','social_enterprise','arts_organisation','collective']::text[] THEN 20
      WHEN o.eligible_org_types && ARRAY['aboriginal_corporation','indigenous_charity','indigenous_org','community_org']::text[] THEN 10
      ELSE 5
    END AS eligibility_score,

    CASE
      WHEN o.deadline IS NULL THEN 8
      WHEN o.deadline >= now() + interval '30 days' THEN 15
      WHEN o.deadline >= now() + interval '7 days'  THEN 8
      WHEN o.deadline >= now()                       THEN 4
      ELSE 0
    END AS timing_score,

    ARRAY_REMOVE(ARRAY[
      CASE WHEN o.requires_deductible_gift_recipient THEN 'requires_dgr' END,
      CASE
        WHEN o.eligible_org_types && ARRAY['aboriginal_corporation','indigenous_charity','indigenous_org']::text[]
         AND NOT (o.eligible_org_types && ARRAY['charity','company','community_organisation']::text[])
        THEN 'partner_required'
      END,
      CASE WHEN o.deadline IS NOT NULL AND o.deadline < now() + interval '14 days' THEN 'tight_deadline' END,
      CASE WHEN o.is_national THEN 'national' END,
      CASE WHEN o.max_grant_amount IS NOT NULL AND o.max_grant_amount >= 500000 THEN 'large_grant' END,
      CASE WHEN o.max_grant_amount IS NOT NULL AND o.max_grant_amount < 50000  THEN 'small_grant' END
    ], NULL) AS flags
  FROM project_themes pt
  CROSS JOIN opps o
)
SELECT
  project_code,
  project_name,
  opportunity_id,
  opportunity_name,
  funder_name,
  deadline,
  opens_at,
  min_grant_amount,
  max_grant_amount,
  is_national,
  jurisdictions,
  eligible_org_types,
  focus_areas,
  keywords,
  source_url,
  application_url,
  theme_score,
  geography_score,
  eligibility_score,
  timing_score,
  (theme_score + geography_score + eligibility_score + timing_score) AS fit_score,
  (theme_score > 0 AND (theme_score + geography_score + eligibility_score + timing_score) >= 55) AS is_strong_fit,
  flags,
  now() AS computed_at
FROM scored;

CREATE UNIQUE INDEX IF NOT EXISTS idx_act_grant_rec_pk
  ON act_grant_recommendations (project_code, opportunity_id);
CREATE INDEX IF NOT EXISTS idx_act_grant_rec_score
  ON act_grant_recommendations (fit_score DESC);
CREATE INDEX IF NOT EXISTS idx_act_grant_rec_strong
  ON act_grant_recommendations (project_code, is_strong_fit, fit_score DESC);

COMMENT ON MATERIALIZED VIEW act_grant_recommendations IS
  'Fit-scored opp×project recommendations for 6 ACT projects. theme=50, is_strong_fit filter, 4+ char tokens. Consumer default: WHERE is_strong_fit ORDER BY fit_score DESC. Refresh nightly (P4).';
