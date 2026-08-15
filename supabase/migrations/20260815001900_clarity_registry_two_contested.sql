-- /clarity slice 7 (part 2) — two contested questions whose defects were re-measured today
--
-- Apply:
--   source .env && PGPASSWORD="$DATABASE_PASSWORD" psql -h aws-0-ap-southeast-2.pooler.supabase.com \
--     -p 5432 -U "postgres.tednluwflfhxyucgwigh" -d postgres \
--     -f supabase/migrations/20260815001900_clarity_registry_two_contested.sql
--
-- CONTESTED means: answerable, and a named defect must be fixed before the number may be quoted.
-- The card renders the defect, not a clean figure with a footnote. Both defects below were
-- re-measured against the live database on 2026-08-15 and both reproduce exactly.

BEGIN;

-- ---------------------------------------------------------------------------
-- YOUTH JUSTICE MONEY — measure_kind mixing inflates the topic total 45.3×
-- ---------------------------------------------------------------------------
-- Measured today over topics @> ARRAY['youth-justice']:
--   expenditure_aggregate   848 rows   $66.126bn   ← whole-of-state budgets, not money to anyone
--   budget_announcement      57 rows    $1.583bn
--   grant                 4,111 rows    $1.534bn   ← the only kind that is money to an organisation
--   contract_value          564 rows    $0.195bn
-- Summed blind: $69.44bn. The honest figure is $1.534bn, and the ratio is 45.3×.
INSERT INTO clarity_question (
  slug, stub, question, subject, state, form, honest_at, publishable,
  verification_stamp, caveat, exclusions, claim_phrasing, forbidden_phrasing,
  answer_sql, coverage_sql, uniqueness, uniqueness_basis, surface
) VALUES (
  'youth-justice-total', 'YOUTH JUSTICE MONEY',
  'How much money is recorded against youth justice, and to whom?',
  'JUSTICE', 'contested', 'stacked_three', 'entity', 'internal',
  'verified',
  'measure_kind is a required facet on this question, never a default. Four incompatible measures '
  || 'share one amount column: whole-of-state expenditure aggregates, budget announcements, grants '
  || 'to organisations, and contract values. Summing them is not slightly wrong, it is wrong by '
  || '45.3× and the error runs in the direction that flatters the total.',
  'Nothing is excluded. Every measure_kind is shown, separately, because the exclusion IS the '
  || 'answer here.',
  'CivicGraph records $1.53bn in youth justice grants to organisations. A larger figure circulating '
  || 'from this database is almost certainly whole-of-state expenditure aggregates counted as grants.',
  ARRAY['$69bn goes to youth justice', 'total youth justice funding'],
  $q$
  WITH k AS (
    SELECT measure_kind, count(*) AS rows, sum(amount_dollars) AS dollars
      FROM justice_funding
     WHERE topics @> ARRAY['youth-justice']
     GROUP BY 1
  ),
  g AS (SELECT dollars, rows FROM k WHERE measure_kind = 'grant'),
  t AS (SELECT sum(dollars) AS all_dollars FROM k)
  SELECT jsonb_build_object(
           'kinds', (SELECT jsonb_agg(jsonb_build_object('measure_kind', measure_kind,
                              'rows', rows, 'dollars', dollars) ORDER BY dollars DESC) FROM k),
           'grant_dollars', (SELECT dollars FROM g),
           'all_dollars', (SELECT all_dollars FROM t),
           'inflation_factor', round((SELECT all_dollars FROM t) / nullif((SELECT dollars FROM g), 0), 1)
         ) AS payload,
         '$' || round((SELECT dollars FROM g) / 1e9, 3)::text || 'bn' AS headline,
         'grants only · summing every measure_kind would report $'
           || round((SELECT all_dollars FROM t) / 1e9, 2)::text || 'bn, which is '
           || round((SELECT all_dollars FROM t) / nullif((SELECT dollars FROM g), 0), 1)::text
           || '× too high' AS headline_sub,
         round((SELECT dollars FROM g) / 1e9, 3) AS headline_num
  $q$,
  $q$
  SELECT count(*) FILTER (WHERE measure_kind = 'grant')::numeric AS numerator,
         count(*)::numeric AS denominator,
         'youth-justice rows that are grants to an organisation' AS label
    FROM justice_funding WHERE topics @> ARRAY['youth-justice']
  $q$,
  0.97,
  'Every other surface that totals justice_funding does so without the measure_kind facet, which '
  || 'is precisely how the 45.3× error travels.',
  '/clarity/q/youth-justice-total'
) ON CONFLICT (slug) DO NOTHING;

INSERT INTO clarity_question_ingredient (question_slug, object_key, join_key, role, is_binding)
VALUES ('youth-justice-total', 'public.justice_funding', 'measure_kind', 'fact', true)
ON CONFLICT DO NOTHING;

-- ---------------------------------------------------------------------------
-- WHAT HAS THIS ORG RECEIVED — the rollup's grant lane is empty in every row
-- ---------------------------------------------------------------------------
-- Measured today: mv_entity_total_funding holds 94,088 rows and grants_total is exactly zero in
-- all 94,088. Not sparse, not mostly-zero — zero, everywhere. Any org total read from this MV
-- understates by the whole grant lane and looks like a real number while doing it.
INSERT INTO clarity_question (
  slug, stub, question, subject, state, form, honest_at, publishable,
  verification_stamp, caveat, exclusions, claim_phrasing, forbidden_phrasing,
  answer_sql, coverage_sql, uniqueness, uniqueness_basis, surface
) VALUES (
  'org-total-funding', 'WHAT HAS THIS ORG RECEIVED',
  'What has one organisation received, across every source this database holds?',
  'MONEY', 'contested', 'stacked_three', 'abn', 'internal',
  'verified',
  'mv_entity_total_funding.grants_total is exactly 0 across all 94,088 rows, so any per-org total '
  || 'read from it silently omits grants entirely. Until the matview is rebuilt this question '
  || 'shows contracts and justice funding only, and says so on the card rather than in a footnote.',
  'Grants are excluded because the column that should carry them carries nothing. This is a '
  || 'defect being reported, not a scope decision.',
  'Organisation totals in CivicGraph currently cover contracts and justice funding. The grant lane '
  || 'of the rollup matview is empty and is not included.',
  ARRAY['total funding received', 'all money this org has received'],
  $q$
  WITH m AS (
    SELECT count(*) AS rows,
           count(*) FILTER (WHERE grants_total <> 0) AS with_grants,
           sum(contracts_total) AS contracts, sum(justice_total) AS justice
      FROM mv_entity_total_funding
  )
  SELECT jsonb_build_object(
           'rows', rows, 'rows_with_grants', with_grants,
           'contracts_total', contracts, 'justice_total', justice
         ) AS payload,
         with_grants::text || ' of ' || rows::text AS headline,
         'rows in the org rollup carry any grant total — the grant lane of this matview is empty'
           AS headline_sub,
         with_grants AS headline_num
    FROM m
  $q$,
  $q$
  SELECT count(*) FILTER (WHERE grants_total <> 0)::numeric AS numerator,
         count(*)::numeric AS denominator,
         'rollup rows carrying a grant total' AS label
    FROM mv_entity_total_funding
  $q$,
  0.9,
  '/entity/[gsId] and several report pages read this matview and present its totals as complete.',
  '/clarity/q/org-total-funding'
) ON CONFLICT (slug) DO NOTHING;

INSERT INTO clarity_question_ingredient (question_slug, object_key, join_key, role, is_binding)
VALUES ('org-total-funding', 'public.mv_entity_total_funding', 'entity_id', 'spine', true)
ON CONFLICT DO NOTHING;

COMMIT;
