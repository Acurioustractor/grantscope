-- Standardise ALMA geography tags: full state names → abbreviations
-- Uses array_replace() for exact element matching (safe, no substring issues)

BEGIN;

UPDATE alma_interventions SET geography = array_replace(geography, 'Queensland', 'QLD') WHERE 'Queensland' = ANY(geography);
UPDATE alma_interventions SET geography = array_replace(geography, 'Western Australia', 'WA') WHERE 'Western Australia' = ANY(geography);
UPDATE alma_interventions SET geography = array_replace(geography, 'South Australia', 'SA') WHERE 'South Australia' = ANY(geography);
UPDATE alma_interventions SET geography = array_replace(geography, 'Northern Territory', 'NT') WHERE 'Northern Territory' = ANY(geography);
UPDATE alma_interventions SET geography = array_replace(geography, 'Tasmania', 'TAS') WHERE 'Tasmania' = ANY(geography);
UPDATE alma_interventions SET geography = array_replace(geography, 'Australian Capital Territory', 'ACT') WHERE 'Australian Capital Territory' = ANY(geography);
UPDATE alma_interventions SET geography = array_replace(geography, 'New South Wales', 'NSW') WHERE 'New South Wales' = ANY(geography);
UPDATE alma_interventions SET geography = array_replace(geography, 'Victoria', 'VIC') WHERE 'Victoria' = ANY(geography);

COMMIT;
