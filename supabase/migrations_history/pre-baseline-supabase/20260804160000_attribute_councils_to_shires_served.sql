-- Attribute regional councils to the shire they serve, not their head office.
--
-- Remote communities receive much of their funding through their regional
-- council and through land councils rather than directly. Those councils keep
-- their head offices in the regional hub, so procurement records them at the
-- hub's postcode:
--
--   MacDonnell Shire Council      $44.1M   recorded in Alice Springs (0870)
--   Central Desert Shire Council  $16.8M   recorded in Alice Springs (0870)
--   Victoria Daly Shire Council    $9.8M   recorded in Roper Gulf
--
-- So Central Desert read as having no current funding at all while its own
-- council held $16.8M, and Alice Springs absorbed money raised to deliver
-- services hundreds of kilometres away. A place page built on that would tell
-- remote communities they receive nothing, which is the precise falsehood this
-- work exists to correct.
--
-- A regional council serves its shire by definition, so its name is sound
-- evidence of where it operates — stronger than a head office postcode. The
-- attribution is recorded as council_serves_shire in lga_source so it can be
-- separated from a registered address.
--
-- This does not touch land council royalty distribution, which remains
-- invisible: land councils appear in the graph only through shared directors,
-- with no money attached. Those flows run through the Aboriginal Benefit
-- Account and land council annual reports, neither of which is a bulk dataset.

UPDATE public.gs_entities e
   SET lga_name = m.lga_name,
       lga_code = m.lga_code,
       lga_source = 'council_serves_shire'
  FROM (
    SELECT DISTINCT ON (ent.id) ent.id, l.lga_name, l.lga_code
      FROM public.gs_entities ent
      JOIN (SELECT DISTINCT lga_name, lga_code, state_name FROM public.abs_locality_lga) l
        ON upper(ent.canonical_name) LIKE upper(l.lga_name) || '%'
     WHERE ent.canonical_name ~* '(shire|regional) council'
       AND l.state_name = 'Northern Territory'
       AND length(l.lga_name) >= 5
     ORDER BY ent.id, length(l.lga_name) DESC
  ) m
 WHERE m.id = e.id
   AND e.lga_name IS DISTINCT FROM m.lga_name;
