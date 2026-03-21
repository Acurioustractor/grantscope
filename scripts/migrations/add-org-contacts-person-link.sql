-- Add person_id to org_contacts for linking to person_identity_map
ALTER TABLE org_contacts ADD COLUMN IF NOT EXISTS person_id UUID REFERENCES person_identity_map(person_id);
ALTER TABLE org_contacts ADD COLUMN IF NOT EXISTS linkedin_url TEXT;

-- Index for lookups
CREATE INDEX IF NOT EXISTS idx_org_contacts_person_id ON org_contacts(person_id) WHERE person_id IS NOT NULL;
