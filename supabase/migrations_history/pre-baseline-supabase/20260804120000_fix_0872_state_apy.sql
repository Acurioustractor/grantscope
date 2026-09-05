-- Correct the state for organisations in postcode 0872.
--
-- The geocoding fix trusted gs_entities.state, on the reasoning that it came
-- from registration and was more reliable than the postcode lookup. For 0872
-- that reasoning was wrong: the state was itself inherited from the postcode,
-- and 0872 spans the Northern Territory, South Australia and Western Australia.
--
-- So APY Lands organisations in South Australia — Iwantja, Mimili, Kaltjiti,
-- Pukatja — have been recorded as Northern Territory throughout.
--
-- They are corrected the same way remote NT organisations were placed: by the
-- community named in the organisation's own name, matched to the ABS locality
-- list. The guard that matters is the jurisdiction filter. Postcode 0872 exists
-- only in NT, SA and WA, so a match to any other state is impossible by
-- construction, and without that filter this fires on:
--
--   Western Aranda Health Aboriginal Corporation -> ARANDA, a Canberra suburb
--   Fraser Aboriginal Corporation                -> FRASER, a Canberra suburb
--   Research "Us" Aboriginal Corporation         -> RESEARCH, a Melbourne suburb
--
-- Western Aranda is Western Arrernte and belongs in Central Australia. A name
-- that happens to contain a suburb name is not evidence of location.

WITH m AS (
  SELECT e.id,
         l.state_name,
         l.lga_name,
         l.lga_code,
         count(*) OVER (PARTITION BY e.id) AS hits
    FROM public.gs_entities e
    JOIN public.abs_locality_lga l
      ON l.lga_count = 1
     AND length(l.locality) >= 6
     AND upper(e.canonical_name) ~ ('(^|[^A-Z])' || l.locality || '([^A-Z]|$)')
   WHERE e.postcode = '0872'
     AND e.lga_name IS NULL
     -- Only jurisdictions postcode 0872 actually covers.
     AND l.state_name IN ('Northern Territory', 'South Australia', 'Western Australia')
)
UPDATE public.gs_entities e
   SET state = CASE m.state_name
                 WHEN 'Northern Territory' THEN 'NT'
                 WHEN 'South Australia' THEN 'SA'
                 WHEN 'Western Australia' THEN 'WA'
               END,
       lga_name = m.lga_name,
       lga_code = m.lga_code,
       lga_source = 'inferred_from_org_name'
  FROM m
 WHERE m.id = e.id
   AND m.hits = 1;

UPDATE public.geo_resolution_gaps g
   SET affected_entities = sub.total,
       affected_community_controlled = sub.cc,
       detected_at = now()
  FROM (
    SELECT count(*)::int AS total,
           count(*) FILTER (WHERE is_community_controlled OR entity_type = 'indigenous_corp')::int AS cc
      FROM public.gs_entities
     WHERE postcode = '0872' AND lga_name IS NULL
  ) sub
 WHERE g.postcode = '0872';
