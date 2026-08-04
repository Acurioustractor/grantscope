-- Carry what ORIC knows about a corporation onto the entity.
--
-- We have been measuring these organisations by grants and contracts and
-- concluding they receive little. ORIC records what they actually do, and for
-- Central Australia the dominant activity is land and waters management —
-- caring for Country — followed by community stores and royalty distribution.
-- Those are not grant-funded or contract-funded activities, so the instruments
-- we were measuring with were the wrong ruler.
--
-- This also partly answers the invisibility problem. Of 202 community-controlled
-- organisations with no ABN, 48 have an ORIC income band and employee count.
-- They cannot be matched to a single dollar of funding data, but they can be
-- shown to exist, with a sector, a size and a workforce. On a map that is the
-- difference between an empty dot and an organisation caring for Country.
--
-- Income arrives as bands, not dollars ($100k-<$5m, <$100k, >=$5m, 0), and is
-- stored as given. A band is honest; a midpoint would invent precision.
--
-- The sector text carries mojibake from ORIC's own export — "management?care
-- for Country" should read "management – care for Country" — so the question
-- mark is repaired on the way in.

ALTER TABLE public.gs_entities
  ADD COLUMN IF NOT EXISTS oric_sector text,
  ADD COLUMN IF NOT EXISTS oric_size text,
  ADD COLUMN IF NOT EXISTS oric_income_band text,
  ADD COLUMN IF NOT EXISTS oric_employees integer;

CREATE INDEX IF NOT EXISTS gs_entities_oric_sector_idx ON public.gs_entities (oric_sector)
  WHERE oric_sector IS NOT NULL;

COMMENT ON COLUMN public.gs_entities.oric_income_band IS
  'ORIC income band as published. Bands are kept rather than converted to a midpoint, which would invent precision the source does not have.';
COMMENT ON COLUMN public.gs_entities.oric_sector IS
  'ORIC industry sector. Available for many corporations that have no ABN and therefore no traceable funding, so it is often the only evidence of what an organisation does.';

UPDATE public.gs_entities e
   SET oric_sector = nullif(btrim(replace(o.industry_sectors_raw, '?', ' - ')), ''),
       oric_size = o.corporation_size,
       oric_income_band = nullif(btrim(o.income_year1), ''),
       oric_employees = CASE
         WHEN o.employees_year1 ~ '^[0-9]+$' THEN o.employees_year1::integer
         ELSE NULL
       END
  FROM public.oric_corporations o
 WHERE o.icn = e.oric_icn;
