-- Goods Command Center · Phase 1 · Engagement & Warmth Map
-- Plan: thoughts/shared/plans/goods-command-center-2026-06-09.md
-- Unified relationship registry that rolls up the scattered warmth signals
-- (saved_foundations, opportunity_decisions, org_pipeline/GHL, goods_procurement_entities,
--  historical funding) into one row per funder/investor/partner/buyer, with a
--  HYBRID warmth model: computed baseline (goods_compute_warmth) + manual override.
-- Apply with: source .env && PGPASSWORD="$DATABASE_PASSWORD" psql -h aws-0-ap-southeast-2.pooler.supabase.com -p 5432 -U "postgres.tednluwflfhxyucgwigh" -d postgres -f supabase/migrations/20260609060000_goods_relationships_engagement.sql

BEGIN;

CREATE TABLE IF NOT EXISTS goods_relationships (
  id                uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  relationship_type text NOT NULL CHECK (relationship_type IN
    ('funder','impact_investor','repayable_finance','production_partner','buyer','supporter','advocate')),
  display_name      text NOT NULL,
  entity_id         uuid REFERENCES gs_entities(id) ON DELETE SET NULL,
  ghl_contact_id    text,
  ghl_opportunity_id text,
  -- normalized engagement ladder (each GHL/source stage maps onto this)
  stage             text NOT NULL DEFAULT 'identified' CHECK (stage IN
    ('identified','researching','contacted','in_conversation','proposal','committed','repeat','dormant','declined')),
  target_stage      text CHECK (target_stage IN
    ('identified','researching','contacted','in_conversation','proposal','committed','repeat')),
  -- HYBRID warmth: computed baseline + optional manual override
  warmth_computed   int NOT NULL DEFAULT 0 CHECK (warmth_computed BETWEEN 0 AND 100),
  warmth_override   int CHECK (warmth_override BETWEEN 0 AND 100),
  warmth_display    int GENERATED ALWAYS AS (COALESCE(warmth_override, warmth_computed)) STORED,
  -- signal inputs (denormalized from sources so warmth recompute is cheap)
  last_touch_at     timestamptz,
  total_received_aud numeric NOT NULL DEFAULT 0,
  alignment_score   numeric,
  has_prior_support boolean NOT NULL DEFAULT false,
  advocacy_score    numeric NOT NULL DEFAULT 0,
  -- next-best-action ("what to do to get closer")
  next_action       text,
  next_action_due   date,
  warm_intro_path   text,            -- e.g. "X (their board) also connects to Y you know"
  -- provenance + free text
  source_refs       jsonb NOT NULL DEFAULT '{}'::jsonb,
  notes             text,
  -- stable dedupe key for reliable ON CONFLICT upsert during seeding
  -- (plain stored column + plain unique index, per the partial-index upsert gotcha)
  dedupe_key        text GENERATED ALWAYS AS
    (relationship_type || ':' || COALESCE(entity_id::text, lower(display_name))) STORED,
  created_at        timestamptz NOT NULL DEFAULT now(),
  updated_at        timestamptz NOT NULL DEFAULT now()
);

CREATE UNIQUE INDEX IF NOT EXISTS uq_goods_rel_dedupe   ON goods_relationships(dedupe_key);
CREATE INDEX        IF NOT EXISTS idx_goods_rel_type    ON goods_relationships(relationship_type);
CREATE INDEX        IF NOT EXISTS idx_goods_rel_entity  ON goods_relationships(entity_id) WHERE entity_id IS NOT NULL;
CREATE INDEX        IF NOT EXISTS idx_goods_rel_warmth  ON goods_relationships(warmth_display DESC);

COMMENT ON TABLE goods_relationships IS
  'Goods Command Center unified engagement registry (funders/investors/partners/buyers). Phase 1.';

-- ---------------------------------------------------------------------------
-- Warmth compute: STABLE (uses now() for recency decay -> must be re-run by the
-- seed/refresh job; it is not IMMUTABLE). Weights match the plan doc:
--   Stage 40% · Recency 20% · History 20% · Alignment 15% · Advocacy 5%.
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION goods_compute_warmth(
  p_stage          text,
  p_last_touch     timestamptz,
  p_total_received numeric,
  p_alignment      numeric,
  p_has_prior      boolean,
  p_advocacy       numeric DEFAULT 0
) RETURNS int
LANGUAGE plpgsql STABLE AS $fn$
DECLARE
  v_stage   numeric := 0;
  v_recency numeric := 0;
  v_history numeric := 0;
  v_align   numeric := 0;
  v_adv     numeric := 0;
  v_days    numeric;
BEGIN
  -- Stage (40%) — position on the normalized ladder
  v_stage := CASE p_stage
    WHEN 'identified'      THEN 10
    WHEN 'researching'     THEN 25
    WHEN 'contacted'       THEN 40
    WHEN 'in_conversation' THEN 60
    WHEN 'proposal'        THEN 75
    WHEN 'committed'       THEN 90
    WHEN 'repeat'          THEN 100
    WHEN 'dormant'         THEN 20
    ELSE 0
  END;

  -- Recency (20%) — exponential decay, ~42-day half-life
  IF p_last_touch IS NULL THEN
    v_recency := 0;
  ELSE
    v_days := EXTRACT(EPOCH FROM (now() - p_last_touch)) / 86400.0;
    v_recency := GREATEST(0, 100 * exp(-GREATEST(v_days, 0) / 60.0));
  END IF;

  -- History (20%) — prior giving/partnering floor + log-scaled $ received
  IF p_has_prior THEN
    v_history := LEAST(100, 50 + 12 * ln(GREATEST(1, COALESCE(p_total_received, 0)) / 1000.0 + 1));
  ELSE
    v_history := 0;
  END IF;

  -- Alignment (15%) and Advocacy (5%) — clamp to 0..100
  v_align := LEAST(100, GREATEST(0, COALESCE(p_alignment, 0)));
  v_adv   := LEAST(100, GREATEST(0, COALESCE(p_advocacy, 0)));

  RETURN ROUND(v_stage * 0.40 + v_recency * 0.20 + v_history * 0.20 + v_align * 0.15 + v_adv * 0.05)::int;
END;
$fn$;

-- updated_at touch trigger
CREATE OR REPLACE FUNCTION goods_relationships_touch_updated_at() RETURNS trigger
LANGUAGE plpgsql AS $trg$
BEGIN
  NEW.updated_at := now();
  RETURN NEW;
END;
$trg$;

DROP TRIGGER IF EXISTS trg_goods_relationships_updated ON goods_relationships;
CREATE TRIGGER trg_goods_relationships_updated
  BEFORE UPDATE ON goods_relationships
  FOR EACH ROW EXECUTE FUNCTION goods_relationships_touch_updated_at();

COMMIT;
