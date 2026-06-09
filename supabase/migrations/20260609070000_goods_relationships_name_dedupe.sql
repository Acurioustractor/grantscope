-- Goods Command Center — dedup pass + durable name-based de-duplication.
-- Problem: dedupe_key was `type || ':' || COALESCE(entity_id::text, lower(name))`,
-- so an entity-linked seed row and a name-only GHL row for the SAME org never
-- collapsed (different keys) -> duplicates (Paul Ramsay, Community Resources,
-- Australian Communities Foundation). Merging alone would regress on the next GHL
-- sync, so we also re-key dedup on the normalized NAME.
--
-- ORDER MATTERS: drop the OLD entity_id-based key BEFORE the merge — otherwise
-- moving a dup's entity_id onto its canonical row transiently makes two rows share
-- `type:<uuid>` and trips the old unique index.
-- Apply: source .env && PGPASSWORD="$DATABASE_PASSWORD" psql -h aws-0-ap-southeast-2.pooler.supabase.com -p 6543 -U "postgres.tednluwflfhxyucgwigh" -d postgres -f supabase/migrations/20260609070000_goods_relationships_name_dedupe.sql

BEGIN;

-- 0. Drop the old entity_id-based key + index FIRST (so the merge can move entity_id
--    onto canonical rows without a transient unique violation).
DROP INDEX IF EXISTS uq_goods_rel_dedupe;
ALTER TABLE goods_relationships DROP COLUMN dedupe_key;

-- 1. Fold each non-canonical duplicate's useful fields up into its canonical row.
--    Canonical = the row with a live GHL opp, then highest warmth, then entity-linked.
--    GHL stage is authoritative (system of record), so stage is NOT overwritten.
WITH ranked AS (
  SELECT id, entity_id, ghl_opportunity_id, ghl_contact_id, total_received_aud,
         has_prior_support, alignment_score, last_touch_at, warm_intro_path, next_action,
         row_number() OVER w AS rn,
         first_value(id) OVER w AS canon_id
  FROM goods_relationships
  WINDOW w AS (
    PARTITION BY relationship_type, lower(btrim(display_name))
    ORDER BY (ghl_opportunity_id IS NOT NULL) DESC, warmth_display DESC,
             (entity_id IS NOT NULL) DESC, created_at ASC
  )
),
folded AS (
  SELECT canon_id,
    (array_remove(array_agg(entity_id)          FILTER (WHERE rn > 1), NULL))[1] AS f_entity_id,
    (array_remove(array_agg(ghl_opportunity_id) FILTER (WHERE rn > 1), NULL))[1] AS f_ghl_opp,
    (array_remove(array_agg(ghl_contact_id)     FILTER (WHERE rn > 1), NULL))[1] AS f_ghl_contact,
    max(total_received_aud)                     FILTER (WHERE rn > 1)            AS f_received,
    bool_or(has_prior_support)                  FILTER (WHERE rn > 1)            AS f_prior,
    (array_remove(array_agg(alignment_score)    FILTER (WHERE rn > 1), NULL))[1] AS f_align,
    max(last_touch_at)                          FILTER (WHERE rn > 1)            AS f_touch,
    (array_remove(array_agg(warm_intro_path)    FILTER (WHERE rn > 1), NULL))[1] AS f_intro,
    (array_remove(array_agg(next_action)        FILTER (WHERE rn > 1), NULL))[1] AS f_next
  FROM ranked
  GROUP BY canon_id
  HAVING count(*) FILTER (WHERE rn > 1) > 0
)
UPDATE goods_relationships c SET
  entity_id          = COALESCE(c.entity_id, f.f_entity_id),
  ghl_opportunity_id = COALESCE(c.ghl_opportunity_id, f.f_ghl_opp),
  ghl_contact_id     = COALESCE(c.ghl_contact_id, f.f_ghl_contact),
  total_received_aud = GREATEST(c.total_received_aud, COALESCE(f.f_received, 0)),
  has_prior_support  = c.has_prior_support OR COALESCE(f.f_prior, false),
  alignment_score    = COALESCE(c.alignment_score, f.f_align),
  last_touch_at      = GREATEST(c.last_touch_at, f.f_touch),
  warm_intro_path    = COALESCE(c.warm_intro_path, f.f_intro),
  next_action        = COALESCE(c.next_action, f.f_next),
  updated_at         = now()
FROM folded f
WHERE c.id = f.canon_id;

-- 2. Delete the non-canonical duplicates.
WITH ranked AS (
  SELECT id, row_number() OVER (
    PARTITION BY relationship_type, lower(btrim(display_name))
    ORDER BY (ghl_opportunity_id IS NOT NULL) DESC, warmth_display DESC,
             (entity_id IS NOT NULL) DESC, created_at ASC
  ) AS rn
  FROM goods_relationships
)
DELETE FROM goods_relationships g USING ranked r WHERE g.id = r.id AND r.rn > 1;

-- 3. Re-key dedup on the normalized name so future GHL syncs UPSERT (not duplicate).
ALTER TABLE goods_relationships ADD COLUMN dedupe_key text
  GENERATED ALWAYS AS (relationship_type || ':' || lower(btrim(display_name))) STORED;
CREATE UNIQUE INDEX uq_goods_rel_dedupe ON goods_relationships(dedupe_key);

-- 4. Recompute the computed warmth baseline (merge may have added alignment/$/prior).
UPDATE goods_relationships SET warmth_computed =
  goods_compute_warmth(stage, last_touch_at, total_received_aud, alignment_score, has_prior_support, advocacy_score);

-- 5. Refresh warm-intro paths (entity_id moved onto the merged canonical rows).
WITH our AS (
  SELECT id, entity_id, display_name, warmth_display FROM goods_relationships WHERE entity_id IS NOT NULL
),
paths AS (
  SELECT DISTINCT ON (t.id) t.id,
    'via ' || pen_t.person_name_display || ' — also on the board of ' || k.display_name AS path
  FROM our t
  JOIN mv_person_entity_network pen_t ON pen_t.entity_id = t.entity_id
  JOIN mv_person_entity_network pen_k
       ON pen_k.person_name_normalised = pen_t.person_name_normalised AND pen_k.entity_id <> t.entity_id
  JOIN our k ON k.entity_id = pen_k.entity_id AND k.id <> t.id
  ORDER BY t.id, k.warmth_display DESC
)
UPDATE goods_relationships g SET warm_intro_path = paths.path FROM paths WHERE g.id = paths.id;

COMMIT;
