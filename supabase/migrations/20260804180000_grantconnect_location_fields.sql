-- Capture location fields GrantConnect publishes and we were discarding.
--
-- The award export carries both where the recipient is and where the work is
-- delivered. AusTender has no delivery field at all, which is why MacDonnell
-- Shire Council's money read as Alice Springs and why remote communities looked
-- unfunded. Grants do not have that blind spot, so these columns make grants the
-- better instrument for place-based work — the opposite of what we assumed.
--
-- delivery_postcode in particular allows a grant to be attributed to the
-- community it serves rather than to the head office that received it.

ALTER TABLE public.grantconnect_awards
  ADD COLUMN IF NOT EXISTS recipient_suburb text,
  ADD COLUMN IF NOT EXISTS recipient_town_city text,
  ADD COLUMN IF NOT EXISTS recipient_postcode text,
  ADD COLUMN IF NOT EXISTS recipient_state text,
  ADD COLUMN IF NOT EXISTS delivery_state text,
  ADD COLUMN IF NOT EXISTS delivery_postcode text,
  ADD COLUMN IF NOT EXISTS grant_program text,
  ADD COLUMN IF NOT EXISTS grant_activity text,
  ADD COLUMN IF NOT EXISTS purpose text;

CREATE INDEX IF NOT EXISTS grantconnect_awards_delivery_postcode_idx
  ON public.grantconnect_awards (delivery_postcode) WHERE delivery_postcode IS NOT NULL;
CREATE INDEX IF NOT EXISTS grantconnect_awards_recipient_abn_idx
  ON public.grantconnect_awards (recipient_abn) WHERE recipient_abn IS NOT NULL;

COMMENT ON COLUMN public.grantconnect_awards.delivery_postcode IS
  'Where the funded work is delivered, as published. Lets a grant be attributed to the community served rather than the head office that received it — AusTender has no equivalent field.';
