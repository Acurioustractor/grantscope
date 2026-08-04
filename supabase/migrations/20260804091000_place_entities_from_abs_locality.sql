-- Place entities using the ABS locality correspondence.
--
-- The chain is entity -> locality -> LGA. The middle link comes from the ACNC
-- register's town_city, the last from abs_locality_lga.
--
-- Three constraints keep this from repeating earlier mistakes:
--
--   State must match. Locality names repeat across the country, and matching on
--   name alone would scatter organisations into the wrong states — the same
--   class of error as remote NT landing in Laverton.
--
--   Only unambiguous localities are used. Where a locality straddles two
--   councils, lga_count > 1 and it is left alone rather than assigned to
--   whichever row sorted first.
--
--   Only entities with no LGA are touched. An existing value came from
--   somewhere and is not overwritten on the strength of a town name.
--
-- ORIC-registered corporations are largely unreachable here: ORIC publishes no
-- address, so 192 of the 210 organisations in postcode 0872 have no locality to
-- match on. That gap needs an ORIC address extract, not a better correspondence.

UPDATE public.gs_entities e
   SET lga_name = l.lga_name,
       lga_code = l.lga_code
  FROM public.acnc_charities a
  JOIN public.abs_locality_lga l
    ON l.locality = upper(trim(a.town_city))
   AND l.lga_count = 1
 WHERE a.abn = e.abn
   AND e.abn IS NOT NULL
   AND e.lga_name IS NULL
   AND a.town_city IS NOT NULL
   AND l.state_name = CASE e.state
     WHEN 'NT' THEN 'Northern Territory'
     WHEN 'NSW' THEN 'New South Wales'
     WHEN 'VIC' THEN 'Victoria'
     WHEN 'QLD' THEN 'Queensland'
     WHEN 'SA' THEN 'South Australia'
     WHEN 'WA' THEN 'Western Australia'
     WHEN 'TAS' THEN 'Tasmania'
     WHEN 'ACT' THEN 'Australian Capital Territory'
   END;

-- Update the 0872 gap register to reflect what remains unplaced.
UPDATE public.geo_resolution_gaps g
   SET affected_entities = sub.total,
       affected_community_controlled = sub.cc,
       required_source = 'ORIC address extract — the ABS locality correspondence is now loaded, but ORIC publishes no address for its corporations',
       detected_at = now()
  FROM (
    SELECT count(*)::int AS total,
           count(*) FILTER (WHERE is_community_controlled OR entity_type = 'indigenous_corp')::int AS cc
      FROM public.gs_entities
     WHERE postcode = '0872' AND state IN ('NT','SA') AND lga_name IS NULL
  ) sub
 WHERE g.postcode = '0872';
