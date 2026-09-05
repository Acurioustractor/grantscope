-- 20260905151000_act_context_tables_anon_revoke.sql
-- Drafted 2026-09-05; NOT applied. Apply with /db-apply on Ben's verb.
--
-- /ops/schema measures "open to the public key" by RLS state, not by grant. Of the 42 private-owner objects it finds
-- open, 36 are consent- or approval-gated publishing tables (Empathy Ledger stories, Harvest approved listings, studio
-- approved media) and are meant to be. These six are ACT-owned with plain public read policies or a matview grant:
--   funder_context_snapshot         840 kB  "Public read"          Xero-derived funder context; readers: grantscope + act-global server code
--   act_grant_recommendations        29 MB  matview grant          ACT grant scoring; readers: grantscope server code via act_grant_recommendations_current
--   grant_application_requirements   72 kB  "Public read"          readers: act-global server code
--   tagging_sweep_runs              264 kB  "Public read"          ops; readers: act-global server code
--   learned_thresholds               96 kB  policy named "Authenticated…" but granted to public; no reader in any repo
--   recommendation_outcomes         144 kB  same shape; no reader in any repo
-- No anon or authenticated client reads any of them (grep over six repos, 2026-09-05). Service role bypasses RLS.
BEGIN;
DROP POLICY IF EXISTS "Public read" ON public.funder_context_snapshot;
DROP POLICY IF EXISTS "Public read" ON public.grant_application_requirements;
DROP POLICY IF EXISTS "Public read" ON public.tagging_sweep_runs;
DROP POLICY IF EXISTS "Authenticated read access on learned_thresholds" ON public.learned_thresholds;
DROP POLICY IF EXISTS "Authenticated read access on recommendation_outcomes" ON public.recommendation_outcomes;
REVOKE SELECT ON public.act_grant_recommendations FROM anon, authenticated;
GRANT SELECT ON public.act_grant_recommendations TO service_role;
COMMIT;
-- Post-check: /ops/schema "private objects readable by the public key" should drop by 6 (11 with 20260905150000).
