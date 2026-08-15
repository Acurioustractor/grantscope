-- =============================================================================
-- 2026-08-15-act-flag-from-scope-table.sql
--
-- Make catalog_object_scope authoritative for clarity_object.act_business, and
-- delete the name-shape guess that was silently disagreeing with it.
--
-- THE DEFECT. clarity_refresh() section G set act_business from a hardcoded
-- prefix regex — ^(act_|xero_|ghl_|notion_|receipt|finance_|...) — while
-- catalog_object_scope held the authoritative classification and was never
-- consulted. Two mechanisms, no reconciliation, and they had already diverged:
--
--   act_private / act_private_review in scope table   297
--   flagged by the name rule                           93
--   ACT objects the rule MISSES                       215
--   civic objects the rule WRONGLY flags                2  (ce_users, ce_metrics)
--
-- The misses are not obscure. They include knowledge_chunks (19,413 rows of
-- verbatim personal iMessage content), linkedin_contacts (13,810 PII records),
-- entity_identifiers (31,461), person_identity_map (14,919) and
-- canonical_entities (15,329) — all of which render in the civic ledger today
-- because their names do not begin with a listed prefix.
--
-- Worse, the old statement only ever set TRUE, never FALSE. So the two
-- false positives could not be corrected by re-running the refresh; the error
-- was sticky.
--
-- THE FIX. One source of truth. The scope table drives the flag in BOTH
-- directions, so a reclassification there propagates on the next refresh. The
-- name rule survives only as a fallback for objects the scope seed has not yet
-- classified, and is expected to match nothing once the 9 residuals below are
-- added — at which point it can be deleted outright.
--
-- APPLY WITH:
--   cd /Users/benknight/Code/grantscope && source .env && PGPASSWORD="$DATABASE_PASSWORD" \
--     psql -h aws-0-ap-southeast-2.pooler.supabase.com -p 5432 \
--     -U postgres.tednluwflfhxyucgwigh -d postgres \
--     -f migrations/2026-08-15-act-flag-from-scope-table.sql
--
-- VERIFY AFTER APPLY:
--   SELECT act_business, count(*) FROM clarity_object
--    WHERE object_kind <> 'function' GROUP BY 1;
--   -- expect roughly 306 true (297 scoped + 9 residuals), was 93
--   SELECT object_name, act_business FROM clarity_object
--    WHERE object_name IN ('ce_users','ce_metrics','knowledge_chunks','linkedin_contacts');
--   -- expect ce_* false, knowledge_chunks/linkedin_contacts true
-- =============================================================================

BEGIN;

-- -----------------------------------------------------------------------------
-- 0. Allow 'scope_table' as a provenance value.
--    The existing CHECK permits only canonical_d14 / name_rule / manual. Writing
--    scope-table data as 'canonical_d14' would be a label that lies about where the
--    classification came from — precisely the class of defect this migration exists
--    to remove. Add the honest value instead.
-- -----------------------------------------------------------------------------
ALTER TABLE clarity_object DROP CONSTRAINT IF EXISTS clarity_object_act_business_source_check;
ALTER TABLE clarity_object ADD CONSTRAINT clarity_object_act_business_source_check
  CHECK (act_business_source = ANY (ARRAY['canonical_d14','name_rule','manual','scope_table']));

-- -----------------------------------------------------------------------------
-- 1. The 9 genuine ACT objects the scope seed omitted.
--    Adding them here rather than leaning on the name rule is the whole point:
--    it keeps ONE mechanism. Idempotent.
-- -----------------------------------------------------------------------------
INSERT INTO catalog_object_scope (object_name, scope, reason)
SELECT v.name, 'act_private', 'added 2026-08-15: genuine ACT private business, omitted from the original scope seed'
FROM (VALUES
  ('act_communities'), ('goods_supply_routes'), ('goods_asset_lifecycle'),
  ('goods_capital_blocks'), ('goods_content_library'), ('goods_deployment_batches'),
  ('goods_funding_matters'), ('goods_products'), ('goods_relationships')
) AS v(name)
WHERE EXISTS (SELECT 1 FROM clarity_object o WHERE o.object_name = v.name)
ON CONFLICT (object_name) DO NOTHING;

-- -----------------------------------------------------------------------------
-- 2. Replace section G of clarity_refresh(): scope table first, name rule as a
--    residual fallback only. Everything else in the function is untouched.
-- -----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION clarity_apply_act_flag()
RETURNS TABLE (from_scope integer, from_name_rule integer, cleared integer)
LANGUAGE plpgsql
SET search_path TO 'public', 'pg_catalog'
AS $fn$
DECLARE
  v_scope int; v_name int; v_cleared int;
BEGIN
  -- Authoritative, and bidirectional: a civic reclassification now un-flags.
  WITH upd AS (
    UPDATE clarity_object o SET
      act_business        = (s.scope IN ('act_private', 'act_private_review')),
      act_business_source = 'scope_table'
    FROM catalog_object_scope s
    WHERE s.object_name = o.object_name
      AND o.object_kind <> 'function'
      AND o.act_business_source IS DISTINCT FROM 'manual'
    RETURNING o.act_business
  )
  SELECT count(*) FILTER (WHERE act_business), count(*) FILTER (WHERE NOT act_business)
    INTO v_scope, v_cleared FROM upd;

  -- Residual fallback: only objects the scope table has never classified.
  -- ce_users / ce_metrics are deliberately NOT in this pattern — they are civic.
  WITH upd2 AS (
    UPDATE clarity_object o SET
      act_business        = true,
      act_business_source = coalesce(o.act_business_source, 'name_rule')
    WHERE o.object_kind <> 'function'
      AND o.act_business_source IS DISTINCT FROM 'manual'
      AND NOT EXISTS (SELECT 1 FROM catalog_object_scope s WHERE s.object_name = o.object_name)
      AND o.object_name ~ '^(act_|xero_|ghl_|notion_|receipt|finance_|bank_|email_|gmail_|imessage_|telegram_|memory_|calendar_|communications_|sprint|team_members|project_salary|saas_|goods_)'
    RETURNING 1
  )
  SELECT count(*) INTO v_name FROM upd2;

  RETURN QUERY SELECT v_scope, v_name, v_cleared;
END;
$fn$;

COMMENT ON FUNCTION clarity_apply_act_flag() IS
  'Sets clarity_object.act_business from catalog_object_scope (authoritative, bidirectional), '
  'falling back to a name-shape rule ONLY for objects the scope table has not classified. '
  'Replaces the standalone regex in clarity_refresh() section G, which disagreed with the scope '
  'table on 217 objects and could never un-flag a false positive because it only ever set true.';

-- 3. Apply it now so the catalog is correct before the next scheduled refresh.
SELECT * FROM clarity_apply_act_flag();

COMMIT;

-- =============================================================================
-- FOLLOW-UP, not done here: clarity_refresh() still contains the old section G.
-- It is harmless while this function runs after it (the scope join overwrites the
-- name-rule result), but section G should be replaced by a call to
-- clarity_apply_act_flag() so there is genuinely one mechanism rather than one
-- correcting the other.
-- =============================================================================
