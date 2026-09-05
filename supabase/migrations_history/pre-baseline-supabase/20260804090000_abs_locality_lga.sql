-- abs_locality_lga — the authoritative locality-to-council reference.
--
-- Derived from two ABS ASGS Edition 3 allocation files, joined on mesh block:
--   SAL_2021_AUST.xlsx  mesh block -> suburb/locality name and state
--   LGA_2025_AUST.xlsx  mesh block -> local government area
--
-- This is the reference geo_resolution_gaps has been asking for. Postcode 0872
-- spans three states and four councils, so no postcode-keyed lookup can place
-- an organisation in it. Locality can.
--
-- lga_count records how many councils a locality touches. 92.2% of localities
-- sit in exactly one; the rest straddle a boundary and must not be used to
-- assign a single council without further evidence.

CREATE TABLE IF NOT EXISTS public.abs_locality_lga (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  locality text NOT NULL,
  state_name text NOT NULL,
  lga_code text NOT NULL,
  lga_name text NOT NULL,
  lga_count integer NOT NULL DEFAULT 1,
  source text NOT NULL DEFAULT 'ABS ASGS Ed3 SAL_2021_AUST + LGA_2025_AUST',
  loaded_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (locality, state_name, lga_code)
);

CREATE INDEX IF NOT EXISTS abs_locality_lga_locality_idx ON public.abs_locality_lga (locality);
CREATE INDEX IF NOT EXISTS abs_locality_lga_unambiguous_idx ON public.abs_locality_lga (locality, state_name)
  WHERE lga_count = 1;

ALTER TABLE public.abs_locality_lga ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Public read abs locality lga" ON public.abs_locality_lga;
CREATE POLICY "Public read abs locality lga"
  ON public.abs_locality_lga FOR SELECT TO anon, authenticated USING (true);
DROP POLICY IF EXISTS "Service role manages abs locality lga" ON public.abs_locality_lga;
CREATE POLICY "Service role manages abs locality lga"
  ON public.abs_locality_lga FOR ALL TO service_role USING (true) WITH CHECK (true);
GRANT SELECT ON public.abs_locality_lga TO anon, authenticated;
GRANT ALL ON public.abs_locality_lga TO service_role;

COMMENT ON TABLE public.abs_locality_lga IS
  'ABS ASGS Edition 3 locality-to-LGA correspondence, built from the SAL and LGA mesh block allocation files. Use lga_count = 1 before assigning a council.';
