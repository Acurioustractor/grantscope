-- /clarity slice 7 (part 1) — FILL THE REGISTRY: the blocked questions, and one that was not
--
-- Apply:
--   source .env && PGPASSWORD="$DATABASE_PASSWORD" psql -h aws-0-ap-southeast-2.pooler.supabase.com \
--     -p 5432 -U "postgres.tednluwflfhxyucgwigh" -d postgres \
--     -f supabase/migrations/20260815001800_clarity_registry_blocked_seven.sql
--
-- THE FINDING THAT CHANGED THIS MIGRATION.
--
-- The spec registers `grant-behind-this-edge` as blocked, on research finding V38: "
-- gs_relationships.source_record_id is a dead key namespace — 100% orphaned on a 200,000-row
-- anti-join". That figure has been repeated in four slices, on the seams screen, in the want
-- list's fix_note and in this spec's own §7.3 refusal to build a record-level provenance drill.
--
-- It is wrong today. Measured 2026-08-15 over the full population:
--
--     144,901 of 144,901 justice_funding edges resolve to their funding record  =  100.0%
--
-- The 0% comes from joining EVERY dataset's source_record_id against justice_funding. aec_donations
-- keys point at aec rows, austender keys at austender rows; testing them against justice_funding
-- returns zero, correctly, for the wrong question. The gap metric `justice_edge_drillthrough`
-- carries that bug in its own SQL, which is why it has never produced a measurement anybody
-- questioned. Both are fixed below.
--
-- The real defect in the same neighbourhood is different and worth naming: 761,801 edges —
-- person_roles, acnc_register, foundation_board and 40-odd small grantee datasets — carry no
-- source key at all. Drill-through is not broken there, it was never built.

BEGIN;

-- ---------------------------------------------------------------------------
-- 1. A sentinel may be exempted from a question, in writing
-- ---------------------------------------------------------------------------
-- `duplicate_canonical_name` and `category_node_hub` both guard gs_relationships, so every
-- question that reads the graph inherits a block. For a question that counts whether a KEY
-- resolves, a name-collision defect is real and irrelevant — and a guard that refuses every
-- question is a guard somebody switches off. The exemption is per-question, requires a written
-- reason, and renders on the card. Silence is not an option the schema offers.
CREATE TABLE IF NOT EXISTS clarity_sentinel_exemption (
  sentinel_key  text NOT NULL REFERENCES clarity_sentinel(key) ON DELETE CASCADE,
  question_slug text NOT NULL REFERENCES clarity_question(slug) ON DELETE CASCADE,
  reason        text NOT NULL CHECK (length(btrim(reason)) > 30),
  created_at    timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (sentinel_key, question_slug)
);

COMMENT ON TABLE clarity_sentinel_exemption IS
  'Per-question sentinel exemptions. The reason is mandatory and is rendered on the answer card: '
  'an exemption nobody can read is indistinguishable from a guard that was quietly disabled.';

-- ---------------------------------------------------------------------------
-- 2. Fix the drill-through metric, which was measuring the wrong population
-- ---------------------------------------------------------------------------
UPDATE clarity_gap_metric SET
  title = 'Justice graph edges that resolve to a funding record',
  numerator_sql = $s$
    SELECT count(j.id) FROM (
      SELECT source_record_id::uuid AS rid FROM gs_relationships
       WHERE dataset = 'justice_funding' AND source_record_id ~ '^[0-9a-f]{8}-'
    ) s LEFT JOIN justice_funding j ON j.id = s.rid
  $s$,
  denominator_sql = $s$
    SELECT count(*) FROM gs_relationships
     WHERE dataset = 'justice_funding' AND source_record_id ~ '^[0-9a-f]{8}-'
  $s$,
  fix_effort = NULL,
  fix_note = NULL,
  note = 'Scoped to dataset = ''justice_funding''. The previous SQL tested every dataset''s '
      || 'source_record_id against justice_funding and reported 0%, which is true of aec_donations '
      || 'keys and meaningless as a measure of drill-through. Corrected 2026-08-15.'
WHERE metric_key = 'justice_edge_drillthrough';

-- The unscoped-edge problem is real, and it is a different metric. Registered rather than folded
-- into the one above, because 761,801 edges with no key at all is not a low match rate.
INSERT INTO clarity_gap_metric (
  metric_key, title, family, question, numerator_sql, denominator_sql,
  unit, direction, target, cost_class, enabled, note, fix_effort, fix_note
) VALUES (
  'edges_without_source_key',
  'Graph edges carrying no source record key at all',
  'join_integrity',
  'What share of the graph can never be drilled back to the record that made it?',
  $s$SELECT count(*) FROM gs_relationships WHERE source_record_id IS NULL$s$,
  $s$SELECT count(*) FROM gs_relationships$s$,
  'pct', 'lower_better', 10, 'medium', true,
  'person_roles, acnc_register, foundation_board and ~40 small grantee datasets build edges with '
  || 'no key back to their source row. Not a broken join — a drill-through nobody built.',
  'M',
  'Each builder has to carry its source row id through. Bounded per dataset, and the three '
  || 'largest cover 92% of the affected edges.'
) ON CONFLICT (metric_key) DO NOTHING;

-- ---------------------------------------------------------------------------
-- 3. THE ANSWER THAT WAS FILED AS A WANT — `grant-behind-this-edge`
-- ---------------------------------------------------------------------------
INSERT INTO clarity_question (
  slug, stub, question, subject, state, form, honest_at, publishable,
  verification_stamp, caveat, exclusions, claim_phrasing, forbidden_phrasing,
  answer_sql, coverage_sql, uniqueness, uniqueness_basis, surface
) VALUES (
  'grant-behind-this-edge',
  'THE RECEIPT',
  'Can you click a funding edge in the graph and see the grant record behind it?',
  'MONEY',
  'answered', 'scalar', 'entity', 'internal',
  'verified',
  'True of justice_funding edges only. 761,801 edges — person_roles, acnc_register, '
  || 'foundation_board and about forty small grantee datasets — carry no source key at all, so '
  || 'the drill-through does not fail there, it was never built.',
  'Edges whose source_record_id is not uuid-shaped are excluded from the denominator rather than '
  || 'counted as failures; they belong to datasets keyed some other way.',
  'Every justice funding edge in CivicGraph resolves to the funding record that created it '
  || '(144,901 of 144,901, measured 2026-08-15).',
  ARRAY['the graph has no provenance', 'source_record_id is dead'],
  $q$
  WITH e AS (
    SELECT source_record_id::uuid AS rid FROM gs_relationships
     WHERE dataset = 'justice_funding' AND source_record_id ~ '^[0-9a-f]{8}-'
  ),
  r AS (SELECT count(*) AS den, count(j.id) AS num FROM e LEFT JOIN justice_funding j ON j.id = e.rid),
  ds AS (SELECT dataset, count(*) AS edges, count(source_record_id) AS with_key
           FROM gs_relationships GROUP BY 1)
  SELECT jsonb_build_object(
           'resolved', r.num, 'edges', r.den,
           'datasets', (SELECT jsonb_agg(jsonb_build_object('dataset', dataset, 'edges', edges,
                                'with_key', with_key) ORDER BY edges DESC) FROM ds),
           'edges_without_any_key', (SELECT sum(edges - with_key) FROM ds)
         ) AS payload,
         round(100.0 * r.num / nullif(r.den, 0), 1)::text || '%' AS headline,
         r.num::text || ' of ' || r.den::text || ' justice edges resolve to their funding record'
           AS headline_sub,
         round(100.0 * r.num / nullif(r.den, 0), 1) AS headline_num
    FROM r
  $q$,
  $q$
  SELECT count(source_record_id)::numeric AS numerator, count(*)::numeric AS denominator,
         'graph edges carrying any source record key' AS label
    FROM gs_relationships
  $q$,
  0.95,
  'No other surface in either repo measures whether the graph can be walked back to its sources.',
  '/clarity/q/grant-behind-this-edge'
) ON CONFLICT (slug) DO NOTHING;

INSERT INTO clarity_question_ingredient (question_slug, object_key, join_key, role, is_binding)
VALUES
  -- The `public.` prefix is mandatory: clarity_sentinel.guards_objects is compared against THIS
  -- column, and an unprefixed key silently detaches every sentinel from the question. My first
  -- version of this insert did exactly that and the answer ran green with two block sentinels
  -- tripped and unnoticed.
  ('grant-behind-this-edge', 'public.gs_relationships', 'source_record_id', 'fact',      true),
  ('grant-behind-this-edge', 'public.justice_funding',  'id',               'reference', false)
ON CONFLICT DO NOTHING;

INSERT INTO clarity_sentinel_exemption (sentinel_key, question_slug, reason) VALUES
  ('duplicate_canonical_name', 'grant-behind-this-edge',
   'This question counts whether a key resolves, not who the endpoints are. 9,607 duplicate '
   || 'canonical names corrupt centrality and merge nothing about source_record_id.'),
  ('category_node_hub', 'grant-behind-this-edge',
   'Two category nodes carrying 17.6% of edges skews degree, not key resolution. Every edge is '
   || 'counted once here regardless of which node it hangs off.')
ON CONFLICT DO NOTHING;

-- ---------------------------------------------------------------------------
-- 4. THE SIX THAT ARE GENUINELY BLOCKED
-- ---------------------------------------------------------------------------
-- Every blocking defect below was re-measured against the live database on 2026-08-15 rather than
-- carried from the spec. Two numbers moved: mv_board_contractor_links is 5 rows, not 4, and
-- mv_board_donor_links is 3, not 2.

INSERT INTO clarity_question (
  slug, stub, question, subject, state, form, honest_at, publishable,
  caveat, exclusions, claim_phrasing, blocked_by, blocked_by_metric,
  unlock_effort, unlock_note, licence_note, uniqueness, uniqueness_basis, surface
) VALUES

('indigenous-over-rep', 'OVER-REPRESENTATION',
 'How over-represented are Aboriginal and Torres Strait Islander young people in this place, against the population that lives there?',
 'JUSTICE', 'unanswerable', 'scalar', 'lga', 'internal',
 'Every per-capita Indigenous rate below state level depends on a denominator this database does '
 || 'not hold. Without it, a rate can be computed and every one of them would be wrong.',
 '',
 '',
 ARRAY['abs_indigenous_population_by_lga'], NULL,
 'S',
 'abs_indigenous_population_by_lga exists and holds 0 rows. One ABS download, CC-BY-4.0, no '
 || 'licence negotiation and no scraping.',
 'CC-BY-4.0 · ABS Census, freely redistributable',
 0.9,
 'The rate is computable in several places once the denominator exists; the point is that nowhere '
 || 'in either repo is it currently computed honestly.',
 '/clarity/wants'),

('board-to-contractor', 'DIRECTORS AND CONTRACTS',
 'Which organisations share a director with a company that holds a government contract?',
 'POWER', 'unanswerable', 'ranked_bar', 'person_block', 'internal',
 'The interlock substrate is real — mv_board_interlocks holds 39,757 people across multiple '
 || 'boards. What is missing is the join from those people to contract holders, and the three '
 || 'matviews that were built to carry it are empty in all but a handful of rows.',
 '',
 '',
 ARRAY['mv_board_contractor_links', 'mv_board_donor_links'], NULL,
 'S',
 'mv_board_contractor_links holds 5 rows and mv_board_donor_links 3, against mv_board_interlocks '
 || 'at 39,757 with the same person columns. That shape is a predicate bug in the matview '
 || 'definitions, not an absence of data. Re-measured 2026-08-15; the spec said 4 and 2.',
 NULL,
 0.95,
 'Two flagship cross-sections on /clarity/cross depend on these and currently render nothing.',
 '/clarity/wants'),

('national-crime-map', 'CRIME, NATIONALLY',
 'How does recorded crime by local government area compare with where the money goes, across the country?',
 'JUSTICE', 'unanswerable', 'matrix', 'lga', 'internal',
 'crime_stats_lga holds 58,125 rows and reads as a national dataset. It is not: NSW alone is '
 || '51,480 of them, and Western Australia and Tasmania have zero. A national map drawn from this '
 || 'would silently invent two states and drown five others.',
 '',
 '',
 ARRAY['crime_stats_lga'], NULL,
 'M',
 'BOCSAR covers NSW well. WA and TAS need their own ingests, each with its own offence '
 || 'classification to reconcile — that reconciliation is the work, not the download.',
 'Mostly open; WA and TAS publish under varying terms',
 0.85,
 'No other surface attempts crime against funding at LGA grain, precisely because of this gap.',
 '/clarity/wants'),

('anything-at-sa2', 'SA2 GRAIN',
 'Can any claim in this product be made below the local government area?',
 'PLACE', 'unanswerable', 'scalar', 'postcode', 'internal',
 'gs_entities.sa2_code is populated on 87,800 of 609,405 rows — 14.4%. postcode_geo carries an '
 || 'sa2_code but is a postcode register, not a complete SA2 one, so it cannot fill the gap.',
 '',
 '',
 ARRAY['gs_entities'], NULL,
 'M',
 'An ABS SA2 boundary ingest plus a point-in-polygon pass over the entities that have an address. '
 || 'The /atlas place work has already built the harder half of this for LGAs.',
 'CC-BY-4.0 · ABS ASGS',
 0.8,
 'Every sub-LGA claim anywhere in either product waits on this one column.',
 '/clarity/wants'),

('nz-crosswalk', 'ACROSS THE TASMAN',
 'Which New Zealand charities are the same organisation as an Australian one we already hold?',
 'CHARITY', 'unanswerable', 'scalar', 'entity', 'internal',
 'nz_charities holds 45,192 rows and every one of them has a null gs_entity_id. The table was '
 || 'ingested and never crosswalked, so it is present, sizeable, and joins to nothing.',
 '',
 '',
 ARRAY['nz_charities'], NULL,
 'S',
 'Name-and-registration matching against the spine, the same shape as the ORIC and ACNC '
 || 'crosswalks that already exist. 0 of 45,192 linked today.',
 'NZ Charities Register, open data',
 0.7,
 'A trans-Tasman view exists nowhere in either repo.',
 '/clarity/wants')

ON CONFLICT (slug) DO NOTHING;

-- ---------------------------------------------------------------------------
-- 5. THE REFUSAL — the most important state in the set
-- ---------------------------------------------------------------------------
-- A refused question gets a full card AND a full page and renders no chart at all. It is the only
-- place in either repo where a refusal has its own URL. `refuses_when` carries the condition in
-- prose so the page states the rule rather than implying the data is merely missing.
INSERT INTO clarity_question (
  slug, stub, question, subject, state, form, honest_at, publishable,
  caveat, exclusions, claim_phrasing, refuses_when,
  blocked_by, unlock_effort, unlock_note, uniqueness, uniqueness_basis, surface
) VALUES (
  'detention-by-lga', 'DETENTION BY PLACE',
  'What is the youth detention rate in this local government area?',
  'JUSTICE', 'refused', 'refused', 'state', 'internal',
  'AIHW publishes youth justice at state level, quarterly, roughly two quarters lagged, by '
  || 'design. That is not a defect in their collection and no amount of work here turns it into '
  || 'an LGA figure.',
  'Nothing is excluded, because nothing is drawn.',
  'Youth detention in this database is honest at state level and nowhere finer.',
  'Asked for any grain below the state. aihw_youth_justice_stats holds 13 rows, one year, '
  || 'source_table = ''PDF_HEADLINE'', and the Northern Territory is missing entirely — an LGA '
  || 'choropleth built on it would be a fabrication with a legend.',
  ARRAY['aihw_youth_justice_stats'],
  'L',
  'Per-LGA detention counts do not exist in any published Australian source. Nothing cheap exists, '
  || 'and pretending otherwise on a want list is its own kind of dishonesty.',
  0.98,
  'Every place surface in either repo would draw this map if the data allowed it. This is the '
  || 'registry saying no, once, with its reasons, at a URL that can be linked.',
  '/clarity/q/detention-by-lga'
) ON CONFLICT (slug) DO NOTHING;

INSERT INTO clarity_question_ingredient (question_slug, object_key, join_key, role, is_binding)
VALUES ('detention-by-lga', 'public.aihw_youth_justice_stats', 'state', 'fact', true)
ON CONFLICT DO NOTHING;

-- The convention that bit me, now enforced by the schema instead of by memory. clarity_object
-- keys are bare; clarity_question_ingredient keys carry `public.` because they are compared
-- against clarity_sentinel.guards_objects. Two conventions, one comparison, and the failure mode
-- is silent: the answer runs green with its guards detached.
ALTER TABLE clarity_question_ingredient
  DROP CONSTRAINT IF EXISTS ingredient_object_key_is_qualified;
ALTER TABLE clarity_question_ingredient
  ADD CONSTRAINT ingredient_object_key_is_qualified
  CHECK (object_key LIKE 'public.%');

COMMIT;
