-- Foundation landscape taxonomy, geography assignments, and visualization views.

BEGIN;

CREATE TABLE IF NOT EXISTS foundation_categories (
  category_slug text PRIMARY KEY,
  label text NOT NULL,
  parent_slug text REFERENCES foundation_categories(category_slug) ON DELETE SET NULL,
  description text,
  color_hex text NOT NULL DEFAULT '#121212',
  sort_order integer NOT NULL DEFAULT 100,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS foundation_category_assignments (
  foundation_id uuid NOT NULL REFERENCES foundations(id) ON DELETE CASCADE,
  category_slug text NOT NULL REFERENCES foundation_categories(category_slug) ON DELETE CASCADE,
  assignment_kind text NOT NULL DEFAULT 'inferred'
    CHECK (assignment_kind IN ('declared', 'program', 'observed', 'inferred', 'manual')),
  confidence numeric(4,3) NOT NULL DEFAULT 0.5 CHECK (confidence >= 0 AND confidence <= 1),
  evidence_text text,
  evidence_url text,
  assignment_source text NOT NULL DEFAULT 'foundation-landscape-classifier',
  classifier_version text NOT NULL DEFAULT 'v1',
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (foundation_id, category_slug, assignment_kind, assignment_source)
);

CREATE INDEX IF NOT EXISTS idx_foundation_category_assignments_category
  ON foundation_category_assignments(category_slug, confidence DESC);

CREATE INDEX IF NOT EXISTS idx_foundation_category_assignments_foundation
  ON foundation_category_assignments(foundation_id);

CREATE TABLE IF NOT EXISTS foundation_geo_focus (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  foundation_id uuid NOT NULL REFERENCES foundations(id) ON DELETE CASCADE,
  geo_type text NOT NULL CHECK (geo_type IN ('national', 'state', 'region', 'lga', 'postcode', 'remoteness', 'place')),
  geo_code text,
  geo_name text NOT NULL,
  confidence numeric(4,3) NOT NULL DEFAULT 0.5 CHECK (confidence >= 0 AND confidence <= 1),
  evidence_text text,
  evidence_url text,
  assignment_source text NOT NULL DEFAULT 'foundation-landscape-classifier',
  classifier_version text NOT NULL DEFAULT 'v1',
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE UNIQUE INDEX IF NOT EXISTS foundation_geo_focus_dedupe_idx
  ON foundation_geo_focus(foundation_id, geo_type, coalesce(geo_code, ''), lower(geo_name), assignment_source);

CREATE INDEX IF NOT EXISTS idx_foundation_geo_focus_geo
  ON foundation_geo_focus(geo_type, geo_code, geo_name);

INSERT INTO foundation_categories (category_slug, label, description, color_hex, sort_order) VALUES
  ('first-nations', 'First Nations', 'Aboriginal and Torres Strait Islander communities, culture, enterprise, justice, health, and self-determination.', '#D02020', 10),
  ('housing-homelessness', 'Housing & Homelessness', 'Housing security, homelessness response, shelters, tenancy support, and emergency accommodation.', '#1040C0', 20),
  ('health-wellbeing', 'Health & Wellbeing', 'Physical health, mental health, hospitals, wellbeing, medical support, prevention, and community health.', '#00A878', 30),
  ('education-scholarships', 'Education & Scholarships', 'Schools, tertiary access, scholarships, bursaries, training, learning, and student support.', '#F0C020', 40),
  ('youth-families', 'Youth & Families', 'Children, young people, families, parenting, early years, and youth development.', '#E85D04', 50),
  ('justice-systems-change', 'Justice & Systems Change', 'Justice reform, prevention, diversion, reintegration, legal support, advocacy, and systems change.', '#6A4C93', 60),
  ('arts-culture', 'Arts & Culture', 'Arts practice, cultural organisations, festivals, heritage, creative industries, and artists.', '#E83F6F', 70),
  ('environment-climate', 'Environment & Climate', 'Conservation, biodiversity, climate, landcare, water, circular economy, and sustainability.', '#2A9D8F', 80),
  ('regional-rural', 'Regional & Rural Communities', 'Regional, rural, and remote community resilience, liveability, leadership, and place-based work.', '#8D5524', 90),
  ('disability-inclusion', 'Disability & Inclusion', 'Disability support, accessibility, inclusion, assistive technology, and participation.', '#118AB2', 100),
  ('social-enterprise-employment', 'Social Enterprise & Employment', 'Employment pathways, enterprise, financial inclusion, social business, and workforce participation.', '#073B4C', 110),
  ('disaster-resilience', 'Disaster & Resilience', 'Disaster recovery, preparedness, emergency relief, climate resilience, and crisis response.', '#EF476F', 120),
  ('animal-welfare', 'Animal Welfare', 'Animal rescue, wildlife care, animal health, and protection.', '#7CB518', 130),
  ('research-medical-science', 'Research & Medical Science', 'Scientific, medical, academic, and translational research funding.', '#3A86FF', 140),
  ('faith-community-welfare', 'Faith & Community Welfare', 'Faith-connected welfare, community support, relief, and pastoral care.', '#9B5DE5', 150),
  ('community-capacity', 'Community Capacity', 'General community grants, local capacity, equipment, volunteering, and civic participation.', '#121212', 160)
ON CONFLICT (category_slug) DO UPDATE SET
  label = EXCLUDED.label,
  description = EXCLUDED.description,
  color_hex = EXCLUDED.color_hex,
  sort_order = EXCLUDED.sort_order,
  updated_at = now();

DROP MATERIALIZED VIEW IF EXISTS mv_foundation_landscape_top_foundations;
DROP MATERIALIZED VIEW IF EXISTS mv_foundation_landscape_access;
DROP MATERIALIZED VIEW IF EXISTS mv_foundation_landscape_geo;
DROP MATERIALIZED VIEW IF EXISTS mv_foundation_landscape_category;

CREATE MATERIALIZED VIEW mv_foundation_landscape_category AS
WITH category_foundations AS (
  SELECT DISTINCT foundation_id, category_slug
  FROM foundation_category_assignments
  WHERE confidence >= 0.35
),
program_counts AS (
  SELECT
    foundation_id,
    count(*) FILTER (WHERE status IN ('open', 'ongoing', 'upcoming')) AS open_program_count,
    count(*) AS program_count
  FROM foundation_programs
  GROUP BY foundation_id
),
grantee_counts AS (
  SELECT
    foundation_id,
    count(*) AS observed_grantee_count,
    coalesce(sum(grant_amount), 0)::numeric AS observed_grant_amount
  FROM foundation_grantees
  GROUP BY foundation_id
)
SELECT
  c.category_slug,
  c.label,
  c.color_hex,
  c.sort_order,
  count(DISTINCT f.id)::integer AS foundation_count,
  coalesce(sum(f.total_giving_annual), 0)::numeric AS estimated_annual_giving,
  coalesce(sum(pc.open_program_count), 0)::integer AS open_program_count,
  coalesce(sum(pc.program_count), 0)::integer AS program_count,
  coalesce(sum(gc.observed_grantee_count), 0)::integer AS observed_grantee_count,
  coalesce(sum(gc.observed_grant_amount), 0)::numeric AS observed_grant_amount
FROM foundation_categories c
LEFT JOIN category_foundations cf ON cf.category_slug = c.category_slug
LEFT JOIN foundations f ON f.id = cf.foundation_id
LEFT JOIN program_counts pc ON pc.foundation_id = f.id
LEFT JOIN grantee_counts gc ON gc.foundation_id = f.id
GROUP BY c.category_slug, c.label, c.color_hex, c.sort_order;

CREATE UNIQUE INDEX idx_mv_foundation_landscape_category_slug
  ON mv_foundation_landscape_category(category_slug);

CREATE INDEX idx_mv_foundation_landscape_category_giving
  ON mv_foundation_landscape_category(estimated_annual_giving DESC);

CREATE MATERIALIZED VIEW mv_foundation_landscape_geo AS
WITH geo_foundations AS (
  SELECT DISTINCT foundation_id, geo_type, geo_code, geo_name
  FROM foundation_geo_focus
  WHERE confidence >= 0.35
),
program_counts AS (
  SELECT
    foundation_id,
    count(*) FILTER (WHERE status IN ('open', 'ongoing', 'upcoming')) AS open_program_count
  FROM foundation_programs
  GROUP BY foundation_id
)
SELECT
  gf.geo_type,
  gf.geo_code,
  gf.geo_name,
  count(DISTINCT f.id)::integer AS foundation_count,
  coalesce(sum(f.total_giving_annual), 0)::numeric AS estimated_annual_giving,
  coalesce(sum(pc.open_program_count), 0)::integer AS open_program_count
FROM geo_foundations gf
JOIN foundations f ON f.id = gf.foundation_id
LEFT JOIN program_counts pc ON pc.foundation_id = f.id
GROUP BY gf.geo_type, gf.geo_code, gf.geo_name;

CREATE UNIQUE INDEX idx_mv_foundation_landscape_geo_key
  ON mv_foundation_landscape_geo(geo_type, coalesce(geo_code, ''), geo_name);

CREATE INDEX idx_mv_foundation_landscape_geo_giving
  ON mv_foundation_landscape_geo(estimated_annual_giving DESC);

CREATE MATERIALIZED VIEW mv_foundation_landscape_access AS
WITH program_modes AS (
  SELECT
    foundation_id,
    bool_or(status IN ('open', 'ongoing', 'upcoming')) AS has_open_program,
    bool_or(application_mode = 'online_application') AS has_online_application,
    bool_or(application_mode = 'eoi') AS has_eoi,
    bool_or(application_mode = 'invitation_only' OR status = 'invitation_only') AS has_invitation_only,
    bool_or(application_mode IN ('relationship_based', 'monitor') OR status = 'monitor') AS has_relationship_monitor
  FROM foundation_programs
  GROUP BY foundation_id
),
foundation_access AS (
  SELECT
    f.id,
    f.total_giving_annual,
    CASE
      WHEN pm.has_open_program AND pm.has_online_application THEN 'open_application'
      WHEN pm.has_open_program AND pm.has_eoi THEN 'eoi'
      WHEN pm.has_invitation_only THEN 'invitation_only'
      WHEN pm.has_relationship_monitor THEN 'relationship_led'
      WHEN pm.has_open_program THEN 'open_or_rolling'
      WHEN f.application_tips IS NOT NULL OR f.giving_philosophy IS NOT NULL THEN 'relationship_led'
      ELSE 'unknown'
    END AS access_mode
  FROM foundations f
  LEFT JOIN program_modes pm ON pm.foundation_id = f.id
)
SELECT
  access_mode,
  count(*)::integer AS foundation_count,
  coalesce(sum(total_giving_annual), 0)::numeric AS estimated_annual_giving
FROM foundation_access
GROUP BY access_mode;

CREATE UNIQUE INDEX idx_mv_foundation_landscape_access_mode
  ON mv_foundation_landscape_access(access_mode);

CREATE MATERIALIZED VIEW mv_foundation_landscape_top_foundations AS
WITH category_rollup AS (
  SELECT
    fca.foundation_id,
    array_agg(DISTINCT fc.label ORDER BY fc.label) AS categories
  FROM foundation_category_assignments fca
  JOIN foundation_categories fc ON fc.category_slug = fca.category_slug
  WHERE fca.confidence >= 0.35
  GROUP BY fca.foundation_id
),
geo_rollup AS (
  SELECT
    foundation_id,
    array_agg(DISTINCT geo_name ORDER BY geo_name) AS geographies
  FROM foundation_geo_focus
  WHERE confidence >= 0.35
  GROUP BY foundation_id
),
program_counts AS (
  SELECT
    foundation_id,
    count(*) FILTER (WHERE status IN ('open', 'ongoing', 'upcoming')) AS open_program_count,
    count(*) AS program_count
  FROM foundation_programs
  GROUP BY foundation_id
),
grantee_counts AS (
  SELECT
    foundation_id,
    count(*) AS observed_grantee_count,
    coalesce(sum(grant_amount), 0)::numeric AS observed_grant_amount
  FROM foundation_grantees
  GROUP BY foundation_id
)
SELECT
  f.id AS foundation_id,
  f.name,
  f.type,
  f.website,
  f.total_giving_annual,
  f.profile_confidence,
  coalesce(cr.categories, ARRAY[]::text[]) AS categories,
  coalesce(gr.geographies, ARRAY[]::text[]) AS geographies,
  coalesce(pc.open_program_count, 0)::integer AS open_program_count,
  coalesce(pc.program_count, 0)::integer AS program_count,
  coalesce(gc.observed_grantee_count, 0)::integer AS observed_grantee_count,
  coalesce(gc.observed_grant_amount, 0)::numeric AS observed_grant_amount,
  greatest(
    coalesce(f.total_giving_annual, 0),
    coalesce(gc.observed_grant_amount, 0)
  )::numeric AS landscape_weight
FROM foundations f
LEFT JOIN category_rollup cr ON cr.foundation_id = f.id
LEFT JOIN geo_rollup gr ON gr.foundation_id = f.id
LEFT JOIN program_counts pc ON pc.foundation_id = f.id
LEFT JOIN grantee_counts gc ON gc.foundation_id = f.id
WHERE coalesce(f.total_giving_annual, 0) > 0
   OR coalesce(pc.program_count, 0) > 0
   OR coalesce(gc.observed_grantee_count, 0) > 0;

CREATE UNIQUE INDEX idx_mv_foundation_landscape_top_foundations_id
  ON mv_foundation_landscape_top_foundations(foundation_id);

CREATE INDEX idx_mv_foundation_landscape_top_foundations_weight
  ON mv_foundation_landscape_top_foundations(landscape_weight DESC);

COMMIT;
