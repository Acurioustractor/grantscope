-- Add partner_contact_ids to saved_grants for tagging GHL contacts on grants
ALTER TABLE saved_grants
ADD COLUMN IF NOT EXISTS partner_contact_ids uuid[] DEFAULT '{}';
