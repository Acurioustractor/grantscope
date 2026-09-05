-- Register the honest justice_funding total, and a sentinel so it cannot regress a third time.
--
-- Apply:
--   source .env && PGPASSWORD="$DATABASE_PASSWORD" psql -h aws-0-ap-southeast-2.pooler.supabase.com \
--     -p 5432 -U "postgres.tednluwflfhxyucgwigh" -d postgres \
--     -f supabase/migrations/20260816030000_clarity_register_justice_money_to_orgs.sql
--
-- WHY THIS EXISTS
--
-- On 2026-08-16 the same figure was corrected twice in two hours:
--
--   CLAUDE.md, as written           measure_kind='grant'                    $46.10bn
--   first correction                ...minus aggregate-shaped names         $38.01bn
--   second correction               ...and is_aggregate IS NOT TRUE         $33.98bn
--
-- Both errors were caught by hand, both by accident, and either could have shipped. A registered
-- question with a sentinel is the mechanism this project already built for exactly that, and it
-- had never been pointed at its own most-quoted number.
--
-- 71.81% of the dollars in justice_funding — $86.58bn of $120.56bn — are not money received by an
-- organisation for justice work. Full audit:
--   thoughts/shared/data-map/justice-funding-filter-audit.md

BEGIN;

-- ---------------------------------------------------------------------------
-- The sentinel — permanently tripped, and that is the design
-- ---------------------------------------------------------------------------
-- Modelled on receipt_type_contamination, which does the same job for political_donations. It is
-- not an alarm that fires when something breaks; it is a standing condition of the table. Any
-- question touching justice_funding must either apply the filters or write a clarity_sentinel
-- exemption explaining why not. Silence is not an option the schema allows.
INSERT INTO clarity_sentinel (key, label, description, probe_sql, severity, guards_objects)
VALUES (
  'measure_kind_contamination',
  'justice_funding is not all money to organisations',
  'Three independent classes of row in justice_funding are not money received by an organisation '
  || 'for justice work, and none of them is excluded by the others: 848 expenditure_aggregate '
  || 'whole-of-state budget rows; 1,900 rows flagged is_aggregate (1,358 of which are ALSO '
  || 'measure_kind=''grant''); and 46 rows whose recipient is a source-spreadsheet total named '
  || '"Total", "Various" or "n/a". A fourth trap is not a row class at all: the table holds '
  || 'transport service contracts and rail concessions, so measure_kind alone never scopes it to '
  || 'justice — topic filtering does. Raise this to warn only when a filtered view exists that '
  || 'callers can safely default to.',
  $probe$
  SELECT (1 - sum(amount_dollars) FILTER (
            WHERE measure_kind = 'grant'
              AND is_aggregate IS NOT TRUE
              AND lower(trim(recipient_name)) NOT IN
                  ('total','totals','grand total','subtotal','sub-total',
                   'various','n/a','na','unknown','tbc','other'))
          / nullif(sum(amount_dollars), 0)) > 0.5 AS tripped,
         count(*) FILTER (WHERE measure_kind <> 'grant' OR is_aggregate) AS n,
         round((1 - sum(amount_dollars) FILTER (
            WHERE measure_kind = 'grant'
              AND is_aggregate IS NOT TRUE
              AND lower(trim(recipient_name)) NOT IN
                  ('total','totals','grand total','subtotal','sub-total',
                   'various','n/a','na','unknown','tbc','other'))
          / nullif(sum(amount_dollars), 0))::numeric, 4) AS share,
         jsonb_build_object(
           'note', 'filter measure_kind = ''grant'' AND is_aggregate IS NOT TRUE AND a '
                || 'non-aggregate recipient_name, and scope by topics — this table is not all justice',
           'audit', 'thoughts/shared/data-map/justice-funding-filter-audit.md') AS detail
    FROM justice_funding
  $probe$,
  'block',
  ARRAY['public.justice_funding']
) ON CONFLICT (key) DO UPDATE
  SET description = EXCLUDED.description,
      probe_sql = EXCLUDED.probe_sql,
      guards_objects = EXCLUDED.guards_objects;

-- ---------------------------------------------------------------------------
-- The question
-- ---------------------------------------------------------------------------
INSERT INTO clarity_question (
  slug, stub, question, subject, state, form, honest_at, publishable,
  defamation_sensitive, caveat, exclusions, claim_phrasing, forbidden_phrasing,
  answer_sql, coverage_sql, live_rerun_ok, uniqueness, uniqueness_basis, surface
) VALUES (
  'justice-money-to-orgs',
  'MONEY THAT REACHED ORGANISATIONS',
  'How much of the justice-related funding we hold actually reached an organisation, rather than '
  || 'being a budget line or a spreadsheet total?',
  'MONEY', 'answered', 'scalar', 'national', 'public',
  false,
  'This is a floor and it is a record of what was PUBLISHED, not of what was spent. It counts '
  || 'rows in justice_funding that are grants, are not flagged as aggregates, and name a real '
  || 'recipient. It excludes whole-of-state budget lines, because a budget is not money to any '
  || 'organisation. It does not scope to justice by topic, so it is the honest ceiling for '
  || '"money to organisations in this table", not a justice total — the table also holds '
  || 'transport service contracts.',
  'Excluded and why: 848 expenditure_aggregate rows (whole-of-state budgets); 1,900 rows flagged '
  || 'is_aggregate, of which 1,358 are also labelled grants; 46 rows whose recipient is a '
  || 'spreadsheet total named "Total", "Various" or "n/a". Together $86.58bn of $120.56bn.',
  'CivicGraph holds $33.98bn of published grants to named organisations in its justice funding '
  || 'records. That is what was published and recorded, not what governments spent.',
  ARRAY[
    'Australia spends $34bn on justice',
    'governments spent $33.98bn',
    'total justice funding is $33.98bn',
    '$46.1bn in justice grants'
  ],
  $answer$
  WITH f AS (
    SELECT amount_dollars, recipient_name
      FROM justice_funding
     WHERE measure_kind = 'grant'
       AND is_aggregate IS NOT TRUE
       AND lower(trim(recipient_name)) NOT IN
           ('total','totals','grand total','subtotal','sub-total',
            'various','n/a','na','unknown','tbc','other')
  )
  SELECT '$' || round((sum(amount_dollars) / 1e9)::numeric, 2)::text || 'bn' AS headline,
         count(*)::text || ' grants to '
           || count(DISTINCT recipient_name)::text
           || ' named organisations, after excluding budget lines and spreadsheet totals'
           AS headline_sub,
         round((sum(amount_dollars) / 1e9)::numeric, 2) AS headline_num
    FROM f
  $answer$,
  $coverage$
  SELECT round(sum(amount_dollars) FILTER (
            WHERE measure_kind = 'grant'
              AND is_aggregate IS NOT TRUE
              AND lower(trim(recipient_name)) NOT IN
                  ('total','totals','grand total','subtotal','sub-total',
                   'various','n/a','na','unknown','tbc','other'))
          / nullif(sum(amount_dollars), 0), 4) AS coverage
    FROM justice_funding
  $coverage$,
  true,
  0.95,
  'Nothing else in either repo states this number with its exclusions attached. Every other '
  || 'surface reading justice_funding states a larger one, usually without knowing it.',
  '/clarity/q/justice-money-to-orgs'
) ON CONFLICT (slug) DO UPDATE
  SET caveat = EXCLUDED.caveat,
      exclusions = EXCLUDED.exclusions,
      claim_phrasing = EXCLUDED.claim_phrasing,
      forbidden_phrasing = EXCLUDED.forbidden_phrasing,
      answer_sql = EXCLUDED.answer_sql,
      coverage_sql = EXCLUDED.coverage_sql;

-- The `public.` prefix is mandatory here and CHECK-constrained: this column is compared against
-- clarity_sentinel.guards_objects. An unprefixed row detaches the sentinel and the answer runs
-- green with a block sentinel silently tripped.
INSERT INTO clarity_question_ingredient (question_slug, object_key, join_key, role, is_binding)
VALUES ('justice-money-to-orgs', 'public.justice_funding', 'id', 'spine', true)
ON CONFLICT DO NOTHING;

COMMIT;

-- VERIFY:
--   SELECT tripped, share FROM ... (run the sentinel probe) -- expect tripped = true, share ~0.7181
--   SELECT slug, state FROM clarity_question WHERE slug = 'justice-money-to-orgs';
--   SELECT * FROM clarity_question_ingredient WHERE question_slug = 'justice-money-to-orgs';
-- Then run the answer:
--   node --env-file=.env scripts/run-clarity-answers.mjs --dry-run
-- Expect headline $33.98bn and the sentinel to BLOCK until an exemption is written — that is the
-- correct outcome, not a failure. The question's own filters satisfy the sentinel's intent, and
-- the exemption should say exactly that.
