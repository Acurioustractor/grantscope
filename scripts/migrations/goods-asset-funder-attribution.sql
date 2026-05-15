-- B1: funder attribution on assets + linkage helpers.
--
-- Adds columns so every bed/washer can record who paid for it, when, and via
-- which invoice. Trip prep at Utopia needs this: "100 beds paid by Snow".

ALTER TABLE goods_asset_lifecycle
  ADD COLUMN IF NOT EXISTS funded_by_funder_id  UUID,       -- soft FK to foundations.id (no enforced FK — funders may be Xero contacts not in foundations table)
  ADD COLUMN IF NOT EXISTS funded_by_label      TEXT,       -- "Snow Foundation", "FRRR", etc. Free-text canonical.
  ADD COLUMN IF NOT EXISTS funded_amount_aud    NUMERIC,    -- $ allocated to this asset
  ADD COLUMN IF NOT EXISTS funded_via_invoice   TEXT,       -- Xero invoice ref e.g. INV-0321
  ADD COLUMN IF NOT EXISTS paid_at              DATE,
  ADD COLUMN IF NOT EXISTS deployment_batch_id  UUID,       -- groups bulk deployments together
  ADD COLUMN IF NOT EXISTS deployment_notes     TEXT;

CREATE INDEX IF NOT EXISTS idx_goods_asset_lifecycle_funder ON goods_asset_lifecycle (funded_by_funder_id) WHERE funded_by_funder_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_goods_asset_lifecycle_batch  ON goods_asset_lifecycle (deployment_batch_id) WHERE deployment_batch_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_goods_asset_lifecycle_community ON goods_asset_lifecycle (community_id) WHERE community_id IS NOT NULL;

COMMENT ON COLUMN goods_asset_lifecycle.funded_by_label IS
  'Free-text funder canonical name. Source of truth for "who paid for this asset". E.g. "Snow Foundation", "TFN", "FRRR", "Vincent Fairfax".';
COMMENT ON COLUMN goods_asset_lifecycle.deployment_batch_id IS
  'UUID grouping a single deployment event (e.g., 100 beds delivered to Utopia 2026-05-20).';

-- Track deployment batches separately so we can summarise "Utopia trip May 2026 = 100 beds, 5 washers, paid by Snow"
CREATE TABLE IF NOT EXISTS goods_deployment_batches (
  id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  community_id        UUID REFERENCES goods_communities(id) ON DELETE SET NULL,
  community_name      TEXT NOT NULL,
  product_slug        TEXT NOT NULL,
  product_type        TEXT,
  unit_count          INTEGER NOT NULL,
  funded_by_label     TEXT,
  funded_by_funder_id UUID,
  funded_amount_aud   NUMERIC,
  funded_via_invoice  TEXT,
  deployed_at         DATE NOT NULL DEFAULT CURRENT_DATE,
  deployed_by         TEXT,
  notes               TEXT,
  created_at          TIMESTAMPTZ DEFAULT NOW(),
  updated_at          TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_goods_deployment_batches_community ON goods_deployment_batches (community_id);
CREATE INDEX IF NOT EXISTS idx_goods_deployment_batches_funder ON goods_deployment_batches (funded_by_funder_id);
CREATE INDEX IF NOT EXISTS idx_goods_deployment_batches_deployed_at ON goods_deployment_batches (deployed_at DESC);

COMMENT ON TABLE goods_deployment_batches IS
  'One row per bulk deployment event (e.g., 100 beds to Ampilatwatja on 2026-05-20 paid by Snow). Each generates N asset_lifecycle rows linked via deployment_batch_id.';
