-- Make the typed keys buried in jsonb filterable, without a table rewrite.
--
-- scripts/jev-jsonb-census.mjs found 220 keys sitting inside jsonb columns that
-- behave like enums: a handful of values, repeated across hundreds of thousands
-- of rows, where nothing can index or filter them. This handles the four that
-- survived exact verification.
--
-- ── Verified on the full tables, not on the census sample ───────────────────
--
-- The census samples 200 rows, and on two of six candidates it was wrong by more
-- than an order of magnitude. Exact counts, 2026-09-21:
--
--   gs_relationships  3,010,624 rows
--     properties->>'role_type'           326,693 rows,  11 distinct   PROMOTE
--     properties->>'procurement_method'  665,686 rows,   7 distinct   PROMOTE
--     properties->>'buyer_name'          669,855 rows, 491 distinct   index, not an enum
--     properties->>'purpose'             193,601 rows,  free text     leave; this is a READ target
--
--   person_roles        339,698 rows
--     properties->>'charity_size'        298,686 rows,   3 distinct   PROMOTE
--     properties->>'original_role'       338,124 rows, 999 distinct   NOT an enum
--
-- `original_role` is the lesson. The census reported 12 distinct values; there
-- are 999. A 200-row sample saw 12 because a dozen roles cover most rows and the
-- tail is long. Cardinality from a sample is a LOWER BOUND and can never prove a
-- field is an enum. It also differs from the normalised `role_type` column on
-- 186,233 rows, so it is raw input, not a missing field: a thing to read, not a
-- thing to constrain.
--
-- ── Why an index and a view, and not a column ───────────────────────────────
--
-- The problem is that these keys cannot be filtered or indexed. A stored
-- generated column would solve that and cost a full rewrite of a 3.0M-row table
-- plus an exclusive lock; a plain column would need a chunked backfill that can
-- silently drift from the jsonb it was copied from.
--
-- An expression index gives the filtering with no rewrite and nothing to drift,
-- because there is only ever one copy of the value. The view gives readable
-- column names on top of it. If app code later wants real columns as a public
-- contract, that is a separate decision with a maintenance window attached.
--
-- Indexes are PARTIAL, on the rows that have the key. role_type is present on
-- 10.9% of the table, so the full-table form would be nine times larger for no
-- benefit.
--
-- Apply: scripts/db-apply.sh supabase/migrations/20260921210000_index_the_keys_buried_in_jsonb.sql
--
-- NOTE: plain CREATE INDEX takes a lock against writes for the duration.
-- CONCURRENTLY cannot run inside the transaction db-apply.sh wraps the file in.
-- These are partial and small; if the lock is a problem, run them by hand with
-- CONCURRENTLY outside a transaction instead.

BEGIN;

-- ── gs_relationships ───────────────────────────────────────────────────────

CREATE INDEX IF NOT EXISTS gs_relationships_props_role_type_idx
  ON public.gs_relationships ((properties ->> 'role_type'))
  WHERE properties ? 'role_type';

CREATE INDEX IF NOT EXISTS gs_relationships_props_procurement_method_idx
  ON public.gs_relationships ((properties ->> 'procurement_method'))
  WHERE properties ? 'procurement_method';

-- 491 distinct buyers over 669,855 rows. Not an enum, but low enough cardinality
-- that an index earns its keep for "everything this buyer bought".
CREATE INDEX IF NOT EXISTS gs_relationships_props_buyer_name_idx
  ON public.gs_relationships ((properties ->> 'buyer_name'))
  WHERE properties ? 'buyer_name';

-- ── person_roles ───────────────────────────────────────────────────────────

CREATE INDEX IF NOT EXISTS person_roles_props_charity_size_idx
  ON public.person_roles ((properties ->> 'charity_size'))
  WHERE properties ? 'charity_size';

-- ── Readable names on top ──────────────────────────────────────────────────
--
-- security_invoker so the view cannot be used to read past the underlying
-- table's RLS, per the shared-project rule.

CREATE OR REPLACE VIEW public.v_gs_relationships_typed
WITH (security_invoker = true) AS
SELECT
  r.id,
  r.source_entity_id,
  r.target_entity_id,
  r.relationship_type,
  r.amount,
  r.year,
  r.dataset,
  r.properties ->> 'role_type'          AS role_type,
  r.properties ->> 'procurement_method' AS procurement_method,
  r.properties ->> 'buyer_name'         AS buyer_name,
  -- Free text, 193,601 rows, averaging 475 characters. Exposed to be READ, not
  -- filtered: there is no index on it and a LIKE over it will scan.
  r.properties ->> 'purpose'            AS purpose
FROM public.gs_relationships r;

COMMENT ON VIEW public.v_gs_relationships_typed IS
  'gs_relationships with the typed keys lifted out of properties. role_type (11 values), procurement_method (7) and buyer_name (491) are indexed; purpose is free text and is not. Values are read through from jsonb, so there is no copy to drift.';

CREATE OR REPLACE VIEW public.v_person_roles_typed
WITH (security_invoker = true) AS
SELECT
  p.id,
  p.person_name,
  p.person_name_normalised,
  p.role_type,
  p.entity_id,
  p.confidence,
  p.properties ->> 'charity_size'  AS charity_size,
  -- 999 distinct raw role titles, differing from the normalised role_type on
  -- 186,233 rows. Kept visible because the disagreement is the interesting part.
  p.properties ->> 'original_role' AS original_role
FROM public.person_roles p;

COMMENT ON VIEW public.v_person_roles_typed IS
  'person_roles with charity_size (3 values, indexed) and original_role lifted out of properties. original_role is raw input with 999 distinct values and disagrees with the normalised role_type on 186,233 rows; it is not an enum.';

COMMIT;
