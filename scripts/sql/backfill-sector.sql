-- Backfill gs_entities.sector using entity_type + name patterns + ACNC purposes.
-- Current state: 465K entities have null sector (79% uncovered).
-- This SQL targets the obvious wins: derive sector from existing signals that
-- are 100% reliable. Leaves ambiguous cases for LLM/classifier agents later.

BEGIN;

-- 1. Normalize existing mixed-case values
UPDATE gs_entities SET sector = 'Education' WHERE sector IN ('education');
UPDATE gs_entities SET sector = 'Health' WHERE sector IN ('health');
UPDATE gs_entities SET sector = 'Community' WHERE sector IN ('community', 'community-controlled', 'community-services');
UPDATE gs_entities SET sector = 'Arts & Culture' WHERE sector IN ('arts', 'Arts');
UPDATE gs_entities SET sector = 'Government' WHERE sector IN ('government');
UPDATE gs_entities SET sector = 'Indigenous' WHERE sector IN ('indigenous', 'Indigenous-led');
UPDATE gs_entities SET sector = 'Disability Services' WHERE sector IN ('disability-services');

-- 2. Entity_type derivations
UPDATE gs_entities SET sector = 'Philanthropy'
 WHERE entity_type = 'foundation' AND (sector IS NULL OR sector = 'unknown');

UPDATE gs_entities SET sector = 'Government'
 WHERE entity_type = 'government_body' AND (sector IS NULL OR sector = 'unknown');

UPDATE gs_entities SET sector = 'Indigenous'
 WHERE entity_type = 'indigenous_corp' AND (sector IS NULL OR sector = 'unknown');

-- 3. Name-pattern derivations (high confidence)
UPDATE gs_entities SET sector = 'Health'
 WHERE (sector IS NULL OR sector = 'unknown')
   AND entity_type NOT IN ('foundation', 'government_body', 'indigenous_corp')
   AND (
     canonical_name ~* '\b(health|hospital|medical|clinic|nursing|dental|mental health|wellbeing)\b'
   );

UPDATE gs_entities SET sector = 'Education'
 WHERE (sector IS NULL OR sector = 'unknown')
   AND entity_type NOT IN ('foundation', 'government_body', 'indigenous_corp')
   AND sector IS DISTINCT FROM 'Health'
   AND (
     canonical_name ~* '\b(school|university|college|education|academy|institute|tafe|learning|student)\b'
   );

UPDATE gs_entities SET sector = 'Community'
 WHERE (sector IS NULL OR sector = 'unknown')
   AND entity_type NOT IN ('foundation', 'government_body', 'indigenous_corp')
   AND sector IS NULL
   AND (
     canonical_name ~* '\b(community|neighbourhood|community services|community centre)\b'
   );

UPDATE gs_entities SET sector = 'Religion'
 WHERE (sector IS NULL OR sector = 'unknown')
   AND entity_type NOT IN ('foundation', 'government_body', 'indigenous_corp')
   AND sector IS NULL
   AND (
     canonical_name ~* '\b(church|parish|diocese|mission|ministry|catholic|anglican|uniting|baptist|presbyterian|lutheran|synagogue|mosque|temple)\b'
   );

UPDATE gs_entities SET sector = 'Social Welfare'
 WHERE (sector IS NULL OR sector = 'unknown')
   AND entity_type NOT IN ('foundation', 'government_body', 'indigenous_corp')
   AND sector IS NULL
   AND (
     canonical_name ~* '\b(welfare|family services|youth services|homelessness|food bank|refuge|shelter|family support|case management)\b'
   );

UPDATE gs_entities SET sector = 'Legal Services'
 WHERE (sector IS NULL OR sector = 'unknown')
   AND entity_type NOT IN ('foundation', 'government_body', 'indigenous_corp')
   AND sector IS NULL
   AND (
     canonical_name ~* '\b(legal|law|lawyers|solicitor|legal aid|legal service)\b'
   );

UPDATE gs_entities SET sector = 'Environment'
 WHERE (sector IS NULL OR sector = 'unknown')
   AND entity_type NOT IN ('foundation', 'government_body', 'indigenous_corp')
   AND sector IS NULL
   AND (
     canonical_name ~* '\b(environmental|conservation|climate|biodiversity|wildlife|sustainable|renewable|river|catchment|landcare)\b'
   );

UPDATE gs_entities SET sector = 'Arts & Culture'
 WHERE (sector IS NULL OR sector = 'unknown')
   AND entity_type NOT IN ('foundation', 'government_body', 'indigenous_corp')
   AND sector IS NULL
   AND (
     canonical_name ~* '\b(arts|gallery|museum|theatre|cultural|festival|orchestra|ballet|opera|heritage)\b'
   );

UPDATE gs_entities SET sector = 'Sport & Recreation'
 WHERE (sector IS NULL OR sector = 'unknown')
   AND entity_type NOT IN ('foundation', 'government_body', 'indigenous_corp')
   AND sector IS NULL
   AND (
     canonical_name ~* '\b(sport|sporting|football|rugby|cricket|tennis|golf|athletic|soccer|basketball|club)\b'
   );

UPDATE gs_entities SET sector = 'Housing'
 WHERE (sector IS NULL OR sector = 'unknown')
   AND entity_type NOT IN ('foundation', 'government_body', 'indigenous_corp')
   AND sector IS NULL
   AND (
     canonical_name ~* '\b(housing|tenancy|real estate|property|development|accommodation)\b'
   );

-- 4. ACNC-derived sector from purposes (for remaining charities)
UPDATE gs_entities ge SET sector = 'Health'
  FROM acnc_charities ac
 WHERE ge.abn = ac.abn
   AND ge.sector IS NULL
   AND ac.purposes::text ILIKE '%health%'
   AND ac.purposes::text NOT ILIKE '%mental%';

UPDATE gs_entities ge SET sector = 'Education'
  FROM acnc_charities ac
 WHERE ge.abn = ac.abn
   AND ge.sector IS NULL
   AND (ac.purposes::text ILIKE '%education%' OR ac.purposes::text ILIKE '%training%');

UPDATE gs_entities ge SET sector = 'Social Welfare'
  FROM acnc_charities ac
 WHERE ge.abn = ac.abn
   AND ge.sector IS NULL
   AND (ac.purposes::text ILIKE '%poverty%' OR ac.purposes::text ILIKE '%social welfare%' OR ac.purposes::text ILIKE '%relief%');

UPDATE gs_entities ge SET sector = 'Religion'
  FROM acnc_charities ac
 WHERE ge.abn = ac.abn
   AND ge.sector IS NULL
   AND ac.purposes::text ILIKE '%religion%';

UPDATE gs_entities ge SET sector = 'Community'
  FROM acnc_charities ac
 WHERE ge.abn = ac.abn
   AND ge.sector IS NULL
   AND ac.purposes::text ILIKE '%community%';

COMMIT;

-- Report after
SELECT sector, COUNT(*) FROM gs_entities WHERE sector IS NOT NULL GROUP BY sector ORDER BY count DESC LIMIT 25;

SELECT COUNT(*) FILTER (WHERE sector IS NOT NULL) as w_sector,
       COUNT(*) FILTER (WHERE sector IS NULL) as no_sector,
       COUNT(*) as total
  FROM gs_entities;
