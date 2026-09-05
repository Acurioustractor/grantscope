-- Attribute councils to the area they serve, nationally.
--
-- The Northern Territory fix generalises: a council's head office sits where it
-- is convenient, and for remote councils that is often another LGA entirely.
-- Lockhart River Aboriginal Shire Council was recorded in Cairns, Shire of
-- Ngaanyatjarraku in Kalgoorlie-Boulder, Mornington Shire in Napranum. In every
-- case the hub was credited with money raised to serve somewhere remote.
--
-- The matching rule is deliberately strict, because a loose one places
-- organisations that merely mention a council. Stripping the council words from
-- the name must leave the LGA name and nothing else:
--
--   Lockhart River Aboriginal Shire Council -> LOCKHART RIVER  = LGA, accepted
--   City of Perth Band Incorporated         -> PERTH BAND INC != LGA, rejected
--   Blacktown City Council Blue Knot Foundation -> ... BLUE KNOT, rejected
--   Lismore Orchid Society                  -> ORCHID SOCIETY, rejected
--
-- Those four are real organisations that happen to carry a council's name, and
-- an earlier draft of this rule moved all of them.

WITH state_map AS (
  SELECT * FROM (VALUES
    ('NSW','New South Wales'), ('VIC','Victoria'), ('QLD','Queensland'),
    ('SA','South Australia'), ('WA','Western Australia'), ('TAS','Tasmania'),
    ('NT','Northern Territory'), ('ACT','Australian Capital Territory')
  ) AS t(code, name)
), council AS (
  SELECT e.id, e.state,
         -- Strip the words that describe the body, leaving the place.
         btrim(regexp_replace(
           upper(e.canonical_name),
           '\y(SHIRE|REGIONAL|CITY|DISTRICT|MUNICIPAL|TOWN|ABORIGINAL|COUNCIL|OF|THE|CORPORATION)\y',
           ' ', 'g')) AS place_token
    FROM public.gs_entities e
   WHERE e.canonical_name ~* '(shire|regional|city|district|municipal|town) council|^shire of |^city of |^district council of |^town of '
), matched AS (
  SELECT DISTINCT ON (c.id) c.id, l.lga_name, l.lga_code
    FROM council c
    JOIN state_map sm ON sm.code = c.state
    JOIN (SELECT DISTINCT lga_name, lga_code, state_name FROM public.abs_locality_lga) l
      ON l.state_name = sm.name
     -- Equality after normalising whitespace, not containment.
     AND regexp_replace(c.place_token, '\s+', ' ', 'g')
       = regexp_replace(upper(l.lga_name), '\s+', ' ', 'g')
   ORDER BY c.id, length(l.lga_name) DESC
)
UPDATE public.gs_entities e
   SET lga_name = m.lga_name,
       lga_code = m.lga_code,
       lga_source = 'council_serves_shire'
  FROM matched m
 WHERE m.id = e.id
   AND e.lga_name IS DISTINCT FROM m.lga_name;
