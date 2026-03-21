-- foundation-type-reclassify-unknown.sql
-- Classify 294 'unknown' (formerly NULL) type foundations

BEGIN;

-- Ancillary funds
UPDATE foundations SET type = 'private_ancillary_fund'
WHERE type = 'unknown' AND name ILIKE '%ancillary fund%';

-- Endowment funds → philanthropic_foundation
UPDATE foundations SET type = 'philanthropic_foundation'
WHERE type = 'unknown' AND (
  name ILIKE '%endowment%'
  OR name ILIKE '%charitable fund%'
  OR name ILIKE '%charitable endowment%'
);

-- Health charities
UPDATE foundations SET type = 'health_charity'
WHERE type = 'unknown' AND (
  name ILIKE '%cancer council%'
  OR name ILIKE '%diabetes%'
);

-- Religious
UPDATE foundations SET type = 'religious_organisation'
WHERE type = 'unknown' AND (
  name ILIKE '%catholic church%'
  OR name ILIKE '%anglican%'
  OR name ILIKE '%diocesan%'
  OR name ILIKE '%baha%i%'
  OR name ILIKE '%wayside chapel%'
);

-- Service delivery
UPDATE foundations SET type = 'service_delivery'
WHERE type = 'unknown' AND (
  name ILIKE '%cabrini health%'
  OR name ILIKE '%sargents charity%'
);

-- Arts
UPDATE foundations SET type = 'arts_culture'
WHERE type = 'unknown' AND (
  name ILIKE '%art museum%'
);

-- Environmental
UPDATE foundations SET type = 'environmental'
WHERE type = 'unknown' AND (
  name ILIKE '%desert channels%'
);

-- Research
UPDATE foundations SET type = 'research_body'
WHERE type = 'unknown' AND (
  name ILIKE '%research institute%'
  OR name ILIKE '%science and industry%'
);

-- Giving platforms / community foundations
UPDATE foundations SET type = 'community_foundation'
WHERE type = 'unknown' AND (
  name ILIKE '%paypal giving%'
  OR name ILIKE '%good2give%'
  OR name ILIKE '%give where you live%'
  OR name ILIKE '%groundswell giving%'
  OR name ILIKE '%workplace giving%'
  OR name ILIKE '%australian philanthropic services%'
  OR name ILIKE '%lord mayor%charitable%'
);

-- Education (school funds)
UPDATE foundations SET type = 'education_body'
WHERE type = 'unknown' AND (
  name ILIKE '%college%fund%'
  OR name ILIKE '%college%endowment%'
  OR name ILIKE '%school%fund%'
);

SELECT COUNT(*) as remaining_unknown FROM foundations WHERE type = 'unknown';

COMMIT;
