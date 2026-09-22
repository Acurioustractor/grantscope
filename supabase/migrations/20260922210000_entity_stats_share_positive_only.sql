-- mv_gs_entity_stats: compute top_counterparty_share from positive amounts only.
--
-- The share is max(counterparty total) / sum(counterparty totals). A negative counterparty
-- total (a contract variation that reduced the value, a grant refund) shrinks the sum and
-- pushes the share above 1. 12 of 3.4M edges carry a negative amount (8 qld_arts_grants,
-- 4 austender added by the 2026-09-22 rebuild); the first to land put DAVID SHAW
-- (AU-ABN-48879288726) at 1.058 and failed tests/integration/entities/entity-dossier.test.ts.
-- The edges are right; the formula is what assumed every amount is positive. Negative totals
-- now count as 0 in the share. Nothing else in the view changes.
--
-- A materialized view cannot be replaced in place, and mv_search_index reads this one, so both
-- are dropped and recreated from their live definitions (pg_get_viewdef, 2026-09-22), with the
-- same indexes and grants. mv_search_index is otherwise byte-for-byte unchanged.
-- counterparty_count(mv_gs_entity_stats), a PostgREST computed column, takes the view's row
-- type, so it is dropped first and recreated with its grants. (The first apply stopped on it
-- and rolled back cleanly, 2026-09-22.)
--
-- Apply AFTER this file is on main (.claude/skills/db-apply/SKILL.md step 5):
--   scripts/db-apply.sh supabase/migrations/20260922210000_entity_stats_share_positive_only.sql

BEGIN;
SET LOCAL statement_timeout = 0;

DROP FUNCTION public.counterparty_count(mv_gs_entity_stats);
DROP MATERIALIZED VIEW mv_search_index;
DROP MATERIALIZED VIEW mv_gs_entity_stats;

CREATE MATERIALIZED VIEW mv_gs_entity_stats AS
 WITH directional AS (
         SELECT gs_relationships.source_entity_id AS entity_id,
            gs_relationships.target_entity_id AS counterparty_id,
            gs_relationships.relationship_type,
            gs_relationships.amount,
            gs_relationships.year,
            'outbound'::text AS direction
           FROM gs_relationships
        UNION ALL
         SELECT gs_relationships.target_entity_id AS entity_id,
            gs_relationships.source_entity_id AS counterparty_id,
            gs_relationships.relationship_type,
            gs_relationships.amount,
            gs_relationships.year,
            'inbound'::text AS direction
           FROM gs_relationships
        ), type_stats AS (
         SELECT directional.entity_id,
            directional.relationship_type,
            directional.direction,
            count(*) AS rel_count,
            COALESCE(sum(directional.amount), (0)::numeric) AS rel_amount
           FROM directional
          GROUP BY directional.entity_id, directional.relationship_type, directional.direction
        ), year_stats AS (
         SELECT directional.entity_id,
            directional.year,
            count(*) AS rel_count
           FROM directional
          WHERE (directional.year IS NOT NULL)
          GROUP BY directional.entity_id, directional.year
        ), counterparty_totals AS (
         SELECT directional.entity_id,
            directional.counterparty_id,
            sum(COALESCE(directional.amount, (0)::numeric)) AS cp_total
           FROM directional
          GROUP BY directional.entity_id, directional.counterparty_id
        ), concentration AS (
         SELECT counterparty_totals.entity_id,
                CASE
                    WHEN (sum(GREATEST(counterparty_totals.cp_total, (0)::numeric)) > (0)::numeric) THEN (max(GREATEST(counterparty_totals.cp_total, (0)::numeric)) / sum(GREATEST(counterparty_totals.cp_total, (0)::numeric)))
                    ELSE (0)::numeric
                END AS top_counterparty_share,
            count(DISTINCT counterparty_totals.counterparty_id) AS distinct_counterparties
           FROM counterparty_totals
          GROUP BY counterparty_totals.entity_id
        ), entity_agg AS (
         SELECT type_stats.entity_id,
            sum(
                CASE
                    WHEN (type_stats.direction = 'outbound'::text) THEN type_stats.rel_count
                    ELSE (0)::bigint
                END) AS outbound_count,
            sum(
                CASE
                    WHEN (type_stats.direction = 'inbound'::text) THEN type_stats.rel_count
                    ELSE (0)::bigint
                END) AS inbound_count,
            sum(
                CASE
                    WHEN (type_stats.direction = 'outbound'::text) THEN type_stats.rel_amount
                    ELSE (0)::numeric
                END) AS total_outbound_amount,
            sum(
                CASE
                    WHEN (type_stats.direction = 'inbound'::text) THEN type_stats.rel_amount
                    ELSE (0)::numeric
                END) AS total_inbound_amount,
            array_agg(DISTINCT type_stats.relationship_type) FILTER (WHERE (type_stats.direction = 'outbound'::text)) AS outbound_types,
            array_agg(DISTINCT type_stats.relationship_type) FILTER (WHERE (type_stats.direction = 'inbound'::text)) AS inbound_types,
            jsonb_object_agg(((type_stats.relationship_type || ':'::text) || type_stats.direction), jsonb_build_object('count', type_stats.rel_count, 'amount', type_stats.rel_amount, 'direction', type_stats.direction)) AS type_breakdown
           FROM type_stats
          GROUP BY type_stats.entity_id
        ), year_agg AS (
         SELECT year_stats.entity_id,
            jsonb_object_agg((year_stats.year)::text, year_stats.rel_count) AS year_distribution
           FROM year_stats
          GROUP BY year_stats.entity_id
        )
 SELECT e.id,
    e.gs_id,
    e.canonical_name,
    e.entity_type,
    e.abn,
    e.source_count,
    COALESCE(ea.outbound_count, (0)::numeric) AS outbound_relationships,
    COALESCE(ea.inbound_count, (0)::numeric) AS inbound_relationships,
    (COALESCE(ea.outbound_count, (0)::numeric) + COALESCE(ea.inbound_count, (0)::numeric)) AS total_relationships,
    COALESCE(ea.total_outbound_amount, (0)::numeric) AS total_outbound_amount,
    COALESCE(ea.total_inbound_amount, (0)::numeric) AS total_inbound_amount,
    ea.outbound_types,
    ea.inbound_types,
    COALESCE(ea.type_breakdown, '{}'::jsonb) AS type_breakdown,
    COALESCE(ya.year_distribution, '{}'::jsonb) AS year_distribution,
    COALESCE(c.top_counterparty_share, (0)::numeric) AS top_counterparty_share,
    COALESCE(c.distinct_counterparties, (0)::bigint) AS distinct_counterparties
   FROM (((gs_entities e
     JOIN entity_agg ea ON ((e.id = ea.entity_id)))
     LEFT JOIN year_agg ya ON ((e.id = ya.entity_id)))
     LEFT JOIN concentration c ON ((e.id = c.entity_id)))
  WHERE ((COALESCE(ea.outbound_count, (0)::numeric) + COALESCE(ea.inbound_count, (0)::numeric)) > (0)::numeric);

CREATE UNIQUE INDEX idx_mv_gs_es_id ON public.mv_gs_entity_stats USING btree (id);
CREATE INDEX idx_mv_gs_es_total ON public.mv_gs_entity_stats USING btree (total_relationships DESC);
CREATE INDEX idx_mv_gs_es_gs_id ON public.mv_gs_entity_stats USING btree (gs_id);
CREATE INDEX idx_mv_gs_es_abn ON public.mv_gs_entity_stats USING btree (abn) WHERE (abn IS NOT NULL);
REVOKE ALL ON public.mv_gs_entity_stats FROM PUBLIC, anon, authenticated;
GRANT ALL ON public.mv_gs_entity_stats TO service_role;
GRANT SELECT ON public.mv_gs_entity_stats TO agent_readonly;

CREATE FUNCTION public.counterparty_count(mv_gs_entity_stats)
 RETURNS bigint
 LANGUAGE sql
 STABLE
 SET search_path TO 'public', 'extensions', 'pg_temp'
AS $function$
  select $1.distinct_counterparties;
$function$;
REVOKE ALL ON FUNCTION public.counterparty_count(mv_gs_entity_stats) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.counterparty_count(mv_gs_entity_stats) TO anon, authenticated, service_role;

CREATE MATERIALIZED VIEW mv_search_index AS
 WITH ent AS (
         SELECT e.entity_type AS kind,
            e.gs_id AS id,
            e.canonical_name AS name,
            e.abn,
            e.state,
            e.lga_name AS place,
            e.sector,
            (COALESCE(f.grants_total, (0)::numeric) + COALESCE(f.contracts_total, (0)::numeric)) AS money_in,
            NULL::numeric AS money_out,
                CASE
                    WHEN e.is_community_controlled THEN 'community-controlled'::text
                    ELSE NULL::text
                END AS tier,
            NULLIF(concat_ws(' · '::text, NULLIF(e.remoteness, ''::text),
                CASE
                    WHEN (f.grand_total_records > 0) THEN (f.grand_total_records || ' funding records'::text)
                    ELSE NULL::text
                END), ''::text) AS meta,
            ('/entity/'::text || e.gs_id) AS href,
            st.source_count,
            NULL::date AS closes_at,
            NULL::numeric AS amount_min,
            NULL::text AS postcode
           FROM ((gs_entities e
             LEFT JOIN mv_entity_total_funding f ON ((f.entity_id = e.id)))
             LEFT JOIN ( SELECT mv_gs_entity_stats.id,
                    max(mv_gs_entity_stats.source_count) AS source_count
                   FROM mv_gs_entity_stats
                  GROUP BY mv_gs_entity_stats.id) st ON ((st.id = e.id)))
          WHERE (e.entity_type = ANY (ARRAY['charity'::text, 'company'::text, 'indigenous_corp'::text, 'government_body'::text, 'program'::text]))
        ), se AS (
         SELECT 'social_enterprise'::text AS kind,
            (s.se_id)::text AS id,
            s.name,
            s.abn,
            s.state,
            s.city AS place,
            s.sectors_text AS sector,
            COALESCE(s.contract_value, (0)::numeric) AS money_in,
            NULL::numeric AS money_out,
            s.verification_tier AS tier,
            NULLIF(concat_ws(' · '::text,
                CASE
                    WHEN (s.contract_count > 0) THEN (s.contract_count || ' contracts'::text)
                    ELSE NULL::text
                END,
                CASE
                    WHEN (s.buyer_count > 0) THEN (s.buyer_count || ' buyers'::text)
                    ELSE NULL::text
                END), ''::text) AS meta,
            ('/social-enterprises/'::text || s.se_id) AS href,
            NULL::integer AS source_count,
            NULL::date AS closes_at,
            NULL::numeric AS amount_min,
            s.postcode
           FROM se_search_index s
        ), fnd AS (
         SELECT 'foundation'::text AS kind,
            (f.id)::text AS id,
            f.name,
            f.acnc_abn AS abn,
            NULL::text AS state,
            NULL::text AS place,
            array_to_string(f.thematic_focus, ', '::text) AS sector,
            NULL::numeric AS money_in,
            f.total_giving_annual AS money_out,
            f.profile_confidence AS tier,
            NULLIF(concat_ws(' · '::text, f.type,
                CASE
                    WHEN (f.avg_grant_size > (0)::numeric) THEN ('avg grant $'::text || (round(f.avg_grant_size))::text)
                    ELSE NULL::text
                END), ''::text) AS meta,
            ('/foundations/'::text || f.id) AS href,
            NULL::integer AS source_count,
            NULL::date AS closes_at,
            NULL::numeric AS amount_min,
            NULL::text AS postcode
           FROM foundations f
        ), grants AS (
         SELECT 'grant_round'::text AS kind,
            (g.id)::text AS id,
            g.name,
            NULL::text AS abn,
            NULL::text AS state,
            NULL::text AS place,
            array_to_string(g.categories, ', '::text) AS sector,
            (g.amount_max)::numeric AS money_in,
            NULL::numeric AS money_out,
            g.application_status AS tier,
            NULLIF(concat_ws(' · '::text, g.provider,
                CASE
                    WHEN (g.closes_at IS NOT NULL) THEN ('closes '::text || to_char((g.closes_at)::timestamp with time zone, 'DD Mon YYYY'::text))
                    ELSE NULL::text
                END), ''::text) AS meta,
            ('/grants/'::text || g.id) AS href,
            NULL::integer AS source_count,
            g.closes_at,
            (g.amount_min)::numeric AS amount_min,
            NULL::text AS postcode
           FROM grant_opportunities g
          WHERE ((g.closes_at IS NULL) OR (g.closes_at >= CURRENT_DATE))
        ), ppl AS (
         SELECT 'person'::text AS kind,
            b.person_name_normalised AS id,
            b.person_name_display AS name,
            NULL::text AS abn,
            NULL::text AS state,
            NULL::text AS place,
            array_to_string(b.organisations[1:3], ', '::text) AS sector,
            (COALESCE(b.total_procurement_dollars, (0)::numeric) + COALESCE(b.total_justice_dollars, (0)::numeric)) AS money_in,
            COALESCE(b.total_donation_dollars, (0)::numeric) AS money_out,
                CASE
                    WHEN b.connects_community_controlled THEN 'connects community-controlled'::text
                    ELSE NULL::text
                END AS tier,
            (b.board_count || ' boards'::text) AS meta,
            ('/person/'::text || regexp_replace(b.person_name_display, '\s'::text, '%20'::text, 'g'::text)) AS href,
            (b.board_count)::integer AS source_count,
            NULL::date AS closes_at,
            NULL::numeric AS amount_min,
            NULL::text AS postcode
           FROM mv_board_interlocks b
        ), plc AS (
         SELECT 'place'::text AS kind,
            ((TRIM(BOTH '-'::text FROM regexp_replace(lower(l.lga_name), '[^a-z0-9]+'::text, '-'::text, 'g'::text)) || '-'::text) || lower(COALESCE(l.state, 'xx'::text))) AS id,
            TRIM(BOTH FROM l.lga_name) AS name,
            NULL::text AS abn,
            upper(l.state) AS state,
            TRIM(BOTH FROM l.lga_name) AS place,
            NULL::text AS sector,
            l.total_funding AS money_in,
            NULL::numeric AS money_out,
                CASE
                    WHEN (l.avg_seifa_decile IS NOT NULL) THEN ('SEIFA decile '::text || (round(l.avg_seifa_decile))::text)
                    ELSE NULL::text
                END AS tier,
            (((l.entity_count || ' organisations · '::text) || l.community_controlled_count) || ' community-controlled'::text) AS meta,
            ('/place/council/'::text || TRIM(BOTH '-'::text FROM regexp_replace(lower(l.lga_name), '[^a-z0-9]+'::text, '-'::text, 'g'::text))) AS href,
            (l.entity_count)::integer AS source_count,
            NULL::date AS closes_at,
            NULL::numeric AS amount_min,
            NULL::text AS postcode
           FROM ( SELECT DISTINCT ON ((lower(TRIM(BOTH FROM l0.lga_name))), (lower(COALESCE(l0.state, ''::text)))) l0.lga_name,
                    l0.lga_code,
                    l0.state,
                    l0.entity_count,
                    l0.community_controlled_count,
                    l0.total_funding,
                    l0.relationship_count,
                    l0.avg_seifa_decile
                   FROM mv_funding_by_lga l0
                  WHERE ((l0.lga_name IS NOT NULL) AND ((l0.state IS NOT NULL) OR (NOT (EXISTS ( SELECT 1
                           FROM mv_funding_by_lga l1
                          WHERE ((l1.state IS NOT NULL) AND (lower(TRIM(BOTH FROM l1.lga_name)) = lower(TRIM(BOTH FROM l0.lga_name)))))))))
                  ORDER BY (lower(TRIM(BOTH FROM l0.lga_name))), (lower(COALESCE(l0.state, ''::text))), l0.entity_count DESC NULLS LAST, l0.total_funding DESC NULLS LAST) l
        ), alma AS (
         SELECT 'intervention'::text AS kind,
            (a.id)::text AS id,
            a.name,
            NULL::text AS abn,
            NULL::text AS state,
            array_to_string(a.geography[1:2], ', '::text) AS place,
            a.type AS sector,
            NULL::numeric AS money_in,
            NULL::numeric AS money_out,
            a.evidence_level AS tier,
            NULLIF(concat_ws(' · '::text, a.operating_organization,
                CASE
                    WHEN (a.years_operating > 0) THEN (a.years_operating || ' years'::text)
                    ELSE NULL::text
                END), ''::text) AS meta,
                CASE
                    WHEN (a.gs_entity_id IS NOT NULL) THEN ('/entity/'::text || e.gs_id)
                    ELSE NULL::text
                END AS href,
            NULL::integer AS source_count,
            NULL::date AS closes_at,
            NULL::numeric AS amount_min,
            NULL::text AS postcode
           FROM (alma_interventions a
             LEFT JOIN gs_entities e ON ((e.id = a.gs_entity_id)))
          WHERE (a.review_status = 'Published'::text)
        ), pcd AS (
         SELECT 'postcode'::text AS kind,
            (p.postcode || '-au'::text) AS id,
            (p.postcode ||
                CASE
                    WHEN (loc.locality IS NOT NULL) THEN (' '::text || initcap(loc.locality))
                    ELSE ''::text
                END) AS name,
            NULL::text AS abn,
            upper(p.state) AS state,
            initcap(COALESCE(loc.locality, NULLIF(p.locality, ''::text))) AS place,
            NULL::text AS sector,
            p.total_funding AS money_in,
            NULL::numeric AS money_out,
                CASE
                    WHEN (p.seifa_irsd_decile IS NOT NULL) THEN ('SEIFA decile '::text || p.seifa_irsd_decile)
                    ELSE NULL::text
                END AS tier,
            NULLIF(concat_ws(' · '::text, NULLIF(p.remoteness, ''::text), (p.entity_count || ' organisations'::text)), ''::text) AS meta,
            ('/places/'::text || p.postcode) AS href,
            (p.entity_count)::integer AS source_count,
            NULL::date AS closes_at,
            NULL::numeric AS amount_min,
            p.postcode
           FROM (( SELECT DISTINCT ON (mv_funding_by_postcode.postcode) mv_funding_by_postcode.postcode,
                    mv_funding_by_postcode.state,
                    mv_funding_by_postcode.remoteness,
                    mv_funding_by_postcode.seifa_irsd_decile,
                    mv_funding_by_postcode.locality,
                    mv_funding_by_postcode.entity_count,
                    mv_funding_by_postcode.community_controlled_count,
                    mv_funding_by_postcode.total_funding,
                    mv_funding_by_postcode.community_controlled_funding,
                    mv_funding_by_postcode.relationship_count
                   FROM mv_funding_by_postcode
                  WHERE (mv_funding_by_postcode.postcode ~ '^\d{4}$'::text)
                  ORDER BY mv_funding_by_postcode.postcode, mv_funding_by_postcode.entity_count DESC NULLS LAST) p
             LEFT JOIN LATERAL ( SELECT g.locality
                   FROM postcode_geo g
                  WHERE ((g.postcode = p.postcode) AND (g.locality ~ '^[A-Z][A-Z ''-]+$'::text))
                  ORDER BY g.locality
                 LIMIT 1) loc ON (true))
        ), u AS (
         SELECT ent.kind,
            ent.id,
            ent.name,
            ent.abn,
            ent.state,
            ent.place,
            ent.sector,
            ent.money_in,
            ent.money_out,
            ent.tier,
            ent.meta,
            ent.href,
            ent.source_count,
            ent.closes_at,
            ent.amount_min,
            ent.postcode
           FROM ent
        UNION ALL
         SELECT se.kind,
            se.id,
            se.name,
            se.abn,
            se.state,
            se.place,
            se.sector,
            se.money_in,
            se.money_out,
            se.tier,
            se.meta,
            se.href,
            se.source_count,
            se.closes_at,
            se.amount_min,
            se.postcode
           FROM se
        UNION ALL
         SELECT fnd.kind,
            fnd.id,
            fnd.name,
            fnd.abn,
            fnd.state,
            fnd.place,
            fnd.sector,
            fnd.money_in,
            fnd.money_out,
            fnd.tier,
            fnd.meta,
            fnd.href,
            fnd.source_count,
            fnd.closes_at,
            fnd.amount_min,
            fnd.postcode
           FROM fnd
        UNION ALL
         SELECT grants.kind,
            grants.id,
            grants.name,
            grants.abn,
            grants.state,
            grants.place,
            grants.sector,
            grants.money_in,
            grants.money_out,
            grants.tier,
            grants.meta,
            grants.href,
            grants.source_count,
            grants.closes_at,
            grants.amount_min,
            grants.postcode
           FROM grants
        UNION ALL
         SELECT ppl.kind,
            ppl.id,
            ppl.name,
            ppl.abn,
            ppl.state,
            ppl.place,
            ppl.sector,
            ppl.money_in,
            ppl.money_out,
            ppl.tier,
            ppl.meta,
            ppl.href,
            ppl.source_count,
            ppl.closes_at,
            ppl.amount_min,
            ppl.postcode
           FROM ppl
        UNION ALL
         SELECT plc.kind,
            plc.id,
            plc.name,
            plc.abn,
            plc.state,
            plc.place,
            plc.sector,
            plc.money_in,
            plc.money_out,
            plc.tier,
            plc.meta,
            plc.href,
            plc.source_count,
            plc.closes_at,
            plc.amount_min,
            plc.postcode
           FROM plc
        UNION ALL
         SELECT alma.kind,
            alma.id,
            alma.name,
            alma.abn,
            alma.state,
            alma.place,
            alma.sector,
            alma.money_in,
            alma.money_out,
            alma.tier,
            alma.meta,
            alma.href,
            alma.source_count,
            alma.closes_at,
            alma.amount_min,
            alma.postcode
           FROM alma
        UNION ALL
         SELECT pcd.kind,
            pcd.id,
            pcd.name,
            pcd.abn,
            pcd.state,
            pcd.place,
            pcd.sector,
            pcd.money_in,
            pcd.money_out,
            pcd.tier,
            pcd.meta,
            pcd.href,
            pcd.source_count,
            pcd.closes_at,
            pcd.amount_min,
            pcd.postcode
           FROM pcd
        )
 SELECT kind,
    id,
    name,
    abn,
    state,
    place,
    sector,
    money_in,
    money_out,
    tier,
    meta,
    href,
    source_count,
    closes_at,
    amount_min,
    postcode,
    to_tsvector('simple'::regconfig, concat_ws(' '::text, name, sector, place, abn, meta, postcode)) AS tsv,
    now() AS built_at
   FROM u
  WHERE ((name IS NOT NULL) AND (length(TRIM(BOTH FROM name)) > 1));

CREATE UNIQUE INDEX mv_search_index_kind_id ON public.mv_search_index USING btree (kind, id);
CREATE INDEX mv_search_index_name_trgm ON public.mv_search_index USING gin (name gin_trgm_ops);
CREATE INDEX mv_search_index_tsv ON public.mv_search_index USING gin (tsv);
CREATE INDEX mv_search_index_kind_state ON public.mv_search_index USING btree (kind, state);
CREATE INDEX mv_search_index_abn ON public.mv_search_index USING btree (abn) WHERE (abn IS NOT NULL);
CREATE INDEX mv_search_index_postcode ON public.mv_search_index USING btree (postcode) WHERE (postcode IS NOT NULL);
REVOKE ALL ON public.mv_search_index FROM PUBLIC, anon, authenticated;
GRANT SELECT ON public.mv_search_index TO service_role, agent_readonly;

DO $$
DECLARE n int;
BEGIN
  SELECT count(*) INTO n FROM mv_gs_entity_stats WHERE top_counterparty_share < 0 OR top_counterparty_share > 1;
  IF n > 0 THEN RAISE EXCEPTION '% entities still have a share outside 0..1', n; END IF;
END $$;

COMMIT;
