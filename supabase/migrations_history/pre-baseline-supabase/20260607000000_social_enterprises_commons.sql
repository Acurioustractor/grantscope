-- Register social_enterprises as a first-class public dataset in the
-- Australian Giving Data Commons (open national registry of the social and
-- Indigenous enterprise supply base).

INSERT INTO data_catalog (
  table_name,
  domain,
  owner_team,
  description,
  source_of_truth,
  pii_level,
  sla_hours,
  freshness_key,
  provenance_field,
  confidence_field,
  public_export,
  licence,
  source_url,
  source_owner,
  collection_method,
  update_cadence,
  public_caveat
)
VALUES (
  'social_enterprises',
  'supply_base',
  'graph',
  'Federated national registry of social and Indigenous enterprises drawn from certifiers, registries and state network directories.',
  true,
  'none',
  168,
  'updated_at',
  'source_primary',
  'profile_confidence',
  true,
  'Mixed registry and public-source licences. Some source registries restrict reuse of authored descriptions — check source_primary before republishing.',
  'https://www.civicgraph.au/social-enterprises',
  'Source registries, certifiers, state networks and CivicGraph federation layer',
  'Public registry and directory federation, ABN matching and deduplication.',
  'Source-dependent, re-crawled during active windows.',
  'Supply Nation and ORIC records are Indigenous businesses and corporations — not every record is a social enterprise in the certified sense. Read source_primary before classifying.'
)
ON CONFLICT (table_name) DO UPDATE SET
  domain = EXCLUDED.domain,
  owner_team = EXCLUDED.owner_team,
  description = EXCLUDED.description,
  source_of_truth = EXCLUDED.source_of_truth,
  pii_level = EXCLUDED.pii_level,
  sla_hours = EXCLUDED.sla_hours,
  freshness_key = EXCLUDED.freshness_key,
  provenance_field = EXCLUDED.provenance_field,
  confidence_field = EXCLUDED.confidence_field,
  public_export = EXCLUDED.public_export,
  licence = EXCLUDED.licence,
  source_url = EXCLUDED.source_url,
  source_owner = EXCLUDED.source_owner,
  collection_method = EXCLUDED.collection_method,
  update_cadence = EXCLUDED.update_cadence,
  public_caveat = EXCLUDED.public_caveat,
  updated_at = now();
