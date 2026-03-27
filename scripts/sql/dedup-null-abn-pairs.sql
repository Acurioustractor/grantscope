-- ============================================================================
-- dedup-null-abn-pairs.sql
-- Deduplicates 1,516 pairs of non-person entities sharing same canonical_name,
-- entity_type, and state, all with NULL ABN.
--
-- Strategy:
--   1. For each pair, keep the entity with the earliest created_at (survivor)
--   2. Merge enrichment fields from victim to survivor (fill NULLs)
--   3. Delete conflicting relationships (same source+target+type+dataset+record)
--   4. Redirect remaining relationships from victim to survivor
--   5. Redirect FK references in other tables
--   6. Delete victim entities
--
-- Safety:
--   - Runs in a single transaction (atomic)
--   - Handles unique constraint on gs_relationships (idx_gs_rel_dedup)
--   - Reports counts at each step
--
-- Usage:
--   source .env && PGPASSWORD="$DATABASE_PASSWORD" psql \
--     -h aws-0-ap-southeast-2.pooler.supabase.com -p 5432 \
--     -U "postgres.tednluwflfhxyucgwigh" -d postgres \
--     -f scripts/sql/dedup-null-abn-pairs.sql
-- ============================================================================

\timing on

BEGIN;

-- ── Build survivor/victim mapping ──────────────────────────────────────────
CREATE TEMP TABLE dedup_pairs ON COMMIT DROP AS
WITH clusters AS (
  SELECT canonical_name, entity_type, state
  FROM gs_entities
  WHERE entity_type != 'person' AND abn IS NULL
  GROUP BY canonical_name, entity_type, state
  HAVING COUNT(*) = 2
),
ranked AS (
  SELECT e.id, e.canonical_name, e.entity_type, e.state,
    ROW_NUMBER() OVER (
      PARTITION BY e.canonical_name, e.entity_type, e.state
      ORDER BY e.created_at ASC
    ) AS rn
  FROM gs_entities e
  JOIN clusters c
    ON e.canonical_name = c.canonical_name
    AND e.entity_type = c.entity_type
    AND (e.state IS NOT DISTINCT FROM c.state)
  WHERE e.abn IS NULL AND e.entity_type != 'person'
)
SELECT
  s.id AS survivor_id,
  v.id AS victim_id
FROM ranked s
JOIN ranked v
  ON s.canonical_name = v.canonical_name
  AND s.entity_type = v.entity_type
  AND (s.state IS NOT DISTINCT FROM v.state)
WHERE s.rn = 1 AND v.rn = 2;

CREATE INDEX ON dedup_pairs (victim_id);
CREATE INDEX ON dedup_pairs (survivor_id);

SELECT COUNT(*) AS pairs_to_process FROM dedup_pairs;

-- ── Step 1: Merge enrichment fields from victim to survivor ────────────────
UPDATE gs_entities survivor
SET
  description   = COALESCE(survivor.description,   victim.description),
  website       = COALESCE(survivor.website,        victim.website),
  postcode      = COALESCE(survivor.postcode,       victim.postcode),
  sector        = COALESCE(survivor.sector,         victim.sector),
  sub_sector    = COALESCE(survivor.sub_sector,     victim.sub_sector),
  latest_revenue      = COALESCE(survivor.latest_revenue,      victim.latest_revenue),
  latest_assets       = COALESCE(survivor.latest_assets,       victim.latest_assets),
  latest_tax_payable  = COALESCE(survivor.latest_tax_payable,  victim.latest_tax_payable),
  financial_year      = COALESCE(survivor.financial_year,      victim.financial_year),
  seifa_irsd_decile   = COALESCE(survivor.seifa_irsd_decile,   victim.seifa_irsd_decile),
  remoteness          = COALESCE(survivor.remoteness,          victim.remoteness),
  sa2_code            = COALESCE(survivor.sa2_code,            victim.sa2_code),
  is_community_controlled = COALESCE(survivor.is_community_controlled, victim.is_community_controlled),
  lga_name            = COALESCE(survivor.lga_name,            victim.lga_name),
  lga_code            = COALESCE(survivor.lga_code,            victim.lga_code),
  -- Merge source_datasets arrays (union distinct)
  source_datasets = (
    SELECT ARRAY(SELECT DISTINCT u FROM unnest(
      COALESCE(survivor.source_datasets, '{}') || COALESCE(victim.source_datasets, '{}')
    ) u)
  ),
  source_count = (
    SELECT COUNT(DISTINCT u) FROM unnest(
      COALESCE(survivor.source_datasets, '{}') || COALESCE(victim.source_datasets, '{}')
    ) u
  ),
  -- Merge tags arrays (union distinct)
  tags = (
    SELECT ARRAY(SELECT DISTINCT u FROM unnest(
      COALESCE(survivor.tags, '{}') || COALESCE(victim.tags, '{}')
    ) u)
  ),
  -- Keep earliest first_seen, latest last_seen
  first_seen = LEAST(survivor.first_seen, victim.first_seen),
  last_seen  = GREATEST(survivor.last_seen, victim.last_seen),
  updated_at = NOW()
FROM dedup_pairs dp
JOIN gs_entities victim ON victim.id = dp.victim_id
WHERE survivor.id = dp.survivor_id;

-- ── Step 2: Handle source-side relationships ───────────────────────────────

-- 2a. Delete victim source rels that conflict with survivor's existing rels
WITH deleted AS (
  DELETE FROM gs_relationships
  WHERE id IN (
    SELECT vr.id
    FROM gs_relationships vr
    JOIN dedup_pairs dp ON vr.source_entity_id = dp.victim_id
    WHERE EXISTS (
      SELECT 1 FROM gs_relationships sr
      WHERE sr.source_entity_id = dp.survivor_id
        AND sr.target_entity_id = vr.target_entity_id
        AND sr.relationship_type = vr.relationship_type
        AND sr.dataset = vr.dataset
        AND COALESCE(sr.source_record_id, '') = COALESCE(vr.source_record_id, '')
    )
  )
  RETURNING id
)
SELECT COUNT(*) AS conflicting_source_rels_deleted FROM deleted;

-- 2b. Delete self-loops (victim -> survivor within same pair)
WITH deleted AS (
  DELETE FROM gs_relationships
  USING dedup_pairs dp
  WHERE gs_relationships.source_entity_id = dp.victim_id
    AND gs_relationships.target_entity_id = dp.survivor_id
  RETURNING gs_relationships.id
)
SELECT COUNT(*) AS self_loop_source_rels_deleted FROM deleted;

-- 2c. Redirect remaining victim source rels to survivor
WITH updated AS (
  UPDATE gs_relationships
  SET source_entity_id = dp.survivor_id
  FROM dedup_pairs dp
  WHERE gs_relationships.source_entity_id = dp.victim_id
  RETURNING gs_relationships.id
)
SELECT COUNT(*) AS source_rels_redirected FROM updated;

-- ── Step 3: Handle target-side relationships ───────────────────────────────

-- 3a. Delete victim target rels that conflict with survivor's existing rels
WITH deleted AS (
  DELETE FROM gs_relationships
  WHERE id IN (
    SELECT vr.id
    FROM gs_relationships vr
    JOIN dedup_pairs dp ON vr.target_entity_id = dp.victim_id
    WHERE EXISTS (
      SELECT 1 FROM gs_relationships sr
      WHERE sr.target_entity_id = dp.survivor_id
        AND sr.source_entity_id = vr.source_entity_id
        AND sr.relationship_type = vr.relationship_type
        AND sr.dataset = vr.dataset
        AND COALESCE(sr.source_record_id, '') = COALESCE(vr.source_record_id, '')
    )
  )
  RETURNING id
)
SELECT COUNT(*) AS conflicting_target_rels_deleted FROM deleted;

-- 3b. Delete self-loops (survivor -> victim within same pair)
WITH deleted AS (
  DELETE FROM gs_relationships
  USING dedup_pairs dp
  WHERE gs_relationships.target_entity_id = dp.victim_id
    AND gs_relationships.source_entity_id = dp.survivor_id
  RETURNING gs_relationships.id
)
SELECT COUNT(*) AS self_loop_target_rels_deleted FROM deleted;

-- 3c. Redirect remaining victim target rels to survivor
WITH updated AS (
  UPDATE gs_relationships
  SET target_entity_id = dp.survivor_id
  FROM dedup_pairs dp
  WHERE gs_relationships.target_entity_id = dp.victim_id
  RETURNING gs_relationships.id
)
SELECT COUNT(*) AS target_rels_redirected FROM updated;

-- ── Step 4: Clean up any self-loops created by redirects ───────────────────
WITH deleted AS (
  DELETE FROM gs_relationships
  WHERE source_entity_id = target_entity_id
    AND source_entity_id IN (SELECT survivor_id FROM dedup_pairs)
  RETURNING id
)
SELECT COUNT(*) AS self_loops_cleaned FROM deleted;

-- ── Step 5: Redirect FK references in other tables ─────────────────────────
-- justice_funding
WITH updated AS (
  UPDATE justice_funding SET gs_entity_id = dp.survivor_id
  FROM dedup_pairs dp WHERE justice_funding.gs_entity_id = dp.victim_id
  RETURNING justice_funding.id
)
SELECT COUNT(*) AS justice_funding_redirected FROM updated;

-- alma_interventions
UPDATE alma_interventions SET gs_entity_id = dp.survivor_id
FROM dedup_pairs dp WHERE alma_interventions.gs_entity_id = dp.victim_id;

-- foundations
UPDATE foundations SET gs_entity_id = dp.survivor_id
FROM dedup_pairs dp WHERE foundations.gs_entity_id = dp.victim_id;

-- ndis_registered_providers
UPDATE ndis_registered_providers SET gs_entity_id = dp.survivor_id
FROM dedup_pairs dp WHERE ndis_registered_providers.gs_entity_id = dp.victim_id;

-- justice_reinvestment_sites
UPDATE justice_reinvestment_sites SET gs_entity_id = dp.survivor_id
FROM dedup_pairs dp WHERE justice_reinvestment_sites.gs_entity_id = dp.victim_id;

-- nz_charities
UPDATE nz_charities SET gs_entity_id = dp.survivor_id
FROM dedup_pairs dp WHERE nz_charities.gs_entity_id = dp.victim_id;

-- nz_gets_contracts
UPDATE nz_gets_contracts SET gs_entity_id = dp.survivor_id
FROM dedup_pairs dp WHERE nz_gets_contracts.gs_entity_id = dp.victim_id;

-- research_grants
UPDATE research_grants SET gs_entity_id = dp.survivor_id
FROM dedup_pairs dp WHERE research_grants.gs_entity_id = dp.victim_id;

-- org_contacts
UPDATE org_contacts SET linked_entity_id = dp.survivor_id
FROM dedup_pairs dp WHERE org_contacts.linked_entity_id = dp.victim_id;

-- org_pipeline
UPDATE org_pipeline SET funder_entity_id = dp.survivor_id
FROM dedup_pairs dp WHERE org_pipeline.funder_entity_id = dp.victim_id;

-- person_roles (entity_id)
UPDATE person_roles SET entity_id = dp.survivor_id
FROM dedup_pairs dp WHERE person_roles.entity_id = dp.victim_id;

-- person_roles (person_entity_id)
UPDATE person_roles SET person_entity_id = dp.survivor_id
FROM dedup_pairs dp WHERE person_roles.person_entity_id = dp.victim_id;

-- person_entity_links (UNIQUE on person_id+entity_id -- delete conflicts first)
DELETE FROM person_entity_links
WHERE entity_id IN (SELECT victim_id FROM dedup_pairs)
  AND EXISTS (
    SELECT 1 FROM person_entity_links x
    JOIN dedup_pairs dp ON x.entity_id = dp.survivor_id
    WHERE dp.victim_id = person_entity_links.entity_id
      AND x.person_id = person_entity_links.person_id
  );
UPDATE person_entity_links SET entity_id = dp.survivor_id
FROM dedup_pairs dp WHERE person_entity_links.entity_id = dp.victim_id;

-- gs_entity_aliases (redirect non-conflicting, then delete remaining)
UPDATE gs_entity_aliases SET entity_id = dp.survivor_id
FROM dedup_pairs dp
WHERE gs_entity_aliases.entity_id = dp.victim_id
  AND NOT EXISTS (
    SELECT 1 FROM gs_entity_aliases x
    WHERE x.entity_id = dp.survivor_id
      AND x.alias_value = gs_entity_aliases.alias_value
      AND x.alias_type = gs_entity_aliases.alias_type
  );
DELETE FROM gs_entity_aliases WHERE entity_id IN (SELECT victim_id FROM dedup_pairs);

-- contact_entity_links (UNIQUE on contact_id+entity_id -- delete conflicts first)
DELETE FROM contact_entity_links
WHERE entity_id IN (SELECT victim_id FROM dedup_pairs)
  AND EXISTS (
    SELECT 1 FROM contact_entity_links x
    JOIN dedup_pairs dp ON x.entity_id = dp.survivor_id
    WHERE dp.victim_id = contact_entity_links.entity_id
      AND x.contact_id = contact_entity_links.contact_id
  );
UPDATE contact_entity_links SET entity_id = dp.survivor_id
FROM dedup_pairs dp WHERE contact_entity_links.entity_id = dp.victim_id;

-- entity_watches (UNIQUE on user_id+entity_id -- delete conflicts first)
DELETE FROM entity_watches
WHERE entity_id IN (SELECT victim_id FROM dedup_pairs)
  AND EXISTS (
    SELECT 1 FROM entity_watches x
    JOIN dedup_pairs dp ON x.entity_id = dp.survivor_id
    WHERE dp.victim_id = entity_watches.entity_id
      AND x.user_id = entity_watches.user_id
  );
UPDATE entity_watches SET entity_id = dp.survivor_id
FROM dedup_pairs dp WHERE entity_watches.entity_id = dp.victim_id;

-- funder_portfolio_entities (UNIQUE on portfolio_id+entity_id -- delete conflicts first)
DELETE FROM funder_portfolio_entities
WHERE entity_id IN (SELECT victim_id FROM dedup_pairs)
  AND EXISTS (
    SELECT 1 FROM funder_portfolio_entities x
    JOIN dedup_pairs dp ON x.entity_id = dp.survivor_id
    WHERE dp.victim_id = funder_portfolio_entities.entity_id
      AND x.portfolio_id = funder_portfolio_entities.portfolio_id
  );
UPDATE funder_portfolio_entities SET entity_id = dp.survivor_id
FROM dedup_pairs dp WHERE funder_portfolio_entities.entity_id = dp.victim_id;

-- name_aliases
UPDATE name_aliases SET canonical_entity_id = dp.survivor_id
FROM dedup_pairs dp WHERE name_aliases.canonical_entity_id = dp.victim_id;

-- ── Step 6: Delete victim entities ─────────────────────────────────────────
WITH deleted AS (
  DELETE FROM gs_entities WHERE id IN (SELECT victim_id FROM dedup_pairs)
  RETURNING id
)
SELECT COUNT(*) AS entities_deleted FROM deleted;

-- ── Step 7: Verify no remaining duplicates ─────────────────────────────────
SELECT COUNT(*) AS remaining_null_abn_dup_clusters
FROM (
  SELECT canonical_name, entity_type, state
  FROM gs_entities
  WHERE entity_type != 'person' AND abn IS NULL
  GROUP BY canonical_name, entity_type, state
  HAVING COUNT(*) > 1
) sub;

SELECT COUNT(*) AS total_entities_after FROM gs_entities;

COMMIT;
