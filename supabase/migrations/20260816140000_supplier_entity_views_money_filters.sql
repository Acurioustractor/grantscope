-- Three supplier/entity matviews: apply the mandatory money filters (fixes #4-6 from the audit)
--
-- Apply:
--   source .env && PGPASSWORD="$DATABASE_PASSWORD" psql -h aws-0-ap-southeast-2.pooler.supabase.com \
--     -p 5432 -U "postgres.tednluwflfhxyucgwigh" -d postgres \
--     -f supabase/migrations/20260816140000_supplier_entity_views_money_filters.sql
--
-- Measured before (departments as $10bn "grant recipients"/"proven suppliers"):
--   mv_grant_contract_overlap    4,868 rows  grant_total $54.20bn
--   mv_justice_proven_suppliers  4,868 rows  justice_dollars $54.20bn
--   mv_youth_justice_entities    5,953 rows  justice_funding_total $6.65bn
--
-- Four read sites patched — including the EXISTS presence check in proven_suppliers, because a
-- department qualifies as a "supplier" through it even if the aggregate CTE were filtered.
-- Definitions otherwise verbatim from pg_get_viewdef. No dependents (pg_depend). Indexes and
-- relacl reproduced exactly — including proven_suppliers' legacy blanket anon/authenticated ALL,
-- which is a pre-existing posture question, not something to change silently in a filter fix.

BEGIN;

-- mv_grant_contract_overlap -----------------------------------------------------------------
DROP MATERIALIZED VIEW public.mv_grant_contract_overlap;

CREATE MATERIALIZED VIEW public.mv_grant_contract_overlap AS
 WITH grant_totals AS (
         SELECT justice_funding.recipient_abn AS abn,
            (array_agg(justice_funding.recipient_name ORDER BY justice_funding.amount_dollars DESC NULLS LAST))[1] AS recipient_name,
            count(*)::integer AS grant_count,
            COALESCE(sum(justice_funding.amount_dollars), 0::numeric)::bigint AS grant_total,
            min(justice_funding.financial_year) AS grant_first_year,
            max(justice_funding.financial_year) AS grant_last_year
           FROM justice_funding
          WHERE justice_funding.recipient_abn IS NOT NULL AND justice_funding.measure_kind = 'grant' AND justice_funding.is_aggregate IS NOT TRUE AND (justice_funding.recipient_name IS NULL OR lower(btrim(justice_funding.recipient_name)) <> ALL (ARRAY['total','totals','grand total','subtotal','sub-total','various','n/a','na','unknown','tbc','other']))
          GROUP BY justice_funding.recipient_abn
        ), contract_totals AS (
         SELECT austender_contracts.supplier_abn AS abn,
            (array_agg(austender_contracts.supplier_name ORDER BY austender_contracts.contract_value DESC NULLS LAST))[1] AS supplier_name,
            count(*)::integer AS contract_count,
            COALESCE(sum(austender_contracts.contract_value), 0::numeric)::bigint AS contract_total,
            min(EXTRACT(year FROM austender_contracts.contract_start))::integer AS contract_first_year,
            max(EXTRACT(year FROM austender_contracts.contract_start))::integer AS contract_last_year
           FROM austender_contracts
          WHERE austender_contracts.supplier_abn IS NOT NULL
          GROUP BY austender_contracts.supplier_abn
        )
 SELECT g.abn,
    g.recipient_name,
    c.supplier_name,
    g.grant_count,
    g.grant_total,
    c.contract_count,
    c.contract_total,
    g.grant_total + c.contract_total AS combined_public_funding,
    g.grant_first_year,
    g.grant_last_year,
    c.contract_first_year,
    c.contract_last_year,
        CASE
            WHEN c.contract_total > g.grant_total THEN 'contract_heavy'::text
            WHEN g.grant_total > c.contract_total THEN 'grant_heavy'::text
            ELSE 'balanced'::text
        END AS funding_profile,
    e.gs_id,
    e.entity_type,
    e.state,
    e.is_community_controlled,
    e.community_controlled_tier
   FROM grant_totals g
     JOIN contract_totals c ON c.abn = g.abn
     LEFT JOIN gs_entities e ON e.abn = g.abn;

CREATE INDEX mv_grant_contract_overlap_combined_public_funding_idx ON public.mv_grant_contract_overlap USING btree (combined_public_funding DESC);
CREATE INDEX mv_grant_contract_overlap_funding_profile_idx ON public.mv_grant_contract_overlap USING btree (funding_profile);
CREATE INDEX mv_grant_contract_overlap_abn_idx ON public.mv_grant_contract_overlap USING btree (abn);
GRANT ALL ON public.mv_grant_contract_overlap TO service_role;
GRANT SELECT ON public.mv_grant_contract_overlap TO agent_readonly;

-- mv_youth_justice_entities -----------------------------------------------------------------
DROP MATERIALIZED VIEW public.mv_youth_justice_entities;

CREATE MATERIALIZED VIEW public.mv_youth_justice_entities AS
 WITH yj_funding AS (
         SELECT justice_funding.gs_entity_id,
            sum(justice_funding.amount_dollars) AS justice_funding_total,
            count(*) AS justice_grant_count
           FROM justice_funding
          WHERE justice_funding.gs_entity_id IS NOT NULL AND justice_funding.measure_kind = 'grant' AND justice_funding.is_aggregate IS NOT TRUE AND (justice_funding.recipient_name IS NULL OR lower(btrim(justice_funding.recipient_name)) <> ALL (ARRAY['total','totals','grand total','subtotal','sub-total','various','n/a','na','unknown','tbc','other'])) AND (justice_funding.sector ~~* '%youth%'::text OR justice_funding.sector ~~* '%justice%'::text OR justice_funding.program_name ~~* '%youth%'::text OR justice_funding.program_name ~~* '%juvenile%'::text)
          GROUP BY justice_funding.gs_entity_id
        ), yj_contracts AS (
         SELECT e_1.id AS entity_id,
            sum(c.contract_value) AS contract_total,
            count(*) AS contract_count
           FROM austender_contracts c
             JOIN gs_entities e_1 ON e_1.abn = c.supplier_abn AND e_1.abn IS NOT NULL
          WHERE c.title ~~* '%youth justice%'::text OR c.title ~~* '%juvenile%'::text OR c.title ~~* '%young offend%'::text OR c.title ~~* '%youth detention%'::text
          GROUP BY e_1.id
        ), yj_alma AS (
         SELECT alma_interventions.gs_entity_id,
            count(*) AS intervention_count,
            array_agg(DISTINCT alma_interventions.evidence_level) AS evidence_levels,
            avg(alma_interventions.cost_per_young_person) AS avg_cost_per_person
           FROM alma_interventions
          WHERE alma_interventions.gs_entity_id IS NOT NULL AND alma_interventions.serves_youth_justice = true
          GROUP BY alma_interventions.gs_entity_id
        ), yj_entity_ids AS (
         SELECT yj_funding.gs_entity_id AS id
           FROM yj_funding
        UNION
         SELECT yj_contracts.entity_id
           FROM yj_contracts
        UNION
         SELECT yj_alma.gs_entity_id
           FROM yj_alma
        )
 SELECT e.id,
    e.gs_id,
    e.canonical_name,
    e.abn,
    e.entity_type,
    e.sector,
    e.state,
    e.postcode,
    e.remoteness,
    e.lga_name,
    e.is_community_controlled,
    COALESCE(jf.justice_funding_total, 0::numeric) AS justice_funding_total,
    COALESCE(jf.justice_grant_count, 0::bigint) AS justice_grant_count,
    COALESCE(ac.contract_total, 0::numeric) AS contract_total,
    COALESCE(ac.contract_count, 0::bigint) AS contract_count,
    COALESCE(alma.intervention_count, 0::bigint) AS alma_intervention_count,
    alma.evidence_levels,
    alma.avg_cost_per_person,
    jf.justice_funding_total IS NOT NULL AS has_justice_funding,
    ac.contract_total IS NOT NULL AS has_yj_contracts,
    alma.intervention_count IS NOT NULL AS has_alma_interventions
   FROM yj_entity_ids ids
     JOIN gs_entities e ON e.id = ids.id
     LEFT JOIN yj_funding jf ON jf.gs_entity_id = e.id
     LEFT JOIN yj_contracts ac ON ac.entity_id = e.id
     LEFT JOIN yj_alma alma ON alma.gs_entity_id = e.id;

CREATE UNIQUE INDEX mv_youth_justice_entities_id_idx ON public.mv_youth_justice_entities USING btree (id);
GRANT ALL ON public.mv_youth_justice_entities TO service_role;
GRANT SELECT ON public.mv_youth_justice_entities TO agent_readonly;

-- mv_justice_proven_suppliers ---------------------------------------------------------------
DROP MATERIALIZED VIEW public.mv_justice_proven_suppliers;

CREATE MATERIALIZED VIEW public.mv_justice_proven_suppliers AS
 WITH base AS (
         SELECT DISTINCT ON (g.abn) g.id AS entity_id,
            g.gs_id,
            g.abn,
            g.canonical_name,
            g.entity_type,
            g.state,
            g.postcode,
            g.sector,
            g.lga_name,
            g.is_community_controlled
           FROM gs_entities g
          WHERE g.abn IS NOT NULL AND (EXISTS ( SELECT 1
                   FROM justice_funding j
                  WHERE j.recipient_abn = g.abn AND j.measure_kind = 'grant' AND j.is_aggregate IS NOT TRUE AND (j.recipient_name IS NULL OR lower(btrim(j.recipient_name)) <> ALL (ARRAY['total','totals','grand total','subtotal','sub-total','various','n/a','na','unknown','tbc','other'])))) AND (EXISTS ( SELECT 1
                   FROM austender_contracts c
                  WHERE c.supplier_abn = g.abn))
          ORDER BY g.abn, g.gs_id
        ), jf AS (
         SELECT justice_funding.recipient_abn AS abn,
            sum(justice_funding.amount_dollars) AS justice_dollars,
            count(*) AS justice_record_count,
            count(DISTINCT justice_funding.program_name) AS distinct_justice_programs,
            array_agg(DISTINCT justice_funding.state) FILTER (WHERE justice_funding.state IS NOT NULL) AS justice_states
           FROM justice_funding
          WHERE TRUE AND justice_funding.measure_kind = 'grant' AND justice_funding.is_aggregate IS NOT TRUE AND (justice_funding.recipient_name IS NULL OR lower(btrim(justice_funding.recipient_name)) <> ALL (ARRAY['total','totals','grand total','subtotal','sub-total','various','n/a','na','unknown','tbc','other'])) AND (justice_funding.recipient_abn IN ( SELECT base.abn
                   FROM base))
          GROUP BY justice_funding.recipient_abn
        ), ct AS (
         SELECT austender_contracts.supplier_abn AS abn,
            count(*) AS contract_count,
            sum(austender_contracts.contract_value) AS contract_value,
            count(DISTINCT austender_contracts.buyer_name) AS distinct_buyers,
            max(austender_contracts.contract_end) AS last_contract_end,
            min(austender_contracts.contract_start) AS first_contract_start
           FROM austender_contracts
          WHERE (austender_contracts.supplier_abn IN ( SELECT base.abn
                   FROM base))
          GROUP BY austender_contracts.supplier_abn
        ), ac AS (
         SELECT DISTINCT ON (acnc_charities.abn) acnc_charities.abn,
            acnc_charities.charity_size,
            acnc_charities.name AS acnc_name,
            acnc_charities.registration_date AS acnc_registered_since
           FROM acnc_charities
          WHERE (acnc_charities.abn IN ( SELECT base.abn
                   FROM base))
          ORDER BY acnc_charities.abn, acnc_charities.registration_date
        )
 SELECT b.gs_id,
    b.abn,
    b.canonical_name,
    b.entity_type,
    b.state,
    b.postcode,
    b.sector,
    b.lga_name,
    b.is_community_controlled,
    jf.justice_dollars,
    jf.justice_record_count,
    jf.distinct_justice_programs,
    jf.justice_states,
    ct.contract_count,
    ct.contract_value,
    ct.distinct_buyers,
    ct.last_contract_end,
    ct.first_contract_start,
    ac.charity_size,
    ac.acnc_name,
    ac.acnc_registered_since,
    ac.abn IS NOT NULL AS has_acnc,
    COALESCE(jf.justice_dollars, 0::numeric) + COALESCE(ct.contract_value, 0::numeric) AS total_evidence_dollars,
    (EXISTS ( SELECT 1
           FROM alma_interventions ai
          WHERE ai.gs_entity_id = b.entity_id AND (EXISTS ( SELECT 1
                   FROM alma_intervention_evidence e
                  WHERE e.intervention_id = ai.id)) AND (EXISTS ( SELECT 1
                   FROM alma_intervention_outcomes o
                  WHERE o.intervention_id = ai.id)))) AS has_alma_evidence_outcomes
   FROM base b
     LEFT JOIN jf ON jf.abn = b.abn
     LEFT JOIN ct ON ct.abn = b.abn
     LEFT JOIN ac ON ac.abn = b.abn;

CREATE UNIQUE INDEX mv_justice_proven_suppliers_abn_idx ON public.mv_justice_proven_suppliers USING btree (abn);
CREATE INDEX mv_justice_proven_suppliers_gsid_idx ON public.mv_justice_proven_suppliers USING btree (gs_id);
CREATE INDEX mv_justice_proven_suppliers_state_idx ON public.mv_justice_proven_suppliers USING btree (state);
CREATE INDEX mv_justice_proven_suppliers_dollars_idx ON public.mv_justice_proven_suppliers USING btree (total_evidence_dollars DESC);
CREATE INDEX mv_justice_proven_suppliers_alma_idx ON public.mv_justice_proven_suppliers USING btree (has_alma_evidence_outcomes) WHERE has_alma_evidence_outcomes;
GRANT ALL ON public.mv_justice_proven_suppliers TO anon;
GRANT ALL ON public.mv_justice_proven_suppliers TO authenticated;
GRANT ALL ON public.mv_justice_proven_suppliers TO service_role;
GRANT SELECT ON public.mv_justice_proven_suppliers TO agent_readonly;

COMMIT;
