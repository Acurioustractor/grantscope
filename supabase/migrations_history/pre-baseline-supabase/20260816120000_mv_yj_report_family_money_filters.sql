-- The mv_yj_report_* family: apply the mandatory money filters (fix #2 from the money-views audit)
--
-- Apply:
--   source .env && PGPASSWORD="$DATABASE_PASSWORD" psql -h aws-0-ap-southeast-2.pooler.supabase.com \
--     -p 5432 -U "postgres.tednluwflfhxyucgwigh" -d postgres \
--     -f supabase/migrations/20260816120000_mv_yj_report_family_money_filters.sql
--
-- These six matviews feed the PUBLIC QLD youth-justice snapshot (the most-sourced report in the
-- repo) via build-youth-justice-report-snapshot.mjs / refresh-youth-justice-report-cache.mjs.
-- They predate the measure_kind discovery and each hand-rolled partial exclusions (department-name
-- regexes, program_name !~~ 'Total%'). The hand rules mostly held on the state trio and acco_gap;
-- they failed completely on recipients and remoteness. Measured before:
--
--   recipients       1,548 rows  $43.85bn   honest topic figure is ~$1.0bn — 43x
--   remoteness           5 rows  $18.32bn   dept budget rows carry their head-office remoteness
--   acco_gap             2 rows   $1.02bn   ≈ honest (the public 12% ACCO claim survives)
--   state_programs      52 rows   $1.12bn   ≈ honest
--   state_top_orgs      59 rows   $0.46bn
--   state_program_partners  2,352 rows
--
-- The standard three filters are ADDED to every existing hand rule, never replacing them — the
-- department regexes exclude things measure_kind cannot (a department genuinely receiving a
-- grant), and the standard filters exclude things the regexes miss (lowercase totals, 'Various',
-- expenditure_aggregate rows with organisation-shaped names).
--
-- mv_yj_report_coverage is deliberately NOT touched: it is a manifest describing the whole topic
-- slice, aggregates included — that is its purpose. Definitions captured live via pg_get_viewdef;
-- only the topic-filter WHERE site is edited. No external dependents (checked pg_depend).
-- ACLs uniform (service_role ALL, agent_readonly SELECT) and restored per object.
-- After applying, re-run the snapshot: node scripts/build-youth-justice-report-snapshot.mjs

BEGIN;

-- mv_yj_report_recipients -------------------------------------------------------------------
DROP MATERIALIZED VIEW public.mv_yj_report_recipients;

CREATE MATERIALIZED VIEW public.mv_yj_report_recipients AS
 SELECT jf.recipient_name,
    jf.state,
    ge.gs_id,
    sum(jf.amount_dollars)::bigint AS total,
    count(*)::integer AS grants
   FROM justice_funding jf
     LEFT JOIN gs_entities ge ON ge.id = jf.gs_entity_id
  WHERE jf.topics @> ARRAY['youth-justice'::text] AND jf.measure_kind = 'grant' AND jf.is_aggregate IS NOT TRUE AND (jf.recipient_name IS NULL OR lower(btrim(jf.recipient_name)) <> ALL (ARRAY['total','totals','grand total','subtotal','sub-total','various','n/a','na','unknown','tbc','other'])) AND jf.recipient_name IS NOT NULL AND jf.source <> 'austender-direct'::text AND jf.program_name !~~ 'ROGS%'::text
  GROUP BY jf.recipient_name, jf.state, ge.gs_id;

CREATE INDEX idx_mv_yj_report_recipients_total ON public.mv_yj_report_recipients USING btree (total DESC NULLS LAST);
GRANT ALL ON public.mv_yj_report_recipients TO service_role;
GRANT SELECT ON public.mv_yj_report_recipients TO agent_readonly;

-- mv_yj_report_remoteness -------------------------------------------------------------------
DROP MATERIALIZED VIEW public.mv_yj_report_remoteness;

CREATE MATERIALIZED VIEW public.mv_yj_report_remoteness AS
 SELECT ge.remoteness,
    count(DISTINCT jf.recipient_name)::integer AS orgs,
    sum(jf.amount_dollars)::bigint AS total,
    count(*)::integer AS grants
   FROM justice_funding jf
     JOIN gs_entities ge ON ge.id = jf.gs_entity_id
  WHERE jf.topics @> ARRAY['youth-justice'::text] AND jf.measure_kind = 'grant' AND jf.is_aggregate IS NOT TRUE AND (jf.recipient_name IS NULL OR lower(btrim(jf.recipient_name)) <> ALL (ARRAY['total','totals','grand total','subtotal','sub-total','various','n/a','na','unknown','tbc','other'])) AND jf.source <> 'austender-direct'::text AND jf.program_name !~~ 'ROGS%'::text AND jf.program_name !~~ 'Total%'::text AND ge.remoteness IS NOT NULL
  GROUP BY ge.remoteness;

CREATE INDEX idx_mv_yj_report_remoteness_total ON public.mv_yj_report_remoteness USING btree (total DESC);
GRANT ALL ON public.mv_yj_report_remoteness TO service_role;
GRANT SELECT ON public.mv_yj_report_remoteness TO agent_readonly;

-- mv_yj_report_acco_gap ---------------------------------------------------------------------
DROP MATERIALIZED VIEW public.mv_yj_report_acco_gap;

CREATE MATERIALIZED VIEW public.mv_yj_report_acco_gap AS
 SELECT
        CASE
            WHEN ge.is_community_controlled THEN 'Community Controlled'::text
            ELSE 'Other service providers'::text
        END AS org_type,
    count(DISTINCT jf.recipient_name)::integer AS orgs,
    sum(jf.amount_dollars)::bigint AS total_funding,
    round(sum(jf.amount_dollars) / NULLIF(count(DISTINCT jf.recipient_name), 0)::numeric)::bigint AS avg_per_recipient,
    round(avg(jf.amount_dollars))::bigint AS avg_grant,
    count(*)::integer AS funding_rows,
    round(sum(jf.amount_dollars) / NULLIF(sum(sum(jf.amount_dollars)) OVER (), 0::numeric) * 100::numeric, 1)::double precision AS funding_share_pct
   FROM justice_funding jf
     JOIN gs_entities ge ON ge.id = jf.gs_entity_id
  WHERE jf.topics @> ARRAY['youth-justice'::text] AND jf.measure_kind = 'grant' AND jf.is_aggregate IS NOT TRUE AND (jf.recipient_name IS NULL OR lower(btrim(jf.recipient_name)) <> ALL (ARRAY['total','totals','grand total','subtotal','sub-total','various','n/a','na','unknown','tbc','other'])) AND jf.source <> 'austender-direct'::text AND jf.amount_dollars IS NOT NULL AND jf.amount_dollars > 0::numeric AND jf.recipient_name IS NOT NULL AND jf.recipient_name <> ''::text AND jf.recipient_name <> 'Total'::text AND jf.recipient_name !~* '^(Department of|Dept |Queensland Government|NSW Government|Victorian Government|Government of|State of|Commonwealth Government)'::text AND (jf.recipient_name <> ALL (ARRAY['Territory Families, Housing and Communities'::text, 'Community Services Directorate'::text])) AND jf.program_name !~~ 'ROGS%'::text AND jf.program_name !~~ 'Total%'::text
  GROUP BY (
        CASE
            WHEN ge.is_community_controlled THEN 'Community Controlled'::text
            ELSE 'Other service providers'::text
        END);


GRANT ALL ON public.mv_yj_report_acco_gap TO service_role;
GRANT SELECT ON public.mv_yj_report_acco_gap TO agent_readonly;

-- mv_yj_report_state_programs ---------------------------------------------------------------
DROP MATERIALIZED VIEW public.mv_yj_report_state_programs;

CREATE MATERIALIZED VIEW public.mv_yj_report_state_programs AS
 WITH provider_rows AS (
         SELECT jf.id,
            jf.source,
            jf.source_url,
            jf.source_statement_id,
            jf.recipient_name,
            jf.recipient_abn,
            jf.program_name,
            jf.program_round,
            jf.amount_dollars,
            jf.state,
            jf.location,
            jf.funding_type,
            jf.sector,
            jf.project_description,
            jf.announcement_date,
            jf.financial_year,
            jf.alma_intervention_id,
            jf.alma_organization_id,
            jf.created_at,
            jf.updated_at,
            jf.gs_entity_id,
            jf.topics,
            jf.is_aggregate
           FROM justice_funding jf
          WHERE jf.topics @> ARRAY['youth-justice'::text] AND jf.measure_kind = 'grant' AND jf.is_aggregate IS NOT TRUE AND (jf.recipient_name IS NULL OR lower(btrim(jf.recipient_name)) <> ALL (ARRAY['total','totals','grand total','subtotal','sub-total','various','n/a','na','unknown','tbc','other'])) AND jf.source <> 'austender-direct'::text AND jf.amount_dollars IS NOT NULL AND jf.amount_dollars > 0::numeric AND jf.state IS NOT NULL AND jf.program_name !~~ 'ROGS%'::text AND jf.program_name !~~ 'Total%'::text AND jf.program_name !~~ 'Government real%'::text AND jf.program_name !~~ 'Cost per%'::text AND jf.program_name !~~ 'Net capital%'::text AND jf.program_name !~~ 'Real recurrent%'::text AND jf.recipient_name IS NOT NULL AND jf.recipient_name <> ''::text AND jf.recipient_name <> 'Total'::text AND jf.recipient_name !~~ 'Youth Justice -%'::text AND jf.recipient_name !~~ 'Department of%'::text AND jf.recipient_name !~~ 'State of%'::text AND jf.recipient_name !~~ 'Multiple%'::text AND (jf.recipient_name <> ALL (ARRAY['Territory Families, Housing and Communities'::text, 'Community Services Directorate'::text]))
        )
 SELECT state,
    program_name,
    count(*)::integer AS grants,
    sum(amount_dollars)::bigint AS total,
    count(DISTINCT recipient_name)::integer AS orgs
   FROM provider_rows
  GROUP BY state, program_name;

CREATE INDEX idx_mv_yj_report_state_programs_state_total ON public.mv_yj_report_state_programs USING btree (state, total DESC NULLS LAST);
GRANT ALL ON public.mv_yj_report_state_programs TO service_role;
GRANT SELECT ON public.mv_yj_report_state_programs TO agent_readonly;

-- mv_yj_report_state_top_orgs ---------------------------------------------------------------
DROP MATERIALIZED VIEW public.mv_yj_report_state_top_orgs;

CREATE MATERIALIZED VIEW public.mv_yj_report_state_top_orgs AS
 WITH provider_rows AS (
         SELECT jf.id,
            jf.source,
            jf.source_url,
            jf.source_statement_id,
            jf.recipient_name,
            jf.recipient_abn,
            jf.program_name,
            jf.program_round,
            jf.amount_dollars,
            jf.state,
            jf.location,
            jf.funding_type,
            jf.sector,
            jf.project_description,
            jf.announcement_date,
            jf.financial_year,
            jf.alma_intervention_id,
            jf.alma_organization_id,
            jf.created_at,
            jf.updated_at,
            jf.gs_entity_id,
            jf.topics,
            jf.is_aggregate
           FROM justice_funding jf
          WHERE jf.topics @> ARRAY['youth-justice'::text] AND jf.measure_kind = 'grant' AND jf.is_aggregate IS NOT TRUE AND (jf.recipient_name IS NULL OR lower(btrim(jf.recipient_name)) <> ALL (ARRAY['total','totals','grand total','subtotal','sub-total','various','n/a','na','unknown','tbc','other'])) AND jf.source <> 'austender-direct'::text AND jf.amount_dollars IS NOT NULL AND jf.amount_dollars > 0::numeric AND jf.state IS NOT NULL AND jf.program_name !~~ 'ROGS%'::text AND jf.program_name !~~ 'Total%'::text AND jf.recipient_name IS NOT NULL AND jf.recipient_name <> ''::text AND jf.recipient_name <> 'Total'::text AND jf.recipient_name !~~ 'Youth Justice -%'::text AND jf.recipient_name !~~ 'Department of%'::text AND jf.recipient_name !~~ 'State of%'::text AND jf.recipient_name !~~ 'Multiple%'::text AND (jf.recipient_name <> ALL (ARRAY['Territory Families, Housing and Communities'::text, 'Community Services Directorate'::text]))
        ), ranked AS (
         SELECT jf.state,
            jf.recipient_name,
            jf.recipient_abn,
            sum(jf.amount_dollars)::bigint AS total,
            count(*)::integer AS grants,
            COALESCE(linked.gs_id, by_abn.gs_id) AS gs_id,
            row_number() OVER (PARTITION BY jf.state ORDER BY (sum(jf.amount_dollars)) DESC NULLS LAST, jf.recipient_name) AS rn
           FROM provider_rows jf
             LEFT JOIN gs_entities linked ON linked.id = jf.gs_entity_id
             LEFT JOIN LATERAL ( SELECT gs_entities.gs_id
                   FROM gs_entities
                  WHERE gs_entities.abn = jf.recipient_abn
                  ORDER BY gs_entities.source_count DESC NULLS LAST
                 LIMIT 1) by_abn ON jf.recipient_abn IS NOT NULL
          GROUP BY jf.state, jf.recipient_name, jf.recipient_abn, (COALESCE(linked.gs_id, by_abn.gs_id))
        )
 SELECT state,
    recipient_name,
    recipient_abn,
    grants,
    total,
    gs_id
   FROM ranked
  WHERE rn <= 50;

CREATE INDEX idx_mv_yj_report_state_top_orgs_state_total ON public.mv_yj_report_state_top_orgs USING btree (state, total DESC NULLS LAST);
GRANT ALL ON public.mv_yj_report_state_top_orgs TO service_role;
GRANT SELECT ON public.mv_yj_report_state_top_orgs TO agent_readonly;

-- mv_yj_report_state_program_partners -------------------------------------------------------
DROP MATERIALIZED VIEW public.mv_yj_report_state_program_partners;

CREATE MATERIALIZED VIEW public.mv_yj_report_state_program_partners AS
 WITH provider_rows AS (
         SELECT jf.id,
            jf.source,
            jf.source_url,
            jf.source_statement_id,
            jf.recipient_name,
            jf.recipient_abn,
            jf.program_name,
            jf.program_round,
            jf.amount_dollars,
            jf.state,
            jf.location,
            jf.funding_type,
            jf.sector,
            jf.project_description,
            jf.announcement_date,
            jf.financial_year,
            jf.alma_intervention_id,
            jf.alma_organization_id,
            jf.created_at,
            jf.updated_at,
            jf.gs_entity_id,
            jf.topics,
            jf.is_aggregate
           FROM justice_funding jf
          WHERE jf.topics @> ARRAY['youth-justice'::text] AND jf.measure_kind = 'grant' AND jf.is_aggregate IS NOT TRUE AND (jf.recipient_name IS NULL OR lower(btrim(jf.recipient_name)) <> ALL (ARRAY['total','totals','grand total','subtotal','sub-total','various','n/a','na','unknown','tbc','other'])) AND jf.source <> 'austender-direct'::text AND jf.amount_dollars IS NOT NULL AND jf.amount_dollars > 0::numeric AND jf.state IS NOT NULL AND jf.program_name !~~ 'ROGS%'::text AND jf.program_name !~~ 'Total%'::text AND jf.program_name !~~ 'Government real%'::text AND jf.program_name !~~ 'Cost per%'::text AND jf.program_name !~~ 'Net capital%'::text AND jf.program_name !~~ 'Real recurrent%'::text AND jf.recipient_name IS NOT NULL AND jf.recipient_name <> ''::text AND jf.recipient_name <> 'Total'::text AND jf.recipient_name !~~ 'Youth Justice -%'::text AND jf.recipient_name !~~ 'Department of%'::text AND jf.recipient_name !~~ 'State of%'::text AND jf.recipient_name !~~ 'Multiple%'::text AND (jf.recipient_name <> ALL (ARRAY['Territory Families, Housing and Communities'::text, 'Community Services Directorate'::text]))
        ), ranked AS (
         SELECT jf.state,
            jf.program_name,
            jf.recipient_name,
            jf.recipient_abn,
            sum(jf.amount_dollars)::bigint AS total,
            count(*)::integer AS grants,
            COALESCE(linked.gs_id, by_abn.gs_id) AS gs_id,
            COALESCE(linked.is_community_controlled, by_abn.is_community_controlled, false) AS is_community_controlled,
            row_number() OVER (PARTITION BY jf.state, jf.program_name ORDER BY (sum(jf.amount_dollars)) DESC NULLS LAST, jf.recipient_name) AS rn
           FROM provider_rows jf
             LEFT JOIN gs_entities linked ON linked.id = jf.gs_entity_id
             LEFT JOIN LATERAL ( SELECT gs_entities.gs_id,
                    gs_entities.is_community_controlled
                   FROM gs_entities
                  WHERE gs_entities.abn = jf.recipient_abn
                  ORDER BY gs_entities.source_count DESC NULLS LAST
                 LIMIT 1) by_abn ON jf.recipient_abn IS NOT NULL
          GROUP BY jf.state, jf.program_name, jf.recipient_name, jf.recipient_abn, (COALESCE(linked.gs_id, by_abn.gs_id)), (COALESCE(linked.is_community_controlled, by_abn.is_community_controlled, false))
        )
 SELECT state,
    program_name,
    recipient_name,
    recipient_abn,
    total,
    grants,
    gs_id,
    is_community_controlled,
    rn
   FROM ranked;

CREATE INDEX idx_mv_yj_report_state_program_partners_state_program ON public.mv_yj_report_state_program_partners USING btree (state, program_name, rn);
GRANT ALL ON public.mv_yj_report_state_program_partners TO service_role;
GRANT SELECT ON public.mv_yj_report_state_program_partners TO agent_readonly;

COMMIT;
