-- Stop assigning remote NT and SA communities to a Western Australian shire.
--
-- Postcode 0872 is the largest in Australia. It covers the remote centre —
-- Utopia, Yuendumu, Papunya, Hermannsburg, Ali Curung, Ampilatwatja — plus the
-- APY Lands in South Australia and a slice of remote WA.
--
-- postcode_geo holds 80 locality rows for it. Every one is stamped
-- state='WA', lga_name='Laverton', lga_code=54970, sharing a single SA2. So
-- ALI CURUNG, AMPILATWATJA, AREYONGA and AMATA are all recorded as being in a
-- shire in Western Australia.
--
-- 210 Northern Territory organisations inherited that LGA, and 202 of them are
-- Aboriginal community-controlled. Every LGA-level product built on this —
-- mv_funding_by_lga, mv_funding_deserts and the desert scores — has been
-- counting remote NT money against a WA council. The error lands precisely on
-- the communities with the least visibility to begin with.
--
-- This migration does NOT invent the right answer. Resolving each locality to
-- its true LGA needs the ABS locality-to-LGA correspondence, which we do not
-- hold. Guessing from place names would replace a wrong assertion with a
-- confident one, which is the failure this codebase keeps finding.
--
-- Instead it removes the false assertion and registers the gap, so these
-- organisations read as unresolved rather than as Western Australian. They drop
-- out of LGA rollups, which is a visible absence rather than a silent
-- misattribution — and geo_resolution_gaps records exactly what is missing and
-- what would fix it.

CREATE TABLE IF NOT EXISTS public.geo_resolution_gaps (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  postcode text NOT NULL,
  issue text NOT NULL,
  affected_entities integer NOT NULL DEFAULT 0,
  affected_community_controlled integer NOT NULL DEFAULT 0,
  required_source text NOT NULL,
  detected_at timestamptz NOT NULL DEFAULT now(),
  resolved_at timestamptz,
  UNIQUE (postcode, issue)
);

ALTER TABLE public.geo_resolution_gaps ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Authenticated read geo gaps" ON public.geo_resolution_gaps;
CREATE POLICY "Authenticated read geo gaps"
  ON public.geo_resolution_gaps FOR SELECT TO authenticated USING (true);
DROP POLICY IF EXISTS "Service role manages geo gaps" ON public.geo_resolution_gaps;
CREATE POLICY "Service role manages geo gaps"
  ON public.geo_resolution_gaps FOR ALL TO service_role USING (true) WITH CHECK (true);
GRANT SELECT ON public.geo_resolution_gaps TO authenticated;
GRANT ALL ON public.geo_resolution_gaps TO service_role;

COMMENT ON TABLE public.geo_resolution_gaps IS
  'Register of known geocoding gaps. A gap recorded here is visible and countable; the alternative is a confident wrong location.';

-- Record the gap before clearing the values, so the count reflects what was affected.
INSERT INTO public.geo_resolution_gaps (postcode, issue, affected_entities, affected_community_controlled, required_source)
SELECT
  '0872',
  'All 80 postcode_geo localities stamped WA/Laverton, including NT and SA APY communities',
  count(*)::int,
  count(*) FILTER (WHERE is_community_controlled OR entity_type = 'indigenous_corp')::int,
  'ABS locality-to-LGA correspondence (or equivalent gazetteer) for postcode 0872 across NT, SA and WA'
FROM public.gs_entities
WHERE postcode = '0872' AND state IN ('NT','SA')
ON CONFLICT (postcode, issue) DO UPDATE SET
  affected_entities = EXCLUDED.affected_entities,
  affected_community_controlled = EXCLUDED.affected_community_controlled,
  detected_at = now();

-- Clear the false LGA on NT and SA entities. Their own state field comes from
-- registration and is more trustworthy than this postcode lookup, so state is
-- left alone; only the fabricated LGA goes.
UPDATE public.gs_entities
   SET lga_name = NULL, lga_code = NULL
 WHERE postcode = '0872'
   AND state IN ('NT','SA')
   AND lga_code = '54970';

-- Clear the reference rows so nothing re-derives Laverton from them. The
-- locality names are still useful and are kept; only the unusable
-- state/LGA/SA2 assertions are removed.
UPDATE public.postcode_geo
   SET lga_name = NULL, lga_code = NULL, state = NULL, sa2_code = NULL
 WHERE postcode = '0872';
