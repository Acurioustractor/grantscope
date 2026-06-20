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
-- HAVING count = 1 guard skips any display_name that resolves to more than one
-- entity. Safe to re-run.

WITH exact_match AS (
  SELECT gr.id AS rel_id, e.id AS entity_id
  FROM goods_relationships gr
  JOIN gs_entities e
    ON lower(btrim(e.canonical_name)) = lower(btrim(gr.display_name))
  WHERE gr.entity_id IS NULL
),
unique_match AS (
  -- keep only display_names that resolved to exactly one entity
  SELECT rel_id, min(entity_id) AS entity_id
  FROM exact_match
  GROUP BY rel_id
  HAVING count(*) = 1
)
UPDATE goods_relationships gr
SET entity_id  = unique_match.entity_id,
    updated_at = now()
FROM unique_match
WHERE gr.id = unique_match.rel_id;
