-- /clarity slice 7 part 4 — the last five questions
--
-- Apply:
--   source .env && PGPASSWORD="$DATABASE_PASSWORD" psql -h aws-0-ap-southeast-2.pooler.supabase.com \
--     -p 5432 -U "postgres.tednluwflfhxyucgwigh" -d postgres \
--     -f supabase/migrations/20260815002400_clarity_registry_final_five.sql
--
-- Every figure measured 2026-08-15 before the question was written. Two notes up front:
--
-- TWO PURSES loses its UNVERIFIED stamp. The spec stamped it unverified because nobody had ever
-- re-run the 949-of-4,167 figure. It now reproduces at 952 of 4,167 — three ABNs of drift — and
-- from here the runner re-computes it nightly, which is what the stamp was asking for.
--
-- NDIS CONCENTRATION is registered against a narrower question than the spec asked. The spec asks
-- where concentration sits AGAINST DISADVANTAGE. The concentration half is real and good at state
-- and service-district grain; the disadvantage half needs a district-to-LGA crosswalk that does
-- not exist, because ndis_participants_lga.lga_code is 100% NULL. Registering the original wording
-- as answered would answer a different question than the title asks, so the title changed.

BEGIN;

-- ---------------------------------------------------------------------------
-- MONEY WE CANNOT SEE — $11.83bn to organisations the graph never created
-- ---------------------------------------------------------------------------
-- 67,691 distinct recipient ABNs across grantconnect_awards, carrying $207.38bn.
-- 30,126 of those ABNs are absent from gs_entities: 68,170 awards, $11.83bn.
-- (Spec said 30,129 / 68,175 / $11.83bn. Three ABNs and five awards of drift.)
INSERT INTO clarity_question (
  slug, stub, question, subject, state, form, honest_at, publishable,
  verification_stamp, caveat, exclusions, claim_phrasing, forbidden_phrasing,
  answer_sql, coverage_sql, uniqueness, uniqueness_basis, surface
) VALUES (
  'off-spine-grants', 'MONEY WE CANNOT SEE',
  'How much Commonwealth grant money goes to organisations this graph has never created?',
  'MONEY', 'answered', 'scalar', 'abn', 'internal',
  'verified',
  'These organisations are not missing from Australia, they are missing from this database. The '
  || 'award records exist and name them; no entity was ever created, so nothing else in CivicGraph '
  || 'can see the money. The denominator matters as much as the number and is stated on the card.',
  '12,328 awards carry no recipient ABN at all and are excluded from both halves — they cannot be '
  || 'tested against the spine either way.',
  'Of $207.38bn in Commonwealth grant awards with an identified recipient ABN, $11.83bn — 68,170 '
  || 'awards to 30,126 ABNs — goes to organisations that do not exist as entities in CivicGraph.',
  ARRAY['missing money', 'unaccounted grants', 'hidden funding'],
  $q$
  WITH a AS (
    SELECT recipient_abn, count(*) AS n, sum(value_aud) AS v
      FROM grantconnect_awards WHERE recipient_abn IS NOT NULL GROUP BY 1
  ),
  j AS (
    SELECT a.n, a.v, (e.abn IS NULL) AS off_spine
      FROM a LEFT JOIN gs_entities e ON e.abn = a.recipient_abn
  )
  SELECT jsonb_build_object(
           'abns_off_spine', count(*) FILTER (WHERE off_spine),
           'abns_total', count(*),
           'awards_off_spine', sum(n) FILTER (WHERE off_spine),
           'awards_total', sum(n),
           'dollars_off_spine', sum(v) FILTER (WHERE off_spine),
           'dollars_total', sum(v)
         ) AS payload,
         '$' || round(sum(v) FILTER (WHERE off_spine) / 1e9, 2)::text || 'bn' AS headline,
         'of $' || round(sum(v) / 1e9, 2)::text || 'bn — '
           || (sum(n) FILTER (WHERE off_spine))::text || ' awards to '
           || (count(*) FILTER (WHERE off_spine))::text
           || ' ABNs with no entity in this graph' AS headline_sub,
         round(sum(v) FILTER (WHERE off_spine) / 1e9, 2) AS headline_num
    FROM j
  $q$,
  $q$
  SELECT count(recipient_abn)::numeric AS numerator, count(*)::numeric AS denominator,
         'grant awards carrying a recipient ABN' AS label
    FROM grantconnect_awards
  $q$,
  0.93,
  'The entity builder reports what it created. Nothing anywhere reports what it declined to create.',
  '/clarity/q/off-spine-grants'
) ON CONFLICT (slug) DO NOTHING;

INSERT INTO clarity_question_ingredient (question_slug, object_key, join_key, role, is_binding)
VALUES
  ('off-spine-grants', 'public.grantconnect_awards', 'recipient_abn', 'fact',  true),
  ('off-spine-grants', 'public.gs_entities',         'abn',           'denominator', false)
ON CONFLICT DO NOTHING;

-- ---------------------------------------------------------------------------
-- HOW MUCH IS GOVERNMENT — pinned to the last complete AIS year
-- ---------------------------------------------------------------------------
-- acnc_ais by year: 2023 = 53,207 · 2022 = 52,935 · 2021 = 51,746 · 2025 = 1 stray row · NO 2024.
-- In 2023, 42,644 charities report gross income and 8,275 of them (19.4%) draw at least half
-- their revenue from government. The year is selected explicitly. Without that, a query spanning
-- the table silently averages incompatible years and quietly includes a single 2025 row.
INSERT INTO clarity_question (
  slug, stub, question, subject, state, form, honest_at, publishable,
  verification_stamp, caveat, exclusions, claim_phrasing, forbidden_phrasing,
  answer_sql, coverage_sql, uniqueness, uniqueness_basis, surface
) VALUES (
  'govt-dependence', 'HOW MUCH IS GOVERNMENT',
  'How many charities depend on government for most of their revenue?',
  'CHARITY', 'answered', 'ranked_bar', 'entity', 'internal',
  'verified',
  'Pinned to the 2023 Annual Information Statement year, which is the last complete one — there '
  || 'are NO 2024 rows in acnc_ais at all, and a single stray 2025 row. Any figure quoted from '
  || 'this table without naming its year is averaging incompatible years.',
  'Charities reporting zero or null gross income are excluded from the ratio, because a share of '
  || 'zero is undefined rather than zero. They remain in the coverage denominator.',
  'In the 2023 AIS year, 8,275 of 42,644 charities reporting income — 19.4% — drew at least half '
  || 'their revenue from government.',
  ARRAY['charities are government funded', 'most charities depend on government'],
  $q$
  WITH y AS (SELECT 2023 AS yr),
  a AS (
    SELECT revenue_from_government AS gov, total_gross_income AS inc, charity_size
      FROM acnc_ais, y WHERE ais_year = y.yr AND total_gross_income > 0
  ),
  b AS (
    SELECT CASE
             WHEN gov / inc >= 0.9 THEN '90-100%'
             WHEN gov / inc >= 0.5 THEN '50-89%'
             WHEN gov / inc >= 0.1 THEN '10-49%'
             ELSE 'under 10%'
           END AS band,
           count(*) AS n
      FROM a GROUP BY 1
  )
  SELECT jsonb_build_object(
           'ais_year', 2023,
           'bands', (SELECT jsonb_agg(jsonb_build_object('band', band, 'charities', n)) FROM b),
           'reporting_income', (SELECT count(*) FROM a),
           'dependent_50_plus', (SELECT count(*) FROM a WHERE gov / inc >= 0.5)
         ) AS payload,
         round(100.0 * (SELECT count(*) FROM a WHERE gov / inc >= 0.5)
               / nullif((SELECT count(*) FROM a), 0), 1)::text || '%' AS headline,
         (SELECT count(*) FROM a WHERE gov / inc >= 0.5)::text || ' of '
           || (SELECT count(*) FROM a)::text
           || ' charities draw at least half their revenue from government (2023 AIS year)'
           AS headline_sub,
         round(100.0 * (SELECT count(*) FROM a WHERE gov / inc >= 0.5)
               / nullif((SELECT count(*) FROM a), 0), 1) AS headline_num
  $q$,
  $q$
  SELECT count(*) FILTER (WHERE total_gross_income > 0)::numeric AS numerator,
         count(*)::numeric AS denominator,
         'charities in the 2023 AIS year reporting gross income' AS label
    FROM acnc_ais WHERE ais_year = 2023
  $q$,
  0.8,
  'ACNC publishes the underlying statements. What is absent everywhere is the year-pinning, which '
  || 'is the only thing standing between this table and a silently wrong average.',
  '/clarity/q/govt-dependence'
) ON CONFLICT (slug) DO NOTHING;

INSERT INTO clarity_question_ingredient (question_slug, object_key, join_key, role, is_binding)
VALUES ('govt-dependence', 'public.acnc_ais', 'abn', 'fact', true)
ON CONFLICT DO NOTHING;

-- ---------------------------------------------------------------------------
-- TWO PURSES, ONE ORG — reproduced, so the UNVERIFIED stamp comes off
-- ---------------------------------------------------------------------------
INSERT INTO clarity_question (
  slug, stub, question, subject, state, form, honest_at, publishable,
  verification_stamp, caveat, exclusions, claim_phrasing, forbidden_phrasing,
  answer_sql, coverage_sql, uniqueness, uniqueness_basis, surface
) VALUES (
  'two-purses', 'TWO PURSES, ONE ORG',
  'Which foundation grantees also hold Commonwealth contracts?',
  'MONEY', 'answered', 'scalar', 'abn', 'internal',
  'verified',
  'Holding both is ordinary for a large service provider and is not a finding about any of them. '
  || 'What the number describes is the overlap between two funding worlds that are usually '
  || 'reported separately. Foundation grantee coverage is partial and skewed to foundations whose '
  || 'grant lists were published at all.',
  'Grantees with no ABN cannot be tested and are excluded from both halves.',
  'Of 4,167 foundation grantees identified by ABN, 952 — 22.8% — also hold at least one '
  || 'Commonwealth contract.',
  ARRAY['double dipping', 'taking from both sides'],
  $q$
  WITH g AS (SELECT DISTINCT grantee_abn FROM foundation_grantees WHERE grantee_abn IS NOT NULL),
  j AS (
    SELECT g.grantee_abn,
           EXISTS (SELECT 1 FROM austender_contracts c WHERE c.supplier_abn = g.grantee_abn)
             AS has_contract
      FROM g
  )
  SELECT jsonb_build_object(
           'grantees', count(*),
           'also_contract', count(*) FILTER (WHERE has_contract),
           'grant_only', count(*) FILTER (WHERE NOT has_contract)
         ) AS payload,
         round(100.0 * count(*) FILTER (WHERE has_contract) / nullif(count(*), 0), 1)::text || '%'
           AS headline,
         count(*) FILTER (WHERE has_contract)::text || ' of ' || count(*)::text
           || ' foundation grantees also hold a Commonwealth contract' AS headline_sub,
         round(100.0 * count(*) FILTER (WHERE has_contract) / nullif(count(*), 0), 1) AS headline_num
    FROM j
  $q$,
  $q$
  SELECT count(DISTINCT grantee_abn)::numeric AS numerator,
         count(DISTINCT coalesce(grantee_abn, grantee_name_normalised))::numeric AS denominator,
         'foundation grantees identified by ABN rather than name only' AS label
    FROM foundation_grantees
  $q$,
  0.87,
  'Philanthropic and government funding are reported in separate worlds. Nothing else in either '
  || 'repo puts the two against one ABN.',
  '/clarity/q/two-purses'
) ON CONFLICT (slug) DO NOTHING;

INSERT INTO clarity_question_ingredient (question_slug, object_key, join_key, role, is_binding)
VALUES
  ('two-purses', 'public.foundation_grantees',  'grantee_abn',  'spine', true),
  ('two-purses', 'public.austender_contracts',  'supplier_abn', 'fact',  false)
ON CONFLICT DO NOTHING;

-- austender's outlier sentinel guards the contracts table, and this question never reads a
-- contract value — it asks only whether a contract exists.
INSERT INTO clarity_sentinel_exemption (sentinel_key, question_slug, reason) VALUES
  ('contract_value_ceiling', 'two-purses',
   'This answer tests only for the EXISTENCE of a contract and reads no contract_value at all, so '
   || 'the 13 outlier rows cannot move the number. They would still be counted as contracts under '
   || 'any adjudication.')
ON CONFLICT DO NOTHING;

-- ---------------------------------------------------------------------------
-- WHOSE MONEY, WHOSE PLACE — contested, on a denominator that is not comparable
-- ---------------------------------------------------------------------------
-- In the 227 LGAs holding at least one high-confidence community-controlled organisation,
-- community-controlled orgs receive $4.57bn of $1,065.29bn recorded — 0.4%.
--
-- The number is computable and the comparison is not. That denominator is dominated by national
-- contractors whose registered address happens to sit in the same LGA, and CivicGraph's own
-- attribution work has already established that remote communities are funded through regional and
-- land councils whose registered address credits the hub. Both defects push in the same direction.
-- Contested, with the org-count share shown beside the dollar share, because they disagree and the
-- disagreement is the honest content.
INSERT INTO clarity_question (
  slug, stub, question, subject, state, form, honest_at, publishable,
  verification_stamp, caveat, exclusions, claim_phrasing, forbidden_phrasing,
  answer_sql, coverage_sql, uniqueness, uniqueness_basis, surface
) VALUES (
  'community-controlled-share', 'WHOSE MONEY, WHOSE PLACE',
  'Where community-controlled organisations exist, what share of the money do they receive?',
  'PLACE', 'contested', 'stacked_three', 'lga', 'internal',
  'verified',
  'The dollar share is not a like-for-like comparison and must not be quoted as one. The '
  || 'denominator counts every organisation with a registered address in the same local government '
  || 'area, including national contractors headquartered there, and CivicGraph''s own place work '
  || 'has established that remote communities are funded through regional and land councils whose '
  || 'registered address credits the hub rather than the community. Both defects push the share '
  || 'down. The organisation-count share is shown beside it because the two disagree.',
  'Community-controlled status is gated at cc_confidence >= 9. Entities with no resolved local '
  || 'government area are excluded from both halves — 10,236 of 12,479 community-controlled '
  || 'entities carry one.',
  'In local government areas where community-controlled organisations exist, they are a visible '
  || 'share of organisations and a far smaller share of recorded dollars. The dollar gap is real '
  || 'but its size cannot be stated from this data.',
  ARRAY['community-controlled orgs get 0.4%', 'receive almost nothing', 'excluded from funding'],
  $q$
  WITH e AS (
    SELECT id, lga_name, (is_community_controlled AND coalesce(cc_confidence, 0) >= 9) AS cc
      FROM gs_entities WHERE lga_name IS NOT NULL
  ),
  f AS (
    SELECT e.lga_name, e.cc, sum(m.grand_total_funding) AS dollars, count(*) AS orgs
      FROM e JOIN mv_entity_total_funding m ON m.entity_id = e.id
     GROUP BY 1, 2
  ),
  lga AS (SELECT lga_name FROM f WHERE cc GROUP BY 1),
  s AS (
    SELECT sum(f.dollars) FILTER (WHERE f.cc) AS cc_dollars, sum(f.dollars) AS all_dollars,
           sum(f.orgs) FILTER (WHERE f.cc) AS cc_orgs, sum(f.orgs) AS all_orgs,
           count(DISTINCT f.lga_name) AS lgas
      FROM f JOIN lga ON lga.lga_name = f.lga_name
  )
  SELECT jsonb_build_object(
           'lgas', lgas, 'cc_dollars', cc_dollars, 'all_dollars', all_dollars,
           'cc_orgs', cc_orgs, 'all_orgs', all_orgs,
           'dollar_share_pct', round(100.0 * cc_dollars / nullif(all_dollars, 0), 2),
           'org_share_pct', round(100.0 * cc_orgs / nullif(all_orgs, 0), 2)
         ) AS payload,
         round(100.0 * cc_orgs / nullif(all_orgs, 0), 1)::text || '% of organisations, '
           || round(100.0 * cc_dollars / nullif(all_dollars, 0), 1)::text || '% of dollars'
           AS headline,
         'across ' || lgas::text
           || ' local government areas that hold a community-controlled organisation — the dollar '
           || 'share is not like-for-like, see the caveat' AS headline_sub,
         round(100.0 * cc_orgs / nullif(all_orgs, 0), 1) AS headline_num
    FROM s
  $q$,
  $q$
  SELECT count(*) FILTER (WHERE lga_name IS NOT NULL)::numeric AS numerator,
         count(*)::numeric AS denominator,
         'community-controlled entities with a resolved local government area' AS label
    FROM gs_entities WHERE is_community_controlled AND coalesce(cc_confidence, 0) >= 9
  $q$,
  0.95,
  '/atlas maps place and does not attempt this share. It is the question the place work was '
  || 'ultimately for, and it is the one the attribution defects bite hardest.',
  '/clarity/q/community-controlled-share'
) ON CONFLICT (slug) DO NOTHING;

INSERT INTO clarity_question_ingredient (question_slug, object_key, join_key, role, is_binding)
VALUES
  ('community-controlled-share', 'public.gs_entities',             'lga_name',  'spine', true),
  ('community-controlled-share', 'public.mv_entity_total_funding', 'entity_id', 'fact',  false)
ON CONFLICT DO NOTHING;

-- ---------------------------------------------------------------------------
-- NDIS CONCENTRATION — answered at state, and the title changed to match
-- ---------------------------------------------------------------------------
-- 14,915 rows, 234 service districts, last report 2026-03-31. Concentration is genuinely
-- measurable here. What is NOT available is the crossing with disadvantage: SEIFA is postcode and
-- LGA based, NDIS publishes by service district, and ndis_participants_lga.lga_code is 100% NULL,
-- so there is no crosswalk. The spec's wording asked for the crossing; this asks what the data
-- supports and says what it does not.
INSERT INTO clarity_question (
  slug, stub, question, subject, state, form, honest_at, publishable,
  verification_stamp, caveat, exclusions, claim_phrasing, forbidden_phrasing,
  answer_sql, coverage_sql, uniqueness, uniqueness_basis, surface
) VALUES (
  'ndis-concentration', 'NDIS CONCENTRATION',
  'How concentrated is NDIS spending among the largest providers, and where?',
  'MONEY', 'answered', 'ranked_bar', 'state', 'internal',
  'verified',
  'State grain only. This CANNOT be crossed with disadvantage, which is the question everybody '
  || 'wants: SEIFA is published by postcode and local government area, the NDIA publishes by '
  || 'service district, and ndis_participants_lga.lga_code is 100% NULL, so no crosswalk exists. '
  || 'Anything finer or crossed with SEIFA would be invented.',
  '4,425 of 14,915 rows carry a state_code that is not a state — ALL, OT or State_Missing, 29.7% '
  || 'of the table. They are excluded from the ranking and reported in the payload rather than '
  || 'silently dropped.',
  'In the March 2026 NDIA reporting, the top ten providers take between 31% and 66% of payments '
  || 'depending on the state. The two higher figures circulating from this table — 74% and 72% — '
  || 'are the OT and State_Missing buckets, which are not states.',
  ARRAY['NDIS concentration by LGA', 'concentration in disadvantaged areas'],
  $q$
  WITH latest AS (SELECT max(report_date) AS d FROM ndis_market_concentration),
  s AS (
    SELECT state_code, round(avg(payment_share_top10_pct), 1) AS top10, count(*) AS rows
      FROM ndis_market_concentration, latest
     WHERE report_date = latest.d
       AND state_code NOT IN ('ALL', 'OT', 'State_Missing')
     GROUP BY 1
  )
  SELECT jsonb_build_object(
           'report_date', (SELECT d FROM latest),
           'states', (SELECT jsonb_agg(jsonb_build_object('state', state_code, 'top10_pct', top10,
                              'rows', rows) ORDER BY top10 DESC) FROM s),
           'excluded_non_state_rows',
             (SELECT count(*) FROM ndis_market_concentration
               WHERE state_code IN ('ALL', 'OT', 'State_Missing'))
         ) AS payload,
         (SELECT round(min(top10), 0)::text || '–' || round(max(top10), 0)::text || '%' FROM s)
           AS headline,
         'share taken by the top ten providers, lowest to highest state, reported '
           || (SELECT to_char(d, 'Mon YYYY') FROM latest) AS headline_sub,
         (SELECT round(max(top10), 1) FROM s) AS headline_num
  $q$,
  $q$
  SELECT count(*) FILTER (WHERE state_code NOT IN ('ALL','OT','State_Missing'))::numeric
           AS numerator,
         count(*)::numeric AS denominator,
         'rows carrying a real state code' AS label
    FROM ndis_market_concentration
  $q$,
  0.86,
  'The NDIS surfaces in this repo count providers and participants. None of them reports how much '
  || 'of the payment flow the largest ten providers take.',
  '/clarity/q/ndis-concentration'
) ON CONFLICT (slug) DO NOTHING;

INSERT INTO clarity_question_ingredient (question_slug, object_key, join_key, role, is_binding)
VALUES ('ndis-concentration', 'public.ndis_market_concentration', 'state_code', 'fact', true)
ON CONFLICT DO NOTHING;

COMMIT;
