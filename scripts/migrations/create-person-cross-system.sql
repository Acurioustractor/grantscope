-- Person Cross-System Influence Network
-- Cross-matches person names across:
--   1. ACNC board members (person_roles)
--   2. Political donors (political_donations - individual donors)
--   3. Federal lobbyist firm owners (gs_relationships lobbies_for)
--
-- Creates mv_person_cross_system: people appearing in 2+ systems

-- Step 1: Extract individual donors from political_donations
-- Heuristic: "LastName, FirstName" format, no org keywords, short name
CREATE MATERIALIZED VIEW IF NOT EXISTS mv_individual_donors AS
WITH raw_donors AS (
  SELECT
    donor_name,
    -- Normalize: "LastName, FirstName" → "FIRSTNAME LASTNAME"
    UPPER(TRIM(
      CASE
        WHEN donor_name LIKE '%, %' THEN
          SPLIT_PART(donor_name, ', ', 2) || ' ' || SPLIT_PART(donor_name, ', ', 1)
        ELSE donor_name
      END
    )) AS person_name_normalised,
    SUM(amount)::bigint AS total_donated,
    COUNT(DISTINCT donation_to) AS parties_funded,
    ARRAY_AGG(DISTINCT donation_to ORDER BY donation_to) AS parties,
    COUNT(DISTINCT financial_year) AS years_active,
    MIN(financial_year) AS first_year,
    MAX(financial_year) AS last_year
  FROM political_donations
  WHERE donor_name LIKE '%, %'
    AND donor_name NOT LIKE '%Pty%'
    AND donor_name NOT LIKE '%Ltd%'
    AND donor_name NOT LIKE '%Inc%'
    AND donor_name NOT LIKE '%Union%'
    AND donor_name NOT LIKE '%Party%'
    AND donor_name NOT LIKE '%Association%'
    AND donor_name NOT LIKE '%Department%'
    AND donor_name NOT LIKE '%Division%'
    AND donor_name NOT LIKE '%Foundation%'
    AND donor_name NOT LIKE '%Services%'
    AND donor_name NOT LIKE '%&%'
    AND donor_name NOT LIKE '%Shop%'
    AND donor_name NOT LIKE '%Construction%'
    AND LENGTH(donor_name) BETWEEN 5 AND 40
    AND ARRAY_LENGTH(STRING_TO_ARRAY(donor_name, ' '), 1) <= 5
  GROUP BY donor_name
)
SELECT * FROM raw_donors
WHERE total_donated > 1000;  -- Filter out trivial amounts

CREATE UNIQUE INDEX IF NOT EXISTS idx_mv_individual_donors_name
  ON mv_individual_donors (person_name_normalised);

-- Step 2: Cross-match person_roles board members against individual donors
-- Uses exact normalised name match (fast, no fuzzy needed for this pass)
CREATE MATERIALIZED VIEW IF NOT EXISTS mv_person_cross_system AS
WITH
-- Board members from person_roles
board_members AS (
  SELECT
    pr.person_name_normalised,
    MIN(pr.person_name) AS person_name,
    COUNT(DISTINCT pr.entity_id) AS board_count,
    ARRAY_AGG(DISTINCT pr.company_name ORDER BY pr.company_name) AS board_entities,
    ARRAY_AGG(DISTINCT pr.company_abn ORDER BY pr.company_abn) FILTER (WHERE pr.company_abn IS NOT NULL) AS board_abns,
    MAX(pr.role_type) AS primary_role
  FROM person_roles pr
  WHERE pr.person_name_normalised IS NOT NULL
    AND LENGTH(pr.person_name_normalised) > 3
  GROUP BY pr.person_name_normalised
),
-- Individual political donors (from mv_individual_donors)
donors AS (
  SELECT
    person_name_normalised,
    donor_name,
    total_donated,
    parties_funded,
    parties,
    years_active
  FROM mv_individual_donors
),
-- Lobbyist firm owners (when populated, from lobbyist JSON properties)
-- For now: check if person appears as entity connected via lobbies_for
lobbyist_connected AS (
  SELECT DISTINCT
    ge.canonical_name AS entity_name,
    ge.id AS entity_id,
    true AS is_lobbying_connected
  FROM gs_relationships r
  JOIN gs_entities ge ON ge.id = r.source_entity_id
  WHERE r.relationship_type = 'lobbies_for'
),
-- All unique person names across systems
all_persons AS (
  SELECT person_name_normalised FROM board_members
  UNION
  SELECT person_name_normalised FROM donors
)
SELECT DISTINCT ON (ap.person_name_normalised)
  ap.person_name_normalised,
  COALESCE(bm.person_name, d.donor_name) AS display_name,
  -- System flags
  bm.person_name IS NOT NULL AS on_charity_boards,
  d.donor_name IS NOT NULL AS is_political_donor,
  -- System count
  (bm.person_name IS NOT NULL)::int + (d.donor_name IS NOT NULL)::int AS system_count,
  -- Board data
  COALESCE(bm.board_count, 0) AS board_count,
  bm.board_entities,
  bm.board_abns,
  bm.primary_role,
  -- Donation data
  COALESCE(d.total_donated, 0) AS total_donated,
  COALESCE(d.parties_funded, 0) AS parties_funded,
  d.parties AS parties_funded_list,
  COALESCE(d.years_active, 0) AS donation_years,
  -- Influence score: boards * 3 + donation tiers + party breadth
  (COALESCE(bm.board_count, 0) * 3
   + CASE WHEN d.total_donated > 1000000 THEN 10
          WHEN d.total_donated > 100000 THEN 5
          WHEN d.total_donated > 10000 THEN 2
          ELSE 0 END
   + LEAST(COALESCE(d.parties_funded, 0), 5)
  )::int AS influence_score
FROM all_persons ap
LEFT JOIN board_members bm ON bm.person_name_normalised = ap.person_name_normalised
LEFT JOIN donors d ON d.person_name_normalised = ap.person_name_normalised
WHERE
  -- Must appear in 2+ systems
  (bm.person_name IS NOT NULL)::int + (d.donor_name IS NOT NULL)::int >= 2
ORDER BY ap.person_name_normalised;

CREATE UNIQUE INDEX IF NOT EXISTS idx_mv_person_cross_name
  ON mv_person_cross_system (person_name_normalised);
CREATE INDEX IF NOT EXISTS idx_mv_person_cross_score
  ON mv_person_cross_system (influence_score DESC);

-- Summary query (run after creation):
-- SELECT COUNT(*) as cross_system_people,
--        AVG(influence_score)::int as avg_score,
--        MAX(influence_score) as max_score,
--        SUM(total_donated)::bigint as total_political_donations,
--        AVG(board_count)::numeric(4,1) as avg_boards
-- FROM mv_person_cross_system;
