-- justice-money-to-orgs: exempt from measure_kind_contamination, in writing.
--
-- Apply:
--   source .env && PGPASSWORD="$DATABASE_PASSWORD" psql -h aws-0-ap-southeast-2.pooler.supabase.com \
--     -p 5432 -U "postgres.tednluwflfhxyucgwigh" -d postgres \
--     -f supabase/migrations/20260816040000_clarity_justice_money_sentinel_exemption.sql
--
-- The sentinel is permanently tripped by design: 71.81% of the dollars in justice_funding are not
-- money received by an organisation. It blocks every question on the table, including the one
-- written specifically to state the filtered figure. That is the mechanism working, not failing —
-- a sentinel is never silently detached, it is exempted with a reason on the record.

BEGIN;

INSERT INTO clarity_sentinel_exemption (sentinel_key, question_slug, reason)
VALUES (
  'measure_kind_contamination',
  'justice-money-to-orgs',
  'This question IS the filter the sentinel demands. Its answer_sql applies all three row-level '
  || 'exclusions the sentinel exists to enforce — measure_kind = ''grant'', is_aggregate IS NOT '
  || 'TRUE, and a recipient_name that is not a spreadsheet total — and its exclusions field states '
  || 'the $86.58bn of $120.56bn it removes and why. Blocking it would leave the contaminated '
  || 'figure as the only one anybody could quote, which is the exact failure that produced two '
  || 'corrections to CLAUDE.md in two hours on 2026-08-16. '
  || 'SCOPE, stated so this exemption cannot be read as broader than it is: it covers the row '
  || 'classes only. It does NOT cover the fourth trap, which is not a row class — justice_funding '
  || 'holds transport service contracts and rail concessions, so no measure_kind filter scopes it '
  || 'to justice. This question does not claim to be a justice total and its claim_phrasing and '
  || 'forbidden_phrasing both say so. Any question that DOES claim a justice figure must scope by '
  || 'topics and needs its own exemption, not this one.'
) ON CONFLICT (sentinel_key, question_slug) DO UPDATE SET reason = EXCLUDED.reason;

COMMIT;

-- VERIFY:
--   node --env-file=.env scripts/run-clarity-answers.mjs --dry-run
-- Expect justice-money-to-orgs to answer $33.98bn, with the sentinel still TRIPPED (it should
-- never stop being tripped) and the exemption rendered on the card.
