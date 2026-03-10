-- Director / Officeholder Network
-- Phase 1: person_roles table for ASIC officeholder data
-- Phase 2: Populate via ASIC person/officeholder extract (paid data)
-- Links into gs_entities (person type) + gs_relationships (directorship type)

--------------------------------------------------------------------------------
-- person_roles: Raw officeholder appointments from ASIC
-- One row per person-role-company combination
-- Multiple roles possible (director, secretary, alternate director, etc.)
--------------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS person_roles (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

  -- Person identity
  person_name TEXT NOT NULL,
  person_name_normalised TEXT GENERATED ALWAYS AS (
    UPPER(TRIM(REGEXP_REPLACE(person_name, '\s+', ' ', 'g')))
  ) STORED,

  -- Role
  role_type TEXT NOT NULL CHECK (role_type IN (
    'director', 'secretary', 'alternate_director',
    'public_officer', 'chair', 'ceo', 'cfo',
    'board_member', 'trustee', 'officeholder', 'other'
  )),

  -- Company link
  company_acn TEXT NOT NULL,
  company_name TEXT,
  company_abn TEXT,

  -- Cross-reference to gs_entities (populated by enrichment)
  entity_id UUID REFERENCES gs_entities(id) ON DELETE SET NULL,
  person_entity_id UUID REFERENCES gs_entities(id) ON DELETE SET NULL,

  -- Dates
  appointment_date DATE,
  cessation_date DATE,

  -- Provenance
  source TEXT NOT NULL DEFAULT 'asic',
  source_file TEXT,
  confidence TEXT DEFAULT 'registry' CHECK (confidence IN (
    'registry', 'verified', 'reported', 'inferred', 'unverified'
  )),

  -- Metadata
  properties JSONB DEFAULT '{}',
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- Indexes for network queries
CREATE INDEX IF NOT EXISTS idx_person_roles_person_norm
  ON person_roles(person_name_normalised);

CREATE INDEX IF NOT EXISTS idx_person_roles_person_trgm
  ON person_roles USING gin(person_name gin_trgm_ops);

CREATE INDEX IF NOT EXISTS idx_person_roles_acn
  ON person_roles(company_acn);

CREATE INDEX IF NOT EXISTS idx_person_roles_abn
  ON person_roles(company_abn) WHERE company_abn IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_person_roles_entity
  ON person_roles(entity_id) WHERE entity_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_person_roles_person_entity
  ON person_roles(person_entity_id) WHERE person_entity_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_person_roles_role_type
  ON person_roles(role_type);

CREATE INDEX IF NOT EXISTS idx_person_roles_active
  ON person_roles(company_acn) WHERE cessation_date IS NULL;

-- Prevent exact duplicates
CREATE UNIQUE INDEX IF NOT EXISTS idx_person_roles_dedup
  ON person_roles(person_name_normalised, role_type, company_acn, COALESCE(appointment_date, '1900-01-01'));

-- Updated_at trigger
CREATE TRIGGER person_roles_updated_at
  BEFORE UPDATE ON person_roles
  FOR EACH ROW EXECUTE FUNCTION gs_update_timestamp();

-- RLS
ALTER TABLE person_roles ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Public read" ON person_roles FOR SELECT USING (true);
CREATE POLICY "Service write" ON person_roles FOR ALL USING (auth.role() = 'service_role');

GRANT SELECT ON person_roles TO anon, authenticated, service_role;

--------------------------------------------------------------------------------
-- Materialized view: Director network (shared directorships)
-- Two companies share a director = potential governance connection
--------------------------------------------------------------------------------
CREATE MATERIALIZED VIEW IF NOT EXISTS mv_director_network AS
WITH active_directors AS (
  SELECT
    person_name_normalised,
    company_acn,
    company_name,
    company_abn,
    entity_id,
    role_type
  FROM person_roles
  WHERE cessation_date IS NULL
    AND role_type IN ('director', 'alternate_director', 'chair')
),
shared AS (
  SELECT
    a.person_name_normalised,
    a.company_acn AS company_a_acn,
    a.company_name AS company_a_name,
    a.entity_id AS entity_a_id,
    b.company_acn AS company_b_acn,
    b.company_name AS company_b_name,
    b.entity_id AS entity_b_id
  FROM active_directors a
  JOIN active_directors b
    ON a.person_name_normalised = b.person_name_normalised
    AND a.company_acn < b.company_acn  -- avoid duplicates and self-joins
)
SELECT
  person_name_normalised,
  company_a_acn,
  company_a_name,
  entity_a_id,
  company_b_acn,
  company_b_name,
  entity_b_id
FROM shared
ORDER BY person_name_normalised, company_a_acn, company_b_acn;

CREATE UNIQUE INDEX IF NOT EXISTS idx_mv_director_network_dedup
  ON mv_director_network(person_name_normalised, company_a_acn, company_b_acn);

--------------------------------------------------------------------------------
-- Helper: Count directorships per person (board-seat accumulators)
--------------------------------------------------------------------------------
CREATE MATERIALIZED VIEW IF NOT EXISTS mv_person_board_seats AS
SELECT
  person_name_normalised,
  COUNT(DISTINCT company_acn) AS board_seats,
  COUNT(DISTINCT company_acn) FILTER (WHERE role_type = 'director') AS director_seats,
  COUNT(DISTINCT company_acn) FILTER (WHERE role_type = 'chair') AS chair_seats,
  ARRAY_AGG(DISTINCT company_name ORDER BY company_name) AS companies,
  ARRAY_AGG(DISTINCT company_acn ORDER BY company_acn) AS company_acns
FROM person_roles
WHERE cessation_date IS NULL
GROUP BY person_name_normalised
HAVING COUNT(DISTINCT company_acn) >= 2  -- only people on 2+ boards
ORDER BY board_seats DESC;

CREATE UNIQUE INDEX IF NOT EXISTS idx_mv_board_seats_person
  ON mv_person_board_seats(person_name_normalised);

COMMENT ON TABLE person_roles IS 'Director/officeholder appointments from ASIC and other sources';
COMMENT ON MATERIALIZED VIEW mv_director_network IS 'Shared directorships between companies — governance network';
COMMENT ON MATERIALIZED VIEW mv_person_board_seats IS 'People sitting on 2+ boards — board accumulator metric';
