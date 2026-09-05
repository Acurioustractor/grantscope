-- NOT APPLIED — pooler saturated 2026-06-10; apply with psql -f
--
-- Goods on Country — Advisory Circle (QBE Diagnostic Area 07).
-- Area 07 rule: advisory relationships are NEVER presented as a board. To honour
-- that, advisers must be a distinct contact_type, not folded into 'governance'.
-- This migration adds 'advisory' to the org_contacts.contact_type CHECK and the
-- three fields the advisory surface reads, all additive + idempotent.
--
-- ASSUMPTIONS (verify against information_schema before applying):
--   - org_contacts.contact_type is text NOT NULL with a CHECK constraint named
--     org_contacts_contact_type_check whose allowed set is exactly:
--       governance | funder | partner | supplier | political | community | advocacy
--     If the constraint name differs, adjust the DROP below. Confirm with:
--       SELECT conname, pg_get_constraintdef(oid) FROM pg_constraint
--       WHERE conrelid = 'org_contacts'::regclass AND contype = 'c';
--   - expertise / last_contacted_at / engagement_ask do not yet exist on
--     org_contacts. ADD COLUMN IF NOT EXISTS makes the column adds idempotent.
--   - No existing rows carry contact_type values outside the current allowed set,
--     so re-adding the CHECK cannot fail on legacy data (we only widen the set).

-- 1. Widen the contact_type CHECK to allow 'advisory'.
-- DROP + recreate: a CHECK can only be widened by replacing it. IF EXISTS keeps
-- the drop idempotent; the recreate is the full allowed set plus 'advisory'.
ALTER TABLE org_contacts
  DROP CONSTRAINT IF EXISTS org_contacts_contact_type_check;

ALTER TABLE org_contacts
  ADD CONSTRAINT org_contacts_contact_type_check
  CHECK (contact_type IN (
    'governance',
    'funder',
    'partner',
    'supplier',
    'political',
    'community',
    'advocacy',
    'advisory'
  ));

-- 2. Advisory-specific fields (additive, all nullable, no backfill required).
ALTER TABLE org_contacts
  ADD COLUMN IF NOT EXISTS expertise text[],
  ADD COLUMN IF NOT EXISTS last_contacted_at date,
  ADD COLUMN IF NOT EXISTS engagement_ask text;

COMMENT ON COLUMN org_contacts.expertise IS
  'Adviser expertise areas, e.g. {''Impact measurement'',''First Nations enterprise''}. Rendered as tags on the Advisory Circle.';
COMMENT ON COLUMN org_contacts.last_contacted_at IS
  'When this adviser was last engaged — keeps the advisory relationship honest (advisers are relationships to maintain, not a standing board).';
COMMENT ON COLUMN org_contacts.engagement_ask IS
  'The specific, time-bound ask of this adviser, e.g. "Review the QBE evidence pack before 30 Jun". Advisers are engaged for a task, never seated on a board.';
