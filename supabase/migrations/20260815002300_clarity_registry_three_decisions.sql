-- /clarity slice 7 part 3 — the three questions that needed a decision before they could be written
--
-- Apply:
--   source .env && PGPASSWORD="$DATABASE_PASSWORD" psql -h aws-0-ap-southeast-2.pooler.supabase.com \
--     -p 5432 -U "postgres.tednluwflfhxyucgwigh" -d postgres \
--     -f supabase/migrations/20260815002300_clarity_registry_three_decisions.sql
--
-- Two refusals and one worked example. Each decision is made on a measurement taken today, and in
-- two of the three cases the measurement is worse than the reason I expected to give.

BEGIN;

-- ---------------------------------------------------------------------------
-- WHO MET WHOM — refused, and not for the reason the spec assumed
-- ---------------------------------------------------------------------------
-- The spec stamps this PILOT and asks whether organisations that met ministers later won
-- contracts. Measured today, civic_ministerial_diaries holds:
--
--   1,728 meetings · jurisdiction = 'QLD' for every one of them · 5 ministers
--   1,151 distinct organisations · 408 with a linked entity (23.6%) · 0 with an ABN
--   2020-12-03 → 2026-01-30
--
-- The ABN gap is the smaller problem. The larger one is that these are five Queensland ministers,
-- and the contract table the question wants to join to is austender — Commonwealth. Asking
-- whether a QLD minister's meeting preceded a Commonwealth contract is a category error dressed
-- as an influence finding. state_tenders holds 199,679 QLD rows and would be the right join, but
-- it is owned and scraped by JusticeHub and matched on supplier name, not ABN, so the chain would
-- be: fuzzy diary organisation name → fuzzy supplier name → inferred influence. Three soft joins
-- and a causal verb.
INSERT INTO clarity_question (
  slug, stub, question, subject, state, form, honest_at, publishable,
  defamation_sensitive, caveat, exclusions, claim_phrasing, refuses_when,
  blocked_by, unlock_effort, unlock_note, uniqueness, uniqueness_basis, surface
) VALUES (
  'ministerial-diaries', 'WHO MET WHOM',
  'Which ministers met which organisations, and did those organisations later win contracts?',
  'POWER', 'refused', 'refused', 'none', 'internal',
  true,
  'Ministerial diary data in this database is one state and five ministers. It can show that a '
  || 'meeting was published; it cannot support a claim about access or influence, and the second '
  || 'half of the question — did they later win contracts — has no sound join at all.',
  'Nothing is excluded, because nothing is drawn.',
  'CivicGraph holds 1,728 published Queensland ministerial diary entries covering five ministers. '
  || 'They are a record of published meetings and nothing more.',
  'Asked to connect meetings to contracts, or to generalise beyond Queensland. All 1,728 meetings '
  || 'are QLD and cover 5 ministers; organisation_abn is populated on 0 of them and only 408 carry '
  || 'a linked entity. The contract table this would join to is Commonwealth, so the join is '
  || 'either a category error or a chain of two fuzzy name matches ending in a causal verb. On a '
  || 'defamation-sensitive question about named people, that is not a coverage problem to caveat, '
  || 'it is a claim that must not be constructed.',
  ARRAY['civic_ministerial_diaries'],
  'L',
  'A national diary corpus does not exist as open data. Each jurisdiction publishes separately, '
  || 'most as PDFs, none with ABNs. Even complete, the meeting-to-contract link needs a supplier '
  || 'crosswalk that is itself unbuilt. Nothing cheap exists and nothing medium does either.',
  0.99,
  'Nothing else in either repo touches ministerial diaries. This card exists so that the next '
  || 'person who finds the table knows what it cannot carry before they build on it.',
  '/clarity/q/ministerial-diaries'
) ON CONFLICT (slug) DO NOTHING;

INSERT INTO clarity_question_ingredient (question_slug, object_key, join_key, role, is_binding)
VALUES ('ministerial-diaries', 'public.civic_ministerial_diaries', 'organisation', 'fact', true)
ON CONFLICT DO NOTHING;

-- ---------------------------------------------------------------------------
-- PAY AND DEPENDENCE — refused, because the sample is a size class, not a sample
-- ---------------------------------------------------------------------------
-- total_paid_key_management coverage in the 2023 AIS year, by charity size:
--
--   Large    4,866 of  5,715  = 85.1%
--   Medium     223 of  8,461  =  2.6%
--   Small       46 of 36,479  =  0.1%
--
-- That is not thin coverage, it is a disclosure threshold. ACNC requires key management personnel
-- remuneration from large charities and effectively nobody else. A correlation computed across
-- this is a statement about large charities wearing the word "charities", on a question already
-- marked defamation-sensitive because it is about named people's pay.
INSERT INTO clarity_question (
  slug, stub, question, subject, state, form, honest_at, publishable,
  defamation_sensitive, caveat, exclusions, claim_phrasing, refuses_when,
  blocked_by, unlock_effort, unlock_note, uniqueness, uniqueness_basis, surface
) VALUES (
  'exec-pay-dependence', 'PAY AND DEPENDENCE',
  'Does executive pay track how dependent a charity is on government revenue?',
  'CHARITY', 'refused', 'refused', 'none', 'internal',
  true,
  'Executive remuneration is disclosed to the ACNC by large charities and almost nobody else. Any '
  || 'relationship computed over the disclosed set describes large charities, and the word '
  || '"charities" in a headline would not.',
  'Nothing is excluded, because nothing is computed.',
  'CivicGraph can report government revenue dependence for charities that file an AIS. It cannot '
  || 'relate that to executive pay for any group broader than large charities.',
  'Asked for a relationship between pay and dependence across charities. Key management '
  || 'remuneration is reported by 85.1% of large charities, 2.6% of medium and 0.1% of small — a '
  || 'disclosure threshold, not a sample. A coefficient over it would be a claim about large '
  || 'charities presented as a claim about charities, on a question about named people''s pay. '
  || 'The honest alternative is a descriptive, large-charity-only comparison that says so in its '
  || 'title, and that is a different question from this one.',
  ARRAY['acnc_ais'],
  'M',
  'Not fixable by ingestion — the data is not withheld, it is not required. A large-charity-only '
  || 'descriptive question could be registered instead, which is scoping work rather than data '
  || 'work, and it must not inherit this question''s phrasing.',
  0.96,
  'Executive pay is not joined to government dependence anywhere in either repo, and this card is '
  || 'the reason rather than an oversight.',
  '/clarity/q/exec-pay-dependence'
) ON CONFLICT (slug) DO NOTHING;

INSERT INTO clarity_question_ingredient (question_slug, object_key, join_key, role, is_binding)
VALUES ('exec-pay-dependence', 'public.acnc_ais', 'abn', 'fact', true)
ON CONFLICT DO NOTHING;

-- ---------------------------------------------------------------------------
-- EVERY DOLLAR — not a refusal. A worked example, pinned and stamped.
-- ---------------------------------------------------------------------------
-- This one is answerable; it is just not board-shaped. "For one ABN, every dollar from every tier"
-- needs a subject, and every other card answers about the whole database. Rather than refuse a
-- question the data supports, it is pinned to one organisation, stamped PILOT, and the card says
-- it is a demonstration of a path rather than a finding about anybody.
--
-- Life Without Barriers (ABN 15 101 252 171) is the subject: present in six systems, and today it
-- carries 93 Commonwealth contracts ($1,650.3m), 75 Commonwealth grants ($344.8m), 424 justice
-- funding grants ($776.5m) and 906 QLD tender records ($380.5m). No political donations. It was
-- chosen because it exercises four tiers at once, which is what makes it a useful demonstration.
INSERT INTO clarity_question (
  slug, stub, question, subject, state, form, honest_at, publishable,
  verification_stamp, caveat, exclusions, claim_phrasing, forbidden_phrasing,
  answer_sql, coverage_sql, uniqueness, uniqueness_basis, surface
) VALUES (
  'every-dollar-one-abn', 'EVERY DOLLAR',
  'For one organisation, what is every dollar this database can see, from every tier of government?',
  'MONEY', 'answered', 'stacked_three', 'abn', 'internal',
  'pilot',
  'A worked example, not a finding. One ABN is pinned so the path can be demonstrated end to end; '
  || 'the same query runs for any ABN and the entity page is where it belongs. The total is a '
  || 'floor and the sources may overlap — a justice funding record and a Commonwealth contract can '
  || 'describe the same money, and nothing here de-duplicates them, which is why every source is '
  || 'listed separately and the total is stated as "at least".',
  'Political donations are shown filtered to receipt_type = ''donation received''. State tenders '
  || 'are Queensland only, because that is the only state with meaningful coverage in this '
  || 'database.',
  'Across four sources CivicGraph records at least $3.15bn associated with Life Without Barriers '
  || '(ABN 15 101 252 171). Sources may overlap and the figure is a floor, not a total.',
  ARRAY['received $3.15bn', 'total government funding', 'the biggest recipient'],
  $q$
  WITH src AS (
    SELECT 'Commonwealth contracts' AS source, count(*) AS records, sum(contract_value) AS dollars
      FROM austender_contracts WHERE supplier_abn = '15101252171'
    UNION ALL
    SELECT 'Commonwealth grants', count(*), sum(value_aud)
      FROM grantconnect_awards WHERE recipient_abn = '15101252171'
    UNION ALL
    SELECT 'Justice funding (grants)', count(*), sum(amount_dollars)
      FROM justice_funding WHERE recipient_abn = '15101252171' AND measure_kind = 'grant'
    UNION ALL
    SELECT 'QLD tenders', count(*), sum(contract_value)
      FROM state_tenders WHERE supplier_abn = '15101252171'
    UNION ALL
    SELECT 'Political donations', count(*), sum(amount)
      FROM political_donations
     WHERE donor_abn = '15101252171' AND receipt_type = 'donation received'
  )
  SELECT jsonb_build_object(
           'subject_abn', '15101252171',
           'subject_name', 'Life Without Barriers',
           'sources', (SELECT jsonb_agg(jsonb_build_object('source', source, 'records', records,
                              'dollars', dollars) ORDER BY dollars DESC NULLS LAST) FROM src),
           'floor_total', (SELECT sum(dollars) FROM src),
           'records', (SELECT sum(records) FROM src)
         ) AS payload,
         'at least $' || round((SELECT sum(dollars) FROM src) / 1e9, 2)::text || 'bn' AS headline,
         'across ' || (SELECT sum(records) FROM src)::text || ' records in '
           || (SELECT count(*) FROM src WHERE records > 0)::text
           || ' sources — a worked example for one ABN, sources may overlap' AS headline_sub,
         round((SELECT sum(dollars) FROM src) / 1e9, 2) AS headline_num
  $q$,
  $q$
  SELECT (CASE WHEN EXISTS (SELECT 1 FROM austender_contracts
                             WHERE supplier_abn = '15101252171') THEN 1 ELSE 0 END
        + CASE WHEN EXISTS (SELECT 1 FROM grantconnect_awards
                             WHERE recipient_abn = '15101252171') THEN 1 ELSE 0 END
        + CASE WHEN EXISTS (SELECT 1 FROM justice_funding
                             WHERE recipient_abn = '15101252171'
                               AND measure_kind = 'grant') THEN 1 ELSE 0 END
        + CASE WHEN EXISTS (SELECT 1 FROM state_tenders
                             WHERE supplier_abn = '15101252171') THEN 1 ELSE 0 END
        + CASE WHEN EXISTS (SELECT 1 FROM political_donations
                             WHERE donor_abn = '15101252171'
                               AND receipt_type = 'donation received') THEN 1 ELSE 0 END
         )::numeric AS numerator,
         5::numeric AS denominator,
         'money sources carrying any record for this ABN' AS label
  $q$,
  0.75,
  '/entity/[gsId] shows funding per organisation already. What it does not do is state, on the '
  || 'same screen, that the total is a floor and which tiers are missing. That statement is the '
  || 'only thing this card adds, and it is the reason it is a pilot rather than a product surface.',
  '/clarity/q/every-dollar-one-abn'
) ON CONFLICT (slug) DO NOTHING;

INSERT INTO clarity_question_ingredient (question_slug, object_key, join_key, role, is_binding)
VALUES
  ('every-dollar-one-abn', 'public.austender_contracts',  'supplier_abn',  'fact', true),
  ('every-dollar-one-abn', 'public.grantconnect_awards',  'recipient_abn', 'fact', false),
  ('every-dollar-one-abn', 'public.justice_funding',      'recipient_abn', 'fact', false),
  ('every-dollar-one-abn', 'public.state_tenders',        'supplier_abn',  'fact', false),
  ('every-dollar-one-abn', 'public.political_donations',  'donor_abn',     'fact', false)
ON CONFLICT DO NOTHING;

-- Both armed sentinels attach to this question through its ingredients, and neither can reach the
-- answer. That is a claim, so it is evidenced rather than asserted: the donation figure is already
-- filtered to receipt_type = 'donation received', and this ABN's largest Commonwealth contract is
-- $623.7m against a $5bn ceiling, with 0 of its 93 rows above the threshold. Measured 2026-08-15.
INSERT INTO clarity_sentinel_exemption (sentinel_key, question_slug, reason) VALUES
  ('receipt_type_contamination', 'every-dollar-one-abn',
   'This answer filters political_donations to receipt_type = ''donation received'' in its own '
   || 'SQL, so the contaminating rows are excluded before the figure is computed. The sentinel '
   || 'guards the table, and this question does not read the contaminated part of it.'),
  ('contract_value_ceiling', 'every-dollar-one-abn',
   'The ceiling fires on 13 austender rows at or above $5bn. This ABN has 0 rows above the '
   || 'threshold and a largest contract of $623.7m — an order of magnitude clear — so none of the '
   || 'outliers is inside this answer. Re-check if the pinned ABN ever changes.')
ON CONFLICT DO NOTHING;

COMMIT;
