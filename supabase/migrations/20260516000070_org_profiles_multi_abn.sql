-- Multi-ABN support for org_profiles.
--
-- ACT has three legal entities:
--   - Nicholas Marchesi sole trader  ABN 21 591 780 066  (active trading, all
--     historical revenue + expense lives here)
--   - A Curious Tractor Pty Ltd      ACN 697 347 676 / ABN PENDING
--   - A Kind Tractor Ltd (charity)   ABN 73 669 029 341 (dormant)
--
-- Until today, org_profiles.abn for ACT was the ACN '697347676' (incorrect —
-- ACN ≠ ABN). Dashboard queries that filter by ABN found nothing because
-- there are no austender/justice_funding/foundation_grantees rows under any
-- of the 3 identifiers.
--
-- This migration:
--   1. Adds additional_abns text[] for secondary ABNs (sole trader, charity)
--   2. Adds acn text for the ACN reference (display only, not used for joins)
--   3. Backfills ACT with: primary abn=21591780066 (sole trader, the one
--      with all the Xero history), additional_abns=[73669029341] (charity),
--      acn=697347676 (Pty Ltd identifier).
--
-- Service-layer change (separate commit) will OR-match across the union.

ALTER TABLE org_profiles
  ADD COLUMN IF NOT EXISTS additional_abns text[] DEFAULT '{}',
  ADD COLUMN IF NOT EXISTS acn text;

COMMENT ON COLUMN org_profiles.additional_abns IS
  'Secondary ABNs an org operates under. Service functions union with primary abn for cross-system lookups.';
COMMENT ON COLUMN org_profiles.acn IS
  'ACN reference (display only). For joins use abn + additional_abns.';

-- Backfill ACT: switch primary to sole-trader ABN (where the data lives),
-- move ACN out of the abn field, list charity ABN as additional.
UPDATE org_profiles
SET
  abn = '21591780066',
  additional_abns = ARRAY['73669029341'],
  acn = '697347676',
  updated_at = now()
WHERE slug = 'act';
