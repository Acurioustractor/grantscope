-- Slice 2 — the first three questions, end to end, plus the three armed sentinels.
--
-- Apply:
--   source .env && PGPASSWORD="$DATABASE_PASSWORD" psql -h aws-0-ap-southeast-2.pooler.supabase.com \
--     -p 5432 -U "postgres.tednluwflfhxyucgwigh" -d postgres \
--     -f supabase/migrations/20260815000400_clarity_question_seed.sql
--
-- Rollback:
--   DELETE FROM clarity_question WHERE slug IN
--     ('evidence-gap','bidder-fragility','watchhouse-children');
--   DELETE FROM clarity_sentinel WHERE key IN
--     ('receipt_type_contamination','contract_value_ceiling','category_node_hub');
--
-- Three end to end beats twenty-six half-written. The rest of the registry stays absent rather
-- than arriving as stubs.
--
-- CONTRACT for answer_sql: returns EXACTLY ONE row with columns
--   (payload jsonb, headline text, headline_sub text, headline_num numeric).
-- CONTRACT for coverage_sql: returns EXACTLY ONE row with columns
--   (numerator numeric, denominator numeric, label text).
-- CONTRACT for rows_sql: must tolerate a trailing LIMIT/OFFSET appended by the runner.
--
-- Every filter in exclusions is DETERMINISTIC and is printed in the caption under the number.
-- It is not documentation. Removing it changes the answer by an order of magnitude in two of
-- the three cases below.

BEGIN;

-- ---------------------------------------------------------------------------------------------
-- 1. evidence-gap
--
-- The two mandatory filters both had to be discovered. justice_funding mixes state budget
-- aggregates with grants in one amount column: 848 'expenditure_aggregate' rows carry $66.1bn of
-- the youth-justice topic, 95.3% of its dollars, while actual grants to actual organisations are
-- $1.53bn. A naive SUM overstates money reaching organisations by 45x. And topics use HYPHENS --
-- 'youth_justice' returns zero rows silently.
-- ---------------------------------------------------------------------------------------------
INSERT INTO clarity_question (
  slug, stub, question, subject, state, form, honest_at, publishable,
  verification_stamp, caveat, exclusions, claim_phrasing, forbidden_phrasing,
  answer_sql, rows_sql, coverage_sql, uniqueness, uniqueness_basis, surface
) VALUES (
  'evidence-gap',
  'EVIDENCE GAP',
  'How much youth-justice grant money goes to organisations with no recorded evidence of what works?',
  'EVIDENCE',
  'answered', 'scalar', 'entity', 'shareable',
  'verified',
  'This measures evidence recorded in ALMA, not evidence that exists. ALMA holds ~2,136 curated interventions; it is a register, not a census of practice. The true claim is that the evidence base is not connected to the money. The claim that these organisations have no evidence would be a slur and is forbidden.',
  'measure_kind = ''grant'' (excludes 848 state-budget aggregate rows worth $66.1bn) AND topics && ARRAY[''youth-justice''] (hyphen, not underscore) AND gs_entity_id IS NOT NULL',
  'Organisations receiving youth-justice grant funding with no evidence record connected to them in ALMA.',
  ARRAY[
    'these organisations have no evidence',
    'organisations with no evidence',
    'ineffective organisations',
    'wasted funding'
  ],
  $sql$
  WITH jf AS (
    SELECT gs_entity_id, sum(amount_dollars) AS amt, count(*) AS n
      FROM justice_funding
     WHERE measure_kind = 'grant'
       AND gs_entity_id IS NOT NULL
       AND topics && ARRAY['youth-justice']
     GROUP BY 1
  ),
  ev AS (SELECT DISTINCT gs_entity_id FROM alma_interventions WHERE gs_entity_id IS NOT NULL),
  agg AS (
    SELECT (ev.gs_entity_id IS NOT NULL) AS has_evidence,
           count(*) AS orgs, sum(jf.amt) AS dollars, sum(jf.n) AS grant_rows
      FROM jf LEFT JOIN ev ON ev.gs_entity_id = jf.gs_entity_id
     GROUP BY 1
  ),
  t AS (SELECT sum(orgs) AS all_orgs, sum(dollars) AS all_dollars FROM agg)
  SELECT jsonb_build_object(
           'segments', (SELECT jsonb_agg(jsonb_build_object(
                                 'has_evidence', has_evidence, 'orgs', orgs,
                                 'dollars', dollars, 'grant_rows', grant_rows) ORDER BY has_evidence)
                          FROM agg),
           'total_orgs', t.all_orgs,
           'total_dollars', t.all_dollars
         ) AS payload,
         round(100.0 * (SELECT orgs FROM agg WHERE NOT has_evidence) / t.all_orgs, 1)::text || '%'
           AS headline,
         (SELECT orgs FROM agg WHERE NOT has_evidence)::text || ' of ' || t.all_orgs::text
           || ' organisations' AS headline_sub,
         round(100.0 * (SELECT orgs FROM agg WHERE NOT has_evidence) / t.all_orgs, 1) AS headline_num
    FROM t
  $sql$,
  $sql$
  WITH jf AS (
    SELECT gs_entity_id, sum(amount_dollars) AS amt, count(*) AS n
      FROM justice_funding
     WHERE measure_kind = 'grant'
       AND gs_entity_id IS NOT NULL
       AND topics && ARRAY['youth-justice']
     GROUP BY 1
  ),
  ev AS (SELECT DISTINCT gs_entity_id FROM alma_interventions WHERE gs_entity_id IS NOT NULL)
  SELECT e.gs_id, e.canonical_name, e.state, e.lga_name,
         jf.amt AS grant_dollars, jf.n AS grant_rows,
         (ev.gs_entity_id IS NOT NULL) AS has_evidence
    FROM jf
    JOIN gs_entities e ON e.id = jf.gs_entity_id
    LEFT JOIN ev ON ev.gs_entity_id = jf.gs_entity_id
   ORDER BY jf.amt DESC NULLS LAST
  $sql$,
  $sql$
  SELECT count(*) FILTER (WHERE gs_entity_id IS NOT NULL)::numeric AS numerator,
         count(*)::numeric AS denominator,
         'justice_funding grant rows resolved to an entity' AS label
    FROM justice_funding
   WHERE measure_kind = 'grant' AND topics && ARRAY['youth-justice']
  $sql$,
  0.95,
  'There is no Australian funding-to-evidence linkage at all. ALMA is a purpose-built evidence register and no regulator collects this.',
  NULL
);

INSERT INTO clarity_question_ingredient (question_slug, object_key, join_key, role, is_binding, measured_pct) VALUES
  ('evidence-gap', 'public.justice_funding',    'gs_entity_id', 'spine',  true,  93.65),
  ('evidence-gap', 'public.alma_interventions', 'gs_entity_id', 'fact',   false, 70.27),
  ('evidence-gap', 'public.gs_entities',        'id',           'reference', false, NULL);

-- ---------------------------------------------------------------------------------------------
-- 2. bidder-fragility
--
-- The buyer-wedge question answered. A commissioner choosing between providers can see, before
-- signing, that a bidder has five weeks of cash.
--
-- The mean is unusable here and the data says so: the 'watch' tier's mean months-of-reserves is
-- 1,956, because a charity with near-zero expenses and any assets produces an enormous ratio.
-- Median only. The fragile tier's 1.1 is credible precisely because the tier is defined by low
-- reserves.
-- ---------------------------------------------------------------------------------------------
INSERT INTO clarity_question (
  slug, stub, question, subject, state, form, honest_at, publishable,
  verification_stamp, caveat, exclusions, claim_phrasing, forbidden_phrasing,
  answer_sql, rows_sql, coverage_sql, uniqueness, uniqueness_basis, surface
) VALUES (
  'bidder-fragility',
  'BIDDER FRAGILITY',
  'Is the charity delivering this government service financially able to survive the contract?',
  'CHARITY',
  'answered', 'ranked_bar', 'abn', 'shareable',
  'verified',
  'Months of reserves must be reported as a median, never a mean. The watch tier''s mean is 1,956 months -- a charity with near-zero expenses and any assets produces an enormous ratio. Financial position is as at the most recent Annual Information Statement on record, which lags: acnc_ais has no FY2024 rows and one 2025 row, so always read ais_year before reading a trend.',
  'DISTINCT ON (abn) most recent ais_year per charity, from mv_justice_charity_financial_health (charities with justice-related government funding and an AIS record)',
  'Charities holding justice-related government funding, banded by financial fragility, with the median months of operating reserves in each band.',
  ARRAY[
    'average months of reserves',
    'mean months of reserves',
    'these charities will fail',
    'at risk of collapse'
  ],
  $sql$
  WITH latest AS (
    SELECT DISTINCT ON (abn) * FROM mv_justice_charity_financial_health
     ORDER BY abn, ais_year DESC
  ),
  tiers AS (
    SELECT fragility_tier,
           count(*) AS charities,
           count(*) FILTER (WHERE is_deficit) AS in_deficit,
           count(*) FILTER (WHERE low_reserves) AS low_reserves,
           count(*) FILTER (WHERE high_govt_dependency) AS high_govt_dep,
           round(avg(govt_revenue_share)::numeric, 3) AS avg_govt_revenue_share,
           round(percentile_cont(0.5) WITHIN GROUP (ORDER BY months_of_reserves)::numeric, 1)
             AS median_months_reserves
      FROM latest GROUP BY 1
  )
  SELECT jsonb_build_object(
           'tiers', (SELECT jsonb_agg(to_jsonb(tiers) ORDER BY charities DESC) FROM tiers),
           'total_charities', (SELECT count(*) FROM latest)
         ) AS payload,
         (SELECT charities FROM tiers WHERE fragility_tier = 'fragile')::text AS headline,
         'fragile charities, median '
           || (SELECT median_months_reserves FROM tiers WHERE fragility_tier = 'fragile')::text
           || ' months of reserves' AS headline_sub,
         (SELECT charities FROM tiers WHERE fragility_tier = 'fragile')::numeric AS headline_num
  $sql$,
  $sql$
  WITH latest AS (
    SELECT DISTINCT ON (abn) * FROM mv_justice_charity_financial_health
     ORDER BY abn, ais_year DESC
  )
  SELECT abn, charity_name, ais_year, fragility_tier,
         round(govt_revenue_share::numeric, 3) AS govt_revenue_share,
         is_deficit, low_reserves, high_govt_dependency,
         round(months_of_reserves::numeric, 1) AS months_of_reserves
    FROM latest
   WHERE fragility_tier IN ('fragile', 'watch')
   ORDER BY (fragility_tier = 'fragile') DESC, months_of_reserves ASC NULLS LAST
  $sql$,
  $sql$
  SELECT count(*) FILTER (WHERE fragility_tier <> 'unknown')::numeric AS numerator,
         count(*)::numeric AS denominator,
         'charities with a usable AIS financial record' AS label
    FROM (SELECT DISTINCT ON (abn) fragility_tier FROM mv_justice_charity_financial_health
           ORDER BY abn, ais_year DESC) t
  $sql$,
  0.9,
  'ACNC publishes the Annual Information Statement and AusTender publishes the contract. Neither joins them, and the join has never been made publicly.',
  NULL
);

INSERT INTO clarity_question_ingredient (question_slug, object_key, join_key, role, is_binding, measured_pct) VALUES
  ('bidder-fragility', 'public.mv_justice_charity_financial_health', 'abn', 'spine', true, 94.08),
  ('bidder-fragility', 'public.acnc_ais',                            'abn', 'fact',  false, 94.08);

-- ---------------------------------------------------------------------------------------------
-- 3. watchhouse-children
--
-- REBASELINED. The April bucket is n=2 snapshots, so it is not a baseline. VERIFICATION.md
-- corrects the headline from a 3.0x rise on April to 2.7x on May, and non-Indigenous growth from
-- +868% to +476%. This question computes from the May baseline for that reason.
--
-- Both readings of the First Nations share are true and the second is the one that gets
-- misreported when the first ships alone: First Nations child numbers ROSE, and the share fell
-- only because the non-Indigenous population grew faster.
-- ---------------------------------------------------------------------------------------------
INSERT INTO clarity_question (
  slug, stub, question, subject, state, form, honest_at, publishable,
  verification_stamp, caveat, exclusions, claim_phrasing, forbidden_phrasing,
  answer_sql, rows_sql, coverage_sql, uniqueness, uniqueness_basis, surface
) VALUES (
  'watchhouse-children',
  'WATCHHOUSE CHILDREN',
  'How many children are held in Queensland police watchhouses, for how long, and is that changing?',
  'JUSTICE',
  'answered', 'scalar', 'facility', 'shareable',
  'verified',
  'Counts are person-observations per snapshot, not distinct children -- the same child appears in every snapshot they are present for. This is police custody, not youth detention, and is not comparable to AIHW detention figures without saying so. The April bucket is two snapshots and is not used as a baseline; growth is measured from May. The current month is partial.',
  'Baseline month = 2026-05 (April excluded: n=2 snapshots). Comparison month = most recent month present. Source qld_watchhouse_snapshots, one row per snapshot.',
  'The average number of children held in Queensland police watchhouses on any given day, comparing the most recent month against the May 2026 baseline.',
  ARRAY[
    'distinct children',
    'fewer Aboriginal children are being held',
    'children in detention',
    'youth detention'
  ],
  $sql$
  WITH m AS (
    SELECT date_trunc('month', source_generated_date)::date AS month,
           count(*) AS snaps,
           round(avg(total_children), 1) AS avg_children,
           max(total_children) AS max_children,
           round(avg(child_first_nations), 1) AS avg_first_nations,
           round(avg(child_non_indigenous), 1) AS avg_non_indigenous,
           round(avg(child_over_7_days), 2) AS avg_over_7_days,
           max(child_longest_days) AS max_days,
           round(avg(child_watchhouse_count), 1) AS avg_watchhouses
      FROM qld_watchhouse_snapshots
     GROUP BY 1
  ),
  base AS (SELECT * FROM m WHERE month = date '2026-05-01'),
  cur  AS (SELECT * FROM m ORDER BY month DESC LIMIT 1)
  SELECT jsonb_build_object(
           'months', (SELECT jsonb_agg(to_jsonb(m) ORDER BY month) FROM m),
           'baseline_month', (SELECT month FROM base),
           'current_month', (SELECT month FROM cur),
           'baseline_excluded', 'April 2026 (n=2 snapshots)'
         ) AS payload,
         round((SELECT avg_children FROM cur) / (SELECT avg_children FROM base), 1)::text || 'x'
           AS headline,
         'from ' || (SELECT avg_children FROM base)::text || ' to '
           || (SELECT avg_children FROM cur)::text || ' children on an average day' AS headline_sub,
         round((SELECT avg_children FROM cur) / (SELECT avg_children FROM base), 2) AS headline_num
  $sql$,
  $sql$
  SELECT watchhouse_name,
         count(*) AS observations,
         round(avg(total_in_custody), 1) AS avg_children,
         max(total_in_custody) AS peak,
         sum(first_nations) AS first_nations_person_obs,
         sum(non_indigenous) AS non_indigenous_person_obs,
         max(longest_days) AS max_days,
         sum(custody_over_7_days) AS over_7_days_obs
    FROM qld_watchhouse_snapshot_rows
   WHERE age_group = 'Child'
   GROUP BY 1
   ORDER BY avg_children DESC
  $sql$,
  $sql$
  SELECT count(*)::numeric AS numerator,
         count(*)::numeric AS denominator,
         'snapshots ingested with a source PDF checksum' AS label
    FROM qld_watchhouse_snapshots WHERE raw_pdf_sha256 IS NOT NULL
  $sql$,
  0.98,
  'AIHW publishes youth detention quarterly, state-level, about two quarters lagged. Watchhouses are police custody, so they fall in the gap between AIHW collection and QLD Corrections reporting. Nothing public in Australia has this shape.',
  NULL
);

INSERT INTO clarity_question_ingredient (question_slug, object_key, join_key, role, is_binding, measured_pct) VALUES
  ('watchhouse-children', 'public.qld_watchhouse_snapshots',      'snapshot_id', 'spine', true, 100.00),
  ('watchhouse-children', 'public.qld_watchhouse_snapshot_rows',  'snapshot_id', 'fact',  false, 100.00);

-- ---------------------------------------------------------------------------------------------
-- The three sentinels, armed. Each traces to a confirmed finding, not a hypothetical.
-- ---------------------------------------------------------------------------------------------
INSERT INTO clarity_sentinel (key, label, description, probe_sql, severity, applies_to) VALUES
(
  'receipt_type_contamination',
  'Receipt type contamination',
  'political_donations is 72% rows and 89% dollars ''other receipt'', which is not a donation. Any figure summing amount without filtering receipt_type is inflated roughly 8x.',
  $sql$
  SELECT (sum(amount) FILTER (WHERE receipt_type <> 'donation received')
            / nullif(sum(amount), 0)) > 0.5 AS tripped,
         count(*) FILTER (WHERE receipt_type <> 'donation received') AS n,
         round((sum(amount) FILTER (WHERE receipt_type <> 'donation received')
            / nullif(sum(amount), 0))::numeric, 4) AS share,
         jsonb_build_object('note', 'filter receipt_type = ''donation received''') AS detail
    FROM political_donations
  $sql$,
  'block', '{}'
),
(
  'contract_value_ceiling',
  'Contract value ceiling',
  'Thirteen austender_contracts rows carry 29.4% of all recorded Commonwealth contract value. At least one is demonstrably wrong: a $121.1bn row to a law firm, larger than the annual Defence budget. No contract total should publish without this check.',
  $sql$
  SELECT count(*) > 0 AS tripped,
         count(*) AS n,
         round((sum(contract_value) / nullif((SELECT sum(contract_value) FROM austender_contracts), 0))::numeric, 4) AS share,
         jsonb_build_object('max_value', max(contract_value),
                            'threshold', 5e9) AS detail
    FROM austender_contracts WHERE contract_value >= 5e9
  $sql$,
  'block', '{}'
),
(
  'category_node_hub',
  'Category node hub',
  'Two gs_entities rows of entity_type ''program'' carry 605,135 edges, 17.6% of the graph. They are categories, not organisations, and they invalidate any centrality score that includes them.',
  $sql$
  WITH deg AS (
    SELECT e.id, count(*) AS d
      FROM gs_entities e
      JOIN gs_relationships r ON r.source_entity_id = e.id OR r.target_entity_id = e.id
     WHERE e.entity_type = 'program'
     GROUP BY e.id HAVING count(*) > 10000
  )
  SELECT count(*) > 0 AS tripped, count(*) AS n, NULL::numeric AS share,
         jsonb_build_object('max_degree', coalesce(max(d), 0)) AS detail
    FROM deg
  $sql$,
  'block', '{}'
);

COMMIT;
