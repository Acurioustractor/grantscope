-- Person → Entity linkage bridge table
-- Extends contact_entity_links to cover ALL contact sources via person_identity_map
-- This is the universal bridge: any person (LinkedIn, GHL, Gmail) → CivicGraph entity

CREATE TABLE IF NOT EXISTS person_entity_links (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  person_id uuid NOT NULL REFERENCES person_identity_map(person_id) ON DELETE CASCADE,
  entity_id uuid NOT NULL REFERENCES gs_entities(id) ON DELETE CASCADE,
  confidence_score numeric(4,2) NOT NULL DEFAULT 0,
  link_method text NOT NULL CHECK (link_method IN ('email_domain', 'company_name_exact', 'company_name_fuzzy', 'abn', 'manual', 'linkedin_company')),
  link_evidence jsonb DEFAULT '{}',
  verified boolean NOT NULL DEFAULT false,
  verified_at timestamptz,
  verified_by uuid,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(person_id, entity_id)
);

CREATE INDEX idx_pel_person ON person_entity_links(person_id);
CREATE INDEX idx_pel_entity ON person_entity_links(entity_id);
CREATE INDEX idx_pel_confidence ON person_entity_links(confidence_score DESC);

CREATE OR REPLACE FUNCTION update_pel_timestamp()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trg_pel_updated
  BEFORE UPDATE ON person_entity_links
  FOR EACH ROW EXECUTE FUNCTION update_pel_timestamp();

COMMENT ON TABLE person_entity_links IS 'Universal person→entity bridge. Links any contact source (LinkedIn, GHL, Gmail) to CivicGraph entities via person_identity_map.';
