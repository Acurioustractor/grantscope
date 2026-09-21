-- Store the eligibility enricher's confidence and evidence, not just its answer.
--
-- Apply:  scripts/db-apply.sh supabase/migrations/20260921040000_grant_eligibility_confidence.sql
--
-- Why (2026-09-21 abstention audit): enrich-grant-eligibility.mjs asks the model
-- for a confidence from 0 to 1 and for a one-sentence quote from the page. Both
-- were logged to the console and discarded; only the five booleans were written.
-- A 0.2 verdict landed exactly like a 0.95 one, and these five flags decide
-- whether ACT can apply to a grant at all -- a low-confidence dgr_required=true
-- silently removes a grant from the desk with nothing to distinguish it from a
-- certain one.
--
-- With these columns the script writes the flags only at or above a measured
-- floor of 0.7, and records the confidence, the page quote and the provider on
-- every verdict including the refused ones.
--
-- Nothing is backfilled. Every existing row's flags were written with no floor,
-- so their confidence is genuinely unknown and NULL says so. They are re-derived
-- on the next enrichment pass.

BEGIN;

ALTER TABLE public.grant_opportunities
  ADD COLUMN IF NOT EXISTS eligibility_confidence numeric,
  ADD COLUMN IF NOT EXISTS eligibility_summary   text,
  ADD COLUMN IF NOT EXISTS eligibility_provider  text;

COMMENT ON COLUMN public.grant_opportunities.eligibility_confidence IS
  'Model self-reported confidence 0-1 for the accepts_*/dgr_required flags. Flags are only written at >= 0.7 (scripts/lib/grant-eligibility-verdict.mjs). NULL = written before the floor existed, or the verdict was refused.';
COMMENT ON COLUMN public.grant_opportunities.eligibility_summary IS
  'One sentence quoted from the grant page stating who may apply. The evidence behind the eligibility flags.';
COMMENT ON COLUMN public.grant_opportunities.eligibility_provider IS
  'Which LLM provider produced the eligibility verdict.';

ALTER TABLE public.grant_opportunities
  ADD CONSTRAINT grant_opportunities_eligibility_confidence_range
  CHECK (eligibility_confidence IS NULL OR (eligibility_confidence >= 0 AND eligibility_confidence <= 1))
  NOT VALID;

COMMIT;

-- Post-check:
--   SELECT column_name, data_type FROM information_schema.columns
--   WHERE table_name = 'grant_opportunities'
--     AND column_name IN ('eligibility_confidence','eligibility_summary','eligibility_provider');
--   SELECT conname FROM pg_constraint
--   WHERE conrelid = 'public.grant_opportunities'::regclass
--     AND conname = 'grant_opportunities_eligibility_confidence_range';
