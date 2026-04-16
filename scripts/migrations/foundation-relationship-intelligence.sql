CREATE TABLE IF NOT EXISTS foundation_people (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  foundation_id uuid NOT NULL REFERENCES foundations(id) ON DELETE CASCADE,
  foundation_abn text,
  foundation_name text NOT NULL,
  person_name text NOT NULL,
  person_name_normalised text NOT NULL,
  role_title text,
  role_type text NOT NULL DEFAULT 'other',
  person_entity_id uuid REFERENCES gs_entities(id) ON DELETE SET NULL,
  source_url text NOT NULL DEFAULT '',
  source_document_url text NOT NULL DEFAULT '',
  evidence_text text,
  extraction_method text NOT NULL DEFAULT 'page_extract',
  confidence text,
  metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
  extracted_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE UNIQUE INDEX IF NOT EXISTS foundation_people_dedupe_idx
  ON foundation_people (foundation_id, person_name_normalised, role_type, source_url, extraction_method);

CREATE INDEX IF NOT EXISTS foundation_people_foundation_idx
  ON foundation_people (foundation_id, extracted_at DESC);

CREATE INDEX IF NOT EXISTS foundation_people_person_idx
  ON foundation_people (person_name_normalised);

CREATE TABLE IF NOT EXISTS foundation_grantees (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  foundation_id uuid NOT NULL REFERENCES foundations(id) ON DELETE CASCADE,
  foundation_abn text,
  foundation_name text NOT NULL,
  grantee_name text NOT NULL,
  grantee_name_normalised text NOT NULL,
  grantee_entity_id uuid REFERENCES gs_entities(id) ON DELETE SET NULL,
  grantee_abn text,
  grant_amount numeric,
  grant_year integer,
  program_name text,
  source_url text NOT NULL DEFAULT '',
  source_document_url text NOT NULL DEFAULT '',
  evidence_text text,
  link_method text,
  extraction_method text NOT NULL DEFAULT 'page_extract',
  confidence text,
  metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
  extracted_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE UNIQUE INDEX IF NOT EXISTS foundation_grantees_dedupe_idx
  ON foundation_grantees (
    foundation_id,
    grantee_name_normalised,
    COALESCE(grant_year, -1),
    COALESCE(program_name, ''),
    source_url,
    extraction_method
  );

CREATE INDEX IF NOT EXISTS foundation_grantees_foundation_idx
  ON foundation_grantees (foundation_id, extracted_at DESC);

CREATE INDEX IF NOT EXISTS foundation_grantees_entity_idx
  ON foundation_grantees (grantee_entity_id);

CREATE INDEX IF NOT EXISTS foundation_grantees_name_idx
  ON foundation_grantees (grantee_name_normalised);

CREATE TABLE IF NOT EXISTS foundation_relationship_signals (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  foundation_id uuid NOT NULL REFERENCES foundations(id) ON DELETE CASCADE,
  foundation_abn text,
  foundation_name text NOT NULL,
  signal_type text NOT NULL,
  related_entity_id uuid REFERENCES gs_entities(id) ON DELETE SET NULL,
  related_abn text,
  related_name text,
  person_name text,
  foundation_person_id uuid REFERENCES foundation_people(id) ON DELETE CASCADE,
  foundation_grantee_id uuid REFERENCES foundation_grantees(id) ON DELETE CASCADE,
  source_url text NOT NULL DEFAULT '',
  evidence_text text,
  strength numeric(6,2),
  confidence text,
  metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE UNIQUE INDEX IF NOT EXISTS foundation_relationship_signals_dedupe_idx
  ON foundation_relationship_signals (
    foundation_id,
    signal_type,
    COALESCE(related_entity_id::text, ''),
    COALESCE(person_name, ''),
    COALESCE(source_url, ''),
    COALESCE(foundation_person_id::text, ''),
    COALESCE(foundation_grantee_id::text, '')
  );

CREATE INDEX IF NOT EXISTS foundation_relationship_signals_foundation_idx
  ON foundation_relationship_signals (foundation_id, signal_type, created_at DESC);

CREATE INDEX IF NOT EXISTS foundation_relationship_signals_related_entity_idx
  ON foundation_relationship_signals (related_entity_id, signal_type);

NOTIFY pgrst, 'reload schema';
