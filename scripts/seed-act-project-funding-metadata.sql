UPDATE org_projects
SET metadata = COALESCE(metadata, '{}'::jsonb) || jsonb_build_object(
  'creative', true,
  'funding_tags', jsonb_build_array(
    'arts',
    'culture',
    'documentary',
    'film',
    'narrative',
    'storytelling',
    'justice',
    'alternatives'
  ),
  'preferred_foundation_types', jsonb_build_array(
    'arts_culture',
    'philanthropic_foundation',
    'corporate_foundation',
    'community_foundation',
    'grantmaker',
    'trust'
  ),
  'blocked_foundation_types', jsonb_build_array(
    'university',
    'research_body',
    'hospital',
    'primary_health_network',
    'service_delivery',
    'legal_aid'
  )
)
WHERE slug = 'contained'
  AND org_profile_id = (
    SELECT id FROM org_profiles WHERE slug = 'act'
  );
