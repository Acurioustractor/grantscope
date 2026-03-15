-- Contact → Entity linkage bridge table
-- Powers the Relationship Flywheel: links CRM contacts to the CivicGraph entity graph

CREATE TABLE IF NOT EXISTS contact_entity_links (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  contact_id uuid NOT NULL REFERENCES ghl_contacts(id) ON DELETE CASCADE,
  entity_id uuid NOT NULL REFERENCES gs_entities(id) ON DELETE CASCADE,
  confidence_score numeric(4,2) NOT NULL DEFAULT 0,  -- 0.00 to 1.00
  link_method text NOT NULL CHECK (link_method IN ('email_domain', 'abn', 'fuzzy_name', 'manual', 'board_member', 'grant_recipient')),
  link_evidence jsonb DEFAULT '{}',  -- e.g. {"matched_domain": "orangesky.com.au", "entity_website": "orangesky.com.au"}
  verified boolean NOT NULL DEFAULT false,
  verified_at timestamptz,
  verified_by uuid,  -- user who verified
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(contact_id, entity_id)
);

-- Indexes for lookups in both directions
CREATE INDEX idx_cel_contact ON contact_entity_links(contact_id);
CREATE INDEX idx_cel_entity ON contact_entity_links(entity_id);
CREATE INDEX idx_cel_confidence ON contact_entity_links(confidence_score DESC);
CREATE INDEX idx_cel_method ON contact_entity_links(link_method);

-- Trigger for updated_at
CREATE OR REPLACE FUNCTION update_cel_timestamp()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trg_cel_updated
  BEFORE UPDATE ON contact_entity_links
  FOR EACH ROW EXECUTE FUNCTION update_cel_timestamp();

COMMENT ON TABLE contact_entity_links IS 'Bridges CRM contacts (ghl_contacts) to CivicGraph entities (gs_entities). Core of the Relationship Flywheel.';
