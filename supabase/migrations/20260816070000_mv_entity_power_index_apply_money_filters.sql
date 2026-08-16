-- mv_entity_power_index: the same two mandatory money filters, at four sites.
--
-- !! DO NOT APPLY AS WRITTEN. It fails and rolls back. See BLOCKED below. !!
--
-- BLOCKED — 8 dependent objects
--
-- Attempted 2026-08-16; the plain DROP fails because mv_entity_power_index has dependents, and
-- DROP ... CASCADE would take all eight with it:
--
--   mv_funding_deserts              <- the PUBLIC Atlas reads this
--   mv_foundation_need_alignment
--   mv_foundation_scores
--   mv_foundation_readiness
--   mv_board_interlocks
--   mv_disability_landscape
--   v_goods_warm_intros
--   v_goods_relationship_power      <- needs GRANT SELECT to anon/authenticated/service_role
--                                      restored or the Goods chips render empty
--
-- So this needs a nine-object rebuild: capture every definition, index and grant; drop cascade;
-- recreate in dependency order; restore grants; refresh six matviews (the full refresh set runs
-- ~15 minutes). That is a planned operation with a rollback plan and a refresh window, not an
-- incremental migration. The transaction protected us — nothing changed on the failed attempt.
--
-- The SQL body below is correct and verified; only the drop strategy is wrong.
--
-- Apply (ONLY after the nine-object rebuild is written):
--   source .env && PGPASSWORD="$DATABASE_PASSWORD" psql -h aws-0-ap-southeast-2.pooler.supabase.com \
--     -p 5432 -U "postgres.tednluwflfhxyucgwigh" -d postgres \
--     -f supabase/migrations/20260816070000_mv_entity_power_index_apply_money_filters.sql
--
-- WHY THIS IS A SECOND MIGRATION
--
-- Fixing mv_entity_total_funding (20260816060000) did NOT reach this. mv_entity_power_index does
-- not derive from it — it reads justice_funding and political_donations DIRECTLY, and carries the
-- same two defects independently. This is the matview 28 app files actually read, and its
-- power_score is a RANKING, so contaminated dollars do not just inflate a number, they reorder who
-- appears powerful.
--
--   justice_dollars   $83.53bn -> ~$32.38bn     2.6x overstated
--   donation_dollars  $77.99bn -> ~$12.00bn     6.5x overstated
--
-- FOUR SITES, not two. Two sum dollars; two decide PRESENCE:
--
--   justice_ids    DISTINCT gs_entity_id with no filter — a whole-of-state budget row was enough
--                  to mark an entity as "present in justice funding", which inflates system_count
--                  and therefore power_score even where no money reached anyone.
--   donation_ids   same, via 'other receipt' rows that are not donations at all.
--   justice        sum(amount_dollars)
--   donations      sum(pd.amount)
--
-- The presence sites matter more than they look: system_count is a count of how many systems an
-- entity appears in, and it is the spine of the power score.
--
-- Audit: thoughts/shared/data-map/justice-funding-filter-audit.md

BEGIN;

DROP MATERIALIZED VIEW IF EXISTS public.mv_entity_power_index;

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
    (j.entity_id IS NOT NULL)::integer AS in_justice_funding,
    (d.entity_id IS NOT NULL)::integer AS in_political_donations,
    (c.entity_id IS NOT NULL)::integer AS in_charity_registry,
    (f.entity_id IS NOT NULL)::integer AS in_foundation,
    (a.entity_id IS NOT NULL)::integer AS in_alma_evidence,
    (t.entity_id IS NOT NULL)::integer AS in_ato_transparency,
    (n.entity_id IS NOT NULL)::integer AS in_ndis_provider,
    (b.entity_id IS NOT NULL)::integer AS has_board_links,
    (p.entity_id IS NOT NULL)::integer + (j.entity_id IS NOT NULL)::integer + (d.entity_id IS NOT NULL)::integer + (c.entity_id IS NOT NULL)::integer + (f.entity_id IS NOT NULL)::integer + (a.entity_id IS NOT NULL)::integer + (t.entity_id IS NOT NULL)::integer + (n.entity_id IS NOT NULL)::integer AS system_count,
    COALESCE(p.procurement_dollars, 0::numeric) AS procurement_dollars,
    COALESCE(j.justice_dollars, 0::numeric) AS justice_dollars,
    COALESCE(d.donation_dollars, 0::numeric) AS donation_dollars,
    COALESCE(f.total_giving_annual, 0::numeric) AS foundation_giving,
    COALESCE(t.ato_total_income, 0::numeric) AS ato_income,
    COALESCE(p.procurement_dollars, 0::numeric) + COALESCE(j.justice_dollars, 0::numeric) + COALESCE(d.donation_dollars, 0::numeric) AS total_dollar_flow,
    COALESCE(p.contract_count, 0::bigint) AS contract_count,
    COALESCE(j.justice_count, 0::bigint) AS justice_record_count,
    COALESCE(d.donation_count, 0::bigint) AS donation_count,
    COALESCE(a.intervention_count, 0::bigint) AS alma_intervention_count,
    COALESCE(n.ndis_provider_count, 0::bigint) AS ndis_provider_count,
    COALESCE(b.board_connections, 0::bigint) AS board_connections,
    COALESCE(p.distinct_buyers, 0::bigint) AS distinct_govt_buyers,
    COALESCE(j.distinct_programs, 0::bigint) AS distinct_justice_programs,
    COALESCE(d.distinct_parties, 0::bigint) AS distinct_parties_funded,
    COALESCE(b.distinct_directors, 0::bigint) AS distinct_directors,
    c.charity_size,
    d.parties_funded,
    a.intervention_types AS alma_types,
    a.avg_evidence_score,
    j.justice_states,
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

CREATE UNIQUE INDEX idx_mv_epi_id ON public.mv_entity_power_index USING btree (id);
CREATE INDEX idx_mv_epi_system_count ON public.mv_entity_power_index USING btree (system_count DESC);
CREATE INDEX idx_mv_epi_power_score ON public.mv_entity_power_index USING btree (power_score DESC);
CREATE INDEX idx_mv_epi_entity_type ON public.mv_entity_power_index USING btree (entity_type);
CREATE INDEX idx_mv_epi_abn ON public.mv_entity_power_index USING btree (abn) WHERE (abn IS NOT NULL);
CREATE INDEX idx_mv_epi_community ON public.mv_entity_power_index USING btree (is_community_controlled)
  WHERE (is_community_controlled = true);
CREATE INDEX idx_mv_epi_state_type_remote_justice ON public.mv_entity_power_index
  USING btree (state, entity_type, remoteness, justice_dollars DESC)
  INCLUDE (gs_id, canonical_name, postcode, is_community_controlled)
  WHERE (justice_dollars > (0)::numeric);

COMMENT ON MATERIALIZED VIEW public.mv_entity_power_index IS
  'Cross-system power concentration. justice_dollars is money from the justice_funding TABLE, '
  'which is 81% a whole-of-Queensland-government grants register and only 19.7% topic-tagged — it '
  'is NOT a justice figure. Money filters applied 2026-08-16 at four sites: two dollar sums and '
  'two presence flags (system_count is part of power_score, so an unfiltered presence flag '
  'inflates the ranking). See thoughts/shared/data-map/justice-funding-filter-audit.md';

COMMIT;

-- VERIFY (expect ~32.38 and ~12.00, down from 83.53 and 77.99):
--   SELECT round(sum(justice_dollars)/1e9,2), round(sum(donation_dollars)/1e9,2)
--     FROM mv_entity_power_index;
-- And confirm the row count has not collapsed (was 188,189 — presence filters will reduce it):
--   SELECT count(*) FROM mv_entity_power_index;
