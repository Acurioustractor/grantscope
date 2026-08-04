-- Two corrections found while building the place profile.
--
-- 1. ORIC employee counts are bands, not numbers.
--
-- employees_year1 holds '<5', '5 - 24', '>24' and '0'. Parsing it as an integer
-- silently kept only the literal zeros and discarded every organisation that
-- actually employs people, so every place showed a workforce of nil. The band
-- is kept as text; a midpoint would invent precision the source does not have.
--
-- 2. postcode_geo has no usable rows for the remote councils.
--
-- The geocoding fix nulled state and LGA on all 80 localities of postcode 0872,
-- because they were all stamped Laverton, WA. That was right at the time but it
-- left nothing to join on, so Central Desert and APY Lands have no SEIFA and no
-- remoteness — the disadvantage layer is blank for exactly the places that need
-- it most.
--
-- The ABS locality correspondence is now loaded, so those rows can be repaired
-- properly rather than left empty. Only localities sitting in a single council,
-- and only the three states postcode 0872 actually spans.

ALTER TABLE public.gs_entities
  ADD COLUMN IF NOT EXISTS oric_employee_band text;

COMMENT ON COLUMN public.gs_entities.oric_employee_band IS
  'ORIC workforce band as published (<5, 5 - 24, >24, 0). Kept as a band because the source does not give a count.';

UPDATE public.gs_entities e
   SET oric_employee_band = nullif(btrim(o.employees_year1), '')
  FROM public.oric_corporations o
 WHERE o.icn = e.oric_icn;

-- The integer column only ever held zeros, so it is misleading. The place
-- profile view is rebuilt against the band in the next migration.
DROP VIEW IF EXISTS public.v_lga_place_profile;
ALTER TABLE public.gs_entities DROP COLUMN IF EXISTS oric_employees;

UPDATE public.postcode_geo pg
   SET state = CASE l.state_name
                 WHEN 'Northern Territory' THEN 'NT'
                 WHEN 'South Australia' THEN 'SA'
                 WHEN 'Western Australia' THEN 'WA'
               END,
       lga_name = l.lga_name,
       lga_code = l.lga_code
  FROM public.abs_locality_lga l
 WHERE pg.postcode = '0872'
   AND upper(btrim(pg.locality)) = l.locality
   AND l.lga_count = 1
   AND l.state_name IN ('Northern Territory', 'South Australia', 'Western Australia');
