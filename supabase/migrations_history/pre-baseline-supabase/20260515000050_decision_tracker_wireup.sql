-- Wire ACT grant recommendations into the /tracker Kanban.
--
-- When admin clicks Apply on /ops/grant-recommendations, the API:
--   1. Mirrors the alma_funding_opportunity into grant_opportunities (one-time)
--   2. Stores the resulting grant_opportunity_id on the decision row
--   3. Upserts saved_grants (user_id, grant_id, stage='pursuing')
--
-- saved_grants.grant_id has a FK to grant_opportunities, not directly to
-- alma_funding_opportunities, so a mirror row is required to bridge them.

ALTER TABLE act_grant_recommendation_decisions
  ADD COLUMN IF NOT EXISTS grant_opportunity_id uuid REFERENCES grant_opportunities(id) ON DELETE SET NULL;

COMMENT ON COLUMN act_grant_recommendation_decisions.grant_opportunity_id IS
  'Mirrored grant_opportunities row used by /tracker. Populated when decision becomes pursuing/applied/submitted.';

CREATE INDEX IF NOT EXISTS idx_agr_decisions_grant_opp
  ON act_grant_recommendation_decisions (grant_opportunity_id)
  WHERE grant_opportunity_id IS NOT NULL;
