-- ============================================================================
-- STAGED MIGRATION - NOT APPLIED. Tier 3 (day-shift, human-in-loop).
-- Power-Holder Leverage Map - move A4: de-collide the person -> money rollup.
--
-- WHY (verified 2026-06-20):
--   mv_person_identity_influence sums procurement/justice/donation dollars over
--   mv_person_identity_network grouped by identity_key. Each network row carries
--   the ENTITY's full total per system, so every co-director of an entity is
--   credited that entity's ENTIRE dollar figure. Result: distinct people share
--   identical, inflated totals.
--
--   Confirmed:
--     total_procurement | people_sharing_it
--     7,570,752,694.37  | 8
--     1,645,343,146.58  | 5
--     1,204,194,723.66  | 12
--     1,144,676,719.68  | 6
--   (SELECT total_procurement, count(*) FROM mv_person_identity_influence
--    WHERE NOT is_nominee_block AND total_procurement>0
--    GROUP BY total_procurement HAVING count(*)>=3 ORDER BY 1 DESC LIMIT 6)
--
--   Per the project rule "verification gate BEFORE scoring" (see memory
--   feedback_data_quality_before_scoring): no person-money leaderboard is
--   publishable until this is de-collided.
--
-- FIX:
--   Proportional attribution. Split each entity's per-system dollars evenly
--   across the distinct directors linked to that entity, then sum per person.
--   Even-split is an approximation (it does not weight by role or tenure) but it
--   is defensible and removes the replication. The original summed figures are
--   PRESERVED, renamed as *_affiliated, and should be read as "combined dollar
--   flow of the boards this person sits on" (affiliation breadth), never as
--   personal spend.
--
-- BLAST RADIUS:
--   Non-breaking. Creates a NEW MV mv_person_identity_influence_v2. The existing
--   mv_person_identity_influence is left intact (only 2 app files read it). Swap
--   the leaderboard to _v2, verify, then retire the old MV in a follow-up.
--
-- APPLY (day-shift):
--   source .env && PGPASSWORD="$DATABASE_PASSWORD" psql \
--     -h aws-0-ap-southeast-2.pooler.supabase.com -p 5432 \
--     -U "postgres.tednluwflfhxyucgwigh" -d postgres \
--     -f thoughts/shared/power-map/staged-sql/2026-06-20_power_a4_decollide_person_money.sql
-- ============================================================================

DROP MATERIALIZED VIEW IF EXISTS mv_person_identity_influence_v2;

CREATE MATERIALIZED VIEW mv_person_identity_influence_v2 AS
WITH entity_directors AS (
    -- how many distinct directors share each entity's totals
    SELECT entity_id, COUNT(DISTINCT identity_key) AS director_count
    FROM mv_person_identity_network
    GROUP BY entity_id
),
edges AS (
    SELECT
        n.*,
        GREATEST(COALESCE(ed.director_count, 1), 1) AS director_count
    FROM mv_person_identity_network n
    LEFT JOIN entity_directors ed ON ed.entity_id = n.entity_id
)
SELECT
    identity_key,
    MIN(person_name_normalised) AS person_name_normalised,
    MIN(person_name_display)    AS person_name,
    BOOL_OR(is_nominee_block)   AS is_nominee_block,
    COUNT(*)                    AS board_count,
    COUNT(*) FILTER (WHERE is_community_controlled) AS acco_boards,
    ARRAY_AGG(DISTINCT entity_type) AS entity_types,

    -- ORIGINAL behaviour, honestly relabelled: entity totals summed across every
    -- board seat. DOUBLE-COUNTS co-directors. Use as affiliation breadth only.
    SUM(procurement_dollars) AS total_procurement_affiliated,
    SUM(justice_dollars)     AS total_justice_affiliated,
    SUM(donation_dollars)    AS total_donations_affiliated,

    -- DE-COLLIDED: each entity's dollars split evenly across its directors.
    SUM(procurement_dollars / director_count) AS attributed_procurement,
    SUM(justice_dollars     / director_count) AS attributed_justice,
    SUM(donation_dollars    / director_count) AS attributed_donations,

    SUM(contract_count) AS total_contracts,

    -- honesty signals for the UI
    BOOL_OR(director_count > 1)   AS shares_board_entities,
    MAX(procurement_dollars)      AS max_single_entity_procurement,
    MAX(director_count)           AS max_board_director_count,

    -- system breadth on the de-collided figures
    ((SUM(procurement_dollars / director_count) > 0)::int
     + (SUM(justice_dollars  / director_count) > 0)::int
     + (SUM(donation_dollars / director_count) > 0)::int) AS financial_system_count,

    -- influence score recomputed on attributed dollars
    COUNT(*)::numeric
      * (1 + ln(1 + SUM((procurement_dollars + justice_dollars + donation_dollars) / director_count)))
      AS influence_score_attributed
FROM edges
GROUP BY identity_key;

CREATE UNIQUE INDEX idx_mpiv2_identity ON mv_person_identity_influence_v2 (identity_key);
CREATE INDEX idx_mpiv2_attr_influence ON mv_person_identity_influence_v2 (influence_score_attributed DESC);
CREATE INDEX idx_mpiv2_attr_proc ON mv_person_identity_influence_v2 (attributed_procurement DESC);
CREATE INDEX idx_mpiv2_not_nominee ON mv_person_identity_influence_v2 (is_nominee_block, board_count);

-- ----------------------------------------------------------------------------
-- POST-APPLY VERIFICATION (should return ZERO rows once de-collided):
--   SELECT attributed_procurement, count(*)
--   FROM mv_person_identity_influence_v2
--   WHERE NOT is_nominee_block AND attributed_procurement > 0
--   GROUP BY attributed_procurement HAVING count(*) >= 3
--   ORDER BY 1 DESC LIMIT 6;
--
-- Spot-check the former $7.57B cluster now differs per person:
--   SELECT person_name, board_count, total_procurement_affiliated,
--          attributed_procurement, shares_board_entities, max_board_director_count
--   FROM mv_person_identity_influence_v2
--   WHERE total_procurement_affiliated = 7570752694.37
--   ORDER BY attributed_procurement DESC;
-- ----------------------------------------------------------------------------
