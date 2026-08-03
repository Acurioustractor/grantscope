-- Place remote corporations by the community in their own name.
--
-- ORIC publishes no address and declines bulk data requests, so 138 remote
-- organisations still have no council. Many, however, are named for the
-- community they belong to: Yuendumu Magpies Football Aboriginal Corporation,
-- Titjikala Community Store, Ampilatwatja Health Centre.
--
-- Matching those names against the ABS locality list places them. This is
-- inference, not registry fact — a corporation can be named for a place and
-- operate from another — so it is recorded as such in lga_source rather than
-- being passed off as an address. Anything downstream can exclude it.
--
-- Guards: word-boundary matching so a locality cannot match inside a longer
-- word, a six-character minimum so short names like HART do not fire, and only
-- localities sitting in exactly one council.

ALTER TABLE public.gs_entities
  ADD COLUMN IF NOT EXISTS lga_source text;

COMMENT ON COLUMN public.gs_entities.lga_source IS
  'How the LGA was determined: registry_address where derived from a published address, inferred_from_org_name where taken from the community named in the organisation name. Null for pre-existing values.';

-- Mark what we placed from real addresses in the previous migration, so the
-- weaker inference below is distinguishable from it.
UPDATE public.gs_entities
   SET lga_source = 'registry_address'
 WHERE lga_name IS NOT NULL AND lga_source IS NULL;

WITH candidate AS (
  SELECT e.id,
         l.lga_name,
         l.lga_code,
         count(*) OVER (PARTITION BY e.id) AS match_count
    FROM public.gs_entities e
    JOIN public.abs_locality_lga l
      ON l.lga_count = 1
     AND l.state_name = 'Northern Territory'
     AND length(l.locality) >= 6
     AND upper(e.canonical_name) ~ ('(^|[^A-Z])' || l.locality || '([^A-Z]|$)')
   WHERE e.state = 'NT'
     AND e.postcode = '0872'
     AND e.lga_name IS NULL
)
UPDATE public.gs_entities e
   SET lga_name = c.lga_name,
       lga_code = c.lga_code,
       lga_source = 'inferred_from_org_name'
  FROM candidate c
 WHERE c.id = e.id
   -- Only where the name points at exactly one community.
   AND c.match_count = 1;

-- Refresh the gap register to what genuinely remains.
UPDATE public.geo_resolution_gaps g
   SET affected_entities = sub.total,
       affected_community_controlled = sub.cc,
       required_source = 'ORIC will not release addresses in bulk and discourages custom requests. Remaining organisations are not named for their community, so placing them needs a direct approach to ORIC or the communities themselves.',
       detected_at = now()
  FROM (
    SELECT count(*)::int AS total,
           count(*) FILTER (WHERE is_community_controlled OR entity_type = 'indigenous_corp')::int AS cc
      FROM public.gs_entities
     WHERE postcode = '0872' AND state IN ('NT','SA') AND lga_name IS NULL
  ) sub
 WHERE g.postcode = '0872';
