-- =============================================================================
-- 2026-08-19-grant-missing-matviews.sql
--
-- Ten materialized views had NO grants to the PostgREST roles. Reads through the
-- API returned "permission denied", and the app swallowed it: /foundation/[abn]
-- does `if (!scoreResult.data) return null` -> notFound() -> 404.
--
-- So a page linked from /foundation and twice from /reports/philanthropy has been
-- returning 404 to every visitor, and nothing logged an error, because a permission
-- failure and an empty result are indistinguishable to `.single()`.
--
-- This is the SIXTH recorded instance of the missing-GRANT class in CLAUDE.md's
-- safety rails. 94 of 104 matviews were already granted; these ten were missed.
--
-- Measured before applying (service-role client, PostgREST):
--   DENIED, read by N app files:
--     mv_foundation_scores               6      <- the 404
--     mv_evidence_backed_funding         3
--     mv_person_identity_influence       3
--     mv_trustee_grantee_chain           3
--     mv_person_identity_network         2
--     mv_foundation_need_alignment       1
--     mv_person_identity_influence_v2    1      <- the de-collided person-money method
--   DENIED, read by no app code (granted anyway, so the next feature does not
--   rediscover this the hard way):
--     mv_closing_the_gap_state_summary          <- a nightly pg_cron job refreshes
--                                                  this one; nothing could read it
--     mv_entity_total_funding
--     mv_foundation_readiness
--
-- APPLY:
--   source .env && PGPASSWORD="$DATABASE_PASSWORD" psql \
--     -h aws-0-ap-southeast-2.pooler.supabase.com -p 5432 \
--     -U "postgres.tednluwflfhxyucgwigh" -d postgres \
--     -f migrations/2026-08-19-grant-missing-matviews.sql
--
-- REVERSE: REVOKE SELECT ON <view> FROM anon, authenticated, service_role;
--          (There is no reason to. The other 94 are granted.)
-- =============================================================================

BEGIN;

GRANT SELECT ON
  public.mv_closing_the_gap_state_summary,
  public.mv_entity_total_funding,
  public.mv_evidence_backed_funding,
  public.mv_foundation_need_alignment,
  public.mv_foundation_readiness,
  public.mv_foundation_scores,
  public.mv_person_identity_influence,
  public.mv_person_identity_influence_v2,
  public.mv_person_identity_network,
  public.mv_trustee_grantee_chain
TO anon, authenticated, service_role;

COMMIT;
