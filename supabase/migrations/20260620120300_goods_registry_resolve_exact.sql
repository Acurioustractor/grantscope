-- Goods Command Center — resolve name-only registry rows to gs_entities (exact pass).
--
-- 173 of 265 goods_relationships rows had entity_id NULL (name-only), so NONE of
-- the overlays (cross-system power, funding-history, warm-intros) reached them —
-- including high-value funders (QBE, BHP, Rio Tinto, Macquarie, Centrecorp).
--
-- This backfills entity_id for the rows whose display_name is an EXACT
-- normalized match (lower(btrim(...))) to exactly ONE gs_entities.canonical_name
-- — the zero-ambiguity subset (25 rows: 16 funders, 8 buyers, 1 impact_investor;
-- verified 2026-06-20, 0 rows matched more than one entity). Resolving entity_id
-- here lights up all three overlays for these rows at once.
--
-- The remaining ~148 name-only rows have no exact match and need fuzzy matching
-- (e.g. "Snow Foundation" vs "THE SNOW FOUNDATION LIMITED"); that is deferred to
-- a separate, review-gated pass because a wrong entity_id would silently
-- mis-attribute funding/power across every overlay.
--
-- Set-based (hash join, not a per-row correlated subquery — that times out on
-- the shared pooler). Idempotent: only touches entity_id IS NULL rows, and the
-- match_count = 1 window guard skips any display_name that resolves to more than
-- one entity (min()/aggregates don't apply to uuid). Safe to re-run.

WITH matched AS (
  SELECT gr.id AS rel_id,
         e.id  AS entity_id,
         count(*) OVER (PARTITION BY gr.id) AS match_count
  FROM goods_relationships gr
  JOIN gs_entities e
    ON lower(btrim(e.canonical_name)) = lower(btrim(gr.display_name))
  WHERE gr.entity_id IS NULL
)
UPDATE goods_relationships gr
SET entity_id  = matched.entity_id,
    updated_at = now()
FROM matched
WHERE gr.id = matched.rel_id
  AND matched.match_count = 1;  -- only unambiguous (single-entity) display names
