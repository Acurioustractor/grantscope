-- Goods distribution channel view for Central Australia.
-- Joins org funding capacity (v_org_funding_profile) with Goods pipeline state
-- (goods_relationships) so the beds/washing-machines pipeline can be worked
-- top-down by channel archetype instead of the place map.

CREATE OR REPLACE VIEW v_goods_central_channels AS
SELECT
  p.id AS entity_id,
  p.canonical_name,
  p.abn,
  p.lga_name,
  p.oric_size,
  p.oric_employee_band,
  p.total_traceable_value,
  CASE
    WHEN p.canonical_name ~* 'health|congress|medical' THEN 'health_service'
    WHEN p.canonical_name ~* 'women' THEN 'womens_council'
    WHEN p.canonical_name ~* 'store|wiru' THEN 'community_store'
    WHEN p.canonical_name ~* 'outstation|resource|homelands|services|housing|tangentyere' THEN 'housing_logistics'
    WHEN p.canonical_name ~* 'land council' THEN 'land_council'
    ELSE 'other'
  END AS channel_archetype,
  g.id AS goods_relationship_id,
  g.relationship_type,
  g.stage,
  g.warmth_display,
  g.next_action
FROM v_org_funding_profile p
LEFT JOIN goods_relationships g
  ON (g.entity_id = p.id
      OR lower(g.display_name) = lower(p.canonical_name))
WHERE p.lga_name IN ('Alice Springs', 'MacDonnell', 'Central Desert', 'Barkly')
  AND p.community_controlled = true
ORDER BY p.total_traceable_value DESC NULLS LAST;

-- Seed the missing top-tier channel orgs as buyer prospects.
INSERT INTO goods_relationships
  (relationship_type, display_name, entity_id, stage, next_action, notes)
SELECT
  'buyer',
  e.canonical_name,
  e.id,
  'identified',
  s.next_action,
  s.notes
FROM (VALUES
  ('Regional Anangu Services Aboriginal Corporation',
   'Research housing-maintenance contract cycle; intro via APY housing program contacts',
   'Housing/logistics archetype. $62.6M in housing-purpose GrantConnect awards — the org paid to maintain remote APY houses. Natural delivery channel for beds + washing machines into homes.'),
  ('Tangentyere Council Aboriginal Corporation',
   'Identify town-camp housing services lead; frame as health hardware for town camps',
   'Housing/logistics archetype. $214M traceable, runs Alice Springs town camps with trades and house access.'),
  ('Tjuwanpa Outstation Resource Centre (Aboriginal Corporation)',
   'Map outstation servicing runs west of Alice; ask about whitegoods freight capacity',
   'Housing/logistics archetype. Outstation servicing — trucks and regular runs to homelands, the last-mile layer.'),
  ('Waltja Tjutangku Palyapayi (Aboriginal Corporation)',
   'Intro via NPY/NACCHO network; family services framing for beds in homes',
   'Womens-council archetype. Family services across Central Australian communities; domestic hardware into homes is core work.')
) AS s(name, next_action, notes)
JOIN gs_entities e ON e.canonical_name = s.name
WHERE NOT EXISTS (
  SELECT 1 FROM goods_relationships g
  WHERE g.entity_id = e.id
     OR g.dedupe_key = 'buyer:' || lower(e.canonical_name)
);
