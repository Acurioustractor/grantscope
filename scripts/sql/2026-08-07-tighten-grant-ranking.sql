-- Tighten the ACT grant ranking (audit 2026-08-07, second pass).
--
-- After the feed was unstarved, Goods' "strong fits" still carried two epilepsy
-- research funds, a $1,000 computer grant, a Victoria-only community fund, an
-- extractive-industry funder, and Paul Ramsay's Just Futures listed twice.
--
-- Applied via Supabase MCP; kept here for review and rollback.

-- ─────────────────────────────────────────────────────────────────────────────
-- 1. Duplicate open_grant rows
--
-- 175 of 1,020 open_grant rows were redundant on (name, funder). Keep the most
-- complete — real timing, then an application URL, then most recently verified.
-- Archived rather than deleted; the recommendation MV excludes 'archived'.
-- ─────────────────────────────────────────────────────────────────────────────
WITH ranked AS (
  SELECT id, ROW_NUMBER() OVER (
           PARTITION BY lower(trim(name)), lower(trim(coalesce(funder_name,'')))
           ORDER BY (deadline IS NOT NULL) DESC,
                    (NULLIF(trim(coalesce(application_url,'')),'') IS NOT NULL) DESC,
                    (verified_at IS NOT NULL) DESC,
                    verified_at DESC NULLS LAST, created_at DESC
         ) AS rn
  FROM alma_funding_opportunities WHERE opportunity_type = 'open_grant'
)
UPDATE alma_funding_opportunities a
SET status = 'archived', updated_at = now()
FROM ranked r WHERE r.id = a.id AND r.rn > 1;

-- ─────────────────────────────────────────────────────────────────────────────
-- 2. Extractive funders, consistently
--
-- match-foundations-for-projects.mjs excludes these by name pattern as a values
-- call ("encoded so no future run re-litigates it"), but the grants path reads
-- funder_blocklist and never had them. Same decision, two paths, one of them
-- ignoring it. The MV matches funder_name exactly, so these are the observed
-- values, not patterns.
-- ─────────────────────────────────────────────────────────────────────────────
INSERT INTO funder_blocklist (funder_name, reason, blocked_by, active)
VALUES
  ('BHP Foundation',       'Extractive-industry funder — values exclusion, mirrors EXCLUDE_FUNDERS in match-foundations-for-projects.mjs', 'audit-2026-08-07', true),
  ('Fortescue Foundation', 'Extractive-industry funder — values exclusion, mirrors EXCLUDE_FUNDERS in match-foundations-for-projects.mjs', 'audit-2026-08-07', true),
  ('Rio Tinto Foundation', 'Extractive-industry funder — values exclusion, mirrors EXCLUDE_FUNDERS in match-foundations-for-projects.mjs', 'audit-2026-08-07', true),
  ('Santos Foundation',    'Extractive-industry funder — values exclusion, mirrors EXCLUDE_FUNDERS in match-foundations-for-projects.mjs', 'audit-2026-08-07', true)
ON CONFLICT DO NOTHING;

-- ─────────────────────────────────────────────────────────────────────────────
-- 3. What earns the words "strong fit"
--
-- The MV flags is_strong_fit at fit_score >= 55, which does not discriminate.
-- Measured on ACT-GD, these scored identically at 58 / theme 30 / geo 0 /
-- elig 20 / timing 8:
--
--   Paul Ramsay "Just Futures"        $1,000,000   genuinely relevant
--   Coles Nurture Fund                  $500,000   genuinely relevant
--   Australian Epilepsy Research Fund        —     medical research, not ours
--   "Computer Assistance"                 $1,000   trivial
--
-- Raising the threshold would drop the good with the bad. Two fields separate
-- them: a positive geography signal, or a grant large enough to matter. A round
-- with neither is a coincidence of theme keywords, not a fit.
--
-- Rollback: replace the CASE with plain `recommendation.is_strong_fit` and drop
-- the trivial-amount filter from the WHERE clause.
-- ─────────────────────────────────────────────────────────────────────────────
CREATE OR REPLACE VIEW act_grant_recommendations_current AS
SELECT
  recommendation.project_code,
  recommendation.project_name,
  recommendation.opportunity_id,
  recommendation.opportunity_name,
  recommendation.funder_name,
  recommendation.deadline,
  recommendation.opens_at,
  recommendation.min_grant_amount,
  recommendation.max_grant_amount,
  recommendation.is_national,
  recommendation.jurisdictions,
  recommendation.eligible_org_types,
  recommendation.focus_areas,
  recommendation.keywords,
  recommendation.source_url,
  recommendation.application_url,
  recommendation.opportunity_type,
  recommendation.verification_status,
  recommendation.verified_at,
  recommendation.theme_score,
  recommendation.geography_score,
  recommendation.eligibility_score,
  recommendation.timing_score,
  recommendation.track_record_score,
  recommendation.won_funder,
  recommendation.fit_score,
  (recommendation.is_strong_fit
    AND (COALESCE(recommendation.geography_score, 0) > 0
         OR COALESCE(recommendation.max_grant_amount, 0) >= 50000
         OR recommendation.won_funder))          AS is_strong_fit,
  recommendation.tag_density_penalised,
  recommendation.funder_avg_tags,
  recommendation.flags,
  recommendation.computed_at,
  current_status.feed_status
FROM act_grant_recommendations recommendation
JOIN act_funding_opportunity_current_status current_status
  ON current_status.opportunity_id = recommendation.opportunity_id
WHERE current_status.feed_status IN ('apply_now', 'rolling')
  -- A round capped below $5,000 costs more to write than it returns.
  -- NULL is unknown, not small, so it stays.
  AND (recommendation.max_grant_amount IS NULL OR recommendation.max_grant_amount >= 5000);

-- Steps 1 and 2 only take effect after the MV rebuilds.
REFRESH MATERIALIZED VIEW CONCURRENTLY act_grant_recommendations;
