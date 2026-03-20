-- create-revolving-door-power.sql
-- Revolving door: entities that lobby AND donate AND win contracts
-- These are the entities with the most cross-system influence vectors.

-- First, repopulate mv_revolving_door with actual data
DROP MATERIALIZED VIEW IF EXISTS mv_revolving_door CASCADE;

CREATE MATERIALIZED VIEW mv_revolving_door AS
WITH
-- Entities that lobby (appear in lobbying relationships)
lobbyists AS (
  SELECT DISTINCT COALESCE(r.source_entity_id, r.target_entity_id) as entity_id
  FROM gs_relationships r
  WHERE r.relationship_type = 'lobbies_for'
),
-- Entities that donate politically
donors AS (
  SELECT ge.id as entity_id,
         COUNT(*) as donation_count,
         SUM(pd.amount) as total_donated,
         array_agg(DISTINCT pd.donation_to ORDER BY pd.donation_to) as parties
  FROM political_donations pd
  JOIN gs_entities ge ON ge.abn = pd.donor_abn
  WHERE pd.donor_abn IS NOT NULL
  GROUP BY ge.id
),
-- Entities that win government contracts
contractors AS (
  SELECT ge.id as entity_id,
         COUNT(*) as contract_count,
         SUM(ac.contract_value) as total_contracts,
         COUNT(DISTINCT ac.buyer_name) as distinct_buyers
  FROM austender_contracts ac
  JOIN gs_entities ge ON ge.abn = ac.supplier_abn
  WHERE ac.supplier_abn IS NOT NULL
  GROUP BY ge.id
),
-- Entities that receive justice/social funding
funded AS (
  SELECT gs_entity_id as entity_id,
         COUNT(*) as funding_count,
         SUM(amount_dollars) as total_funded
  FROM justice_funding
  WHERE gs_entity_id IS NOT NULL
  GROUP BY gs_entity_id
)
SELECT
  ge.id,
  ge.gs_id,
  ge.canonical_name,
  ge.entity_type,
  ge.abn,
  ge.state,
  ge.lga_name,
  ge.is_community_controlled,

  -- Influence vectors
  (l.entity_id IS NOT NULL) as lobbies,
  (d.entity_id IS NOT NULL) as donates,
  (c.entity_id IS NOT NULL) as contracts,
  (f.entity_id IS NOT NULL) as receives_funding,

  -- Vector count (how many influence channels)
  (l.entity_id IS NOT NULL)::int +
  (d.entity_id IS NOT NULL)::int +
  (c.entity_id IS NOT NULL)::int +
  (f.entity_id IS NOT NULL)::int AS influence_vectors,

  -- Details
  COALESCE(d.total_donated, 0) as total_donated,
  COALESCE(d.donation_count, 0) as donation_count,
  d.parties as parties_funded,
  COALESCE(c.total_contracts, 0) as total_contracts,
  COALESCE(c.contract_count, 0) as contract_count,
  COALESCE(c.distinct_buyers, 0) as distinct_buyers,
  COALESCE(f.total_funded, 0) as total_funded,
  COALESCE(f.funding_count, 0) as funding_count,

  -- Revolving door score: weighted by influence type
  (
    (l.entity_id IS NOT NULL)::int * 5 +          -- lobbying = strongest signal
    (d.entity_id IS NOT NULL)::int * 3 +          -- donations = strong
    (c.entity_id IS NOT NULL)::int * 2 +          -- contracts = moderate
    (f.entity_id IS NOT NULL)::int * 1 +          -- funding = base
    CASE WHEN COALESCE(d.total_donated, 0) > 100000 THEN 3
         WHEN COALESCE(d.total_donated, 0) > 10000 THEN 1 ELSE 0 END +
    CASE WHEN COALESCE(c.total_contracts, 0) > 10000000 THEN 3
         WHEN COALESCE(c.total_contracts, 0) > 1000000 THEN 1 ELSE 0 END +
    LEAST(array_length(d.parties, 1), 5)          -- more parties = more influence
  ) AS revolving_door_score

FROM gs_entities ge
LEFT JOIN lobbyists l ON l.entity_id = ge.id
LEFT JOIN donors d ON d.entity_id = ge.id
LEFT JOIN contractors c ON c.entity_id = ge.id
LEFT JOIN funded f ON f.entity_id = ge.id
WHERE
  -- Must have at least 2 influence vectors
  (l.entity_id IS NOT NULL)::int +
  (d.entity_id IS NOT NULL)::int +
  (c.entity_id IS NOT NULL)::int +
  (f.entity_id IS NOT NULL)::int >= 2;

CREATE INDEX idx_revolving_door_score ON mv_revolving_door (revolving_door_score DESC);
CREATE INDEX idx_revolving_door_vectors ON mv_revolving_door (influence_vectors DESC);
CREATE INDEX idx_revolving_door_entity_type ON mv_revolving_door (entity_type);
