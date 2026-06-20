-- Goods Command Center — Cross-System Power overlay.
--
-- Wires the two cross-system influence MVs (mv_entity_power_index,
-- mv_revolving_door) into the Goods relationship spine. For every
-- entity-linked Goods relationship (funder / impact_investor / buyer / ...),
-- surface how embedded that counterpart is across the 7 power systems
-- (procurement, justice funding, political donations, charity, foundations,
-- ALMA evidence, ATO transparency) and whether they sit in the revolving-door
-- set (>=2 influence vectors: lobbying / donations / contracts / funding).
--
-- Why: a funder or buyer who is deeply cross-system embedded is both a more
-- powerful ally (their yes carries weight, their board opens doors) and a
-- relationship to handle with more care (donations + lobbying = a public
-- profile worth knowing before we attach the Goods name). It also flags anchor
-- buyers (high procurement power) inside the funder cohort.
--
-- Both MVs key on gs_entities.id; goods_relationships.entity_id is that same id.
-- A VIEW (not materialized): request-time, always current, tiny once filtered
-- to the entity-linked Goods relationships. Read by goods-relationship-power.ts.

CREATE OR REPLACE VIEW v_goods_relationship_power AS
SELECT
  gr.id                              AS rel_id,
  gr.entity_id,
  gr.display_name,
  gr.relationship_type,
  COALESCE(gr.warmth_display, 0)::int AS warmth_display,

  -- cross-system power (mv_entity_power_index)
  pi.power_score,
  pi.system_count,
  pi.in_procurement,
  pi.in_justice_funding,
  pi.in_political_donations,
  pi.in_charity_registry,
  pi.in_foundation,
  pi.in_alma_evidence,
  pi.in_ato_transparency,
  pi.total_dollar_flow,
  pi.foundation_giving,

  -- revolving door (mv_revolving_door)
  rd.influence_vectors,
  rd.revolving_door_score,
  rd.lobbies,
  rd.donates,
  rd.contracts,
  rd.receives_funding

FROM goods_relationships gr
LEFT JOIN mv_entity_power_index pi ON pi.id = gr.entity_id
LEFT JOIN mv_revolving_door    rd ON rd.id = gr.entity_id
WHERE gr.entity_id IS NOT NULL
  -- keep only relationships that actually carry a cross-system signal
  AND (pi.id IS NOT NULL OR rd.id IS NOT NULL);

COMMENT ON VIEW v_goods_relationship_power IS
  'Cross-system power overlay on Goods relationships: mv_entity_power_index (power_score, system_count, per-system flags) + mv_revolving_door (influence_vectors, lobbying/donation/contract/funding flags), joined on entity_id. Only rows with a signal. Read by goods-relationship-power.ts.';
