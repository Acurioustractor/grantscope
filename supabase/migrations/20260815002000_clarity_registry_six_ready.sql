-- /clarity slice 7 part 2 — the six questions whose sources were verified before writing them
--
-- Apply:
--   source .env && PGPASSWORD="$DATABASE_PASSWORD" psql -h aws-0-ap-southeast-2.pooler.supabase.com \
--     -p 5432 -U "postgres.tednluwflfhxyucgwigh" -d postgres \
--     -f supabase/migrations/20260815002000_clarity_registry_six_ready.sql
--
-- Every figure in the comments below was measured against the live database on 2026-08-15 before
-- the question was written, not carried from the spec. Three moved:
--
--   mv_revolving_door        6,988 rows, not 6,976
--   prison/post-release      851 of 4,629 charities reach money (18.4%), spec said 862 / 18.6%
--   mv_funding_deserts       1.77 rows per lga|state key — spec's figure reproduces exactly
--
-- And one lookup was wrong in a way that would have produced a silent zero: pre/post-release
-- charities are identified by the boolean column `acnc_charities.ben_pre_post_release`, NOT by
-- text-matching `purposes`/`beneficiaries`. Those are arrays, ACNC's controlled vocabulary has no
-- prison or offender category, and an ILIKE over them returns 0 rows while looking like a
-- perfectly reasonable query.

BEGIN;

-- ---------------------------------------------------------------------------
-- THREE SYSTEMS AT ONCE — mv_revolving_door: 33 entities carry all four vectors
-- ---------------------------------------------------------------------------
INSERT INTO clarity_question (
  slug, stub, question, subject, state, form, honest_at, publishable,
  verification_stamp, caveat, exclusions, claim_phrasing, forbidden_phrasing,
  answer_sql, coverage_sql, rows_sql, uniqueness, uniqueness_basis, surface
) VALUES (
  'revolving-door', 'THREE SYSTEMS AT ONCE',
  'Which organisations lobby, donate, hold contracts and receive public funding at the same time?',
  'POWER', 'answered', 'ranked_bar', 'entity', 'internal',
  'verified',
  'Presence in four registers is not evidence of wrongdoing and this card must never be read as '
  || 'one. It says these organisations appear in four systems that are usually looked at '
  || 'separately, which is a reason to look, not a finding.',
  'An entity qualifies on its ABN being present in each register. Entities with no ABN cannot '
  || 'qualify at all, so the count is a floor.',
  'CivicGraph holds 33 organisations that lobby, donate, contract and receive funding at once, out '
  || 'of 6,988 appearing in two or more of those systems.',
  ARRAY['corrupt', 'buying influence', 'captured'],
  $q$
  WITH v AS (SELECT influence_vectors, count(*) AS n FROM mv_revolving_door GROUP BY 1)
  SELECT jsonb_build_object(
           'by_vectors', (SELECT jsonb_agg(jsonb_build_object('vectors', influence_vectors, 'entities', n)
                            ORDER BY influence_vectors DESC) FROM v),
           'total_entities', (SELECT sum(n) FROM v),
           'top', (SELECT jsonb_agg(jsonb_build_object('name', canonical_name, 'abn', abn,
                          'vectors', influence_vectors, 'score', revolving_door_score))
                     FROM (SELECT canonical_name, abn, influence_vectors, revolving_door_score
                             FROM mv_revolving_door ORDER BY revolving_door_score DESC NULLS LAST
                            LIMIT 20) z)
         ) AS payload,
         (SELECT n FROM v WHERE influence_vectors = 4)::text AS headline,
         'organisations in all four systems, of ' || (SELECT sum(n) FROM v)::text
           || ' in two or more' AS headline_sub,
         (SELECT n FROM v WHERE influence_vectors = 4) AS headline_num
  $q$,
  $q$
  SELECT count(*) FILTER (WHERE abn IS NOT NULL)::numeric AS numerator,
         count(*)::numeric AS denominator,
         'revolving-door entities resolved to an ABN' AS label
    FROM mv_revolving_door
  $q$,
  $q$SELECT canonical_name, abn, state, influence_vectors, revolving_door_score
       FROM mv_revolving_door ORDER BY revolving_door_score DESC NULLS LAST$q$,
  0.9,
  'mv_revolving_door exists but no surface reads it. /graph has nine modes and none of them is '
  || 'this one.',
  '/clarity/q/revolving-door'
) ON CONFLICT (slug) DO NOTHING;

INSERT INTO clarity_question_ingredient (question_slug, object_key, join_key, role, is_binding)
VALUES ('revolving-door', 'public.mv_revolving_door', 'abn', 'spine', true)
ON CONFLICT DO NOTHING;

-- ---------------------------------------------------------------------------
-- GIVES AND TAKES — contested, and both sentinels trip today
-- ---------------------------------------------------------------------------
-- 2,098 entities both donate and contract. The raw figures are $30.09bn donated and $476.76bn in
-- contracts, and BOTH are contaminated: 72% of political_donations rows are 'other receipt', and
-- 13 austender rows carry 29.4% of all recorded contract value. This card is registered so that
-- the block renders — the machinery already refuses to publish the number.
INSERT INTO clarity_question (
  slug, stub, question, subject, state, form, honest_at, publishable,
  verification_stamp, caveat, exclusions, claim_phrasing, forbidden_phrasing,
  answer_sql, coverage_sql, rows_sql, uniqueness, uniqueness_basis, surface
) VALUES (
  'donor-contractor', 'GIVES AND TAKES',
  'Which organisations donate to political parties and also hold government contracts?',
  'POWER', 'contested', 'stacked_three', 'abn', 'internal',
  'verified',
  'Two armed sentinels block this question and both are tripped. political_donations mixes '
  || '''other receipt'' rows — 72% of rows, 85% of dollars — that are not donations at all, and 13 '
  || 'austender rows carry 29.4% of all recorded contract value with a maximum single row of '
  || '$123.00bn. Either defect alone makes the dollar pairing meaningless.',
  'Nothing is excluded yet, which is the problem. The receipt_type filter and the value ceiling '
  || 'have to be applied before this question may be answered.',
  'CivicGraph can identify organisations that both donate and contract, but cannot yet state the '
  || 'dollar figures: the donation table mixes in non-donation receipts and the contract table '
  || 'carries unadjudicated outliers.',
  ARRAY['donated $30bn', 'bought contracts', 'pay to play'],
  $q$
  SELECT jsonb_build_object(
           'entities', count(*),
           'donated_raw', sum(total_donated),
           'contracts_raw', sum(total_contract_value),
           'note', 'raw sums, both contaminated — see sentinels'
         ) AS payload,
         count(*)::text AS headline,
         'organisations both donate and hold contracts — dollar figures withheld pending two '
           || 'sentinels' AS headline_sub,
         count(*) AS headline_num
    FROM mv_gs_donor_contractors
  $q$,
  $q$
  SELECT count(*) FILTER (WHERE abn IS NOT NULL)::numeric AS numerator,
         count(*)::numeric AS denominator,
         'donor-contractors resolved to an ABN' AS label
    FROM mv_gs_donor_contractors
  $q$,
  $q$SELECT canonical_name, abn, state, total_donated, donation_count, total_contract_value,
            contract_count FROM mv_gs_donor_contractors
      ORDER BY total_contract_value DESC NULLS LAST$q$,
  0.92,
  'The overlap exists as a matview nothing reads. Naming it without the two sentinels is how the '
  || '$123bn row would have been published.',
  '/clarity/q/donor-contractor'
) ON CONFLICT (slug) DO NOTHING;

-- Prefixed keys, so both armed sentinels actually attach and block. This is the question they
-- were written for.
INSERT INTO clarity_question_ingredient (question_slug, object_key, join_key, role, is_binding)
VALUES
  ('donor-contractor', 'public.mv_gs_donor_contractors', 'abn', 'spine', true),
  ('donor-contractor', 'public.political_donations',     'donor_abn',    'fact', false),
  ('donor-contractor', 'public.austender_contracts',     'supplier_abn', 'fact', false)
ON CONFLICT DO NOTHING;

-- ---------------------------------------------------------------------------
-- INTERLOCKED BOARDS — 39,757 people, 133,879 board seats
-- ---------------------------------------------------------------------------
INSERT INTO clarity_question (
  slug, stub, question, subject, state, form, honest_at, publishable,
  verification_stamp, caveat, exclusions, claim_phrasing, forbidden_phrasing,
  answer_sql, coverage_sql, rows_sql, uniqueness, uniqueness_basis, surface
) VALUES (
  'interlocked-boards', 'INTERLOCKED BOARDS',
  'Which organisations are governed by someone who also sits on another board?',
  'POWER', 'answered', 'ranked_bar', 'person_block', 'internal',
  'verified',
  'A person block is not a person. Names are matched on a normalised string, so a common name '
  || 'collapses several humans into one block, and the cap that keeps implausible blocks out of '
  || 'the data stays in place deliberately. Dollar figures are floors: the money rollup reaches '
  || '12.9% of the graph, so an unquoted total here would understate by roughly eight times.',
  'Blocks above the plausibility cap are excluded as name collisions rather than counted as '
  || 'extraordinarily busy directors.',
  'CivicGraph holds 39,757 person blocks that sit on two or more boards, covering 133,879 board '
  || 'seats. Associated procurement of at least $265bn is a floor, not a total.',
  ARRAY['controls', 'runs the sector', 'network of insiders'],
  $q$
  SELECT jsonb_build_object(
           'people', count(*),
           'board_seats', sum(cardinality(entity_ids)),
           'procurement_floor', sum(total_procurement_dollars),
           'justice_floor', sum(total_justice_dollars),
           'by_board_count', (SELECT jsonb_agg(jsonb_build_object('boards', board_count, 'people', n)
                                ORDER BY board_count)
                                FROM (SELECT board_count, count(*) AS n FROM mv_board_interlocks
                                       GROUP BY 1) z)
         ) AS payload,
         count(*)::text AS headline,
         'person blocks on two or more boards, covering '
           || sum(cardinality(entity_ids))::text || ' board seats' AS headline_sub,
         count(*) AS headline_num
    FROM mv_board_interlocks
  $q$,
  $q$
  SELECT count(*) FILTER (WHERE cardinality(coalesce(organisation_abns, '{}')) > 0)::numeric
           AS numerator,
         count(*)::numeric AS denominator,
         'interlock blocks with at least one ABN-identified board' AS label
    FROM mv_board_interlocks
  $q$,
  $q$SELECT person_name_display, board_count, organisations, total_procurement_dollars,
            interlock_score FROM mv_board_interlocks
      ORDER BY interlock_score DESC NULLS LAST$q$,
  0.88,
  'mv_board_interlocks is read by no application code. The three matviews built to join it to '
  || 'contracts and donations hold 5 and 3 rows — see DIRECTORS AND CONTRACTS on the want list.',
  '/clarity/q/interlocked-boards'
) ON CONFLICT (slug) DO NOTHING;

INSERT INTO clarity_question_ingredient (question_slug, object_key, join_key, role, is_binding)
VALUES ('interlocked-boards', 'public.mv_board_interlocks', 'person_name_normalised', 'spine', true)
ON CONFLICT DO NOTHING;

-- ---------------------------------------------------------------------------
-- AFTER RELEASE — 851 of 4,629 charities reach any recorded money
-- ---------------------------------------------------------------------------
-- The lookup is the boolean column ben_pre_post_release. An ILIKE over purposes/beneficiaries
-- returns 0 rows: they are arrays and ACNC's vocabulary has no prison category.
INSERT INTO clarity_question (
  slug, stub, question, subject, state, form, honest_at, publishable,
  verification_stamp, caveat, exclusions, claim_phrasing, forbidden_phrasing,
  answer_sql, coverage_sql, rows_sql, uniqueness, uniqueness_basis, surface
) VALUES (
  'prison-release-charities', 'AFTER RELEASE',
  'Who says they serve people leaving prison, and does any recorded money reach them?',
  'JUSTICE', 'answered', 'scalar', 'entity', 'internal',
  'verified',
  'The 4,629 is self-declared: these charities ticked pre and post release as a beneficiary group '
  || 'on their ACNC record. A charity with no money recorded here is not an unfunded charity — the '
  || 'rollup this is measured against reaches a fraction of Australian funding, and state and '
  || 'philanthropic money is largely outside it.',
  'Charities whose ABN does not resolve to the entity spine are counted in the denominator, not '
  || 'silently dropped.',
  'Of 4,629 charities that name people leaving prison as a beneficiary group, 851 have any funding '
  || 'recorded in CivicGraph — 18.4%.',
  ARRAY['receives no funding', 'unfunded', '3,778 charities get nothing'],
  $q$
  WITH p AS (SELECT abn FROM acnc_charities WHERE ben_pre_post_release AND abn IS NOT NULL),
  m AS (
    SELECT p.abn, max(coalesce(f.grand_total_funding, 0)) AS total
      FROM p
      LEFT JOIN gs_entities e ON e.abn = p.abn
      LEFT JOIN mv_entity_total_funding f ON f.entity_id = e.id
     GROUP BY 1
  )
  SELECT jsonb_build_object(
           'charities', (SELECT count(*) FROM m),
           'with_recorded_money', (SELECT count(*) FROM m WHERE total > 0),
           'without', (SELECT count(*) FROM m WHERE total = 0)
         ) AS payload,
         round(100.0 * (SELECT count(*) FROM m WHERE total > 0)
               / nullif((SELECT count(*) FROM m), 0), 1)::text || '%' AS headline,
         (SELECT count(*) FROM m WHERE total > 0)::text || ' of '
           || (SELECT count(*) FROM m)::text
           || ' charities serving people leaving prison have any funding recorded here'
           AS headline_sub,
         round(100.0 * (SELECT count(*) FROM m WHERE total > 0)
               / nullif((SELECT count(*) FROM m), 0), 1) AS headline_num
  $q$,
  $q$
  SELECT count(*) FILTER (WHERE EXISTS (SELECT 1 FROM gs_entities e WHERE e.abn = c.abn))::numeric
           AS numerator,
         count(*)::numeric AS denominator,
         'pre/post-release charities resolved to the entity spine' AS label
    FROM acnc_charities c WHERE c.ben_pre_post_release AND c.abn IS NOT NULL
  $q$,
  $q$SELECT name, abn, state, charity_size FROM acnc_charities
      WHERE ben_pre_post_release ORDER BY name$q$,
  0.93,
  'ACNC beneficiary flags are not joined to funding anywhere else in either repo.',
  '/clarity/q/prison-release-charities'
) ON CONFLICT (slug) DO NOTHING;

INSERT INTO clarity_question_ingredient (question_slug, object_key, join_key, role, is_binding)
VALUES
  ('prison-release-charities', 'public.acnc_charities',          'abn',       'spine', true),
  ('prison-release-charities', 'public.mv_entity_total_funding', 'entity_id', 'fact',  false)
ON CONFLICT DO NOTHING;

-- ---------------------------------------------------------------------------
-- WHAT THE COMMONWEALTH SPENDS — contested on the outlier sentinel
-- ---------------------------------------------------------------------------
-- 824,978 contracts, 823,073 carrying a value, $1,268.01bn total, of which 13 rows are 29.4%.
INSERT INTO clarity_question (
  slug, stub, question, subject, state, form, honest_at, publishable,
  verification_stamp, caveat, exclusions, claim_phrasing, forbidden_phrasing,
  answer_sql, coverage_sql, rows_sql, uniqueness, uniqueness_basis, surface
) VALUES (
  'commonwealth-spend', 'WHAT THE COMMONWEALTH SPENDS',
  'How much does the Commonwealth spend through contracts, and with whom?',
  'MONEY', 'contested', 'ranked_bar', 'abn', 'internal',
  'verified',
  'Thirteen rows carry 29.4% of all recorded contract value, the largest a single $123.00bn line. '
  || 'Until those thirteen are adjudicated — genuine whole-of-government panels, or CSV field '
  || 'shift — every total, every top-supplier ranking and every year-on-year comparison built on '
  || 'this table inherits them.',
  '1,905 rows carry no contract_value. They are counted as rows and excluded from dollars, and '
  || 'every ordering uses NULLS LAST so they never masquerade as zero.',
  'CivicGraph holds 824,978 Commonwealth contracts. The recorded total is not quotable until 13 '
  || 'outlier rows carrying 29.4% of the value are adjudicated.',
  ARRAY['the Commonwealth spent $1.27 trillion', 'largest supplier'],
  $q$
  WITH t AS (
    SELECT count(*) AS rows, count(contract_value) AS with_value,
           sum(contract_value) AS total
      FROM austender_contracts
  ),
  top13 AS (
    SELECT sum(contract_value) AS v FROM (
      SELECT contract_value FROM austender_contracts
       WHERE contract_value IS NOT NULL
       ORDER BY contract_value DESC LIMIT 13
    ) z
  )
  SELECT jsonb_build_object(
           'rows', t.rows, 'rows_with_value', t.with_value, 'total', t.total,
           'top13_value', top13.v,
           'top13_share_pct', round(100.0 * top13.v / nullif(t.total, 0), 1),
           'rows_without_value', t.rows - t.with_value
         ) AS payload,
         '$' || round(t.total / 1e9, 2)::text || 'bn' AS headline,
         'across ' || t.rows::text || ' contracts — but 13 rows are '
           || round(100.0 * top13.v / nullif(t.total, 0), 1)::text
           || '% of it and are unadjudicated' AS headline_sub,
         round(t.total / 1e9, 2) AS headline_num
    FROM t, top13
  $q$,
  $q$
  SELECT count(contract_value)::numeric AS numerator, count(*)::numeric AS denominator,
         'contracts carrying a value' AS label
    FROM austender_contracts
  $q$,
  $q$SELECT title, buyer_name, supplier_name, supplier_abn, contract_value, contract_start
       FROM austender_contracts ORDER BY contract_value DESC NULLS LAST$q$,
  0.85,
  'Several report pages total this table without the outlier sentinel, which is exactly how the '
  || '$123bn row travels into a headline.',
  '/clarity/q/commonwealth-spend'
) ON CONFLICT (slug) DO NOTHING;

INSERT INTO clarity_question_ingredient (question_slug, object_key, join_key, role, is_binding)
VALUES ('commonwealth-spend', 'public.austender_contracts', 'supplier_abn', 'spine', true)
ON CONFLICT DO NOTHING;

-- ---------------------------------------------------------------------------
-- DISADVANTAGE, NO MONEY — the card renders the grain defect, not a map
-- ---------------------------------------------------------------------------
-- 1,997 rows over 1,130 distinct lga_name|state pairs = 1.77 rows per key. The spec's prescribed
-- GROUP BY lga_name, state does not resolve the grain, and V39 refuted that fix. Until somebody
-- investigates what the duplicate rows are, any per-LGA figure double-counts by an unknown factor.
INSERT INTO clarity_question (
  slug, stub, question, subject, state, form, honest_at, publishable,
  verification_stamp, caveat, exclusions, claim_phrasing, forbidden_phrasing,
  answer_sql, coverage_sql, rows_sql, uniqueness, uniqueness_basis, surface
) VALUES (
  'funding-deserts', 'DISADVANTAGE, NO MONEY',
  'Which disadvantaged places receive the least money?',
  'PLACE', 'contested', 'matrix', 'lga', 'internal',
  'verified',
  'mv_funding_deserts holds 1,997 rows describing 1,130 distinct local government area and state '
  || 'pairs — 1.77 rows per place. Nobody has established what the extra rows are, so summing by '
  || 'place multiplies dollars by an unknown factor that varies per place. This card reports the '
  || 'grain defect and deliberately draws no map.',
  'Nothing is excluded, because nothing is aggregated. Aggregating is the unsafe operation here.',
  'CivicGraph cannot yet rank places by funding shortfall: the desert matview has 1.77 rows per '
  || 'place and the duplicates are unexplained.',
  ARRAY['the most underfunded LGA', 'funding desert ranking', 'gets no money'],
  $q$
  WITH g AS (
    SELECT count(*) AS rows,
           count(DISTINCT (coalesce(lga_name,'?') || '|' || coalesce(state,'?'))) AS pairs
      FROM mv_funding_deserts
  ),
  dup AS (
    SELECT count(*) AS places_with_duplicates FROM (
      SELECT lga_name, state FROM mv_funding_deserts
       GROUP BY 1,2 HAVING count(*) > 1
    ) z
  )
  SELECT jsonb_build_object(
           'rows', g.rows, 'distinct_places', g.pairs,
           'rows_per_place', round(g.rows::numeric / nullif(g.pairs, 0), 2),
           'places_with_duplicates', dup.places_with_duplicates
         ) AS payload,
         round(g.rows::numeric / nullif(g.pairs, 0), 2)::text || ' rows per place' AS headline,
         g.rows::text || ' rows describe ' || g.pairs::text
           || ' places — the grain is unresolved, so no ranking is drawn' AS headline_sub,
         round(g.rows::numeric / nullif(g.pairs, 0), 2) AS headline_num
    FROM g, dup
  $q$,
  $q$
  SELECT count(DISTINCT (coalesce(lga_name,'?') || '|' || coalesce(state,'?')))::numeric
           AS numerator,
         count(*)::numeric AS denominator,
         'distinct places per row in the desert matview' AS label
    FROM mv_funding_deserts
  $q$,
  $q$SELECT lga_name, state, remoteness, avg_irsd_decile, total_dollar_flow, desert_score
       FROM mv_funding_deserts ORDER BY lga_name, state$q$,
  0.94,
  '/atlas owns place and does not attempt a shortfall ranking. This card exists to say why one is '
  || 'not available rather than to leave the gap unexplained.',
  '/clarity/q/funding-deserts'
) ON CONFLICT (slug) DO NOTHING;

INSERT INTO clarity_question_ingredient (question_slug, object_key, join_key, role, is_binding)
VALUES ('funding-deserts', 'public.mv_funding_deserts', 'lga_name', 'spine', true)
ON CONFLICT DO NOTHING;

COMMIT;
