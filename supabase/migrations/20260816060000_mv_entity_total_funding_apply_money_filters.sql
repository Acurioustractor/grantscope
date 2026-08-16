-- mv_entity_total_funding: apply the two mandatory money filters it never had.
--
-- Apply:
--   source .env && PGPASSWORD="$DATABASE_PASSWORD" psql -h aws-0-ap-southeast-2.pooler.supabase.com \
--     -p 5432 -U "postgres.tednluwflfhxyucgwigh" -d postgres \
--     -f supabase/migrations/20260816060000_mv_entity_total_funding_apply_money_filters.sql
--
-- WHY
--
-- This matview is the base of the power-index chain: 28 app files read mv_entity_total_funding or
-- mv_entity_power_index, and 19 read mv_revolving_door. It violated BOTH filters CLAUDE.md
-- documents as mandatory:
--
--   justice CTE    joined justice_funding with no measure_kind, no is_aggregate, no name check
--                    $77.08bn -> $31.59bn        2.4x overstated
--   donations CTE  joined political_donations with no receipt_type
--                    $77.99bn -> $12.00bn        6.5x overstated
--
-- $111.48bn of phantom money in one matview, on both of the two columns that carry a filter rule.
--
-- The definition lived ONLY in the database — scripts/refresh-total-funding-mv.mjs only refreshes
-- it. This migration is now its source of truth.
--
-- WHAT THIS DOES NOT FIX, deliberately
--
-- `justice_total` will still show QUEENSLAND RAIL LTD at roughly $4.1bn, because those 13 rows are
-- genuine `measure_kind = 'grant'`, non-aggregate, real-recipient records — Transport Service
-- Contracts and a Rail Concession Scheme from `qgip`, a whole-of-Queensland-government grants
-- register. They survive every money filter because they are real grants. They are simply not
-- justice.
--
-- That is a NAMING defect, not a filtering one, and it cannot be fixed by scoping to topics:
-- 100,690 of 125,315 grant rows (80.3%) carry no topic tag at all, and `qgip` alone is 101,579 of
-- them. Topic-scoping this column would drop four fifths of the legitimate records to remove one
-- wrong headline.
--
-- So the column keeps its name for the 28 callers, gains a COMMENT saying what it actually holds,
-- and the rename is left as a decision rather than smuggled into a filter fix.
--
-- Audit: thoughts/shared/data-map/justice-funding-filter-audit.md

BEGIN;

DROP MATERIALIZED VIEW IF EXISTS public.mv_entity_total_funding;

CREATE MATERIALIZED VIEW public.mv_entity_total_funding AS
 WITH grants AS (
         SELECT e.id AS entity_id,
            e.gs_id,
            e.canonical_name,
            e.abn,
            'grant'::text AS funding_type,
            e.state,
            e.postcode,
            e.remoteness,
            e.sector,
            e.is_community_controlled,
            count(DISTINCT r.id) AS record_count,
            COALESCE(sum(r.amount), 0::numeric) AS total_amount,
            min(r.start_date) AS earliest_date,
            max(r.last_seen) AS latest_date
           FROM gs_entities e
             JOIN gs_relationships r ON r.target_entity_id = e.id
          WHERE r.relationship_type = 'funder_to_recipient'::text AND r.amount IS NOT NULL
          GROUP BY e.id, e.gs_id, e.canonical_name, e.abn, e.state, e.postcode, e.remoteness, e.sector, e.is_community_controlled
        ), contracts AS (
         SELECT e.id AS entity_id,
            e.gs_id,
            e.canonical_name,
            e.abn,
            'contract'::text AS funding_type,
            e.state,
            e.postcode,
            e.remoteness,
            e.sector,
            e.is_community_controlled,
            count(DISTINCT ac.id) AS record_count,
            COALESCE(sum(ac.contract_value), 0::numeric) AS total_amount,
            min(ac.contract_start) AS earliest_date,
            max(ac.contract_end) AS latest_date
           FROM gs_entities e
             JOIN austender_contracts ac ON ac.supplier_abn = e.abn
          WHERE e.abn IS NOT NULL
          GROUP BY e.id, e.gs_id, e.canonical_name, e.abn, e.state, e.postcode, e.remoteness, e.sector, e.is_community_controlled
        ), justice AS (
         SELECT e.id AS entity_id,
            e.gs_id,
            e.canonical_name,
            e.abn,
            'justice_funding'::text AS funding_type,
            e.state,
            e.postcode,
            e.remoteness,
            e.sector,
            e.is_community_controlled,
            count(DISTINCT jf.id) AS record_count,
            COALESCE(sum(jf.amount_dollars), 0::numeric) AS total_amount,
            NULL::date AS earliest_date,
            NULL::date AS latest_date
           FROM gs_entities e
             JOIN justice_funding jf ON jf.recipient_abn = e.abn
          WHERE e.abn IS NOT NULL
            AND jf.measure_kind = 'grant'
            AND jf.is_aggregate IS NOT TRUE
            AND lower(btrim(jf.recipient_name)) <> ALL (ARRAY['total','totals','grand total','subtotal','sub-total','various','n/a','na','unknown','tbc','other'])
          GROUP BY e.id, e.gs_id, e.canonical_name, e.abn, e.state, e.postcode, e.remoteness, e.sector, e.is_community_controlled
        ), donations AS (
         SELECT e.id AS entity_id,
            e.gs_id,
            e.canonical_name,
            e.abn,
            'political_donation'::text AS funding_type,
            e.state,
            e.postcode,
            e.remoteness,
            e.sector,
            e.is_community_controlled,
            count(DISTINCT pd.id) AS record_count,
            COALESCE(sum(pd.amount), 0::numeric) AS total_amount,
            NULL::date AS earliest_date,
            NULL::date AS latest_date
           FROM gs_entities e
             JOIN political_donations pd ON pd.donor_abn = e.abn
          WHERE e.abn IS NOT NULL
            AND pd.receipt_type = 'donation received'
          GROUP BY e.id, e.gs_id, e.canonical_name, e.abn, e.state, e.postcode, e.remoteness, e.sector, e.is_community_controlled
        ), all_sources AS (
         SELECT grants.entity_id,
            grants.gs_id,
            grants.canonical_name,
            grants.abn,
            grants.funding_type,
            grants.state,
            grants.postcode,
            grants.remoteness,
            grants.sector,
            grants.is_community_controlled,
            grants.record_count,
            grants.total_amount,
            grants.earliest_date,
            grants.latest_date
           FROM grants
        UNION ALL
         SELECT contracts.entity_id,
            contracts.gs_id,
            contracts.canonical_name,
            contracts.abn,
            contracts.funding_type,
            contracts.state,
            contracts.postcode,
            contracts.remoteness,
            contracts.sector,
            contracts.is_community_controlled,
            contracts.record_count,
            contracts.total_amount,
            contracts.earliest_date,
            contracts.latest_date
           FROM contracts
        UNION ALL
         SELECT justice.entity_id,
            justice.gs_id,
            justice.canonical_name,
            justice.abn,
            justice.funding_type,
            justice.state,
            justice.postcode,
            justice.remoteness,
            justice.sector,
            justice.is_community_controlled,
            justice.record_count,
            justice.total_amount,
            justice.earliest_date,
            justice.latest_date
           FROM justice
        UNION ALL
         SELECT donations.entity_id,
            donations.gs_id,
            donations.canonical_name,
            donations.abn,
            donations.funding_type,
            donations.state,
            donations.postcode,
            donations.remoteness,
            donations.sector,
            donations.is_community_controlled,
            donations.record_count,
            donations.total_amount,
            donations.earliest_date,
            donations.latest_date
           FROM donations
        )
 SELECT entity_id,
    gs_id,
    canonical_name,
    abn,
    state,
    postcode,
    remoteness,
    sector,
    is_community_controlled,
    COALESCE(sum(
        CASE
            WHEN funding_type = 'grant'::text THEN total_amount
            ELSE NULL::numeric
        END), 0::numeric) AS grants_total,
    COALESCE(sum(
        CASE
            WHEN funding_type = 'contract'::text THEN total_amount
            ELSE NULL::numeric
        END), 0::numeric) AS contracts_total,
    COALESCE(sum(
        CASE
            WHEN funding_type = 'justice_funding'::text THEN total_amount
            ELSE NULL::numeric
        END), 0::numeric) AS justice_total,
    COALESCE(sum(
        CASE
            WHEN funding_type = 'political_donation'::text THEN total_amount
            ELSE NULL::numeric
        END), 0::numeric) AS donations_total,
    COALESCE(sum(
        CASE
            WHEN funding_type = 'grant'::text THEN record_count
            ELSE NULL::bigint
        END), 0::numeric)::integer AS grants_count,
    COALESCE(sum(
        CASE
            WHEN funding_type = 'contract'::text THEN record_count
            ELSE NULL::bigint
        END), 0::numeric)::integer AS contracts_count,
    COALESCE(sum(
        CASE
            WHEN funding_type = 'justice_funding'::text THEN record_count
            ELSE NULL::bigint
        END), 0::numeric)::integer AS justice_count,
    COALESCE(sum(
        CASE
            WHEN funding_type = 'political_donation'::text THEN record_count
            ELSE NULL::bigint
        END), 0::numeric)::integer AS donations_count,
    sum(total_amount) AS grand_total_funding,
    sum(record_count)::integer AS grand_total_records,
    count(DISTINCT funding_type) AS funding_source_diversity,
    now() AS computed_at
   FROM all_sources
  GROUP BY entity_id, gs_id, canonical_name, abn, state, postcode, remoteness, sector, is_community_controlled;

-- The unique index is not optional: REFRESH MATERIALIZED VIEW CONCURRENTLY requires one, and
-- scripts/refresh-total-funding-mv.mjs refreshes concurrently on the nightly cron.
CREATE UNIQUE INDEX mv_entity_total_funding_entity_id_idx
  ON public.mv_entity_total_funding USING btree (entity_id);
CREATE INDEX mv_entity_total_funding_abn_idx
  ON public.mv_entity_total_funding USING btree (abn) WHERE (abn IS NOT NULL);
CREATE INDEX mv_entity_total_funding_gs_id_idx
  ON public.mv_entity_total_funding USING btree (gs_id);
CREATE INDEX mv_entity_total_funding_grand_total_funding_idx
  ON public.mv_entity_total_funding USING btree (grand_total_funding DESC);
CREATE INDEX mv_entity_total_funding_state_remoteness_idx
  ON public.mv_entity_total_funding USING btree (state, remoteness);
CREATE INDEX mv_entity_total_funding_is_community_controlled_idx
  ON public.mv_entity_total_funding USING btree (is_community_controlled)
  WHERE (is_community_controlled = true);

COMMENT ON MATERIALIZED VIEW public.mv_entity_total_funding IS
  'Per-entity funding rollup. justice_total is money from the justice_funding TABLE, which is 81% '
  'a whole-of-Queensland-government grants register (source qgip) and only 19.7% topic-tagged — it '
  'is NOT a justice figure, and Queensland Rail appears in it for transport service contracts. '
  'Money filters applied 2026-08-16: measure_kind/is_aggregate/recipient_name on justice, '
  'receipt_type on donations. See thoughts/shared/data-map/justice-funding-filter-audit.md';

COMMIT;

-- VERIFY (expect justice ~31.59bn and donations ~12.00bn, down from 77.08 and 77.99):
--   SELECT round(sum(justice_total)/1e9,2) AS justice_bn,
--          round(sum(donations_total)/1e9,2) AS donations_bn
--     FROM mv_entity_total_funding;
-- And the top justice entities should no longer include a $10bn department:
--   SELECT canonical_name, round(justice_total/1e9,2) FROM mv_entity_total_funding
--    ORDER BY justice_total DESC NULLS LAST LIMIT 6;
