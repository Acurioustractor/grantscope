-- justice_funding_clean: expose the columns that make filtering possible.
--
-- APPLY WITH:
--   source .env && PGPASSWORD="$DATABASE_PASSWORD" psql \
--     -h aws-0-ap-southeast-2.pooler.supabase.com -p 5432 \
--     -U "postgres.tednluwflfhxyucgwigh" -d postgres \
--     -f supabase/migrations/20260816020000_justice_funding_clean_expose_measure_columns.sql
--
-- WHY
--
-- `justice_funding_clean` is named for a promise it does not keep. Its entire filter is
-- `sector IS DISTINCT FROM 'procurement'`, and it reports $117.47bn across 151,866 rows against an
-- honest $33.98bn across 125,300 — 3.1x, roughly $83bn of money that is not money received by an
-- organisation.
--
-- The deeper problem is that no caller can fix it: the view does not select `measure_kind` or
-- `is_aggregate`, so anything reading it is structurally unable to exclude whole-of-state budget
-- rows even when it knows it should. 47 views read `justice_funding` and 4 reference
-- `measure_kind`; 100 app files reference the table and 2 reference the column. Some of that is
-- callers not knowing. Some of it is callers not being able to.
--
-- Full audit: thoughts/shared/data-map/justice-funding-filter-audit.md
--
-- WHAT THIS CHANGES
--
-- Nothing, today. It only ADDS columns. Every existing consumer selects named columns or `*`;
-- adding two at the end changes no current result, no row count and no total. It is the
-- prerequisite for the fixes, not a fix in itself.
--
-- Deliberately NOT done here: adding the filters to the view. Doing so would silently change every
-- downstream number in one step, including views where the current behaviour is CORRECT — a view
-- answering "total state expenditure on justice" should include the budget rows. Which views are
-- wrong is a per-view judgement, and each should change with its own migration and its own note.

BEGIN;

CREATE OR REPLACE VIEW public.justice_funding_clean AS
SELECT
  id,
  source,
  source_url,
  source_statement_id,
  recipient_name,
  recipient_abn,
  program_name,
  program_round,
  amount_dollars,
  state,
  location,
  funding_type,
  sector,
  project_description,
  announcement_date,
  financial_year,
  alma_intervention_id,
  alma_organization_id,
  created_at,
  updated_at,
  gs_entity_id,
  topics,
  -- Appended, in this order, so CREATE OR REPLACE accepts the change. Reordering or renaming any
  -- column above requires a DROP, which would cascade to the 35 dependent views.
  measure_kind,
  is_aggregate
FROM public.justice_funding
WHERE sector IS DISTINCT FROM 'procurement'::text;

COMMENT ON VIEW public.justice_funding_clean IS
  'justice_funding minus procurement-sector rows. NOT a filtered money view: it includes '
  'expenditure_aggregate whole-of-state budget rows and reports ~$117bn against ~$34bn of money '
  'actually received by organisations. For money received, filter measure_kind = ''grant'' AND '
  'is_aggregate IS NOT TRUE AND a non-aggregate recipient_name, and scope by topics — this table '
  'is not all justice (it holds transport service contracts). '
  'See thoughts/shared/data-map/justice-funding-filter-audit.md';

COMMIT;

-- VERIFY (should return 24 and both new columns present):
--   SELECT count(*) FROM information_schema.columns WHERE table_name = 'justice_funding_clean';
--   SELECT column_name FROM information_schema.columns
--    WHERE table_name = 'justice_funding_clean' AND column_name IN ('measure_kind','is_aggregate');
--
-- VERIFY no number moved (should be 151866 rows / 117.47bn, exactly as before):
--   SELECT count(*), round(sum(amount_dollars)/1e9, 2) FROM justice_funding_clean;
