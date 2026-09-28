-- The Harvest: fields an event needs to carry itself on the What's On page.
--
-- end_date   optional last day, for events that run across more than one date
-- image_url  a picture for the event card
-- link_url   where "more details" goes: an RSVP form, a ticket page, a story post
-- featured   marks an event as an anchor that leads What's On
--
-- Source: The Harvest Website, drizzle/manual/0007_event_anchor_fields.sql (branch
-- feat/site-review-pizza-now, commit aa4a3cf). Additive only: nullable columns and
-- one boolean with a default, so the code running before this change is unaffected.
-- Safe to run more than once. No grants: harvest_events is read by the Harvest
-- server, and its existing policies are unchanged.

BEGIN;

ALTER TABLE public.harvest_events
  ADD COLUMN IF NOT EXISTS end_date date,
  ADD COLUMN IF NOT EXISTS image_url text,
  ADD COLUMN IF NOT EXISTS link_url text,
  ADD COLUMN IF NOT EXISTS featured boolean NOT NULL DEFAULT false;

COMMIT;

-- Post-check:
-- SELECT column_name, data_type, is_nullable, column_default
--   FROM information_schema.columns
--  WHERE table_schema = 'public' AND table_name = 'harvest_events'
--    AND column_name IN ('end_date', 'image_url', 'link_url', 'featured');
-- Expect four rows; featured is NOT NULL with default false.
