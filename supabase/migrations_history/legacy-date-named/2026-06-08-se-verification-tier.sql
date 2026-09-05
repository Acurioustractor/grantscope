-- Verification tier for social_enterprises (buyer-wedge move 4)
-- certified > verified > identified — strength of EXTERNAL verification, not SE-ness.
-- Computed by scripts/compute-se-verification-tiers.mjs; this just adds the columns.

ALTER TABLE social_enterprises
  ADD COLUMN IF NOT EXISTS verification_tier text
    CHECK (verification_tier IN ('certified', 'verified', 'identified')),
  ADD COLUMN IF NOT EXISTS verification_basis text,
  ADD COLUMN IF NOT EXISTS verification_computed_at timestamptz;

CREATE INDEX IF NOT EXISTS idx_se_verification_tier
  ON social_enterprises (verification_tier);

COMMENT ON COLUMN social_enterprises.verification_tier IS
  'certified = external mark (Social Traders/Supply Nation/BuyAbility/B Corp); verified = statutory register or state-network member with ABN; identified = directory/LLM-classified. See docs/strategy/buyer-wedge.md';
