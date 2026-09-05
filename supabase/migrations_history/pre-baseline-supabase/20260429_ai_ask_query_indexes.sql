-- Speed up common AI-generated funding questions that filter entities by
-- state, legal type, remoteness, then join to justice_funding by gs_entity_id.

CREATE INDEX IF NOT EXISTS idx_gs_entities_state_type_remote_id
ON gs_entities (state, entity_type, remoteness, id)
INCLUDE (gs_id, canonical_name, postcode)
WHERE state IS NOT NULL
  AND entity_type IS NOT NULL
  AND remoteness IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_justice_funding_entity_amount
ON justice_funding (gs_entity_id, amount_dollars DESC)
WHERE gs_entity_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_mv_epi_state_type_remote_justice
ON mv_entity_power_index (state, entity_type, remoteness, justice_dollars DESC)
INCLUDE (gs_id, canonical_name, postcode, is_community_controlled)
WHERE justice_dollars > 0;
