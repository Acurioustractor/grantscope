-- foundation-type-reclassify-v4.sql
-- Final pass: remaining 483 grantmakers — catch stragglers

BEGIN;

-- International aid (more patterns)
UPDATE foundations SET type = 'international_aid'
WHERE type = 'grantmaker' AND (
  name ILIKE '%life you can save%'
  OR name ILIKE '%urgent action fund%'
  OR name ILIKE '%pew charitable%'
  OR name ILIKE '%effective altruism%'
  OR name ILIKE '%australians in mission%'
  OR name ILIKE '%acc international relief%'
  OR name ILIKE '%mary mackillop today%'
  OR name ILIKE '%penny appeal%'
  OR name ILIKE '%hamlin fistula%'
  OR name ILIKE '%coptic orphans%'
  OR name ILIKE '%aid distribution international%'
  OR name ILIKE '%destiny rescue%'
  OR name ILIKE '%inf limited%'
  OR name ILIKE '%rapid relief team%'
  OR name ILIKE '%farm angels%'
);

-- Service delivery (more)
UPDATE foundations SET type = 'service_delivery'
WHERE type = 'grantmaker' AND (
  name ILIKE '%benevolent%' OR name ILIKE '%benevolence%'
  OR name ILIKE '%good shepherd%'
  OR name ILIKE '%star community%'
  OR name ILIKE '%new horizons enterprises%'
  OR name ILIKE '%st john%community care%'
  OR name ILIKE '%kari ltd%'
  OR name ILIKE '%bedingfeld%'
  OR name ILIKE '%veterans retreat%'
  OR name ILIKE '%steer incorporated%'
  OR name ILIKE '%family planning%'
  OR name ILIKE '%uniting country%'
  OR name ILIKE '%jetco%'
  OR name ILIKE '%darebin enterprise%'
  OR name ILIKE '%southern cross institute%'
  OR name ILIKE '%health workforce%'
  OR name ILIKE '%health equity%'
  OR name ILIKE '%health services charitable%'
);

-- Research / science
UPDATE foundations SET type = 'research_body'
WHERE type = 'grantmaker' AND (
  name ILIKE '%academy of science%'
  OR name ILIKE '%parenting research%'
  OR name ILIKE '%marine science%'
  OR name ILIKE '%ai safety%'
  OR name ILIKE '%cancer trials%'
);

-- Environmental (NRM bodies)
UPDATE foundations SET type = 'environmental'
WHERE type = 'grantmaker' AND (
  name ILIKE '%nrm ltd%'
  OR name ILIKE '%dry tropics%'
  OR name ILIKE '%natural resource%'
);

-- Peak bodies
UPDATE foundations SET type = 'peak_body'
WHERE type = 'grantmaker' AND (
  name ILIKE '%cota australia%'
  OR name ILIKE '%services for australian rural%'
  OR name ILIKE '%variety %children%charity%'
);

-- Animal welfare (RSPCA state branches)
UPDATE foundations SET type = 'animal_welfare'
WHERE type = 'grantmaker' AND (
  name ILIKE '%prevention of cruelty to animals%'
  OR name ILIKE '%rspca%'
);

-- Now tag the ones that ARE actually philanthropic foundations
-- These are genuine grantmaking trusts/funds that should stay
UPDATE foundations SET type = 'philanthropic_foundation'
WHERE type = 'grantmaker' AND (
  name ILIKE '%sunrise project%'
  OR name ILIKE '%vincent fairfax%'
  OR name ILIKE '%rose fund%'
  OR name ILIKE '%sidney myer fund%'
  OR name ILIKE '%edith collier%'
  OR name ILIKE '%wyatt benevolent%'
);

-- Report
SELECT type, COUNT(*) FROM foundations WHERE type IN ('grantmaker','philanthropic_foundation','international_aid','service_delivery','research_body','environmental','peak_body','animal_welfare','health_charity') GROUP BY type ORDER BY count DESC;

COMMIT;
