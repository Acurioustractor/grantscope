-- Apply: scripts/db-apply.sh supabase/migrations/20260914170000_act_private_grant_rounds.sql
-- SmartyGrants rounds are for ACT's own grant-seeking only (Ben, 2026-09-14). In grant_opportunities they were
-- public: /grants and /grants/[id] are unauthenticated, /api/data/funding-opportunities is anonymous-capable,
-- v_funding_opportunities and mv_search_index read the table, and signup is open so "authenticated" is anyone.
-- 56 non-gated app files read these tables, so filtering them one by one would leak. The rows move to their own
-- table instead: RLS on, no policies, no anon/authenticated grants (the act_* private pattern), service role only.
-- Pre-checked: 595 rows (source smartygrants; 15 rows from other sources that link to SmartyGrants pages stay), 0 references from saved_grants, grant_applications, alert_events, outbox, feedback,
-- act_grant_recommendation_decisions. Undo: INSERT the rows back from act_private_grant_rounds.
BEGIN;

CREATE TABLE public.act_private_grant_rounds AS
SELECT id, name, provider, program, description, amount_min, amount_max, closes_at, deadline, url, status,
       application_status, geography, metadata, categories, aligned_projects, goods_relevance_score,
       goods_relevance_signals, source, discovery_method, created_at, updated_at
FROM public.grant_opportunities
WHERE source = 'smartygrants';

ALTER TABLE public.act_private_grant_rounds
  ADD PRIMARY KEY (id),
  ALTER COLUMN id SET DEFAULT gen_random_uuid(),
  ALTER COLUMN created_at SET DEFAULT now(),
  ALTER COLUMN updated_at SET DEFAULT now(),
  ADD CONSTRAINT act_private_grant_rounds_url_key UNIQUE (url);

ALTER TABLE public.act_private_grant_rounds ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.act_private_grant_rounds FROM PUBLIC, anon, authenticated;
COMMENT ON TABLE public.act_private_grant_rounds IS
  'ACT-internal grant rounds (SmartyGrants portals). Never public: no policies, service role only. See migration 20260914170000.';

DELETE FROM public.grant_opportunities WHERE source = 'smartygrants';

COMMIT;

-- Drop the 609 rounds from site search now instead of at the nightly rebuild.
REFRESH MATERIALIZED VIEW public.mv_search_index;
