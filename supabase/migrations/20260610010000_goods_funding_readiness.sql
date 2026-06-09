-- Goods funding readiness: ask sizing on the warmth registry + board governance fields.
-- Additive only — all columns nullable, no backfill required.

ALTER TABLE goods_relationships
  ADD COLUMN IF NOT EXISTS ask_amount_aud numeric,
  ADD COLUMN IF NOT EXISTS ask_purpose text;

COMMENT ON COLUMN goods_relationships.ask_amount_aud IS
  'Size of the current open ask in AUD. Stage-weighted pipeline value derives from this (see STAGE_PROBABILITY in goods-engagement-shared.ts).';
COMMENT ON COLUMN goods_relationships.ask_purpose IS
  'What the open ask funds, e.g. "40 beds — Palm Island round 2".';

ALTER TABLE org_contacts
  ADD COLUMN IF NOT EXISTS appointed_at date,
  ADD COLUMN IF NOT EXISTS term_ends_at date,
  ADD COLUMN IF NOT EXISTS identifies_indigenous boolean;

COMMENT ON COLUMN org_contacts.appointed_at IS
  'Board/governance appointment date — funder due-diligence needs who was appointed when.';
COMMENT ON COLUMN org_contacts.term_ends_at IS
  'Governance term expiry, if fixed-term.';
COMMENT ON COLUMN org_contacts.identifies_indigenous IS
  'Self-identified. Used only for aggregate board composition stats (Indigenous-led %). NULL = not stated.';
