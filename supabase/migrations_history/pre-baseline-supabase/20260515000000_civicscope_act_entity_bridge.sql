-- CivicScope ↔ ACT entity bridge (Prompt #1 keystone)
--
-- Generic junction between ACT-curated entities (initially canonical_entities,
-- 15K people merged from GHL via canonical_company text) and CivicScope's
-- gs_entities (514K org registry). Match methods:
--   abn          — future-proof; no abn on canonical_entities yet
--   name_exact   — upper(btrim()) match using idx_gs_entities_name_upper
--   name_fuzzy   — pg_trgm % operator against idx_gs_entities_canonical_trgm
--   manual       — human-reviewed override
--
-- Boundary rule (per CLAUDE.md): GrantScope WRITES this table + foundations.*;
-- it never writes canonical_entities / ghl_* / projects (those are ACT-owned).

CREATE TABLE IF NOT EXISTS civicscope_act_entity_bridge (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),

  act_source_table text NOT NULL DEFAULT 'canonical_entities',
  act_source_id uuid NOT NULL,
  act_match_value text NOT NULL,

  gs_entity_id uuid NOT NULL REFERENCES gs_entities(id) ON DELETE CASCADE,
  gs_id text NOT NULL,
  gs_canonical_name text NOT NULL,

  match_method text NOT NULL CHECK (match_method IN ('abn','name_exact','name_fuzzy','manual')),
  confidence numeric NOT NULL CHECK (confidence BETWEEN 0 AND 1),
  matched_field text NOT NULL,

  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  reviewed_at timestamptz,
  reviewed_by text,
  is_active boolean NOT NULL DEFAULT true,

  UNIQUE (act_source_table, act_source_id, gs_entity_id)
);

CREATE INDEX IF NOT EXISTS idx_bridge_gs_entity
  ON civicscope_act_entity_bridge (gs_entity_id);
CREATE INDEX IF NOT EXISTS idx_bridge_act_source
  ON civicscope_act_entity_bridge (act_source_table, act_source_id);
CREATE INDEX IF NOT EXISTS idx_bridge_method_confidence
  ON civicscope_act_entity_bridge (match_method, confidence DESC);

COMMENT ON TABLE civicscope_act_entity_bridge IS
  'Junction: ACT canonical_entities (people via canonical_company) ↔ CivicScope gs_entities (orgs). Owned by grantscope repo. ACT main reads via v_act_organisations.';


-- Utility: normalise an org name for downstream comparison (lowercase, strip
-- legal suffixes, punctuation, whitespace). Kept available for future matchers
-- even though the current bridge uses simpler upper(btrim()) + trgm.
CREATE OR REPLACE FUNCTION civicscope_normalize_org_name(p_name text)
RETURNS text
LANGUAGE sql
IMMUTABLE
PARALLEL SAFE
AS $$
  SELECT NULLIF(
    btrim(
      regexp_replace(
        regexp_replace(
          regexp_replace(
            lower(coalesce(p_name, '')),
            E'\\b(pty\\.?\\s*ltd\\.?|pty\\s*limited|limited|incorporated|inc\\.?|corporation|corp\\.?|llc|llp|p/l|p\\.?l\\.?|the|and|&)\\b',
            ' ', 'g'
          ),
          '[^a-z0-9 ]', ' ', 'g'
        ),
        E'\\s+', ' ', 'g'
      )
    ),
    ''
  );
$$;


-- Step 1: exact match canonical_company → gs_entities via upper(btrim()) index.
-- Single-shot; finishes in ~10s on 13K canonical_entities × 514K gs_entities.
CREATE OR REPLACE FUNCTION bridge_civicscope_to_act_exact(
  p_rebuild boolean DEFAULT false
)
RETURNS bigint
LANGUAGE plpgsql
AS $func$
DECLARE
  v_count bigint := 0;
BEGIN
  IF p_rebuild THEN
    DELETE FROM civicscope_act_entity_bridge
    WHERE act_source_table = 'canonical_entities'
      AND match_method = 'name_exact';
  END IF;

  WITH candidates AS (
    SELECT
      ce.id AS act_id,
      ce.canonical_company AS act_company,
      upper(btrim(ce.canonical_company)) AS norm_company
    FROM canonical_entities ce
    WHERE ce.canonical_company IS NOT NULL
      AND length(btrim(ce.canonical_company)) >= 3
  ),
  matched AS (
    SELECT
      c.act_id,
      c.act_company,
      g.id AS gs_entity_id,
      g.gs_id,
      g.canonical_name AS gs_name
    FROM candidates c
    CROSS JOIN LATERAL (
      SELECT id, gs_id, canonical_name
      FROM gs_entities
      WHERE upper(btrim(canonical_name)) = c.norm_company
      LIMIT 1
    ) g
  )
  INSERT INTO civicscope_act_entity_bridge (
    act_source_table, act_source_id, act_match_value,
    gs_entity_id, gs_id, gs_canonical_name,
    match_method, confidence, matched_field
  )
  SELECT
    'canonical_entities', m.act_id, m.act_company,
    m.gs_entity_id, m.gs_id, m.gs_name,
    'name_exact', 0.95, 'canonical_company'
  FROM matched m
  ON CONFLICT (act_source_table, act_source_id, gs_entity_id) DO UPDATE
    SET match_method  = 'name_exact',
        confidence    = GREATEST(civicscope_act_entity_bridge.confidence, EXCLUDED.confidence),
        matched_field = EXCLUDED.matched_field,
        updated_at    = now();

  GET DIAGNOSTICS v_count = ROW_COUNT;
  RETURN v_count;
END;
$func$;

COMMENT ON FUNCTION bridge_civicscope_to_act_exact(boolean) IS
  'Exact-match canonical_entities.canonical_company → gs_entities.canonical_name via upper(btrim()) index. Idempotent.';


-- Step 2: batched fuzzy match. Each call processes one batch of unmatched
-- canonical_entities; driver loops until done. Uses pg_trgm GIN index with
-- raised similarity_threshold (0.5) to keep candidate sets bounded. Filters
-- out generic placeholders (self / consultant / freelance / etc.) and short
-- single-word company values that explode the candidate set.
--
-- Returns (rows_inserted, batch_processed, last_id, done). Driver passes
-- last_id back as p_after_id; stops when done=true (batch_processed=0).
CREATE OR REPLACE FUNCTION bridge_civicscope_to_act_fuzzy(
  p_batch_limit int DEFAULT 500,
  p_after_id uuid DEFAULT NULL,
  p_min_similarity numeric DEFAULT 0.70
)
RETURNS TABLE (
  rows_inserted bigint,
  batch_processed bigint,
  last_id uuid,
  done boolean
)
LANGUAGE plpgsql
SET search_path TO extensions, public, pg_temp
AS $func$
DECLARE
  v_inserted bigint := 0;
  v_batch_size bigint := 0;
  v_last_id uuid;
BEGIN
  PERFORM set_limit(0.5);

  CREATE TEMP TABLE _bridge_batch ON COMMIT DROP AS
  SELECT ce.id, ce.canonical_company
  FROM canonical_entities ce
  LEFT JOIN civicscope_act_entity_bridge b
    ON b.act_source_id = ce.id
   AND b.act_source_table = 'canonical_entities'
  WHERE ce.canonical_company IS NOT NULL
    AND length(btrim(ce.canonical_company)) >= 6
    AND b.id IS NULL
    AND (p_after_id IS NULL OR ce.id > p_after_id)
    AND lower(btrim(ce.canonical_company)) !~ '^(self|n/?a|none|null|tbd|tba|unknown|sole trader|consultant|consulting|freelance|freelancer|retired|self employed|self-employed|independent)$'
    AND NOT (canonical_company !~ '\s' AND length(btrim(canonical_company)) < 8)
  ORDER BY ce.id
  LIMIT p_batch_limit;

  SELECT COUNT(*) INTO v_batch_size FROM _bridge_batch;
  SELECT id INTO v_last_id FROM _bridge_batch ORDER BY id DESC LIMIT 1;

  INSERT INTO civicscope_act_entity_bridge (
    act_source_table, act_source_id, act_match_value,
    gs_entity_id, gs_id, gs_canonical_name,
    match_method, confidence, matched_field
  )
  SELECT
    'canonical_entities', b.id, b.canonical_company,
    g.id, g.gs_id, g.canonical_name,
    'name_fuzzy', similarity(lower(g.canonical_name), lower(b.canonical_company)), 'canonical_company'
  FROM _bridge_batch b
  CROSS JOIN LATERAL (
    SELECT id, gs_id, canonical_name
    FROM gs_entities
    WHERE canonical_name % b.canonical_company
    ORDER BY canonical_name <-> b.canonical_company
    LIMIT 1
  ) g
  WHERE similarity(lower(g.canonical_name), lower(b.canonical_company)) >= p_min_similarity
  ON CONFLICT (act_source_table, act_source_id, gs_entity_id) DO NOTHING;

  GET DIAGNOSTICS v_inserted = ROW_COUNT;

  RETURN QUERY SELECT v_inserted, v_batch_size, v_last_id, v_batch_size = 0;
END;
$func$;

COMMENT ON FUNCTION bridge_civicscope_to_act_fuzzy(int, uuid, numeric) IS
  'Batched pg_trgm fuzzy match. Driver: scripts/run-bridge-fuzzy.mjs. Stops when batch_processed=0.';


-- Denormalised view: one row per active bridge, ready for ACT main to read.
CREATE OR REPLACE VIEW v_act_organisations AS
SELECT
  b.id AS bridge_id,

  -- ACT person side
  ce.id   AS canonical_entity_id,
  ce.canonical_name    AS person_name,
  ce.canonical_email   AS person_email,
  ce.canonical_company AS act_company_text,
  ce.engagement_status,
  ce.primary_project_codes,
  ce.tags AS act_tags,

  -- CivicScope org side
  g.id            AS gs_entity_uuid,
  g.gs_id,
  g.canonical_name AS gs_canonical_name,
  g.abn,
  g.entity_type,
  g.sector,
  g.state,
  g.postcode,
  g.lga_name,
  g.remoteness,
  g.seifa_irsd_decile,
  g.is_community_controlled,

  -- Match metadata
  b.match_method,
  b.confidence,
  b.created_at AS bridged_at,
  b.reviewed_at,
  b.is_active
FROM civicscope_act_entity_bridge b
JOIN canonical_entities ce
  ON ce.id = b.act_source_id
 AND b.act_source_table = 'canonical_entities'
JOIN gs_entities g
  ON g.id = b.gs_entity_id
WHERE b.is_active = true;

COMMENT ON VIEW v_act_organisations IS
  'ACT-curated people (canonical_entities) joined to CivicScope org records (gs_entities) via the bridge. Read-only surface for ACT main.';
