-- =============================================================================
-- MIGRATION: Backfill topic tags + ALMA geography
-- 1. Tag ~3K+ untagged QLD justice_funding records with social-sector topics
-- 2. Add diversion/prevention/community-led topics to justice_funding
-- 3. Fix 117 ALMA records with empty geography arrays
-- 4. Update both trigger functions with expanded keyword coverage
-- =============================================================================

BEGIN;

-- =============================================
-- SECTION 1: Backfill justice_funding topics
-- =============================================

-- Youth Justice (catch untagged programs)
UPDATE justice_funding SET topics = COALESCE(topics, '{}') || ARRAY['youth-justice']::text[]
WHERE NOT (COALESCE(topics, '{}') @> ARRAY['youth-justice']::text[])
  AND (
    program_name ILIKE '%young offend%'
    OR program_name ILIKE '%youth offend%'
    OR program_name ILIKE '%bail support%'
    OR program_name ILIKE '%young people%'
    OR program_name ILIKE '%young adults exiting the care%'
    OR program_name ILIKE '%youth diversion%'
    OR program_name ILIKE '%youth%detention%'
    OR program_name ILIKE '%youth%custod%'
  );

-- Diversion
UPDATE justice_funding SET topics = COALESCE(topics, '{}') || ARRAY['diversion']::text[]
WHERE NOT (COALESCE(topics, '{}') @> ARRAY['diversion']::text[])
  AND (
    program_name ILIKE '%diversion%'
    OR program_name ILIKE '%bail support%'
    OR program_name ILIKE '%conferencing%'
    OR program_name ILIKE '%restorative justice%'
    OR program_name ILIKE '%community justice group%'
    OR program_name ILIKE '%caution%scheme%'
  );

-- Prevention
UPDATE justice_funding SET topics = COALESCE(topics, '{}') || ARRAY['prevention']::text[]
WHERE NOT (COALESCE(topics, '{}') @> ARRAY['prevention']::text[])
  AND (
    program_name ILIKE '%crime prevention%'
    OR program_name ILIKE '%suburban crime prevention%'
    OR program_name ILIKE '%community safety%'
    OR program_name ILIKE '%community-based crime%'
    OR program_name ILIKE '%early intervention%'
    OR program_name ILIKE '%prevention%'
  );

-- Community-led
UPDATE justice_funding SET topics = COALESCE(topics, '{}') || ARRAY['community-led']::text[]
WHERE NOT (COALESCE(topics, '{}') @> ARRAY['community-led']::text[])
  AND (
    program_name ILIKE '%community justice group%'
    OR program_name ILIKE '%community action%'
    OR program_name ILIKE '%social inclusion%'
    OR program_name ILIKE '%social enterprise%'
  );

-- Family Services (catch more patterns)
UPDATE justice_funding SET topics = COALESCE(topics, '{}') || ARRAY['family-services']::text[]
WHERE NOT (COALESCE(topics, '{}') @> ARRAY['family-services']::text[])
  AND (
    program_name ILIKE '%sexual violence%'
    OR program_name ILIKE '%victim service%'
    OR program_name ILIKE '%women%support%'
    OR program_name ILIKE '%homelessness%'
    OR program_name ILIKE '%housing and homelessness%'
    OR program_name ILIKE '%housing & homelessness%'
  );

-- Child Protection (catch more patterns)
UPDATE justice_funding SET topics = COALESCE(topics, '{}') || ARRAY['child-protection']::text[]
WHERE NOT (COALESCE(topics, '{}') @> ARRAY['child-protection']::text[])
  AND (
    program_name ILIKE '%young adults exiting the care%'
    OR program_name ILIKE '%community care%'
    OR program_name ILIKE '%specialised assessment%'
    OR program_name ILIKE '%specialised support service%'
    OR program_name ILIKE '%specialised service and support%'
    OR program_name ILIKE '%specialised supplies%'
  );

-- =============================================
-- SECTION 2: Fix ALMA empty geography arrays
-- =============================================

-- NSW-specific
UPDATE alma_interventions SET geography = ARRAY['NSW']::text[]
WHERE cardinality(geography) = 0
  AND (
    name ILIKE '%NSW%'
    OR name ILIKE '%Communities and Justice%'
  );

-- NSW/ACT shared
UPDATE alma_interventions SET geography = ARRAY['NSW', 'ACT']::text[]
WHERE cardinality(geography) = 0
  AND (
    name ILIKE '%NSW/ACT%'
    OR name ILIKE '%(NSW/ACT)%'
  );

-- ACT-specific
UPDATE alma_interventions SET geography = ARRAY['ACT']::text[]
WHERE cardinality(geography) = 0
  AND (
    name ILIKE '%ACT Government%'
    OR name ILIKE '%ACT%' AND name NOT ILIKE '%NSW/ACT%'
  );

-- QLD-specific
UPDATE alma_interventions SET geography = ARRAY['QLD']::text[]
WHERE cardinality(geography) = 0
  AND (
    name ILIKE '%Queensland%'
    OR name ILIKE '%Brisbane%'
    OR name ILIKE '%QATSICPP%'
    OR name ILIKE '%Micah Projects%'
    OR name ILIKE '%Ozcare%'
    OR name ILIKE '%Relationships Australia QLD%'
    OR name ILIKE '%Archdiocese of Brisbane%'
    OR name ILIKE '%Youth Justice Conferencing%'
  );

-- VIC-specific
UPDATE alma_interventions SET geography = ARRAY['VIC']::text[]
WHERE cardinality(geography) = 0
  AND (
    name ILIKE '%Victoria%'
    OR name ILIKE '%VALS%'
    OR name ILIKE '%Youthlaw%'
    OR name ILIKE '%Endeavour Foundation%'
    OR name ILIKE '%Multicap%'
    OR name ILIKE '%The Men''s Project%'
  );

-- NT-specific
UPDATE alma_interventions SET geography = ARRAY['NT']::text[]
WHERE cardinality(geography) = 0
  AND (
    name ILIKE '%NAAJA%'
  );

-- SA-specific
UPDATE alma_interventions SET geography = ARRAY['SA']::text[]
WHERE cardinality(geography) = 0
  AND (
    name ILIKE '%Aboriginal Legal Rights Movement%'
  );

-- TAS-specific
UPDATE alma_interventions SET geography = ARRAY['TAS']::text[]
WHERE cardinality(geography) = 0
  AND (
    name ILIKE '%Department for Education, Children and Young People%'
  );

-- WA-specific
UPDATE alma_interventions SET geography = ARRAY['WA']::text[]
WHERE cardinality(geography) = 0
  AND (
    name ILIKE '%Juvenile Justice Team%'
    OR name ILIKE '%Aboriginal Welfare Officers%'
    OR name ILIKE '%Aboriginal Visitors Scheme%'
  );

-- National programs (remainder — agencies, peak bodies, policy-level)
UPDATE alma_interventions SET geography = ARRAY['National']::text[]
WHERE cardinality(geography) = 0
  AND (
    name ILIKE '%National%'
    OR name ILIKE '%NATSILS%'
    OR name ILIKE '%ATSILS%'
    OR name ILIKE '%SNAICC%'
    OR name ILIKE '%Australian%'
    OR name ILIKE '%Change the Record%'
    OR name ILIKE '%Family Matters%'
    OR name ILIKE '%Human Rights Law%'
    OR name ILIKE '%Attorney-General%'
    OR name ILIKE '%Royal Commission%'
    OR name ILIKE '%Closing the Gap%'
    OR name ILIKE '%Safe & Supported%'
    OR name ILIKE '%Connected Beginnings%'
    OR name ILIKE '%Proven Initiatives%'
  );

-- Catch remaining generic/policy entries as National
UPDATE alma_interventions SET geography = ARRAY['National']::text[]
WHERE cardinality(geography) = 0;

-- =============================================
-- SECTION 3: Update trigger functions
-- =============================================

-- Update justice_funding trigger with expanded topics
CREATE OR REPLACE FUNCTION classify_justice_funding_topics()
RETURNS TRIGGER AS $$
BEGIN
  NEW.topics := ARRAY_REMOVE(ARRAY[
    CASE WHEN NEW.program_name ILIKE '%child protection%'
         OR NEW.program_name ILIKE '%child safety%'
         OR NEW.program_name ILIKE '%out of home care%'
         OR NEW.program_name ILIKE '%foster care%'
         OR NEW.program_name ILIKE '%child related costs%'
         OR NEW.program_name ILIKE '%kinship%'
         OR NEW.program_name ILIKE '%residential care%'
         OR NEW.program_name ILIKE '%care leav%'
         OR NEW.program_name ILIKE '%community care%'
         OR NEW.program_name ILIKE '%specialised support service%'
         OR NEW.program_name ILIKE '%specialised assessment%'
         OR NEW.program_name ILIKE '%young adults exiting the care%'
    THEN 'child-protection' END,

    CASE WHEN NEW.program_name ILIKE '%youth justice%'
         OR NEW.program_name ILIKE '%juvenile%'
         OR NEW.program_name LIKE 'ROGS Youth Justice%'
         OR NEW.program_name ILIKE '%young offend%'
         OR NEW.program_name ILIKE '%youth offend%'
         OR NEW.program_name ILIKE '%bail support%'
         OR NEW.program_name ILIKE '%young people%'
    THEN 'youth-justice' END,

    CASE WHEN NEW.program_name ILIKE '%ndis%'
         OR NEW.program_name ILIKE '%disability%'
    THEN 'ndis' END,

    CASE WHEN NEW.program_name ILIKE '%family%'
         OR NEW.program_name ILIKE '%domestic violence%'
         OR NEW.program_name ILIKE '%sexual violence%'
         OR NEW.program_name ILIKE '%victim service%'
         OR NEW.program_name ILIKE '%homelessness%'
    THEN 'family-services' END,

    CASE WHEN NEW.program_name ILIKE '%indigenous%'
         OR NEW.program_name ILIKE '%aboriginal%'
         OR NEW.program_name ILIKE '%torres strait%'
    THEN 'indigenous' END,

    CASE WHEN NEW.program_name ILIKE '%legal%'
         OR NEW.program_name ILIKE '%court%'
    THEN 'legal-services' END,

    CASE WHEN NEW.program_name ILIKE '%diversion%'
         OR NEW.program_name ILIKE '%bail support%'
         OR NEW.program_name ILIKE '%conferencing%'
         OR NEW.program_name ILIKE '%restorative justice%'
         OR NEW.program_name ILIKE '%community justice group%'
    THEN 'diversion' END,

    CASE WHEN NEW.program_name ILIKE '%crime prevention%'
         OR NEW.program_name ILIKE '%community safety%'
         OR NEW.program_name ILIKE '%early intervention%'
         OR NEW.program_name ILIKE '%prevention%'
    THEN 'prevention' END,

    CASE WHEN NEW.program_name ILIKE '%community justice group%'
         OR NEW.program_name ILIKE '%community action%'
         OR NEW.program_name ILIKE '%social inclusion%'
         OR NEW.program_name ILIKE '%social enterprise%'
    THEN 'community-led' END
  ], NULL);
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Update ALMA trigger with expanded topics
CREATE OR REPLACE FUNCTION classify_alma_topics()
RETURNS TRIGGER AS $$
BEGIN
  NEW.topics := ARRAY_REMOVE(ARRAY[
    CASE WHEN NEW.name ILIKE '%child%' OR NEW.name ILIKE '%protect%'
         OR NEW.name ILIKE '%foster%' OR NEW.name ILIKE '%out of home%'
    THEN 'child-protection' END,

    CASE WHEN NEW.name ILIKE '%youth%' OR NEW.name ILIKE '%justice%'
         OR NEW.name ILIKE '%juvenile%' OR NEW.name ILIKE '%detention%'
    THEN 'youth-justice' END,

    CASE WHEN NEW.name ILIKE '%disab%' OR NEW.name ILIKE '%ndis%'
    THEN 'ndis' END,

    CASE WHEN NEW.name ILIKE '%indigenous%' OR NEW.name ILIKE '%aboriginal%'
         OR NEW.type = 'Cultural Connection'
    THEN 'indigenous' END,

    CASE WHEN NEW.name ILIKE '%diversion%' OR NEW.type = 'Diversion'
    THEN 'diversion' END,

    CASE WHEN NEW.name ILIKE '%prevention%' OR NEW.type = 'Prevention'
         OR NEW.type = 'Early Intervention'
    THEN 'prevention' END,

    CASE WHEN NEW.type = 'Community-Led' OR NEW.type = 'Justice Reinvestment'
         OR NEW.name ILIKE '%community-led%' OR NEW.name ILIKE '%co-design%'
    THEN 'community-led' END,

    CASE WHEN NEW.type = 'Wraparound Support'
         OR NEW.name ILIKE '%wraparound%' OR NEW.name ILIKE '%support service%'
    THEN 'wraparound' END,

    CASE WHEN NEW.name ILIKE '%family%' OR NEW.type = 'Family Strengthening'
    THEN 'family-services' END
  ], NULL);
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

COMMIT;

-- =============================================
-- SECTION 4: Re-run ALMA topic classification
-- (outside transaction for visibility)
-- =============================================

-- Refire the ALMA trigger by touching all records
UPDATE alma_interventions SET topics = NULL;
UPDATE alma_interventions SET name = name;

-- =============================================
-- SECTION 5: Report results
-- =============================================

SELECT '--- justice_funding topic counts ---' as report;
SELECT unnest(topics) as topic, COUNT(*) as records
FROM justice_funding
WHERE source != 'austender-direct'
GROUP BY topic
ORDER BY records DESC;

SELECT '--- justice_funding still untagged (social-sector) ---' as report;
SELECT COUNT(*) as still_untagged
FROM justice_funding
WHERE (topics IS NULL OR cardinality(topics) = 0)
  AND source != 'austender-direct'
  AND (
    program_name ILIKE '%youth%' OR program_name ILIKE '%justice%'
    OR program_name ILIKE '%child%' OR program_name ILIKE '%family%'
    OR program_name ILIKE '%diversion%' OR program_name ILIKE '%community justice%'
  );

SELECT '--- ALMA geography coverage ---' as report;
SELECT
  COUNT(*) FILTER (WHERE cardinality(geography) > 0) as has_geo,
  COUNT(*) FILTER (WHERE cardinality(geography) = 0) as empty_geo,
  COUNT(*) as total
FROM alma_interventions;

SELECT '--- ALMA topic counts ---' as report;
SELECT unnest(topics) as topic, COUNT(*) as records
FROM alma_interventions
GROUP BY topic
ORDER BY records DESC;
