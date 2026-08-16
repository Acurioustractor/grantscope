-- The person trio: money filters + de-collide (fix #5, the last SEVERE from the money-views audit)
--
-- Apply:
--   source .env && PGPASSWORD="$DATABASE_PASSWORD" psql -h aws-0-ap-southeast-2.pooler.supabase.com \
--     -p 5432 -U "postgres.tednluwflfhxyucgwigh" -d postgres \
--     -f supabase/migrations/20260816150000_person_trio_money_filters.sql
--
-- WHY. thoughts/shared/data-map/unfiltered-money-views-audit.md: the person→money lane
-- (mv_person_network, mv_person_entity_network, mv_person_entity_crosswalk) sums justice_funding
-- with no measure_kind/is_aggregate/name filters and political_donations with no receipt_type
-- filter. Measured before this migration: mv_person_network attributes $181.0bn of justice money
-- to people (the honest whole-table grant figure is $33.98bn) and $449.6bn of contracts.
--
-- Three defects fixed, all at the source CTEs:
--   1. justice_funding reads gain the three mandatory filters (measure_kind='grant',
--      is_aggregate IS NOT TRUE, aggregate-shaped recipient names excluded).
--   2. political_donations reads gain receipt_type='donation received' ('other receipt' is 72%
--      of rows and 85% of dollars and is not donations).
--   3. mv_person_network fan-out: duplicate (person, ABN) role rows multiplied every joined
--      dollar (count used DISTINCT ids, sum did not). Money CTEs now join through a DISTINCT
--      (person, ABN) pair set, which also excludes is_nominee_block rows — a professional
--      nominee at thousands of companies is not a person holding that money.
--
-- Grain unchanged on all three; columns unchanged; every downstream relation recreated VERBATIM
-- from its live pg_get_viewdef, indexes and grants restored exactly (v_goods_foundation_targets
-- keeps its legacy blanket GRANT ALL to anon/authenticated — pre-existing posture question,
-- same flag as mv_justice_proven_suppliers, not widened and not fixed here).
--
-- Cascade set (captured live via pg_depend): mv_donor_person_crosslink · mv_person_identity_network
-- · mv_person_influence · mv_person_identity_influence · mv_person_identity_influence_v2
-- · mv_trustee_grantee_chain · mv_foundation_scores · mv_foundation_readiness · v_goods_foundation_targets · v_goods_warm_intros

BEGIN;

DROP MATERIALIZED VIEW public.mv_person_network CASCADE;
DROP MATERIALIZED VIEW public.mv_person_entity_network CASCADE;
DROP MATERIALIZED VIEW public.mv_person_entity_crosswalk CASCADE;

-- ===== mv_person_network =====
CREATE MATERIALIZED VIEW public.mv_person_network AS
WITH person_boards AS (
         SELECT person_roles.person_name_normalised,
            count(DISTINCT person_roles.company_abn) FILTER (WHERE person_roles.company_abn IS NOT NULL) AS board_count,
            count(*) AS role_count,
            array_agg(DISTINCT person_roles.source) AS sources,
            array_agg(DISTINCT person_roles.company_abn) FILTER (WHERE person_roles.company_abn IS NOT NULL) AS org_abns,
            bool_or(person_roles.source ~~ '%parliament%'::text OR person_roles.source = 'openpolitics_au'::text) AS is_politician,
            bool_or(person_roles.source = 'foundation_board'::text) AS is_foundation_trustee
           FROM person_roles
          WHERE person_roles.person_name_normalised IS NOT NULL AND person_roles.person_name_normalised <> ''::text
          GROUP BY person_roles.person_name_normalised
        ), person_donations AS (
         SELECT upper(TRIM(BOTH FROM regexp_replace(pd_1.donor_name, '\s+'::text, ' '::text, 'g'::text))) AS person_name_normalised,
            count(*) AS donation_count,
            count(DISTINCT pd_1.donation_to) AS parties_count,
            sum(pd_1.amount)::bigint AS total_donated
           FROM political_donations pd_1
          WHERE pd_1.amount > 0::numeric AND pd_1.donor_name IS NOT NULL
            AND pd_1.receipt_type = 'donation received'
          GROUP BY (upper(TRIM(BOTH FROM regexp_replace(pd_1.donor_name, '\s+'::text, ' '::text, 'g'::text))))
        ), person_org_pairs AS (
         -- De-collide: one row per (person, ABN). Duplicate role rows at the same company were
         -- multiplying every joined dollar; nominee-block rows attribute thousands of companies'
         -- money to one professional nominee and are excluded from money attribution entirely.
         SELECT DISTINCT person_roles.person_name_normalised,
            person_roles.company_abn
           FROM person_roles
          WHERE person_roles.company_abn IS NOT NULL
            AND NOT EXISTS ( SELECT 1
                   FROM person_identities pi
                  WHERE pi.person_name_normalised = person_roles.person_name_normalised
                    AND pi.is_nominee_block)
        ), person_contracts AS (
         SELECT pr.person_name_normalised,
            count(DISTINCT ac.id) AS contract_count,
            sum(ac.contract_value)::bigint AS total_contract_value
           FROM person_org_pairs pr
             JOIN austender_contracts ac ON ac.supplier_abn = pr.company_abn
          WHERE ac.contract_value > 0::numeric
          GROUP BY pr.person_name_normalised
        ), person_justice AS (
         SELECT pr.person_name_normalised,
            count(DISTINCT jf.id) AS justice_grant_count,
            sum(jf.amount_dollars)::bigint AS total_justice_funding
           FROM person_org_pairs pr
             JOIN justice_funding jf ON jf.recipient_abn = pr.company_abn
          WHERE jf.amount_dollars > 0::numeric
            AND jf.measure_kind = 'grant'
            AND jf.is_aggregate IS NOT TRUE
            AND lower(btrim(jf.recipient_name)) <> ALL (ARRAY['total','totals','grand total','subtotal','sub-total','various','n/a','na','unknown','tbc','other'])
          GROUP BY pr.person_name_normalised
        ), person_foundations AS (
         SELECT pr.person_name_normalised,
            count(DISTINCT f.id) AS foundation_count,
            sum(f.total_giving_annual)::bigint AS total_foundation_giving
           FROM person_org_pairs pr
             JOIN foundations f ON f.acnc_abn = pr.company_abn
          WHERE f.total_giving_annual > 0::numeric
          GROUP BY pr.person_name_normalised
        )
 SELECT pb.person_name_normalised,
    pb.board_count,
    pb.role_count,
    pb.sources,
    pb.org_abns,
    pb.is_politician,
    pb.is_foundation_trustee,
    COALESCE(pd.donation_count, 0::bigint) AS donation_count,
    COALESCE(pd.parties_count, 0::bigint) AS parties_donated_to,
    COALESCE(pd.total_donated, 0::bigint) AS total_donated,
    COALESCE(pc.contract_count, 0::bigint) AS contract_count,
    COALESCE(pc.total_contract_value, 0::bigint) AS total_contract_value,
    COALESCE(pj.justice_grant_count, 0::bigint) AS justice_grant_count,
    COALESCE(pj.total_justice_funding, 0::bigint) AS total_justice_funding,
    COALESCE(pf.foundation_count, 0::bigint) AS foundation_count,
    COALESCE(pf.total_foundation_giving, 0::bigint) AS total_foundation_giving,
        CASE
            WHEN pb.board_count > 0 THEN 1
            ELSE 0
        END +
        CASE
            WHEN COALESCE(pd.total_donated, 0::bigint) > 0 THEN 1
            ELSE 0
        END +
        CASE
            WHEN COALESCE(pc.contract_count, 0::bigint) > 0 THEN 1
            ELSE 0
        END +
        CASE
            WHEN COALESCE(pj.justice_grant_count, 0::bigint) > 0 THEN 1
            ELSE 0
        END +
        CASE
            WHEN COALESCE(pf.foundation_count, 0::bigint) > 0 THEN 1
            ELSE 0
        END +
        CASE
            WHEN pb.is_politician THEN 1
            ELSE 0
        END AS system_count,
    LEAST(pb.board_count, 20::bigint) * 2 +
        CASE
            WHEN COALESCE(pd.total_donated, 0::bigint) > 0 THEN LEAST(log((pd.total_donated + 1)::double precision)::integer, 20)
            ELSE 0
        END +
        CASE
            WHEN COALESCE(pc.total_contract_value, 0::bigint) > 0 THEN LEAST(log((pc.total_contract_value + 1)::double precision)::integer, 20)
            ELSE 0
        END +
        CASE
            WHEN COALESCE(pj.total_justice_funding, 0::bigint) > 0 THEN LEAST(log((pj.total_justice_funding + 1)::double precision)::integer, 15)
            ELSE 0
        END +
        CASE
            WHEN COALESCE(pf.total_foundation_giving, 0::bigint) > 0 THEN LEAST(log((pf.total_foundation_giving + 1)::double precision)::integer, 15)
            ELSE 0
        END +
        CASE
            WHEN pb.is_politician THEN 10
            ELSE 0
        END + (
        CASE
            WHEN pb.board_count > 0 THEN 1
            ELSE 0
        END +
        CASE
            WHEN COALESCE(pd.total_donated, 0::bigint) > 0 THEN 1
            ELSE 0
        END +
        CASE
            WHEN COALESCE(pc.contract_count, 0::bigint) > 0 THEN 1
            ELSE 0
        END +
        CASE
            WHEN COALESCE(pj.justice_grant_count, 0::bigint) > 0 THEN 1
            ELSE 0
        END +
        CASE
            WHEN COALESCE(pf.foundation_count, 0::bigint) > 0 THEN 1
            ELSE 0
        END +
        CASE
            WHEN pb.is_politician THEN 1
            ELSE 0
        END) * 5 AS power_score
   FROM person_boards pb
     LEFT JOIN person_donations pd ON pd.person_name_normalised = pb.person_name_normalised
     LEFT JOIN person_contracts pc ON pc.person_name_normalised = pb.person_name_normalised
     LEFT JOIN person_justice pj ON pj.person_name_normalised = pb.person_name_normalised
     LEFT JOIN person_foundations pf ON pf.person_name_normalised = pb.person_name_normalised;

-- ===== mv_person_entity_network =====
CREATE MATERIALIZED VIEW public.mv_person_entity_network AS
WITH person_boards AS (
         SELECT pr.person_name_normalised,
            min(pr.person_name) AS person_name_display,
            pr.entity_id,
            e.canonical_name AS entity_name,
            e.abn AS entity_abn,
            e.entity_type,
            e.is_community_controlled,
            pr.role_type,
            pr.source,
            pr.appointment_date,
            pr.cessation_date
           FROM person_roles pr
             JOIN gs_entities e ON e.id = pr.entity_id
          WHERE pr.entity_id IS NOT NULL AND pr.cessation_date IS NULL
          GROUP BY pr.person_name_normalised, pr.entity_id, e.canonical_name, e.abn, e.entity_type, e.is_community_controlled, pr.role_type, pr.source, pr.appointment_date, pr.cessation_date
        ), relevant_entities AS (
         SELECT DISTINCT person_boards.entity_id
           FROM person_boards
        ), person_entity_count AS (
         SELECT person_boards.person_name_normalised,
            count(DISTINCT person_boards.entity_id) AS board_count
           FROM person_boards
          GROUP BY person_boards.person_name_normalised
        ), procurement_agg AS (
         SELECT e.id AS entity_id,
            sum(ac.contract_value) AS contract_total,
            count(*) AS contract_count
           FROM austender_contracts ac
             JOIN gs_entities e ON e.abn = ac.supplier_abn
          WHERE ac.supplier_abn IS NOT NULL AND (e.id IN ( SELECT relevant_entities.entity_id
                   FROM relevant_entities))
          GROUP BY e.id
        ), justice_agg AS (
         SELECT justice_funding.gs_entity_id AS entity_id,
            sum(justice_funding.amount_dollars) AS justice_total,
            count(*) AS justice_count
           FROM justice_funding
          WHERE (justice_funding.gs_entity_id IN ( SELECT relevant_entities.entity_id
                   FROM relevant_entities))
            AND justice_funding.measure_kind = 'grant'
            AND justice_funding.is_aggregate IS NOT TRUE
            AND lower(btrim(justice_funding.recipient_name)) <> ALL (ARRAY['total','totals','grand total','subtotal','sub-total','various','n/a','na','unknown','tbc','other'])
          GROUP BY justice_funding.gs_entity_id
        ), donation_agg AS (
         SELECT e.id AS entity_id,
            sum(pd.amount) AS donation_total,
            count(*) AS donation_count
           FROM political_donations pd
             JOIN gs_entities e ON e.abn = pd.donor_abn
          WHERE pd.donor_abn IS NOT NULL AND pd.receipt_type = 'donation received'
            AND (e.id IN ( SELECT relevant_entities.entity_id
                   FROM relevant_entities))
          GROUP BY e.id
        )
 SELECT pb.person_name_normalised,
    pb.person_name_display,
    pb.entity_id,
    pb.entity_name,
    pb.entity_abn,
    pb.entity_type,
    pb.is_community_controlled,
    pb.role_type,
    pb.source,
    pb.appointment_date,
    pec.board_count,
    COALESCE(pa.contract_total, 0::numeric) AS procurement_dollars,
    COALESCE(pa.contract_count, 0::bigint) AS contract_count,
    COALESCE(ja.justice_total, 0::numeric) AS justice_dollars,
    COALESCE(ja.justice_count, 0::bigint) AS justice_count,
    COALESCE(da.donation_total, 0::numeric) AS donation_dollars,
    COALESCE(da.donation_count, 0::bigint) AS donation_count,
    pec.board_count::numeric * (1::numeric + ln(1::numeric + COALESCE(pa.contract_total, 0::numeric) + COALESCE(ja.justice_total, 0::numeric) + COALESCE(da.donation_total, 0::numeric))) AS influence_score
   FROM person_boards pb
     JOIN person_entity_count pec ON pec.person_name_normalised = pb.person_name_normalised
     LEFT JOIN procurement_agg pa ON pa.entity_id = pb.entity_id
     LEFT JOIN justice_agg ja ON ja.entity_id = pb.entity_id
     LEFT JOIN donation_agg da ON da.entity_id = pb.entity_id
  WHERE pec.board_count >= 1
  ORDER BY (pec.board_count::numeric * (1::numeric + ln(1::numeric + COALESCE(pa.contract_total, 0::numeric) + COALESCE(ja.justice_total, 0::numeric) + COALESCE(da.donation_total, 0::numeric)))) DESC;

-- ===== mv_person_entity_crosswalk =====
CREATE MATERIALIZED VIEW public.mv_person_entity_crosswalk AS
WITH person_orgs AS (
         SELECT person_roles.person_name_normalised,
            person_roles.company_abn,
            array_agg(DISTINCT person_roles.source) AS sources,
            array_agg(DISTINCT person_roles.role_type) AS roles
           FROM person_roles
          WHERE person_roles.person_name_normalised IS NOT NULL AND person_roles.company_abn IS NOT NULL
          GROUP BY person_roles.person_name_normalised, person_roles.company_abn
        ), person_entities AS (
         SELECT po.person_name_normalised,
            po.company_abn,
            po.sources,
            po.roles,
            ge.id AS entity_id,
            ge.gs_id,
            ge.canonical_name,
            ge.entity_type,
            ge.sector,
            ge.state,
            ge.is_community_controlled
           FROM person_orgs po
             JOIN gs_entities ge ON ge.abn = po.company_abn
        )
 SELECT pe.person_name_normalised,
    pe.company_abn,
    pe.sources AS role_sources,
    pe.roles,
    pe.entity_id,
    pe.gs_id,
    pe.canonical_name,
    pe.entity_type,
    pe.sector,
    pe.state,
    pe.is_community_controlled,
    COALESCE(ac.contract_total, 0::bigint) AS contract_dollars,
    COALESCE(ac.contract_count, 0::bigint) AS contract_count,
    COALESCE(jf.justice_total, 0::bigint) AS justice_dollars,
    COALESCE(jf.justice_count, 0::bigint) AS justice_count,
    COALESCE(pd.donation_total, 0::bigint) AS donation_dollars,
    COALESCE(pd.donation_count, 0::bigint) AS donation_count
   FROM person_entities pe
     LEFT JOIN LATERAL ( SELECT sum(austender_contracts.contract_value)::bigint AS contract_total,
            count(*) AS contract_count
           FROM austender_contracts
          WHERE austender_contracts.supplier_abn = pe.company_abn) ac ON true
     LEFT JOIN LATERAL ( SELECT sum(justice_funding.amount_dollars)::bigint AS justice_total,
            count(*) AS justice_count
           FROM justice_funding
          WHERE justice_funding.recipient_abn = pe.company_abn
            AND justice_funding.measure_kind = 'grant'
            AND justice_funding.is_aggregate IS NOT TRUE
            AND lower(btrim(justice_funding.recipient_name)) <> ALL (ARRAY['total','totals','grand total','subtotal','sub-total','various','n/a','na','unknown','tbc','other'])) jf ON true
     LEFT JOIN LATERAL ( SELECT sum(political_donations.amount)::bigint AS donation_total,
            count(*) AS donation_count
           FROM political_donations
          WHERE political_donations.donor_abn = pe.company_abn
            AND political_donations.receipt_type = 'donation received') pd ON true;

-- ===== mv_donor_person_crosslink =====
CREATE MATERIALIZED VIEW public.mv_donor_person_crosslink AS
WITH donor_totals AS (
         SELECT upper(TRIM(BOTH FROM regexp_replace(political_donations.donor_name, '\s+'::text, ' '::text, 'g'::text))) AS person_name_normalised,
            political_donations.donor_name,
            count(*) AS donation_count,
            count(DISTINCT political_donations.donation_to) AS parties_count,
            sum(political_donations.amount)::bigint AS total_donated,
            array_agg(DISTINCT political_donations.donation_to) AS parties,
            array_agg(DISTINCT political_donations.financial_year) AS donation_years,
            min(political_donations.donation_date) AS first_donation,
            max(political_donations.donation_date) AS last_donation
           FROM political_donations
          WHERE political_donations.donor_abn IS NULL AND political_donations.amount > 0::numeric AND political_donations.donor_name IS NOT NULL
          GROUP BY (upper(TRIM(BOTH FROM regexp_replace(political_donations.donor_name, '\s+'::text, ' '::text, 'g'::text)))), political_donations.donor_name
        )
 SELECT dt.person_name_normalised,
    dt.donor_name,
    dt.donation_count,
    dt.parties_count,
    dt.total_donated,
    dt.parties,
    dt.donation_years,
    dt.first_donation,
    dt.last_donation,
    pd.board_count,
    pd.org_abns,
    pd.sources AS board_sources,
    pd.is_foundation_trustee,
    pd.is_politician,
    pd.total_contract_value,
    pd.total_justice_funding,
    pd.power_score,
    pd.system_count
   FROM donor_totals dt
     JOIN mv_person_network pd ON pd.person_name_normalised = dt.person_name_normalised;

-- ===== mv_person_identity_network =====
CREATE MATERIALIZED VIEW public.mv_person_identity_network AS
WITH idmap AS (
         SELECT DISTINCT pr.person_name_normalised,
            pr.entity_id,
            pi.identity_key,
            pi.is_nominee_block
           FROM person_identities pi
             JOIN person_roles pr ON pr.id = pi.role_id
        ), net AS (
         SELECT COALESCE(m.identity_key, n.person_name_normalised) AS identity_key,
            n.person_name_normalised,
            n.person_name_display,
            n.entity_id,
            n.entity_name,
            n.entity_abn,
            n.entity_type,
            n.source,
            n.is_community_controlled,
            COALESCE(m.is_nominee_block, false) AS is_nominee_block,
            n.procurement_dollars,
            n.contract_count,
            n.justice_dollars,
            n.justice_count,
            n.donation_dollars,
            n.donation_count
           FROM mv_person_entity_network n
             LEFT JOIN idmap m ON m.person_name_normalised = n.person_name_normalised AND m.entity_id = n.entity_id
        )
 SELECT identity_key,
    min(person_name_normalised) AS person_name_normalised,
    min(person_name_display) AS person_name_display,
    entity_id,
    min(entity_name) AS entity_name,
    min(entity_abn) AS entity_abn,
    min(entity_type) AS entity_type,
    bool_or(is_community_controlled) AS is_community_controlled,
    bool_or(is_nominee_block) AS is_nominee_block,
    array_agg(DISTINCT source) AS sources,
    max(procurement_dollars) AS procurement_dollars,
    max(contract_count) AS contract_count,
    max(justice_dollars) AS justice_dollars,
    max(justice_count) AS justice_count,
    max(donation_dollars) AS donation_dollars,
    max(donation_count) AS donation_count
   FROM net
  GROUP BY identity_key, entity_id;

-- ===== mv_person_influence =====
CREATE MATERIALIZED VIEW public.mv_person_influence AS
SELECT person_name_normalised,
    min(person_name_display) AS person_name,
    count(DISTINCT entity_id) AS board_count,
    count(DISTINCT entity_id) FILTER (WHERE is_community_controlled) AS acco_boards,
    array_agg(DISTINCT entity_type) AS entity_types,
    array_agg(DISTINCT source) AS data_sources,
    sum(procurement_dollars) AS total_procurement,
    sum(contract_count) AS total_contracts,
    sum(justice_dollars) AS total_justice,
    sum(donation_dollars) AS total_donations,
    max(influence_score) AS max_influence_score,
    (sum(procurement_dollars) > 0::numeric)::integer + (sum(justice_dollars) > 0::numeric)::integer + (sum(donation_dollars) > 0::numeric)::integer AS financial_system_count
   FROM mv_person_entity_network
  GROUP BY person_name_normalised
  ORDER BY (max(influence_score)) DESC;

-- ===== mv_person_identity_influence =====
CREATE MATERIALIZED VIEW public.mv_person_identity_influence AS
SELECT identity_key,
    min(person_name_normalised) AS person_name_normalised,
    min(person_name_display) AS person_name,
    bool_or(is_nominee_block) AS is_nominee_block,
    count(*) AS board_count,
    count(*) FILTER (WHERE is_community_controlled) AS acco_boards,
    array_agg(DISTINCT entity_type) AS entity_types,
    sum(procurement_dollars) AS total_procurement,
    sum(contract_count) AS total_contracts,
    sum(justice_dollars) AS total_justice,
    sum(donation_dollars) AS total_donations,
    (sum(procurement_dollars) > 0::numeric)::integer + (sum(justice_dollars) > 0::numeric)::integer + (sum(donation_dollars) > 0::numeric)::integer AS financial_system_count,
    count(*)::numeric * (1::numeric + ln(1::numeric + sum(procurement_dollars) + sum(justice_dollars) + sum(donation_dollars))) AS influence_score
   FROM mv_person_identity_network
  GROUP BY identity_key;

-- ===== mv_person_identity_influence_v2 =====
CREATE MATERIALIZED VIEW public.mv_person_identity_influence_v2 AS
WITH entity_directors AS (
         SELECT mv_person_identity_network.entity_id,
            count(DISTINCT mv_person_identity_network.identity_key) AS director_count
           FROM mv_person_identity_network
          GROUP BY mv_person_identity_network.entity_id
        ), edges AS (
         SELECT n.identity_key,
            n.person_name_normalised,
            n.person_name_display,
            n.entity_id,
            n.entity_name,
            n.entity_abn,
            n.entity_type,
            n.is_community_controlled,
            n.is_nominee_block,
            n.sources,
            n.procurement_dollars,
            n.contract_count,
            n.justice_dollars,
            n.justice_count,
            n.donation_dollars,
            n.donation_count,
            GREATEST(COALESCE(ed.director_count, 1::bigint), 1::bigint) AS director_count
           FROM mv_person_identity_network n
             LEFT JOIN entity_directors ed ON ed.entity_id = n.entity_id
        )
 SELECT identity_key,
    min(person_name_normalised) AS person_name_normalised,
    min(person_name_display) AS person_name,
    bool_or(is_nominee_block) AS is_nominee_block,
    count(*) AS board_count,
    count(*) FILTER (WHERE is_community_controlled) AS acco_boards,
    array_agg(DISTINCT entity_type) AS entity_types,
    sum(procurement_dollars) AS total_procurement_affiliated,
    sum(justice_dollars) AS total_justice_affiliated,
    sum(donation_dollars) AS total_donations_affiliated,
    sum(procurement_dollars / director_count::numeric) AS attributed_procurement,
    sum(justice_dollars / director_count::numeric) AS attributed_justice,
    sum(donation_dollars / director_count::numeric) AS attributed_donations,
    sum(contract_count) AS total_contracts,
    bool_or(director_count > 1) AS shares_board_entities,
    max(procurement_dollars) AS max_single_entity_procurement,
    max(director_count) AS max_board_director_count,
    (sum(procurement_dollars / director_count::numeric) > 0::numeric)::integer + (sum(justice_dollars / director_count::numeric) > 0::numeric)::integer + (sum(donation_dollars / director_count::numeric) > 0::numeric)::integer AS financial_system_count,
    count(*)::numeric * (1::numeric + ln(1::numeric + sum((procurement_dollars + justice_dollars + donation_dollars) / director_count::numeric))) AS influence_score_attributed
   FROM edges
  GROUP BY identity_key;

-- ===== mv_trustee_grantee_chain =====
CREATE MATERIALIZED VIEW public.mv_trustee_grantee_chain AS
WITH foundation_trustees AS (
         SELECT DISTINCT pec.person_name_normalised,
            pec.company_abn AS foundation_abn,
            pec.canonical_name AS foundation_name,
            pec.roles,
            pec.role_sources
           FROM mv_person_entity_crosswalk pec
          WHERE pec.entity_type = 'foundation'::text
        ), foundation_grantees AS (
         SELECT DISTINCT fg_1.foundation_name,
            fg_1.foundation_abn,
            fg_1.grantee_name,
            fg_1.grantee_abn,
            fg_1.link_method,
            fg_1.grant_year
           FROM mv_foundation_grantees fg_1
        )
 SELECT ft.person_name_normalised AS trustee_name,
    ft.foundation_name,
    ft.foundation_abn,
    ft.roles AS trustee_roles,
    fg.grantee_name,
    fg.grantee_abn,
    fg.link_method,
    fg.grant_year,
    (EXISTS ( SELECT 1
           FROM mv_person_entity_crosswalk pec2
          WHERE pec2.person_name_normalised = ft.person_name_normalised AND pec2.company_abn = fg.grantee_abn)) AS trustee_on_grantee_board
   FROM foundation_trustees ft
     JOIN foundation_grantees fg ON fg.foundation_abn = ft.foundation_abn;

-- ===== mv_foundation_scores =====
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

-- ===== mv_foundation_readiness (third-order: depends on mv_foundation_scores) =====
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

-- ===== v_goods_foundation_targets =====
CREATE VIEW public.v_goods_foundation_targets AS
WITH themes AS (
         SELECT ARRAY['indigenous'::text, 'aboriginal'::text, 'rural_remote'::text, 'social-enterprise'::text, 'housing'::text, 'employment'::text, 'economic_development'::text, 'regenerative'::text, 'agriculture'::text] AS arr
        ), goods_rel AS (
         SELECT DISTINCT goods_relationships.entity_id,
            goods_relationships.display_name,
            goods_relationships.warmth_display AS warmth
           FROM goods_relationships
          WHERE goods_relationships.entity_id IS NOT NULL
        ), goods_ent AS (
         SELECT DISTINCT goods_rel.entity_id
           FROM goods_rel
        ), goods_people AS (
         SELECT DISTINCT ON (pen.person_name_normalised) pen.person_name_normalised,
            pen.person_name_display,
            gr.display_name AS goods_org,
            gr.warmth
           FROM mv_person_entity_network pen
             JOIN goods_rel gr ON gr.entity_id = pen.entity_id
          WHERE pen.board_count >= 2 AND pen.board_count <= 15
          ORDER BY pen.person_name_normalised, gr.warmth DESC
        ), bridge AS (
         SELECT DISTINCT ON (pen.entity_id) pen.entity_id AS cand_entity,
            gp.person_name_display AS connector,
            gp.goods_org AS bridged_org,
            gp.warmth AS bridged_warmth
           FROM mv_person_entity_network pen
             JOIN goods_people gp ON gp.person_name_normalised = pen.person_name_normalised
          WHERE pen.board_count >= 2 AND pen.board_count <= 15
          ORDER BY pen.entity_id, gp.warmth DESC
        ), cand AS (
         SELECT f.id,
            f.name,
            f.gs_entity_id,
            f.total_giving_annual,
            f.avg_grant_size,
            f.grant_range_min,
            f.grant_range_max,
            f.has_dgr,
            f.geographic_focus,
            cardinality(ARRAY( SELECT unnest(f.thematic_focus) AS unnest
                INTERSECT
                 SELECT unnest(( SELECT themes.arr
                           FROM themes)) AS unnest)) AS theme_hits,
            ARRAY( SELECT unnest(f.thematic_focus) AS unnest
                INTERSECT
                 SELECT unnest(( SELECT themes.arr
                           FROM themes)) AS unnest) AS matched_themes
           FROM foundations f
          WHERE f.thematic_focus && (( SELECT themes.arr
                   FROM themes)) AND f.gs_entity_id IS NOT NULL AND NOT (f.gs_entity_id IN ( SELECT goods_ent.entity_id
                   FROM goods_ent))
        )
 SELECT c.id,
    c.name,
    c.gs_entity_id,
    c.total_giving_annual,
    c.avg_grant_size,
    c.grant_range_min,
    c.grant_range_max,
    c.has_dgr,
    c.theme_hits,
    c.matched_themes,
    c.geographic_focus,
    b.connector,
    b.bridged_org,
    b.bridged_warmth,
    b.connector IS NOT NULL AS has_bridge,
    round((
        CASE
            WHEN b.connector IS NOT NULL THEN 1000
            ELSE 0
        END + c.theme_hits * 100 +
        CASE
            WHEN c.has_dgr THEN 50
            ELSE 0
        END)::numeric + LEAST(50::numeric, COALESCE(c.total_giving_annual, 0::numeric) / 1000000.0 * 10::numeric))::integer AS priority_score
   FROM cand c
     LEFT JOIN bridge b ON b.cand_entity = c.gs_entity_id;

-- ===== v_goods_warm_intros =====
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


-- ===== indexes, exactly as captured =====
CREATE INDEX idx_donor_person_name ON public.mv_donor_person_crosslink USING btree (person_name_normalised);
CREATE INDEX idx_donor_person_donated ON public.mv_donor_person_crosslink USING btree (total_donated DESC);
CREATE INDEX idx_donor_person_power ON public.mv_donor_person_crosslink USING btree (power_score DESC);
CREATE INDEX idx_donor_person_trustee ON public.mv_donor_person_crosslink USING btree (is_foundation_trustee) WHERE (is_foundation_trustee = true);
CREATE INDEX idx_donor_person_politician ON public.mv_donor_person_crosslink USING btree (is_politician) WHERE (is_politician = true);
CREATE UNIQUE INDEX idx_fs_foundation ON public.mv_foundation_scores USING btree (foundation_id);
CREATE INDEX idx_fs_score ON public.mv_foundation_scores USING btree (foundation_score DESC);
CREATE INDEX idx_fs_abn ON public.mv_foundation_scores USING btree (acnc_abn);
CREATE INDEX idx_person_xwalk_name ON public.mv_person_entity_crosswalk USING btree (person_name_normalised);
CREATE INDEX idx_person_xwalk_entity ON public.mv_person_entity_crosswalk USING btree (entity_id);
CREATE INDEX idx_person_xwalk_abn ON public.mv_person_entity_crosswalk USING btree (company_abn);
CREATE INDEX idx_person_xwalk_contracts ON public.mv_person_entity_crosswalk USING btree (contract_dollars DESC) WHERE (contract_dollars > 0);
CREATE INDEX idx_person_xwalk_justice ON public.mv_person_entity_crosswalk USING btree (justice_dollars DESC) WHERE (justice_dollars > 0);
CREATE INDEX idx_person_xwalk_community ON public.mv_person_entity_crosswalk USING btree (is_community_controlled) WHERE (is_community_controlled = true);
CREATE INDEX idx_pen_board_count ON public.mv_person_entity_network USING btree (board_count DESC);
CREATE INDEX idx_pen_influence ON public.mv_person_entity_network USING btree (influence_score DESC);
CREATE INDEX idx_pen_entity ON public.mv_person_entity_network USING btree (entity_id);
CREATE UNIQUE INDEX mv_person_identity_influence_pk ON public.mv_person_identity_influence USING btree (identity_key);
CREATE INDEX mv_person_identity_influence_rank_idx ON public.mv_person_identity_influence USING btree (financial_system_count DESC, total_justice DESC) WHERE (NOT is_nominee_block);
CREATE UNIQUE INDEX idx_mpiv2_identity ON public.mv_person_identity_influence_v2 USING btree (identity_key);
CREATE INDEX idx_mpiv2_attr_influence ON public.mv_person_identity_influence_v2 USING btree (influence_score_attributed DESC);
CREATE INDEX idx_mpiv2_attr_proc ON public.mv_person_identity_influence_v2 USING btree (attributed_procurement DESC);
CREATE INDEX idx_mpiv2_not_nominee ON public.mv_person_identity_influence_v2 USING btree (is_nominee_block, board_count);
CREATE UNIQUE INDEX mv_person_identity_network_pk ON public.mv_person_identity_network USING btree (identity_key, entity_id);
CREATE INDEX mv_person_identity_network_name_idx ON public.mv_person_identity_network USING btree (person_name_normalised);
CREATE UNIQUE INDEX idx_pi_person ON public.mv_person_influence USING btree (person_name_normalised);
CREATE INDEX idx_pi_influence ON public.mv_person_influence USING btree (max_influence_score DESC);
CREATE INDEX idx_pi_board_count ON public.mv_person_influence USING btree (board_count DESC);
CREATE INDEX idx_person_network_power ON public.mv_person_network USING btree (power_score DESC);
CREATE INDEX idx_person_network_name ON public.mv_person_network USING btree (person_name_normalised);
CREATE INDEX idx_person_network_systems ON public.mv_person_network USING btree (system_count DESC);
CREATE INDEX idx_person_network_politician ON public.mv_person_network USING btree (is_politician) WHERE (is_politician = true);
CREATE INDEX idx_person_network_trustee ON public.mv_person_network USING btree (is_foundation_trustee) WHERE (is_foundation_trustee = true);
CREATE INDEX idx_person_network_donor ON public.mv_person_network USING btree (total_donated DESC) WHERE (total_donated > 0);
CREATE UNIQUE INDEX mv_trustee_grantee_chain_trustee_name_foundation_abn_grante_idx ON public.mv_trustee_grantee_chain USING btree (trustee_name, foundation_abn, grantee_abn, grant_year);

CREATE UNIQUE INDEX idx_fr_id ON public.mv_foundation_readiness USING btree (id);
CREATE INDEX idx_fr_readiness ON public.mv_foundation_readiness USING btree (readiness_score);
CREATE INDEX idx_fr_abn ON public.mv_foundation_readiness USING btree (acnc_abn);

-- ===== grants, exactly as captured from relacl =====
GRANT ALL ON public.mv_person_network TO service_role;
GRANT SELECT ON public.mv_person_network TO agent_readonly;
GRANT ALL ON public.mv_person_entity_network TO service_role;
GRANT SELECT ON public.mv_person_entity_network TO agent_readonly;
GRANT ALL ON public.mv_person_entity_crosswalk TO service_role;
GRANT SELECT ON public.mv_person_entity_crosswalk TO agent_readonly;
GRANT ALL ON public.mv_donor_person_crosslink TO service_role;
GRANT SELECT ON public.mv_donor_person_crosslink TO agent_readonly;
GRANT SELECT ON public.mv_person_identity_network TO agent_readonly;
GRANT ALL ON public.mv_person_influence TO service_role;
GRANT SELECT ON public.mv_person_influence TO agent_readonly;
GRANT SELECT ON public.mv_person_identity_influence TO agent_readonly;
GRANT SELECT ON public.mv_person_identity_influence_v2 TO agent_readonly;
GRANT SELECT ON public.mv_trustee_grantee_chain TO agent_readonly;
GRANT SELECT ON public.mv_foundation_scores TO agent_readonly;
GRANT SELECT ON public.mv_foundation_readiness TO agent_readonly;
-- v_goods_foundation_targets legacy posture restored verbatim (flagged above, not widened here)
GRANT ALL ON public.v_goods_foundation_targets TO anon, authenticated, service_role;
GRANT SELECT ON public.v_goods_foundation_targets TO agent_readonly;
GRANT SELECT ON public.v_goods_warm_intros TO anon, authenticated, service_role, agent_readonly;

COMMIT;
