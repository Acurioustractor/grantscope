-- Seed / sync goods_relationships from the existing scattered sources.
-- Idempotent: re-runnable, ON CONFLICT (dedupe_key) refreshes computed fields.
-- Plan: thoughts/shared/plans/goods-command-center-2026-06-09.md
-- Apply: source .env && PGPASSWORD="$DATABASE_PASSWORD" psql -h aws-0-ap-southeast-2.pooler.supabase.com -p 6543 -U "postgres.tednluwflfhxyucgwigh" -d postgres -f scripts/seed-goods-relationships.sql
-- act org = 8b6160a1-7eea-4bd2-8404-71c196381de0 ; Goods project_code = ACT-GD

-- ---------------------------------------------------------------------------
-- 1) Goods capital deals  ->  funder / impact_investor / repayable_finance
-- ---------------------------------------------------------------------------
WITH pipeline_src AS (
  SELECT
    p.id,
    CASE
      WHEN p.funder_type ILIKE '%invest%'                              THEN 'impact_investor'
      WHEN p.funder_type ILIKE '%loan%' OR p.funder_type ILIKE '%debt%'
        OR p.funder_type ILIKE '%finance%' OR p.funder_type ILIKE '%cdfi%' THEN 'repayable_finance'
      ELSE 'funder'
    END AS relationship_type,
    COALESCE(NULLIF(btrim(p.funder), ''), p.name) AS display_name,
    p.funder_entity_id AS entity_id,
    p.ghl_opportunity_id,
    CASE
      WHEN COALESCE(p.qbe_stage, p.status) ILIKE '%won%'
        OR COALESCE(p.qbe_stage, p.status) ILIKE '%award%'
        OR COALESCE(p.qbe_stage, p.status) ILIKE '%commit%'
        OR COALESCE(p.qbe_stage, p.status) ILIKE '%fund%'      THEN 'committed'
      WHEN COALESCE(p.qbe_stage, p.status) ILIKE '%submit%'
        OR COALESCE(p.qbe_stage, p.status) ILIKE '%appl%'
        OR COALESCE(p.qbe_stage, p.status) ILIKE '%proposal%'
        OR COALESCE(p.qbe_stage, p.status) ILIKE '%bid%'       THEN 'proposal'
      WHEN COALESCE(p.qbe_stage, p.status) ILIKE '%convers%'
        OR COALESCE(p.qbe_stage, p.status) ILIKE '%engage%'
        OR COALESCE(p.qbe_stage, p.status) ILIKE '%qualif%'    THEN 'in_conversation'
      WHEN COALESCE(p.qbe_stage, p.status) ILIKE '%contact%'   THEN 'contacted'
      WHEN COALESCE(p.qbe_stage, p.status) ILIKE '%research%'
        OR COALESCE(p.qbe_stage, p.status) ILIKE '%discover%'  THEN 'researching'
      WHEN COALESCE(p.qbe_stage, p.status) ILIKE '%lost%'
        OR COALESCE(p.qbe_stage, p.status) ILIKE '%declin%'
        OR COALESCE(p.qbe_stage, p.status) ILIKE '%dead%'      THEN 'declined'
      ELSE 'identified'
    END AS stage,
    COALESCE(p.last_synced_at, p.updated_at) AS last_touch_at,
    COALESCE(p.qbe_outcome ILIKE 'won' OR p.status ILIKE '%award%' OR p.status ILIKE '%won%', false) AS won,
    p.qbe_stage,
    p.amount_numeric,
    p.qbe_bid_amount
  FROM org_pipeline p
  WHERE p.project_code = 'ACT-GD'
    AND p.org_profile_id = '8b6160a1-7eea-4bd2-8404-71c196381de0'
)
INSERT INTO goods_relationships
  (relationship_type, display_name, entity_id, ghl_opportunity_id, stage, last_touch_at,
   total_received_aud, has_prior_support, alignment_score, warmth_computed, source_refs)
SELECT
  s.relationship_type, s.display_name, s.entity_id, s.ghl_opportunity_id, s.stage, s.last_touch_at,
  CASE WHEN s.won THEN COALESCE(s.qbe_bid_amount, s.amount_numeric, 0) ELSE 0 END AS total_received_aud,
  s.won AS has_prior_support,
  NULL::numeric AS alignment_score,
  goods_compute_warmth(
    s.stage, s.last_touch_at,
    CASE WHEN s.won THEN COALESCE(s.qbe_bid_amount, s.amount_numeric, 0) ELSE 0 END,
    NULL, s.won, 0) AS warmth_computed,
  jsonb_build_object('source', 'org_pipeline', 'id', s.id, 'qbe_stage', s.qbe_stage)
FROM (
  SELECT *, row_number() OVER (
    PARTITION BY relationship_type, COALESCE(entity_id::text, lower(display_name))
    ORDER BY last_touch_at DESC NULLS LAST) AS rn
  FROM pipeline_src
) s
WHERE s.rn = 1
ON CONFLICT (dedupe_key) DO UPDATE SET
  stage              = EXCLUDED.stage,
  ghl_opportunity_id = COALESCE(EXCLUDED.ghl_opportunity_id, goods_relationships.ghl_opportunity_id),
  last_touch_at      = EXCLUDED.last_touch_at,
  total_received_aud = GREATEST(goods_relationships.total_received_aud, EXCLUDED.total_received_aud),
  has_prior_support  = goods_relationships.has_prior_support OR EXCLUDED.has_prior_support,
  warmth_computed    = EXCLUDED.warmth_computed,
  source_refs        = goods_relationships.source_refs || EXCLUDED.source_refs,
  updated_at         = now();

-- ---------------------------------------------------------------------------
-- 2) Courted funders (saved_foundations for the act org)  ->  funder
-- ---------------------------------------------------------------------------
WITH fnd_src AS (
  SELECT
    sf.id,
    COALESCE(f.name, 'Foundation ' || left(sf.foundation_id::text, 8)) AS display_name,
    ge.id AS entity_id,
    CASE COALESCE(sf.relationship_stage, sf.stage)
      WHEN 'identified'      THEN 'identified'
      WHEN 'researching'     THEN 'researching'
      WHEN 'contacted'       THEN 'contacted'
      WHEN 'in_conversation' THEN 'in_conversation'
      WHEN 'applied'         THEN 'proposal'
      WHEN 'funded'          THEN 'committed'
      WHEN 'declined'        THEN 'declined'
      ELSE 'identified'
    END AS stage,
    sf.last_contact_date::timestamptz AS last_touch_at,
    COALESCE(COALESCE(sf.relationship_stage, sf.stage) = 'funded', false) AS won,
    sf.alignment_score
  FROM saved_foundations sf
  LEFT JOIN foundations f  ON f.id = sf.foundation_id
  LEFT JOIN gs_entities ge ON ge.abn = f.acnc_abn AND f.acnc_abn IS NOT NULL
  WHERE sf.org_profile_id = '8b6160a1-7eea-4bd2-8404-71c196381de0'
     OR sf.user_id = '079d5f62-4502-4129-bcda-0e61a914b26d'
)
INSERT INTO goods_relationships
  (relationship_type, display_name, entity_id, stage, last_touch_at,
   total_received_aud, has_prior_support, alignment_score, warmth_computed, source_refs)
SELECT
  'funder', s.display_name, s.entity_id, s.stage, s.last_touch_at,
  0::numeric, s.won, s.alignment_score,
  goods_compute_warmth(s.stage, s.last_touch_at, 0, s.alignment_score, s.won, 0),
  jsonb_build_object('source', 'saved_foundations', 'id', s.id)
FROM (
  SELECT *, row_number() OVER (
    PARTITION BY COALESCE(entity_id::text, lower(display_name))
    ORDER BY last_touch_at DESC NULLS LAST) AS rn
  FROM fnd_src
) s
WHERE s.rn = 1
ON CONFLICT (dedupe_key) DO UPDATE SET
  stage           = EXCLUDED.stage,
  last_touch_at   = COALESCE(EXCLUDED.last_touch_at, goods_relationships.last_touch_at),
  alignment_score = COALESCE(EXCLUDED.alignment_score, goods_relationships.alignment_score),
  has_prior_support = goods_relationships.has_prior_support OR EXCLUDED.has_prior_support,
  warmth_computed = EXCLUDED.warmth_computed,
  source_refs     = goods_relationships.source_refs || EXCLUDED.source_refs,
  updated_at      = now();

-- ---------------------------------------------------------------------------
-- 3) Engaged buyers (goods_procurement_entities with real engagement)  ->  buyer
-- ---------------------------------------------------------------------------
WITH buyer_src AS (
  SELECT
    g.id,
    g.entity_name AS display_name,
    g.entity_id,
    g.ghl_opportunity_id,
    CASE
      WHEN g.ghl_stage_name ILIKE '%won%'    OR g.ghl_stage_name ILIKE '%deliver%' THEN 'committed'
      WHEN g.ghl_stage_name ILIKE '%order%'  OR g.ghl_stage_name ILIKE '%proposal%'
        OR g.ghl_stage_name ILIKE '%quote%'                                        THEN 'proposal'
      WHEN g.ghl_stage_name ILIKE '%convers%' OR g.ghl_stage_name ILIKE '%engage%' THEN 'in_conversation'
      WHEN g.ghl_stage_name ILIKE '%contact%' OR g.last_contact_date IS NOT NULL   THEN 'contacted'
      ELSE 'researching'
    END AS stage,
    g.last_contact_date AS last_touch_at,
    g.fit_score,
    g.next_action
  FROM goods_procurement_entities g
  WHERE g.ghl_opportunity_id IS NOT NULL OR g.last_contact_date IS NOT NULL
)
INSERT INTO goods_relationships
  (relationship_type, display_name, entity_id, ghl_opportunity_id, stage, last_touch_at,
   total_received_aud, has_prior_support, alignment_score, next_action, warmth_computed, source_refs)
SELECT
  'buyer', s.display_name, s.entity_id, s.ghl_opportunity_id, s.stage, s.last_touch_at,
  0::numeric, false, s.fit_score, s.next_action,
  goods_compute_warmth(s.stage, s.last_touch_at, 0, s.fit_score, false, 0),
  jsonb_build_object('source', 'goods_procurement_entities', 'id', s.id)
FROM (
  SELECT *, row_number() OVER (
    PARTITION BY COALESCE(entity_id::text, lower(display_name))
    ORDER BY last_touch_at DESC NULLS LAST) AS rn
  FROM buyer_src
) s
WHERE s.rn = 1
ON CONFLICT (dedupe_key) DO UPDATE SET
  stage              = EXCLUDED.stage,
  ghl_opportunity_id = COALESCE(EXCLUDED.ghl_opportunity_id, goods_relationships.ghl_opportunity_id),
  last_touch_at      = COALESCE(EXCLUDED.last_touch_at, goods_relationships.last_touch_at),
  alignment_score    = COALESCE(EXCLUDED.alignment_score, goods_relationships.alignment_score),
  next_action        = COALESCE(EXCLUDED.next_action, goods_relationships.next_action),
  warmth_computed    = EXCLUDED.warmth_computed,
  source_refs        = goods_relationships.source_refs || EXCLUDED.source_refs,
  updated_at         = now();

-- ---------------------------------------------------------------------------
-- 4) Warm-intro paths — the differentiator. For each entity-linked relationship,
--    find a shared board member who ALSO sits on the board of ANOTHER relationship
--    we already have (preferring the warmest), via mv_person_entity_network.
--    "via {person} — also on the board of {known org}".
-- ---------------------------------------------------------------------------
WITH our AS (
  SELECT id, entity_id, display_name, warmth_display
  FROM goods_relationships
  WHERE entity_id IS NOT NULL
),
paths AS (
  SELECT DISTINCT ON (t.id)
    t.id,
    'via ' || pen_t.person_name_display || ' — also on the board of ' || k.display_name AS path
  FROM our t
  JOIN mv_person_entity_network pen_t ON pen_t.entity_id = t.entity_id
  JOIN mv_person_entity_network pen_k
       ON pen_k.person_name_normalised = pen_t.person_name_normalised
      AND pen_k.entity_id <> t.entity_id
  JOIN our k ON k.entity_id = pen_k.entity_id AND k.id <> t.id
  ORDER BY t.id, k.warmth_display DESC
)
UPDATE goods_relationships g
SET warm_intro_path = paths.path, updated_at = now()
FROM paths
WHERE g.id = paths.id;

