-- Create JusticeHub org_profile so it works with /org/[slug] system
BEGIN;

INSERT INTO org_profiles (
  id, user_id, name, slug, description, mission, website, org_type,
  linked_gs_entity_id, subscription_plan, subscription_status,
  created_at, updated_at
) VALUES (
  gen_random_uuid(),
  '4d45101e-8f42-44d4-a072-04376c710e70',
  'JusticeHub',
  'justicehub',
  'Justice infrastructure platform. CONTAINED touring campaign, ALMA evidence engine, Empathy Ledger story platform.',
  'Building decision infrastructure for the justice sector — so every dollar goes further and every voice gets heard.',
  'https://justicehub.com.au',
  'social_enterprise',
  '5fda64ca-7890-4d72-b8d5-5cd36476452f',
  'organisation',
  'active',
  NOW(),
  NOW()
)
ON CONFLICT (slug) DO NOTHING;

COMMIT;
