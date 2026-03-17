-- Add linked_entity_id to org_contacts for linking partners to CivicGraph entities
ALTER TABLE org_contacts
  ADD COLUMN IF NOT EXISTS linked_entity_id UUID REFERENCES gs_entities(id);

-- Link PICC contacts to their gs_entities
UPDATE org_contacts SET linked_entity_id = (
  SELECT id FROM gs_entities WHERE gs_id = 'AU-ABN-88671625498'
) WHERE name = 'A Curious Tractor' AND org_profile_id IN (SELECT id FROM org_profiles WHERE slug = 'picc');

UPDATE org_contacts SET linked_entity_id = (
  SELECT id FROM gs_entities WHERE gs_id = 'AU-ABN-42513562148'
) WHERE name = 'SNAICC' AND org_profile_id IN (SELECT id FROM org_profiles WHERE slug = 'picc');

UPDATE org_contacts SET linked_entity_id = (
  SELECT id FROM gs_entities WHERE gs_id = 'AU-ABN-57591914579'
) WHERE name = 'Brodie Germaine Fitness Aboriginal Corp' AND org_profile_id IN (SELECT id FROM org_profiles WHERE slug = 'picc');

UPDATE org_contacts SET linked_entity_id = (
  SELECT id FROM gs_entities WHERE gs_id = 'AU-ABN-53658668627'
) WHERE name = 'Oonchiumpa' AND org_profile_id IN (SELECT id FROM org_profiles WHERE slug = 'picc');

UPDATE org_contacts SET linked_entity_id = (
  SELECT id FROM gs_entities WHERE gs_id = 'AU-ABN-82479284570'
) WHERE name = 'Tranby College' AND org_profile_id IN (SELECT id FROM org_profiles WHERE slug = 'picc');
