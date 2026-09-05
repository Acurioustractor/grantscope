-- Topic tags: classify justice_funding and alma_interventions by topic
-- so reports can filter by tag instead of ILIKE pattern matching.
-- This eliminates statement timeouts from ILIKE on large JOINs.

-- 1. Add topics column to justice_funding
ALTER TABLE justice_funding ADD COLUMN IF NOT EXISTS topics text[] DEFAULT '{}';

-- 2. Add topics column to alma_interventions
ALTER TABLE alma_interventions ADD COLUMN IF NOT EXISTS topics text[] DEFAULT '{}';

-- 3. GIN indexes for fast array containment (@>) queries
CREATE INDEX IF NOT EXISTS idx_justice_funding_topics ON justice_funding USING GIN (topics);
CREATE INDEX IF NOT EXISTS idx_alma_interventions_topics ON alma_interventions USING GIN (topics);

-- 4. Backfill justice_funding topics from program_name patterns
UPDATE justice_funding SET topics = (
  SELECT ARRAY_REMOVE(ARRAY[
    CASE WHEN program_name ILIKE '%child protection%'
         OR program_name ILIKE '%child safety%'
         OR program_name ILIKE '%out of home care%'
         OR program_name ILIKE '%foster care%'
         OR program_name ILIKE '%child related costs%'
         OR program_name ILIKE '%kinship%'
         OR program_name ILIKE '%residential care%'
         OR program_name ILIKE '%care leav%'
    THEN 'child-protection' END,

    CASE WHEN program_name ILIKE '%youth justice%'
         OR program_name ILIKE '%juvenile%'
         OR program_name LIKE 'ROGS Youth Justice%'
    THEN 'youth-justice' END,

    CASE WHEN program_name ILIKE '%ndis%'
         OR program_name ILIKE '%disability%'
    THEN 'ndis' END,

    CASE WHEN program_name ILIKE '%family%'
         OR program_name ILIKE '%domestic violence%'
         OR program_name ILIKE '%family safety%'
    THEN 'family-services' END,

    CASE WHEN program_name ILIKE '%indigenous%'
         OR program_name ILIKE '%aboriginal%'
         OR program_name ILIKE '%torres strait%'
         OR program_name ILIKE '%first nations%'
    THEN 'indigenous' END,

    CASE WHEN program_name ILIKE '%legal%'
         OR program_name ILIKE '%court%'
         OR program_name ILIKE '%justice admin%'
    THEN 'legal-services' END
  ], NULL)
)
WHERE topics = '{}' OR topics IS NULL;

-- 5. Backfill alma_interventions topics from name/description/type
UPDATE alma_interventions SET topics = (
  SELECT ARRAY_REMOVE(ARRAY[
    CASE WHEN name ILIKE '%child%'
         OR name ILIKE '%protect%'
         OR name ILIKE '%foster%'
         OR name ILIKE '%kinship%'
         OR name ILIKE '%family%preserv%'
         OR name ILIKE '%out of home%'
         OR name ILIKE '%residential%'
         OR description ILIKE '%child protection%'
         OR description ILIKE '%out-of-home%'
         OR description ILIKE '%foster care%'
    THEN 'child-protection' END,

    CASE WHEN name ILIKE '%youth%'
         OR name ILIKE '%justice%'
         OR name ILIKE '%juvenile%'
         OR name ILIKE '%detention%'
    THEN 'youth-justice' END,

    CASE WHEN name ILIKE '%disab%'
         OR name ILIKE '%ndis%'
    THEN 'ndis' END,

    CASE WHEN name ILIKE '%indigenous%'
         OR name ILIKE '%aboriginal%'
         OR name ILIKE '%first nations%'
         OR type = 'Cultural Connection'
    THEN 'indigenous' END,

    CASE WHEN name ILIKE '%diversion%'
         OR type = 'Diversion'
    THEN 'diversion' END,

    CASE WHEN name ILIKE '%prevention%'
         OR type = 'Prevention'
    THEN 'prevention' END,

    CASE WHEN name ILIKE '%wraparound%'
         OR type = 'Wraparound Support'
    THEN 'wraparound' END,

    CASE WHEN type = 'Community-Led'
    THEN 'community-led' END
  ], NULL)
)
WHERE topics = '{}' OR topics IS NULL;

-- 6. Auto-tag trigger for new justice_funding rows
CREATE OR REPLACE FUNCTION classify_justice_funding_topics()
RETURNS TRIGGER AS $fn$
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
    THEN 'child-protection' END,

    CASE WHEN NEW.program_name ILIKE '%youth justice%'
         OR NEW.program_name ILIKE '%juvenile%'
         OR NEW.program_name LIKE 'ROGS Youth Justice%'
    THEN 'youth-justice' END,

    CASE WHEN NEW.program_name ILIKE '%ndis%'
         OR NEW.program_name ILIKE '%disability%'
    THEN 'ndis' END,

    CASE WHEN NEW.program_name ILIKE '%family%'
         OR NEW.program_name ILIKE '%domestic violence%'
    THEN 'family-services' END,

    CASE WHEN NEW.program_name ILIKE '%indigenous%'
         OR NEW.program_name ILIKE '%aboriginal%'
         OR NEW.program_name ILIKE '%torres strait%'
    THEN 'indigenous' END,

    CASE WHEN NEW.program_name ILIKE '%legal%'
         OR NEW.program_name ILIKE '%court%'
    THEN 'legal-services' END
  ], NULL);
  RETURN NEW;
END;
$fn$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_classify_justice_funding ON justice_funding;
CREATE TRIGGER trg_classify_justice_funding
  BEFORE INSERT OR UPDATE OF program_name ON justice_funding
  FOR EACH ROW EXECUTE FUNCTION classify_justice_funding_topics();

-- 7. Auto-tag trigger for new alma_interventions rows
CREATE OR REPLACE FUNCTION classify_alma_topics()
RETURNS TRIGGER AS $fn$
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
    THEN 'prevention' END
  ], NULL);
  RETURN NEW;
END;
$fn$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_classify_alma ON alma_interventions;
CREATE TRIGGER trg_classify_alma
  BEFORE INSERT OR UPDATE OF name, type ON alma_interventions
  FOR EACH ROW EXECUTE FUNCTION classify_alma_topics();
