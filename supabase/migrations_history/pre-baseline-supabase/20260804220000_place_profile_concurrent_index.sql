-- Let the place profile refresh without blocking readers.
--
-- The unique index used coalesce(state, ''), and REFRESH MATERIALIZED VIEW
-- CONCURRENTLY requires a unique index built from plain columns with no WHERE
-- clause, so every refresh took an exclusive lock and the page went dark while
-- it ran.
--
-- 433 of 1,169 rows have a null state, and a plain unique index treats nulls as
-- distinct — which would let the same council appear twice. NULLS NOT DISTINCT
-- keeps one row per council while staying a plain-column index.

DROP INDEX IF EXISTS public.mv_lga_place_profile_key_idx;

CREATE UNIQUE INDEX mv_lga_place_profile_key_idx
  ON public.mv_lga_place_profile (lga_name, state) NULLS NOT DISTINCT;
