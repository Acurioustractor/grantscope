-- Keep operational grant decisions distinct from historical funding evidence.
-- Historical Xero wins contribute track-record proof but must never create GHL
-- opportunities or Notion application workspaces.

ALTER TABLE public.act_grant_recommendation_decisions
  ADD COLUMN IF NOT EXISTS decision_scope text NOT NULL DEFAULT 'operational',
  ADD COLUMN IF NOT EXISTS decision_origin text NOT NULL DEFAULT 'legacy';

ALTER TABLE public.act_grant_recommendation_decisions
  DROP CONSTRAINT IF EXISTS act_grant_recommendation_decisions_scope_check,
  DROP CONSTRAINT IF EXISTS act_grant_recommendation_decisions_origin_check;

ALTER TABLE public.act_grant_recommendation_decisions
  ADD CONSTRAINT act_grant_recommendation_decisions_scope_check
    CHECK (decision_scope IN ('operational', 'historical_evidence')),
  ADD CONSTRAINT act_grant_recommendation_decisions_origin_check
    CHECK (decision_origin IN (
      'legacy',
      'grantscope_pursue',
      'manual_admin',
      'notion_sync',
      'ghl_callback',
      'xero_invoices'
    ));

UPDATE public.act_grant_recommendation_decisions
SET
  decision_scope = 'historical_evidence',
  decision_origin = 'xero_invoices',
  updated_at = now()
WHERE decision = 'won'
  AND notes LIKE 'Backfilled from xero_invoices%'
  AND (decision_scope <> 'historical_evidence' OR decision_origin <> 'xero_invoices');

CREATE INDEX IF NOT EXISTS idx_agr_decisions_scope_state
  ON public.act_grant_recommendation_decisions (decision_scope, decision, decided_at DESC);

COMMENT ON COLUMN public.act_grant_recommendation_decisions.decision_scope IS
  'operational rows may drive GHL/Notion; historical_evidence rows only contribute funding history and proof.';
COMMENT ON COLUMN public.act_grant_recommendation_decisions.decision_origin IS
  'System that created the decision row. Used for provenance and safe downstream routing.';
