-- Backfill topic tags on justice_funding records that match domain keywords
-- Safe: only adds tags to records that don't already have the relevant tag

-- Child Protection tags
UPDATE justice_funding SET topics = COALESCE(topics, '{}') || ARRAY['child-protection']::text[]
WHERE NOT (COALESCE(topics, '{}') @> ARRAY['child-protection']::text[])
  AND (
    program_name ILIKE '%child protect%'
    OR program_name ILIKE '%child safety%'
    OR program_name ILIKE '%out-of-home care%'
    OR program_name ILIKE '%foster care%'
    OR program_name ILIKE '%kinship care%'
    OR program_name ILIKE '%family support%child%'
    OR program_name ILIKE '%child%abuse%'
    OR program_name ILIKE '%child%welfare%'
    OR program_name ILIKE '%child%family%'
    OR program_name ILIKE '%intensive family%'
    OR program_name ILIKE '%child%placement%'
    OR (program_name ILIKE '%OOHC%')
    OR (program_name ILIKE '%residential care%' AND program_name NOT ILIKE '%aged%')
  );

-- NDIS/Disability tags
UPDATE justice_funding SET topics = COALESCE(topics, '{}') || ARRAY['ndis']::text[]
WHERE NOT (COALESCE(topics, '{}') @> ARRAY['ndis']::text[])
  AND (
    program_name ILIKE '%ndis%'
    OR program_name ILIKE '%disability%'
    OR program_name ILIKE '%disabled%'
    OR (program_name ILIKE '%specialist%disab%')
    OR (program_name ILIKE '%home and community care%')
    OR (program_name ILIKE '%home & community care%')
  );

-- Family Services tags (broader net)
UPDATE justice_funding SET topics = COALESCE(topics, '{}') || ARRAY['family-services']::text[]
WHERE NOT (COALESCE(topics, '{}') @> ARRAY['family-services']::text[])
  AND (
    program_name ILIKE '%family support%'
    OR program_name ILIKE '%family service%'
    OR program_name ILIKE '%parenting%'
    OR program_name ILIKE '%domestic%violence%'
    OR program_name ILIKE '%family%violence%'
    OR (program_name ILIKE '%early intervention%' AND program_name ILIKE '%family%')
    OR program_name ILIKE '%family%wellbeing%'
    OR program_name ILIKE '%family%connect%'
  );

-- Indigenous tags
UPDATE justice_funding SET topics = COALESCE(topics, '{}') || ARRAY['indigenous']::text[]
WHERE NOT (COALESCE(topics, '{}') @> ARRAY['indigenous']::text[])
  AND (
    program_name ILIKE '%indigenous%'
    OR program_name ILIKE '%aboriginal%'
    OR program_name ILIKE '%torres strait%'
    OR program_name ILIKE '%first nations%'
    OR program_name ILIKE '%NIAA%'
    OR program_name ILIKE '%closing the gap%'
  );

-- Report counts
SELECT 'child-protection' as topic, COUNT(*) as tagged FROM justice_funding WHERE topics @> ARRAY['child-protection']::text[]
UNION ALL
SELECT 'ndis', COUNT(*) FROM justice_funding WHERE topics @> ARRAY['ndis']::text[]
UNION ALL
SELECT 'family-services', COUNT(*) FROM justice_funding WHERE topics @> ARRAY['family-services']::text[]
UNION ALL
SELECT 'indigenous', COUNT(*) FROM justice_funding WHERE topics @> ARRAY['indigenous']::text[]
UNION ALL
SELECT 'youth-justice', COUNT(*) FROM justice_funding WHERE topics @> ARRAY['youth-justice']::text[]
ORDER BY tagged DESC;
