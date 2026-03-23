-- Add 'program' to gs_entities entity_type check constraint
ALTER TABLE gs_entities DROP CONSTRAINT gs_entities_entity_type_check;
ALTER TABLE gs_entities ADD CONSTRAINT gs_entities_entity_type_check
  CHECK (entity_type = ANY (ARRAY['company','charity','foundation','government_body','indigenous_corp','political_party','person','social_enterprise','trust','unknown','program']));
