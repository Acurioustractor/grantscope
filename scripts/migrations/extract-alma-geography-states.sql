-- Extract state abbreviations from compound ALMA geography entries
-- For each entry like "South East Queensland", ensure "QLD" is also in the array
-- Does NOT modify the compound entries themselves, just ensures the abbreviation is present

BEGIN;

-- Queensland compounds → ensure QLD is in array
UPDATE alma_interventions
SET geography = array_append(geography, 'QLD')
WHERE geography::text ILIKE '%queensland%'
  AND NOT ('QLD' = ANY(geography))
  -- Exclude the "Victoria" false positive
  AND NOT (geography::text ILIKE '%e.g., Victoria%');

-- Western Australia compounds → ensure WA is in array
UPDATE alma_interventions
SET geography = array_append(geography, 'WA')
WHERE geography::text ILIKE '%western australia%'
  AND NOT ('WA' = ANY(geography));

-- Northern Territory compounds → ensure NT is in array
UPDATE alma_interventions
SET geography = array_append(geography, 'NT')
WHERE geography::text ILIKE '%northern territory%'
  AND NOT ('NT' = ANY(geography));

-- South Australia compounds → ensure SA is in array
UPDATE alma_interventions
SET geography = array_append(geography, 'SA')
WHERE geography::text ILIKE '%south australia%'
  AND NOT ('SA' = ANY(geography));

-- Tasmania compounds → ensure TAS is in array
UPDATE alma_interventions
SET geography = array_append(geography, 'TAS')
WHERE geography::text ILIKE '%tasmania%'
  AND NOT ('TAS' = ANY(geography));

-- NSW from "Queensland and NSW" etc → ensure NSW is in array
UPDATE alma_interventions
SET geography = array_append(geography, 'NSW')
WHERE geography::text ILIKE '%new south wales%' OR geography::text ILIKE '% NSW%'
  AND NOT ('NSW' = ANY(geography));

-- Victoria compounds — skip, only match is "Australia (e.g., Victoria)" which is not VIC

-- ACT compounds → ensure ACT is in array
UPDATE alma_interventions
SET geography = array_append(geography, 'ACT')
WHERE geography::text ILIKE '%australian capital territory%'
  AND NOT ('ACT' = ANY(geography));

COMMIT;
