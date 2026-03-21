-- foundation-type-reclassify-v6.sql
-- Final sweep of remaining 356 grantmakers

BEGIN;

-- Service delivery (housing, employment, disability, aged care, community services)
UPDATE foundations SET type = 'service_delivery'
WHERE type = 'grantmaker' AND (
  name ILIKE '%we help ourselves%'
  OR name ILIKE '%worklinks%'
  OR name ILIKE '%wayss%'
  OR name ILIKE '%asylum seeker%'
  OR name ILIKE '%technical aid%disabled%'
  OR name ILIKE '%communify%'
  OR name ILIKE '%community resources%'
  OR name ILIKE '%wpcgroup%'
  OR name ILIKE '%chabad house%'
  OR name ILIKE '%health assist%'
  OR name ILIKE '%indochinese elderly%'
  OR name ILIKE '%little sisters of the poor%'
  OR name ILIKE '%feed the hungry%'
  OR name ILIKE '%equipping for life%'
  OR name ILIKE '%grief and bereavement%'
  OR name ILIKE '%mrael%'
  OR name ILIKE '%creating links%'
  OR name ILIKE '%drug%' AND name NOT ILIKE '%foundation%'
  OR name ILIKE '%refuge%' AND name NOT ILIKE '%fund%'
  OR name ILIKE '%meals on wheels%'
  OR name ILIKE '%settlement%'
  OR name ILIKE '%housing%'
  OR name ILIKE '%homeless%'
  OR name ILIKE '%foster care%'
  OR name ILIKE '%child %services%'
  OR name ILIKE '%women%shelter%'
  OR name ILIKE '%counselling%'
  OR name ILIKE '%rehabilitation%'
  OR name ILIKE '%respite%'
  OR name ILIKE '%employment%'
  OR name ILIKE '%workforce%'
  OR name ILIKE '%headspace%'
  OR name ILIKE '%community care%'
  OR name ILIKE '%neighbourhood%'
  OR name ILIKE '%good samaritan%'
);

-- International aid
UPDATE foundations SET type = 'international_aid'
WHERE type = 'grantmaker' AND (
  name ILIKE '%omf international%'
  OR name ILIKE '%anglicans in development%'
  OR name ILIKE '%asian aid%'
  OR name ILIKE '%australian marist solidarity%'
  OR name ILIKE '%ywam%'
  OR name ILIKE '%wycliffe%'
  OR name ILIKE '%interserve%'
  OR name ILIKE '%mission%' AND name NOT ILIKE '%foundation%'
  OR name ILIKE '%overseas%' AND name NOT ILIKE '%fund%' AND name NOT ILIKE '%foundation%'
);

-- Environmental
UPDATE foundations SET type = 'environmental'
WHERE type = 'grantmaker' AND (
  name ILIKE '%youth climate%'
  OR name ILIKE '%catchment%' OR name ILIKE '%catchments%'
  OR name ILIKE '%reef%'
  OR name ILIKE '%river%' AND name NOT ILIKE '%foundation%'
  OR name ILIKE '%greening%'
  OR name ILIKE '%trees%' AND name NOT ILIKE '%foundation%'
);

-- Research
UPDATE foundations SET type = 'research_body'
WHERE type = 'grantmaker' AND (
  name ILIKE '%brien holden%'
  OR name ILIKE '%veski%'
  OR name ILIKE '%musculo-skeletal%'
  OR name ILIKE '%institute%' AND name NOT ILIKE '%trustee%' AND name NOT ILIKE '%foundation%'
);

-- Peak bodies
UPDATE foundations SET type = 'peak_body'
WHERE type = 'grantmaker' AND (
  name ILIKE '%aged %community services australia%'
  OR name ILIKE '%state emergency service%'
  OR name ILIKE '%cota %'
);

-- Education
UPDATE foundations SET type = 'education_body'
WHERE type = 'grantmaker' AND (
  name ILIKE '%building fund%'
  OR name ILIKE '%bursary%'
  OR name ILIKE '%scholarship%' AND name NOT ILIKE '%foundation%'
);

-- Philanthropic foundation (genuine)
UPDATE foundations SET type = 'philanthropic_foundation'
WHERE type = 'grantmaker' AND (
  name ILIKE '%felton bequest%'
);

SELECT COUNT(*) as remaining FROM foundations WHERE type = 'grantmaker';

COMMIT;
