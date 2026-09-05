-- Dual-name transition, step 2 of 2: DROP the deprecated justice_* names.
--
-- DO NOT APPLY until the Vercel deploy of app commit a77c605/e73ea9e is verified live —
-- production must be reading recorded_grants_* before the old names disappear.
--
-- Apply:
--   source .env && PGPASSWORD="$DATABASE_PASSWORD" psql -h aws-0-ap-southeast-2.pooler.supabase.com \
--     -p 5432 -U "postgres.tednluwflfhxyucgwigh" -d postgres \
--     -f supabase/migrations/20260816100000_drop_deprecated_justice_names.sql
--
-- Derived from 20260816090000: the wrappers are removed and the canonical names are set at the
-- alias sites, so justice_total, justice_count, justice_dollars, justice_record_count,
-- distinct_justice_programs, justice_states and in_justice_funding cease to exist on the two
-- matviews. Dependent views keep their own OUTPUT column names (mv_funding_deserts.justice_dollars,
-- mv_board_interlocks.total_justice_dollars, v_goods_relationship_power.in_justice_funding) —
-- renaming those is a separate decision with its own consumers; only their INTERNAL references
-- to the power index are updated. goods-relationship-power.ts depends on that: it deliberately
-- still reads in_justice_funding from the view.

BEGIN;

-- A ── mv_entity_total_funding (0 dependents) ---------------------------------------------------
DROP MATERIALIZED VIEW public.mv_entity_total_funding;

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
        END), 0::numeric) AS recorded_grants_total,
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
        END), 0::numeric)::integer AS recorded_grants_count,
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

GRANT SELECT ON public.mv_entity_total_funding TO agent_readonly;

COMMENT ON MATERIALIZED VIEW public.mv_entity_total_funding IS
  'Per-entity funding rollup. recorded_grants_total is money from the justice_funding TABLE — '
  '81% the whole-of-QLD qgip register, 19.7% topic-tagged; NOT a justice figure. Renamed from '
  'justice_total 2026-08-16. Money filters applied at the same time. '
  'See thoughts/shared/data-map/justice-funding-filter-audit.md';
COMMENT ON COLUMN public.mv_entity_total_funding.recorded_grants_total IS
  'Grant dollars from justice_funding after the mandatory filters.';

-- B ── the mv_entity_power_index chain (object 1 patched, 2-9 verbatim from 20260816080000) -----
DROP MATERIALIZED VIEW public.mv_entity_power_index CASCADE;

CREATE MATERIALIZED VIEW public.mv_entity_power_index AS
 WITH procurement_ids AS (
         SELECT DISTINCT e.id AS entity_id
           FROM austender_contracts ac
             JOIN gs_entities e ON e.abn = ac.supplier_abn
          WHERE ac.supplier_abn IS NOT NULL
        ), justice_ids AS (
         SELECT DISTINCT justice_funding.gs_entity_id AS entity_id
           FROM justice_funding
          WHERE justice_funding.gs_entity_id IS NOT NULL AND justice_funding.measure_kind = 'grant' AND justice_funding.is_aggregate IS NOT TRUE AND lower(btrim(justice_funding.recipient_name)) <> ALL (ARRAY['total','totals','grand total','subtotal','sub-total','various','n/a','na','unknown','tbc','other'])
        ), donation_ids AS (
         SELECT DISTINCT e.id AS entity_id
           FROM political_donations pd
             JOIN gs_entities e ON e.abn = pd.donor_abn
          WHERE pd.donor_abn IS NOT NULL AND pd.receipt_type = 'donation received'
        ), charity_ids AS (
         SELECT DISTINCT e.id AS entity_id
           FROM acnc_charities ac
             JOIN gs_entities e ON e.abn = ac.abn
          WHERE ac.abn IS NOT NULL
        ), foundation_ids AS (
         SELECT DISTINCT e.id AS entity_id
           FROM foundations f_1
             JOIN gs_entities e ON e.abn = f_1.acnc_abn
          WHERE f_1.acnc_abn IS NOT NULL
        ), alma_ids AS (
         SELECT DISTINCT alma_interventions.gs_entity_id AS entity_id
           FROM alma_interventions
          WHERE alma_interventions.gs_entity_id IS NOT NULL
        ), ato_ids AS (
         SELECT DISTINCT e.id AS entity_id
           FROM ato_tax_transparency att
             JOIN gs_entities e ON e.abn = att.abn
          WHERE att.abn IS NOT NULL
        ), ndis_ids AS (
         SELECT DISTINCT e.id AS entity_id
           FROM ndis_registered_providers nrp
             JOIN gs_entities e ON e.abn = nrp.abn
          WHERE nrp.abn IS NOT NULL AND nrp.registration_status = 'Approved'::text
        ), universe AS (
         SELECT procurement_ids.entity_id
           FROM procurement_ids
        UNION
         SELECT justice_ids.entity_id
           FROM justice_ids
        UNION
         SELECT donation_ids.entity_id
           FROM donation_ids
        UNION
         SELECT charity_ids.entity_id
           FROM charity_ids
        UNION
         SELECT foundation_ids.entity_id
           FROM foundation_ids
        UNION
         SELECT alma_ids.entity_id
           FROM alma_ids
        UNION
         SELECT ato_ids.entity_id
           FROM ato_ids
        UNION
         SELECT ndis_ids.entity_id
           FROM ndis_ids
        ), procurement AS (
         SELECT e.id AS entity_id,
            count(*) AS contract_count,
            COALESCE(sum(ac.contract_value), 0::numeric) AS procurement_dollars,
            count(DISTINCT ac.buyer_name) AS distinct_buyers,
            array_agg(DISTINCT EXTRACT(year FROM ac.contract_start)::integer ORDER BY (EXTRACT(year FROM ac.contract_start)::integer)) FILTER (WHERE ac.contract_start IS NOT NULL) AS procurement_years
           FROM austender_contracts ac
             JOIN gs_entities e ON e.abn = ac.supplier_abn
          WHERE ac.supplier_abn IS NOT NULL AND (e.id IN ( SELECT universe.entity_id
                   FROM universe))
          GROUP BY e.id
        ), justice AS (
         SELECT justice_funding.gs_entity_id AS entity_id,
            count(*) AS justice_count,
            COALESCE(sum(justice_funding.amount_dollars), 0::numeric) AS justice_dollars,
            count(DISTINCT justice_funding.program_name) AS distinct_programs,
            array_agg(DISTINCT justice_funding.state ORDER BY justice_funding.state) FILTER (WHERE justice_funding.state IS NOT NULL) AS justice_states
           FROM justice_funding
          WHERE justice_funding.gs_entity_id IS NOT NULL AND justice_funding.measure_kind = 'grant' AND justice_funding.is_aggregate IS NOT TRUE AND lower(btrim(justice_funding.recipient_name)) <> ALL (ARRAY['total','totals','grand total','subtotal','sub-total','various','n/a','na','unknown','tbc','other']) AND (justice_funding.gs_entity_id IN ( SELECT universe.entity_id
                   FROM universe))
          GROUP BY justice_funding.gs_entity_id
        ), donations AS (
         SELECT e.id AS entity_id,
            count(*) AS donation_count,
            COALESCE(sum(pd.amount), 0::numeric) AS donation_dollars,
            array_agg(DISTINCT pd.donation_to ORDER BY pd.donation_to) FILTER (WHERE pd.donation_to IS NOT NULL) AS parties_funded,
            count(DISTINCT pd.donation_to) AS distinct_parties
           FROM political_donations pd
             JOIN gs_entities e ON e.abn = pd.donor_abn
          WHERE pd.donor_abn IS NOT NULL AND pd.receipt_type = 'donation received' AND (e.id IN ( SELECT universe.entity_id
                   FROM universe))
          GROUP BY e.id
        ), charity AS (
         SELECT e.id AS entity_id,
            ac.charity_size,
            ac.purposes,
            ac.beneficiaries
           FROM acnc_charities ac
             JOIN gs_entities e ON e.abn = ac.abn
          WHERE ac.abn IS NOT NULL AND (e.id IN ( SELECT universe.entity_id
                   FROM universe))
        ), foundation AS (
         SELECT e.id AS entity_id,
            f_1.total_giving_annual,
            f_1.thematic_focus,
            f_1.geographic_focus
           FROM foundations f_1
             JOIN gs_entities e ON e.abn = f_1.acnc_abn
          WHERE f_1.acnc_abn IS NOT NULL AND (e.id IN ( SELECT universe.entity_id
                   FROM universe))
        ), alma AS (
         SELECT alma_interventions.gs_entity_id AS entity_id,
            count(*) AS intervention_count,
            array_agg(DISTINCT alma_interventions.type ORDER BY alma_interventions.type) FILTER (WHERE alma_interventions.type IS NOT NULL) AS intervention_types,
            avg(alma_interventions.portfolio_score) AS avg_evidence_score
           FROM alma_interventions
          WHERE alma_interventions.gs_entity_id IS NOT NULL AND (alma_interventions.gs_entity_id IN ( SELECT universe.entity_id
                   FROM universe))
          GROUP BY alma_interventions.gs_entity_id
        ), ato AS (
         SELECT e.id AS entity_id,
            att.total_income AS ato_total_income,
            att.taxable_income AS ato_taxable_income,
            att.tax_payable AS ato_tax_payable,
            att.report_year AS ato_year
           FROM ato_tax_transparency att
             JOIN gs_entities e ON e.abn = att.abn
          WHERE att.abn IS NOT NULL AND (e.id IN ( SELECT universe.entity_id
                   FROM universe))
        ), ndis AS (
         SELECT e.id AS entity_id,
            count(DISTINCT nrp.provider_detail_id) AS ndis_provider_count,
            array_agg(DISTINCT nrp.state_code ORDER BY nrp.state_code) FILTER (WHERE nrp.state_code IS NOT NULL) AS ndis_states
           FROM ndis_registered_providers nrp
             JOIN gs_entities e ON e.abn = nrp.abn
          WHERE nrp.abn IS NOT NULL AND nrp.registration_status = 'Approved'::text AND (e.id IN ( SELECT universe.entity_id
                   FROM universe))
          GROUP BY e.id
        ), boards AS (
         SELECT gs_relationships.target_entity_id AS entity_id,
            count(*) AS board_connections,
            count(DISTINCT gs_relationships.source_entity_id) AS distinct_directors
           FROM gs_relationships
          WHERE (gs_relationships.relationship_type = ANY (ARRAY['directorship'::text, 'member_of'::text])) AND (gs_relationships.target_entity_id IN ( SELECT universe.entity_id
                   FROM universe))
          GROUP BY gs_relationships.target_entity_id
        )
 SELECT ge.id,
    ge.gs_id,
    ge.canonical_name,
    ge.entity_type,
    ge.abn,
    ge.state,
    ge.postcode,
    ge.remoteness,
    ge.seifa_irsd_decile,
    ge.is_community_controlled,
    ge.lga_name,
    (p.entity_id IS NOT NULL)::integer AS in_procurement,
    (j.entity_id IS NOT NULL)::integer AS in_recorded_grants,
    (d.entity_id IS NOT NULL)::integer AS in_political_donations,
    (c.entity_id IS NOT NULL)::integer AS in_charity_registry,
    (f.entity_id IS NOT NULL)::integer AS in_foundation,
    (a.entity_id IS NOT NULL)::integer AS in_alma_evidence,
    (t.entity_id IS NOT NULL)::integer AS in_ato_transparency,
    (n.entity_id IS NOT NULL)::integer AS in_ndis_provider,
    (b.entity_id IS NOT NULL)::integer AS has_board_links,
    (p.entity_id IS NOT NULL)::integer + (j.entity_id IS NOT NULL)::integer + (d.entity_id IS NOT NULL)::integer + (c.entity_id IS NOT NULL)::integer + (f.entity_id IS NOT NULL)::integer + (a.entity_id IS NOT NULL)::integer + (t.entity_id IS NOT NULL)::integer + (n.entity_id IS NOT NULL)::integer AS system_count,
    COALESCE(p.procurement_dollars, 0::numeric) AS procurement_dollars,
    COALESCE(j.justice_dollars, 0::numeric) AS recorded_grants_dollars,
    COALESCE(d.donation_dollars, 0::numeric) AS donation_dollars,
    COALESCE(f.total_giving_annual, 0::numeric) AS foundation_giving,
    COALESCE(t.ato_total_income, 0::numeric) AS ato_income,
    COALESCE(p.procurement_dollars, 0::numeric) + COALESCE(j.justice_dollars, 0::numeric) + COALESCE(d.donation_dollars, 0::numeric) AS total_dollar_flow,
    COALESCE(p.contract_count, 0::bigint) AS contract_count,
    COALESCE(j.justice_count, 0::bigint) AS recorded_grants_count,
    COALESCE(d.donation_count, 0::bigint) AS donation_count,
    COALESCE(a.intervention_count, 0::bigint) AS alma_intervention_count,
    COALESCE(n.ndis_provider_count, 0::bigint) AS ndis_provider_count,
    COALESCE(b.board_connections, 0::bigint) AS board_connections,
    COALESCE(p.distinct_buyers, 0::bigint) AS distinct_govt_buyers,
    COALESCE(j.distinct_programs, 0::bigint) AS distinct_grant_programs,
    COALESCE(d.distinct_parties, 0::bigint) AS distinct_parties_funded,
    COALESCE(b.distinct_directors, 0::bigint) AS distinct_directors,
    c.charity_size,
    d.parties_funded,
    a.intervention_types AS alma_types,
    a.avg_evidence_score,
    j.justice_states AS recorded_grants_states,
    n.ndis_states,
    (p.entity_id IS NOT NULL)::integer * 2 + (j.entity_id IS NOT NULL)::integer * 2 + (d.entity_id IS NOT NULL)::integer * 3 + (c.entity_id IS NOT NULL)::integer * 1 + (f.entity_id IS NOT NULL)::integer * 2 + (a.entity_id IS NOT NULL)::integer * 1 + (t.entity_id IS NOT NULL)::integer * 1 + (n.entity_id IS NOT NULL)::integer * 2 + LEAST(COALESCE(b.board_connections, 0::bigint), 5::bigint) +
        CASE
            WHEN COALESCE(p.procurement_dollars, 0::numeric) > 10000000::numeric THEN 2
            WHEN COALESCE(p.procurement_dollars, 0::numeric) > 1000000::numeric THEN 1
            ELSE 0
        END +
        CASE
            WHEN COALESCE(d.donation_dollars, 0::numeric) > 100000::numeric THEN 2
            WHEN COALESCE(d.donation_dollars, 0::numeric) > 10000::numeric THEN 1
            ELSE 0
        END AS power_score
   FROM universe u
     JOIN gs_entities ge ON ge.id = u.entity_id
     LEFT JOIN procurement p ON p.entity_id = u.entity_id
     LEFT JOIN justice j ON j.entity_id = u.entity_id
     LEFT JOIN donations d ON d.entity_id = u.entity_id
     LEFT JOIN charity c ON c.entity_id = u.entity_id
     LEFT JOIN foundation f ON f.entity_id = u.entity_id
     LEFT JOIN alma a ON a.entity_id = u.entity_id
     LEFT JOIN LATERAL ( SELECT ato.entity_id,
            ato.ato_total_income,
            ato.ato_taxable_income,
            ato.ato_tax_payable,
            ato.ato_year
           FROM ato
          WHERE ato.entity_id = u.entity_id
          ORDER BY ato.ato_year DESC
         LIMIT 1) t ON true
     LEFT JOIN ndis n ON n.entity_id = u.entity_id
     LEFT JOIN boards b ON b.entity_id = u.entity_id;

CREATE INDEX idx_mv_epi_state_type_remote_grants ON public.mv_entity_power_index USING btree (state, entity_type, remoteness, recorded_grants_dollars DESC) INCLUDE (gs_id, canonical_name, postcode, is_community_controlled) WHERE (recorded_grants_dollars > (0)::numeric);
CREATE UNIQUE INDEX idx_mv_epi_id ON public.mv_entity_power_index USING btree (id);
CREATE INDEX idx_mv_epi_system_count ON public.mv_entity_power_index USING btree (system_count DESC);
CREATE INDEX idx_mv_epi_power_score ON public.mv_entity_power_index USING btree (power_score DESC);
CREATE INDEX idx_mv_epi_entity_type ON public.mv_entity_power_index USING btree (entity_type);
CREATE INDEX idx_mv_epi_abn ON public.mv_entity_power_index USING btree (abn) WHERE (abn IS NOT NULL);
CREATE INDEX idx_mv_epi_community ON public.mv_entity_power_index USING btree (is_community_controlled) WHERE (is_community_controlled = true);
GRANT ALL ON public.mv_entity_power_index TO service_role;
GRANT SELECT ON public.mv_entity_power_index TO agent_readonly;

-- 2 ---------------------------------------------------------------------------------------------
CREATE MATERIALIZED VIEW public.mv_funding_deserts AS
 WITH lga_power AS (
         SELECT mv_entity_power_index.lga_name,
            mv_entity_power_index.state,
            count(*) AS entity_count,
            count(*) FILTER (WHERE mv_entity_power_index.is_community_controlled) AS community_controlled_count,
            avg(mv_entity_power_index.system_count) AS avg_system_count,
            avg(mv_entity_power_index.power_score) AS avg_power_score,
            max(mv_entity_power_index.system_count) AS max_system_count,
            sum(mv_entity_power_index.procurement_dollars) AS total_procurement,
            sum(mv_entity_power_index.recorded_grants_dollars) AS total_justice,
            sum(mv_entity_power_index.donation_dollars) AS total_donations,
            sum(mv_entity_power_index.total_dollar_flow) AS total_flow,
            count(*) FILTER (WHERE mv_entity_power_index.in_procurement = 1) AS procurement_entities,
            count(*) FILTER (WHERE mv_entity_power_index.in_recorded_grants = 1) AS justice_entities,
            count(*) FILTER (WHERE mv_entity_power_index.in_political_donations = 1) AS donation_entities,
            count(*) FILTER (WHERE mv_entity_power_index.in_foundation = 1) AS foundation_entities,
            count(*) FILTER (WHERE mv_entity_power_index.in_alma_evidence = 1) AS alma_entities,
            count(*) FILTER (WHERE mv_entity_power_index.in_ndis_provider = 1) AS ndis_entities,
            count(*) FILTER (WHERE mv_entity_power_index.system_count >= 3) AS multi_system_entities
           FROM mv_entity_power_index
          WHERE mv_entity_power_index.lga_name IS NOT NULL
          GROUP BY mv_entity_power_index.lga_name, mv_entity_power_index.state
        ), lga_disadvantage AS (
         SELECT pg.lga_name,
            pg.state,
            pg.remoteness_2021 AS remoteness,
            avg(s.score) FILTER (WHERE s.index_type = 'IRSD'::text) AS avg_irsd_score,
            min(s.decile_national) FILTER (WHERE s.index_type = 'IRSD'::text) AS min_irsd_decile,
            avg(s.decile_national) FILTER (WHERE s.index_type = 'IRSD'::text) AS avg_irsd_decile,
            count(DISTINCT pg.postcode) AS postcode_count
           FROM postcode_geo pg
             LEFT JOIN seifa_2021 s ON s.postcode = pg.postcode
          WHERE pg.lga_name IS NOT NULL
          GROUP BY pg.lga_name, pg.state, pg.remoteness_2021
        ), lga_funding AS (
         SELECT mv_funding_by_lga.lga_name,
            mv_funding_by_lga.state,
            mv_funding_by_lga.total_funding,
            mv_funding_by_lga.entity_count AS funding_entity_count
           FROM mv_funding_by_lga
        ), ndis_lga AS (
         SELECT replace(regexp_replace(ndis_participants_lga.lga_name, '\s*\([A-Za-z]+\)\s*'::text, ''::text, 'g'::text), '-'::text, ' '::text) AS lga_name,
            ndis_participants_lga.state,
            sum(ndis_participants_lga.participant_count) AS ndis_participants
           FROM ndis_participants_lga
          WHERE ndis_participants_lga.quarter_date = (( SELECT max(ndis_participants_lga_1.quarter_date) AS max
                   FROM ndis_participants_lga ndis_participants_lga_1))
          GROUP BY (replace(regexp_replace(ndis_participants_lga.lga_name, '\s*\([A-Za-z]+\)\s*'::text, ''::text, 'g'::text), '-'::text, ' '::text)), ndis_participants_lga.state
        ), ndis_util AS (
         SELECT ndis_utilisation.state,
            avg(ndis_utilisation.utilisation_rate) FILTER (WHERE ndis_utilisation.disability_type = 'ALL'::text AND ndis_utilisation.age_group = 'ALL'::text AND ndis_utilisation.support_class = 'ALL'::text AND ndis_utilisation.service_district <> 'ALL'::text) AS avg_utilisation
           FROM ndis_utilisation
          WHERE ndis_utilisation.quarter_date = (( SELECT max(ndis_utilisation_1.quarter_date) AS max
                   FROM ndis_utilisation ndis_utilisation_1))
          GROUP BY ndis_utilisation.state
        )
 SELECT COALESCE(d.lga_name, p.lga_name) AS lga_name,
    COALESCE(d.state, p.state) AS state,
    d.remoteness,
    d.avg_irsd_score,
    d.min_irsd_decile,
    d.avg_irsd_decile,
    d.postcode_count,
    COALESCE(p.entity_count, 0::bigint) AS indexed_entities,
    COALESCE(p.community_controlled_count, 0::bigint) AS community_controlled_entities,
    COALESCE(p.multi_system_entities, 0::bigint) AS multi_system_entities,
    COALESCE(p.procurement_entities, 0::bigint) AS procurement_entities,
    COALESCE(p.justice_entities, 0::bigint) AS justice_entities,
    COALESCE(p.donation_entities, 0::bigint) AS donation_entities,
    COALESCE(p.foundation_entities, 0::bigint) AS foundation_entities,
    COALESCE(p.alma_entities, 0::bigint) AS alma_entities,
    COALESCE(p.ndis_entities, 0::bigint) AS ndis_entities,
    COALESCE(p.total_procurement, 0::numeric) AS procurement_dollars,
    COALESCE(p.total_justice, 0::numeric) AS justice_dollars,
    COALESCE(p.total_donations, 0::numeric) AS donation_dollars,
    COALESCE(p.total_flow, 0::numeric) AS total_dollar_flow,
    COALESCE(f.total_funding, 0::numeric) AS total_funding_all_sources,
    COALESCE(p.avg_system_count, 0::numeric) AS avg_system_count,
    COALESCE(p.avg_power_score, 0::numeric) AS avg_power_score,
    COALESCE(nl.ndis_participants, 0::bigint) AS ndis_participants,
    COALESCE(nu.avg_utilisation, 0::numeric) AS ndis_avg_utilisation,
        CASE
            WHEN d.avg_irsd_decile IS NOT NULL THEN round((11::numeric - COALESCE(d.avg_irsd_decile, 5::numeric)) * 10::numeric +
            CASE d.remoteness
                WHEN 'Major Cities of Australia'::text THEN 0
                WHEN 'Inner Regional Australia'::text THEN 10
                WHEN 'Outer Regional Australia'::text THEN 20
                WHEN 'Remote Australia'::text THEN 30
                WHEN 'Very Remote Australia'::text THEN 40
                ELSE 10
            END::numeric +
            CASE
                WHEN COALESCE(p.entity_count, 0::bigint) = 0 THEN 30
                WHEN COALESCE(p.multi_system_entities, 0::bigint) = 0 THEN 20
                WHEN COALESCE(p.avg_system_count, 0::numeric) < 1.5 THEN 10
                ELSE 0
            END::numeric +
            CASE
                WHEN COALESCE(p.total_flow, 0::numeric) = 0::numeric THEN 20
                WHEN COALESCE(p.total_flow, 0::numeric) < 1000000::numeric THEN 10
                ELSE 0
            END::numeric +
            CASE
                WHEN COALESCE(nl.ndis_participants, 0::bigint) > 0 AND COALESCE(p.ndis_entities, 0::bigint) = 0 THEN 15
                WHEN COALESCE(nl.ndis_participants, 0::bigint) > 1000 AND COALESCE(p.ndis_entities, 0::bigint) < 5 THEN 10
                ELSE 0
            END::numeric, 1)
            ELSE NULL::numeric
        END AS desert_score
   FROM lga_disadvantage d
     FULL JOIN lga_power p ON p.lga_name = d.lga_name AND p.state = d.state
     LEFT JOIN lga_funding f ON f.lga_name = COALESCE(d.lga_name, p.lga_name) AND f.state = COALESCE(d.state, p.state)
     LEFT JOIN ndis_lga nl ON nl.lga_name = COALESCE(d.lga_name, p.lga_name) AND nl.state = COALESCE(d.state, p.state)
     LEFT JOIN ndis_util nu ON nu.state = COALESCE(d.state, p.state)
  WHERE COALESCE(d.lga_name, p.lga_name) IS NOT NULL;

CREATE INDEX idx_mv_fd_desert_score ON public.mv_funding_deserts USING btree (desert_score DESC NULLS LAST);
GRANT ALL ON public.mv_funding_deserts TO service_role;
GRANT SELECT ON public.mv_funding_deserts TO agent_readonly;

-- 3 ---------------------------------------------------------------------------------------------
CREATE MATERIALIZED VIEW public.mv_board_interlocks AS
 WITH multi_board_persons AS (
         SELECT person_roles.person_name_normalised
           FROM person_roles
          WHERE person_roles.person_name_normalised IS NOT NULL AND person_roles.person_name_normalised <> ''::text AND person_roles.company_abn IS NOT NULL
          GROUP BY person_roles.person_name_normalised
         HAVING count(DISTINCT person_roles.company_abn) >= 2
        ), person_summary AS (
         SELECT pr.person_name_normalised,
            min(pr.person_name) AS person_name_display,
            count(DISTINCT pr.company_abn) AS board_count,
            array_agg(DISTINCT pr.company_name ORDER BY pr.company_name) AS organisations,
            array_agg(DISTINCT pr.company_abn ORDER BY pr.company_abn) AS organisation_abns,
            array_agg(DISTINCT pr.entity_id) FILTER (WHERE pr.entity_id IS NOT NULL) AS entity_ids,
            array_agg(DISTINCT pr.role_type ORDER BY pr.role_type) AS role_types,
            array_agg(DISTINCT pr.source ORDER BY pr.source) AS sources
           FROM person_roles pr
             JOIN multi_board_persons mb ON mb.person_name_normalised = pr.person_name_normalised
          WHERE pr.company_abn IS NOT NULL
          GROUP BY pr.person_name_normalised
        )
 SELECT ps.person_name_normalised,
    ps.person_name_display,
    ps.board_count,
    ps.organisations,
    ps.organisation_abns,
    ps.entity_ids,
    ps.role_types,
    ps.sources,
    COALESCE(pi_agg.total_procurement_dollars, 0::numeric) AS total_procurement_dollars,
    COALESCE(pi_agg.total_justice_dollars, 0::numeric) AS total_justice_dollars,
    COALESCE(pi_agg.total_donation_dollars, 0::numeric) AS total_donation_dollars,
    COALESCE(pi_agg.max_system_count, 0) AS max_entity_system_count,
    COALESCE(pi_agg.sum_power_score, 0::numeric) AS total_power_score,
    COALESCE(pi_agg.has_community_controlled, false) AS connects_community_controlled,
    (ps.board_count::numeric * ln(GREATEST(COALESCE(pi_agg.total_procurement_dollars, 0::numeric) + COALESCE(pi_agg.total_justice_dollars, 0::numeric) + COALESCE(pi_agg.total_donation_dollars, 0::numeric), 0::numeric) + 1::numeric) * GREATEST(COALESCE(pi_agg.max_system_count, 1), 1)::numeric)::numeric(12,2) AS interlock_score
   FROM person_summary ps
     LEFT JOIN LATERAL ( SELECT sum(pi.procurement_dollars) AS total_procurement_dollars,
            sum(pi.recorded_grants_dollars) AS total_justice_dollars,
            sum(pi.donation_dollars) AS total_donation_dollars,
            max(pi.system_count) AS max_system_count,
            sum(pi.power_score) AS sum_power_score,
            bool_or(pi.is_community_controlled) AS has_community_controlled
           FROM mv_entity_power_index pi
          WHERE pi.id = ANY (ps.entity_ids)) pi_agg ON true
  ORDER BY ((ps.board_count::numeric * ln(GREATEST(COALESCE(pi_agg.total_procurement_dollars, 0::numeric) + COALESCE(pi_agg.total_justice_dollars, 0::numeric) + COALESCE(pi_agg.total_donation_dollars, 0::numeric), 0::numeric) + 1::numeric) * GREATEST(COALESCE(pi_agg.max_system_count, 1), 1)::numeric)::numeric(12,2)) DESC NULLS LAST;

CREATE UNIQUE INDEX idx_mv_board_interlocks_person ON public.mv_board_interlocks USING btree (person_name_normalised);
CREATE INDEX idx_mv_board_interlocks_score ON public.mv_board_interlocks USING btree (interlock_score DESC NULLS LAST);
CREATE INDEX idx_mv_board_interlocks_board_count ON public.mv_board_interlocks USING btree (board_count DESC);
GRANT ALL ON public.mv_board_interlocks TO service_role;
GRANT SELECT ON public.mv_board_interlocks TO agent_readonly;

-- 4 ---------------------------------------------------------------------------------------------
CREATE VIEW public.v_goods_relationship_power AS
 SELECT gr.id AS rel_id,
    gr.entity_id,
    gr.display_name,
    gr.relationship_type,
    COALESCE(gr.warmth_display, 0) AS warmth_display,
    pi.power_score,
    pi.system_count,
    pi.in_procurement,
    pi.in_recorded_grants AS in_justice_funding,
    pi.in_political_donations,
    pi.in_charity_registry,
    pi.in_foundation,
    pi.in_alma_evidence,
    pi.in_ato_transparency,
    pi.total_dollar_flow,
    pi.foundation_giving,
    rd.influence_vectors,
    rd.revolving_door_score,
    rd.lobbies,
    rd.donates,
    rd.contracts,
    rd.receives_funding
   FROM goods_relationships gr
     LEFT JOIN mv_entity_power_index pi ON pi.id = gr.entity_id
     LEFT JOIN mv_revolving_door rd ON rd.id = gr.entity_id
  WHERE gr.entity_id IS NOT NULL AND (pi.id IS NOT NULL OR rd.id IS NOT NULL);
GRANT SELECT ON public.v_goods_relationship_power TO anon;
GRANT SELECT ON public.v_goods_relationship_power TO authenticated;
GRANT SELECT ON public.v_goods_relationship_power TO service_role;
GRANT SELECT ON public.v_goods_relationship_power TO agent_readonly;

-- 5 ---------------------------------------------------------------------------------------------
CREATE MATERIALIZED VIEW public.mv_disability_landscape AS
 WITH ndis_by_lga AS (
         SELECT regexp_replace(ndis_participants_lga.lga_name, ' \([^)]*\)(\s*\([^)]*\))?$'::text, ''::text) AS lga_name,
            ndis_participants_lga.state,
            sum(ndis_participants_lga.participant_count) AS ndis_participants
           FROM ndis_participants_lga
          WHERE ndis_participants_lga.quarter_date = (( SELECT max(ndis_participants_lga_1.quarter_date) AS max
                   FROM ndis_participants_lga ndis_participants_lga_1))
          GROUP BY (regexp_replace(ndis_participants_lga.lga_name, ' \([^)]*\)(\s*\([^)]*\))?$'::text, ''::text)), ndis_participants_lga.state
        ), disability_entities AS (
         SELECT regexp_replace(ge.lga_name, ' \([^)]*\)$'::text, ''::text) AS lga_name,
            upper(ge.state) AS state,
            count(*) AS civicgraph_disability_entities,
            count(*) FILTER (WHERE ge.is_community_controlled) AS community_controlled_disability,
            sum(
                CASE
                    WHEN pi.in_recorded_grants = 1 THEN 1
                    ELSE 0
                END) AS also_in_justice,
            sum(
                CASE
                    WHEN pi.in_procurement = 1 THEN 1
                    ELSE 0
                END) AS also_in_procurement,
            avg(pi.system_count) AS avg_system_count
           FROM gs_entities ge
             JOIN ndis_registered_providers nrp ON nrp.abn = ge.abn
             LEFT JOIN mv_entity_power_index pi ON pi.id = ge.id
          WHERE ge.lga_name IS NOT NULL
          GROUP BY (regexp_replace(ge.lga_name, ' \([^)]*\)$'::text, ''::text)), (upper(ge.state))
        ), utilisation_by_state AS (
         SELECT ndis_utilisation.state,
            avg(ndis_utilisation.utilisation_rate) FILTER (WHERE ndis_utilisation.disability_type = 'ALL'::text AND ndis_utilisation.age_group = 'ALL'::text AND ndis_utilisation.support_class = 'ALL'::text AND ndis_utilisation.service_district <> 'ALL'::text) AS overall_utilisation,
            min(ndis_utilisation.utilisation_rate) FILTER (WHERE ndis_utilisation.disability_type = 'ALL'::text AND ndis_utilisation.age_group = 'ALL'::text AND ndis_utilisation.support_class = 'ALL'::text AND ndis_utilisation.service_district <> 'ALL'::text) AS min_utilisation
           FROM ndis_utilisation
          WHERE ndis_utilisation.quarter_date = (( SELECT max(ndis_utilisation_1.quarter_date) AS max
                   FROM ndis_utilisation ndis_utilisation_1))
          GROUP BY ndis_utilisation.state
        ), first_nations_by_state AS (
         SELECT ndis_first_nations.state,
            sum(ndis_first_nations.participant_count) FILTER (WHERE ndis_first_nations.remoteness = 'All'::text) AS fn_total_participants,
            sum(ndis_first_nations.participant_count) FILTER (WHERE ndis_first_nations.remoteness = 'Very Remote'::text) AS fn_very_remote_participants,
            avg(ndis_first_nations.avg_annualised_support) FILTER (WHERE ndis_first_nations.remoteness = 'All'::text) AS fn_avg_budget,
            avg(ndis_first_nations.avg_annualised_support) FILTER (WHERE ndis_first_nations.remoteness = 'Very Remote'::text) AS fn_very_remote_avg_budget
           FROM ndis_first_nations
          WHERE ndis_first_nations.quarter_date = (( SELECT max(ndis_first_nations_1.quarter_date) AS max
                   FROM ndis_first_nations ndis_first_nations_1))
          GROUP BY ndis_first_nations.state
        ), alma_disability AS (
         SELECT COALESCE(ge.lga_name, 'Unknown'::text) AS lga_name,
            COALESCE(ge.state, 'Unknown'::text) AS state,
            count(*) AS disability_interventions,
            avg(ai.portfolio_score) AS avg_evidence_score
           FROM alma_interventions ai
             LEFT JOIN gs_entities ge ON ge.id = ai.gs_entity_id
          WHERE ai.topics @> ARRAY['ndis'::text] OR ai.name ~~* '%disab%'::text OR ai.description ~~* '%disab%'::text OR ai.target_cohort::text ~~* '%disab%'::text
          GROUP BY (COALESCE(ge.lga_name, 'Unknown'::text)), (COALESCE(ge.state, 'Unknown'::text))
        ), desert AS (
         SELECT DISTINCT ON (mv_funding_deserts.lga_name, (upper(mv_funding_deserts.state))) mv_funding_deserts.lga_name,
            upper(mv_funding_deserts.state) AS state,
            mv_funding_deserts.remoteness,
            mv_funding_deserts.desert_score,
            mv_funding_deserts.avg_irsd_decile
           FROM mv_funding_deserts
          WHERE mv_funding_deserts.state IS NOT NULL
          ORDER BY mv_funding_deserts.lga_name, (upper(mv_funding_deserts.state)), mv_funding_deserts.desert_score DESC NULLS LAST
        )
 SELECT COALESCE(n.lga_name, de.lga_name, ds.lga_name) AS lga_name,
    COALESCE(n.state, de.state, ds.state) AS state,
    ds.remoteness,
    ds.desert_score,
    ds.avg_irsd_decile,
    COALESCE(n.ndis_participants, 0::bigint) AS ndis_participants,
    COALESCE(de.civicgraph_disability_entities, 0::bigint) AS disability_entities,
    COALESCE(de.community_controlled_disability, 0::bigint) AS community_controlled_disability,
    COALESCE(de.also_in_justice, 0::bigint) AS cross_system_justice,
    COALESCE(de.also_in_procurement, 0::bigint) AS cross_system_procurement,
    COALESCE(de.avg_system_count, 0::numeric) AS avg_entity_system_count,
    COALESCE(u.overall_utilisation, 0::numeric) AS state_avg_utilisation,
    COALESCE(u.min_utilisation, 0::numeric) AS state_min_utilisation,
    COALESCE(fn.fn_total_participants, 0::bigint) AS fn_ndis_participants,
    COALESCE(fn.fn_very_remote_participants, 0::bigint) AS fn_very_remote_participants,
    COALESCE(fn.fn_avg_budget, 0::numeric) AS fn_avg_budget,
    COALESCE(fn.fn_very_remote_avg_budget, 0::numeric) AS fn_very_remote_avg_budget,
    COALESCE(al.disability_interventions, 0::bigint) AS alma_disability_interventions,
    COALESCE(al.avg_evidence_score, 0::numeric) AS alma_avg_evidence_score,
        CASE
            WHEN COALESCE(n.ndis_participants, 0::bigint) > 0 AND COALESCE(de.civicgraph_disability_entities, 0::bigint) = 0 THEN 'CRITICAL'::text
            WHEN COALESCE(n.ndis_participants, 0::bigint) > 500 AND COALESCE(de.civicgraph_disability_entities, 0::bigint) < 3 THEN 'SEVERE'::text
            WHEN COALESCE(n.ndis_participants, 0::bigint) > 100 AND COALESCE(de.civicgraph_disability_entities, 0::bigint) < 5 THEN 'MODERATE'::text
            WHEN COALESCE(n.ndis_participants, 0::bigint) > 0 THEN 'ADEQUATE'::text
            ELSE 'NO_DATA'::text
        END AS thin_market_status,
        CASE
            WHEN COALESCE(de.civicgraph_disability_entities, 0::bigint) > 0 THEN round(COALESCE(n.ndis_participants, 0::bigint)::numeric / de.civicgraph_disability_entities::numeric, 1)
            ELSE NULL::numeric
        END AS participants_per_provider
   FROM ndis_by_lga n
     FULL JOIN disability_entities de ON de.lga_name = n.lga_name AND de.state = n.state
     LEFT JOIN desert ds ON ds.lga_name = COALESCE(n.lga_name, de.lga_name) AND ds.state = COALESCE(n.state, de.state)
     LEFT JOIN utilisation_by_state u ON u.state = COALESCE(n.state, de.state)
     LEFT JOIN first_nations_by_state fn ON fn.state = COALESCE(n.state, de.state)
     LEFT JOIN alma_disability al ON al.lga_name = COALESCE(n.lga_name, de.lga_name) AND al.state = COALESCE(n.state, de.state)
  WHERE COALESCE(n.lga_name, de.lga_name) IS NOT NULL;


GRANT ALL ON public.mv_disability_landscape TO service_role;
GRANT SELECT ON public.mv_disability_landscape TO agent_readonly;

-- 6 ---------------------------------------------------------------------------------------------
CREATE MATERIALIZED VIEW public.mv_foundation_need_alignment AS
 WITH grantee_locations AS (
         SELECT fg.foundation_name,
            fg.foundation_abn,
            fg.grantee_name,
            fg.grantee_abn,
            e.lga_name,
            e.lga_code,
            e.state,
            e.remoteness,
            e.seifa_irsd_decile,
            e.is_community_controlled
           FROM mv_foundation_grantees fg
             JOIN gs_entities e ON e.abn = fg.grantee_abn
          WHERE e.lga_name IS NOT NULL
        )
 SELECT gl.foundation_name,
    gl.foundation_abn,
    gl.lga_name,
    gl.state,
    gl.remoteness,
    count(DISTINCT gl.grantee_abn) AS grantee_count,
    COALESCE(fd.desert_score, 0::numeric) AS desert_score,
    COALESCE(fd.avg_irsd_decile, 0::numeric) AS avg_lga_disadvantage,
    COALESCE(fd.total_funding_all_sources, 0::numeric) AS existing_funding,
    count(DISTINCT gl.grantee_abn) FILTER (WHERE gl.is_community_controlled) AS community_controlled_count,
    avg(gl.seifa_irsd_decile) AS avg_grantee_disadvantage_decile
   FROM grantee_locations gl
     LEFT JOIN mv_funding_deserts fd ON fd.lga_name = gl.lga_name
  GROUP BY gl.foundation_name, gl.foundation_abn, gl.lga_name, gl.state, gl.remoteness, fd.desert_score, fd.avg_irsd_decile, fd.total_funding_all_sources;

CREATE INDEX idx_fna_foundation_lga ON public.mv_foundation_need_alignment USING btree (foundation_abn, lga_name);
CREATE INDEX idx_fna_desert ON public.mv_foundation_need_alignment USING btree (desert_score DESC);
GRANT SELECT ON public.mv_foundation_need_alignment TO agent_readonly;

-- 7 ---------------------------------------------------------------------------------------------
CREATE MATERIALIZED VIEW public.mv_foundation_scores AS
 WITH foundation_base AS (
         SELECT f.id AS foundation_id,
            f.name,
            f.acnc_abn,
            f.total_giving_annual,
            f.type,
            f.parent_company,
            f.thematic_focus,
            f.geographic_focus
           FROM foundations f
          WHERE f.acnc_abn IS NOT NULL AND f.total_giving_annual > 100000::numeric
        ), transparency AS (
         SELECT fb_1.foundation_id,
            count(DISTINCT fg.grantee_abn) AS grantee_count,
            count(DISTINCT fg.link_method) AS link_methods,
            LEAST(100::bigint, count(DISTINCT fg.grantee_abn) * 5) AS transparency_score
           FROM foundation_base fb_1
             LEFT JOIN mv_foundation_grantees fg ON fg.foundation_abn = fb_1.acnc_abn
          GROUP BY fb_1.foundation_id
        ), need_align AS (
         SELECT fb_1.foundation_id,
            count(DISTINCT fna.lga_name) AS lgas_funded,
            COALESCE(avg(fna.desert_score), 0::numeric) AS avg_desert_score,
            COALESCE(avg(fna.avg_lga_disadvantage), 5::numeric) AS avg_disadvantage,
            sum(fna.community_controlled_count) AS community_controlled_grantees,
            LEAST(100::numeric, COALESCE(avg(fna.desert_score), 0::numeric) * 1.2) AS need_alignment_score
           FROM foundation_base fb_1
             LEFT JOIN mv_foundation_need_alignment fna ON fna.foundation_abn = fb_1.acnc_abn
          GROUP BY fb_1.foundation_id
        ), evidence AS (
         SELECT fb_1.foundation_id,
            count(DISTINCT ebf.grantee_abn) AS evidence_backed_orgs,
            count(DISTINCT ebf.intervention_name) AS interventions,
            COALESCE(avg(ebf.portfolio_score), 0::numeric) AS avg_portfolio_score,
                CASE
                    WHEN t_1.grantee_count = 0 THEN 0::double precision
                    ELSE LEAST(100::double precision, count(DISTINCT ebf.grantee_abn)::double precision / GREATEST(t_1.grantee_count, 1::bigint)::double precision * 100::double precision * 2::double precision)
                END AS evidence_score
           FROM foundation_base fb_1
             LEFT JOIN mv_evidence_backed_funding ebf ON ebf.foundation_abn = fb_1.acnc_abn
             LEFT JOIN transparency t_1 ON t_1.foundation_id = fb_1.foundation_id
          GROUP BY fb_1.foundation_id, t_1.grantee_count
        ), concentration AS (
         SELECT fb_1.foundation_id,
            count(DISTINCT fna.state) AS states_funded,
            count(DISTINCT fna.remoteness) AS remoteness_categories,
            count(DISTINCT fna.lga_name) AS unique_lgas,
            LEAST(100::bigint, COALESCE(count(DISTINCT fna.state), 0::bigint) * 10 + COALESCE(count(DISTINCT fna.remoteness), 0::bigint) * 10 + LEAST(50::bigint, COALESCE(count(DISTINCT fna.lga_name), 0::bigint))) AS concentration_score
           FROM foundation_base fb_1
             LEFT JOIN mv_foundation_need_alignment fna ON fna.foundation_abn = fb_1.acnc_abn
          GROUP BY fb_1.foundation_id
        ), governance AS (
         SELECT fb_1.foundation_id,
            count(DISTINCT tgc.trustee_name) AS total_trustees,
            count(DISTINCT tgc.trustee_name) FILTER (WHERE tgc.trustee_on_grantee_board) AS overlapping_trustees,
            count(*) FILTER (WHERE tgc.trustee_on_grantee_board) AS overlap_instances
           FROM foundation_base fb_1
             LEFT JOIN mv_trustee_grantee_chain tgc ON tgc.foundation_abn = fb_1.acnc_abn
          GROUP BY fb_1.foundation_id
        )
 SELECT fb.foundation_id,
    fb.name,
    fb.acnc_abn,
    fb.total_giving_annual,
    fb.type,
    fb.parent_company,
    COALESCE(t.transparency_score, 0::bigint)::integer AS transparency_score,
    COALESCE(na.need_alignment_score, 0::numeric)::integer AS need_alignment_score,
    COALESCE(ev.evidence_score, 0::double precision)::integer AS evidence_score,
    COALESCE(co.concentration_score, 0::bigint)::integer AS concentration_score,
    ((COALESCE(t.transparency_score, 0::bigint)::numeric * 0.25 + COALESCE(na.need_alignment_score, 0::numeric) * 0.30)::double precision + COALESCE(ev.evidence_score, 0::double precision) * 0.25::double precision + (COALESCE(co.concentration_score, 0::bigint)::numeric * 0.20)::double precision)::integer AS foundation_score,
    COALESCE(t.grantee_count, 0::bigint) AS grantee_count,
    COALESCE(na.lgas_funded, 0::bigint) AS lgas_funded,
    COALESCE(na.avg_desert_score, 0::numeric)::numeric(5,1) AS avg_desert_score,
    COALESCE(na.community_controlled_grantees, 0::numeric) AS community_controlled_grantees,
    COALESCE(ev.evidence_backed_orgs, 0::bigint) AS evidence_backed_orgs,
    COALESCE(ev.interventions, 0::bigint) AS interventions_funded,
    COALESCE(co.states_funded, 0::bigint) AS states_funded,
    COALESCE(co.unique_lgas, 0::bigint) AS unique_lgas,
    COALESCE(g.total_trustees, 0::bigint) AS total_trustees,
    COALESCE(g.overlapping_trustees, 0::bigint) AS overlapping_trustees,
    COALESCE(g.overlap_instances, 0::bigint) AS overlap_instances
   FROM foundation_base fb
     LEFT JOIN transparency t ON t.foundation_id = fb.foundation_id
     LEFT JOIN need_align na ON na.foundation_id = fb.foundation_id
     LEFT JOIN evidence ev ON ev.foundation_id = fb.foundation_id
     LEFT JOIN concentration co ON co.foundation_id = fb.foundation_id
     LEFT JOIN governance g ON g.foundation_id = fb.foundation_id;

CREATE UNIQUE INDEX idx_fs_foundation ON public.mv_foundation_scores USING btree (foundation_id);
CREATE INDEX idx_fs_score ON public.mv_foundation_scores USING btree (foundation_score DESC);
CREATE INDEX idx_fs_abn ON public.mv_foundation_scores USING btree (acnc_abn);
GRANT SELECT ON public.mv_foundation_scores TO agent_readonly;

-- 8 ---------------------------------------------------------------------------------------------
CREATE MATERIALIZED VIEW public.mv_foundation_readiness AS
 WITH foundation_base AS (
         SELECT f.id,
            f.name,
            f.acnc_abn,
            f.type,
            f.total_giving_annual,
            f.acnc_data IS NOT NULL AS has_ais_data,
            f.enrichment_source,
            f.profile_confidence
           FROM foundations f
          WHERE f.type <> ALL (ARRAY['university'::text, 'legal_aid'::text, 'primary_health_network'::text, 'religious_organisation'::text, 'education_body'::text, 'hospital'::text, 'service_delivery'::text, 'unknown'::text])
        ), entity_match AS (
         SELECT DISTINCT ON (fb_1.id) fb_1.id AS foundation_id,
            e.gs_id,
            e.id AS entity_uuid
           FROM foundation_base fb_1
             JOIN gs_entities e ON e.abn = fb_1.acnc_abn
          WHERE fb_1.acnc_abn IS NOT NULL
        ), grantee_counts AS (
         SELECT mv_foundation_grantees.foundation_abn,
            count(*) AS grantee_count
           FROM mv_foundation_grantees
          GROUP BY mv_foundation_grantees.foundation_abn
        ), score_lookup AS (
         SELECT DISTINCT ON (mv_foundation_scores.acnc_abn) mv_foundation_scores.acnc_abn AS score_abn,
            mv_foundation_scores.foundation_score,
                CASE
                    WHEN mv_foundation_scores.foundation_score >= 50 THEN 'high'::text
                    WHEN mv_foundation_scores.foundation_score >= 20 THEN 'medium'::text
                    ELSE 'low'::text
                END AS score_tier
           FROM mv_foundation_scores
          WHERE mv_foundation_scores.acnc_abn IS NOT NULL
          ORDER BY mv_foundation_scores.acnc_abn, mv_foundation_scores.foundation_score DESC
        )
 SELECT fb.id,
    fb.name,
    fb.acnc_abn,
    fb.type,
    fb.total_giving_annual::bigint AS total_giving_annual,
    fb.acnc_abn IS NOT NULL AS has_abn,
    em.gs_id IS NOT NULL AS has_entity,
    fb.has_ais_data,
    COALESCE(gc.grantee_count, 0::bigint)::integer AS grantee_count,
    gc.grantee_count IS NOT NULL AS has_grantees,
    sl.foundation_score IS NOT NULL AS has_score,
    sl.foundation_score,
    sl.score_tier,
        CASE
            WHEN fb.acnc_abn IS NOT NULL THEN 1
            ELSE 0
        END +
        CASE
            WHEN em.gs_id IS NOT NULL THEN 1
            ELSE 0
        END +
        CASE
            WHEN fb.has_ais_data THEN 1
            ELSE 0
        END +
        CASE
            WHEN gc.grantee_count IS NOT NULL THEN 1
            ELSE 0
        END +
        CASE
            WHEN sl.foundation_score IS NOT NULL THEN 1
            ELSE 0
        END AS readiness_score,
    em.gs_id,
    fb.enrichment_source,
    fb.profile_confidence
   FROM foundation_base fb
     LEFT JOIN entity_match em ON em.foundation_id = fb.id
     LEFT JOIN grantee_counts gc ON gc.foundation_abn = fb.acnc_abn
     LEFT JOIN score_lookup sl ON sl.score_abn = fb.acnc_abn
  ORDER BY fb.total_giving_annual DESC NULLS LAST;

CREATE UNIQUE INDEX idx_fr_id ON public.mv_foundation_readiness USING btree (id);
CREATE INDEX idx_fr_readiness ON public.mv_foundation_readiness USING btree (readiness_score);
CREATE INDEX idx_fr_abn ON public.mv_foundation_readiness USING btree (acnc_abn);
GRANT SELECT ON public.mv_foundation_readiness TO agent_readonly;

-- 9 ---------------------------------------------------------------------------------------------
CREATE VIEW public.v_goods_warm_intros AS
 WITH goods AS (
         SELECT gr.id AS rel_id,
            gr.entity_id,
            gr.display_name,
            gr.relationship_type,
            gr.warmth_display
           FROM goods_relationships gr
          WHERE gr.entity_id IS NOT NULL
        ), conn AS (
         SELECT g.rel_id,
            g.display_name AS target_name,
            g.relationship_type,
            g.warmth_display,
            bi.person_name_display AS person,
            pen.role_type,
            bi.board_count,
            bi.interlock_score,
            bi.connects_community_controlled,
            bi.organisations,
            bi.entity_ids
           FROM goods g
             JOIN mv_person_entity_network pen ON pen.entity_id = g.entity_id
             JOIN mv_board_interlocks bi ON bi.person_name_normalised = pen.person_name_normalised
          WHERE bi.board_count >= 2 AND bi.board_count <= 15
        )
 SELECT rel_id,
    target_name,
    relationship_type,
    warmth_display,
    person,
    role_type,
    board_count,
    interlock_score,
    connects_community_controlled,
    ( SELECT array_agg(s.o) AS array_agg
           FROM ( SELECT DISTINCT o.o
                   FROM unnest(c.organisations) o(o)
                  WHERE o.o IS DISTINCT FROM c.target_name
                  ORDER BY o.o
                 LIMIT 4) s) AS other_orgs,
    ( SELECT g2.display_name
           FROM goods g2
          WHERE (g2.entity_id = ANY (c.entity_ids)) AND g2.rel_id <> c.rel_id
          ORDER BY g2.warmth_display DESC
         LIMIT 1) AS bridges_to_goods
   FROM conn c;
GRANT SELECT ON public.v_goods_warm_intros TO anon;
GRANT SELECT ON public.v_goods_warm_intros TO authenticated;
GRANT SELECT ON public.v_goods_warm_intros TO service_role;
GRANT SELECT ON public.v_goods_warm_intros TO agent_readonly;

COMMENT ON MATERIALIZED VIEW public.mv_entity_power_index IS
  'Cross-system power concentration. recorded_grants_* columns hold money from the '
  'justice_funding TABLE — a grants register, not a justice figure. Renamed from justice_* '
  '2026-08-16. Money filters applied at all four sites the same day. '
  'See thoughts/shared/data-map/justice-funding-filter-audit.md';
COMMENT ON COLUMN public.mv_entity_power_index.in_recorded_grants IS
  'Presence in the recorded-grants register after mandatory filters.';


-- ── The two stored-SQL readers of the old names, found by scanning clarity_question and pg_proc.
-- Both keep their OUTPUT keys ('justice_total' in the payload, 'justice_dollars'/'justice' in the
-- function's JSON) — those are consumer contracts; only the source columns move.

UPDATE clarity_question
   SET answer_sql = replace(answer_sql, 'sum(justice_total)', 'sum(recorded_grants_total)')
 WHERE slug = 'org-total-funding'
   AND answer_sql LIKE '%sum(justice_total)%';

CREATE OR REPLACE FUNCTION public.get_power_holder(p_abn text DEFAULT NULL::text, p_gs_id text DEFAULT NULL::text, p_name text DEFAULT NULL::text)
 RETURNS jsonb
 LANGUAGE sql
 STABLE
AS $function$
  WITH e AS (
    SELECT *
    FROM mv_entity_power_index
    WHERE (p_abn   IS NOT NULL AND abn = p_abn)
       OR (p_abn   IS NULL AND p_gs_id IS NOT NULL AND gs_id = p_gs_id)
       OR (p_abn   IS NULL AND p_gs_id IS NULL AND p_name IS NOT NULL
           AND canonical_name ILIKE '%' || p_name || '%')
    ORDER BY power_score DESC NULLS LAST
    LIMIT 1
  )
  SELECT jsonb_build_object(
    'entity', jsonb_build_object(
      'gs_id', e.gs_id,
      'name', e.canonical_name,
      'abn', e.abn,
      'entity_type', e.entity_type,
      'state', e.state,
      'lga_name', e.lga_name,
      'is_community_controlled', e.is_community_controlled,
      'power_score', round(e.power_score)::int,
      'system_count', e.system_count,
      'total_dollar_flow', e.total_dollar_flow,
      'procurement_dollars', e.procurement_dollars,
      'justice_dollars', e.recorded_grants_dollars,
      'donation_dollars', e.donation_dollars,
      'foundation_giving', e.foundation_giving,
      'contract_count', e.contract_count,
      'distinct_govt_buyers', e.distinct_govt_buyers,
      'distinct_parties_funded', e.distinct_parties_funded,
      'systems', jsonb_build_object(
        'procurement', e.in_procurement,
        'justice', e.in_recorded_grants,
        'donations', e.in_political_donations,
        'charity', e.in_charity_registry,
        'foundation', e.in_foundation,
        'ato', e.in_ato_transparency,
        'ndis', e.in_ndis_provider
      )
    ),
    'board_people', COALESCE((
      SELECT jsonb_agg(x) FROM (
        SELECT jsonb_build_object(
                 'name', n.person_name_display,
                 'identity_key', n.identity_key,
                 'is_nominee_block', n.is_nominee_block
               ) AS x
        FROM mv_person_identity_network n
        WHERE n.entity_id = e.id
        ORDER BY n.is_nominee_block, n.person_name_display
        LIMIT 50
      ) s
    ), '[]'::jsonb),
    'foundation_backers', COALESCE((
      SELECT jsonb_agg(jsonb_build_object('foundation', f.foundation_name, 'total', f.total) ORDER BY f.total DESC)
      FROM (
        SELECT foundation_name, sum(grant_amount) AS total
        FROM mv_foundation_grantees
        WHERE grantee_entity_id = e.id AND link_method = 'relationship'
        GROUP BY foundation_name
      ) f
    ), '[]'::jsonb),
    'revolving_door', (
      SELECT jsonb_build_object(
               'score', round(rd.revolving_door_score)::int,
               'influence_vectors', rd.influence_vectors,
               'lobbies', rd.lobbies,
               'donates', rd.donates,
               'contracts', rd.contracts,
               'receives_funding', rd.receives_funding,
               'donate_then_win', (rd.donates AND rd.contracts),
               'parties_funded', rd.parties_funded,
               'distinct_buyers', rd.distinct_buyers
             )
      FROM mv_revolving_door rd
      WHERE rd.id = e.id
    )
  )
  FROM e;
$function$;

COMMIT;
