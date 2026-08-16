-- Add is_aggregate to the three money questions the new sentinel caught, and exempt the fourth.
--
-- Apply:
--   source .env && PGPASSWORD="$DATABASE_PASSWORD" psql -h aws-0-ap-southeast-2.pooler.supabase.com \
--     -p 5432 -U "postgres.tednluwflfhxyucgwigh" -d postgres \
--     -f supabase/migrations/20260816050000_clarity_add_is_aggregate_to_three_questions.sql
--
-- Within minutes of measure_kind_contamination being applied, it blocked four registered
-- questions. Three were missing a filter that nobody knew about until 2026-08-16:
--
--   youth-justice-total     measure_kind YES  topics YES  is_aggregate NO   $1,534.2m -> $915.7m
--   evidence-gap            measure_kind YES  topics YES  is_aggregate NO   778 -> 777 orgs
--   every-dollar-one-abn    measure_kind YES  topics NO   is_aggregate NO   no change
--   grant-behind-this-edge  not a money question at all                     exempt
--
-- youth-justice-total was overstated by 40%. 21 rows carry $618.5m, and they are the
-- qld-historical-grants column totals — the same rows that rank as the #1 and #2 recipients of
-- youth justice funding in Australia if you do not exclude them.
--
-- Audit: thoughts/shared/data-map/justice-funding-filter-audit.md

BEGIN;

-- ---------------------------------------------------------------------------
-- youth-justice-total — the 40% correction
-- ---------------------------------------------------------------------------
-- This question exists to teach the measure_kind trap: its headline_sub reports how much too high
-- the naive sum would be. It now teaches BOTH traps, because the second one lives inside the
-- answer to the first — 21 rows that pass `measure_kind = 'grant'` and are still aggregates.
UPDATE clarity_question SET
  answer_sql = $answer$
  WITH k AS (
    SELECT measure_kind, count(*) AS rows, sum(amount_dollars) AS dollars
      FROM justice_funding
     WHERE topics @> ARRAY['youth-justice']
     GROUP BY 1
  ),
  gk AS (
    SELECT sum(amount_dollars) AS dollars
      FROM justice_funding
     WHERE topics @> ARRAY['youth-justice'] AND measure_kind = 'grant'
  ),
  g AS (
    SELECT sum(amount_dollars) AS dollars, count(*) AS rows
      FROM justice_funding
     WHERE topics @> ARRAY['youth-justice']
       AND measure_kind = 'grant'
       AND is_aggregate IS NOT TRUE
       AND lower(trim(recipient_name)) NOT IN
           ('total','totals','grand total','subtotal','sub-total',
            'various','n/a','na','unknown','tbc','other')
  ),
  t AS (SELECT sum(dollars) AS all_dollars FROM k)
  SELECT jsonb_build_object(
           'kinds', (SELECT jsonb_agg(jsonb_build_object('measure_kind', measure_kind,
                              'rows', rows, 'dollars', dollars) ORDER BY dollars DESC) FROM k),
           'grant_dollars_unfiltered', (SELECT dollars FROM gk),
           'grant_dollars', (SELECT dollars FROM g),
           'aggregate_dollars_inside_grants',
             (SELECT dollars FROM gk) - (SELECT dollars FROM g),
           'all_dollars', (SELECT all_dollars FROM t),
           'inflation_factor', round((SELECT all_dollars FROM t) / nullif((SELECT dollars FROM g), 0), 1)
         ) AS payload,
         '$' || round((SELECT dollars FROM g) / 1e9, 3)::text || 'bn' AS headline,
         'grants to named organisations · summing every measure_kind would report $'
           || round((SELECT all_dollars FROM t) / 1e9, 2)::text || 'bn ('
           || round((SELECT all_dollars FROM t) / nullif((SELECT dollars FROM g), 0), 1)::text
           || '× too high), and a further $'
           || round(((SELECT dollars FROM gk) - (SELECT dollars FROM g)) / 1e6, 1)::text
           || 'm of aggregates sits inside ''grant'' itself' AS headline_sub,
         round((SELECT dollars FROM g) / 1e9, 3) AS headline_num
  $answer$,
  caveat = 'Grants to named organisations, tagged youth-justice. Three exclusions, and the second '
    || 'and third are not implied by the first: rows that are not measure_kind = ''grant''; rows '
    || 'flagged is_aggregate even when labelled a grant; and rows whose recipient is a source '
    || 'spreadsheet total. This is what was published and recorded, not what was spent.',
  exclusions = 'Excluded: every measure_kind except grant; 21 rows flagged is_aggregate carrying '
    || '$618.5m, which are qld-historical-grants column totals; and rows whose recipient is named '
    || '"Total", "Various" or "n/a". Before 2026-08-16 this question published $1,534.2m by '
    || 'excluding only the first of those — a 40% overstatement.'
WHERE slug = 'youth-justice-total';

-- ---------------------------------------------------------------------------
-- evidence-gap — one organisation, but the same defect
-- ---------------------------------------------------------------------------
-- 778 organisations become 777. Trivial in size and not trivial in kind: the entity that drops out
-- is one whose only youth-justice "funding" was an aggregate row.
UPDATE clarity_question SET
  answer_sql = replace(
    answer_sql,
    'WHERE measure_kind = ''grant''
       AND gs_entity_id IS NOT NULL',
    'WHERE measure_kind = ''grant''
       AND is_aggregate IS NOT TRUE
       AND gs_entity_id IS NOT NULL')
WHERE slug = 'evidence-gap';

-- ---------------------------------------------------------------------------
-- every-dollar-one-abn — no change to the number, and the filter goes in anyway
-- ---------------------------------------------------------------------------
-- ABN 15101252171 has zero aggregate rows, so this is pure hygiene. It goes in because the next
-- person to copy this worked example should copy the correct predicate, and because a question
-- that satisfies a sentinel by luck rather than by filter is one ingest away from not.
UPDATE clarity_question SET
  answer_sql = replace(
    answer_sql,
    'FROM justice_funding WHERE recipient_abn = ''15101252171'' AND measure_kind = ''grant''',
    'FROM justice_funding WHERE recipient_abn = ''15101252171'' AND measure_kind = ''grant'' AND is_aggregate IS NOT TRUE')
WHERE slug = 'every-dollar-one-abn';

-- ---------------------------------------------------------------------------
-- Exemptions
-- ---------------------------------------------------------------------------
INSERT INTO clarity_sentinel_exemption (sentinel_key, question_slug, reason) VALUES
(
  'measure_kind_contamination', 'youth-justice-total',
  'Applies all three row-level exclusions the sentinel enforces, and its entire purpose is to '
  || 'show the reader how large the contamination is — the headline_sub reports both the '
  || 'measure_kind inflation factor and the $618.5m of aggregates sitting inside ''grant''. '
  || 'Scoped to justice by topics, so the transport-contract trap does not apply either.'
),
(
  'measure_kind_contamination', 'evidence-gap',
  'Counts organisations, not dollars, but reads justice_funding to decide which organisations are '
  || 'funded — so an aggregate row could admit an entity that never received a grant. Now filters '
  || 'measure_kind, is_aggregate and topics. One organisation of 778 drops out as a result.'
),
(
  'measure_kind_contamination', 'every-dollar-one-abn',
  'A single-ABN worked example that applies measure_kind and is_aggregate. ABN 15101252171 has no '
  || 'aggregate rows today, so the filter changes nothing — it is there so the predicate is right '
  || 'when the data changes, rather than correct by coincidence.'
),
(
  'measure_kind_contamination', 'grant-behind-this-edge',
  'Not a money question. It counts whether a source key resolves to a row, not how much money '
  || 'moved or to whom, and it sums no dollars at all. Aggregate rows resolve or fail to resolve '
  || 'exactly like any other row, so excluding them would change what is being measured rather '
  || 'than make it more honest. Same grounds as this question''s existing two exemptions.'
)
ON CONFLICT (sentinel_key, question_slug) DO UPDATE SET reason = EXCLUDED.reason;

COMMIT;

-- VERIFY:
--   node --env-file=.env scripts/run-clarity-answers.mjs --dry-run
-- Expect 17/19 ok (donor-contractor and commonwealth-spend were blocked before this work and are
-- unrelated), youth-justice-total at $0.916bn, evidence-gap at 777 organisations.
