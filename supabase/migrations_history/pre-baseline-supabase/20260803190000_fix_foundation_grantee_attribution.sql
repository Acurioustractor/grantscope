-- Remove phantom funder attribution from mv_foundation_grantees.
--
-- The view had two branches. The ABN-identity branch is sound: it links a
-- foundation to a grantee through gs_relationships, so the funder is a real
-- resolved entity.
--
-- The second branch was not. It joined justice_funding on the FIRST WORD of the
-- foundation's name against program_name, requiring only that program_name also
-- contain 'FOUNDATION':
--
--   JOIN justice_funding jf
--     ON upper(jf.program_name) LIKE '%'||upper(split_part(f.name,' ',1))||'%'
--    AND upper(jf.program_name) LIKE '%FOUNDATION%'
--   WHERE length(split_part(f.name,' ',1)) > 3
--
-- Any funder named "Foundation ..." has "Foundation" as its first word, so it
-- matched every such program. That produced 23,987 rows across 1,505 funders
-- that never made those grants: "FOUNDATION BRAVE LIMITED" was credited with
-- $43.5M of Channel 7 Children's Research Foundation money.
--
-- The branch is also inverted. In these rows justice_funding.program_name is
-- the RECIPIENT's name, not a program the foundation funded, so even an exact
-- match would assert the opposite of the truth. There is no funder ABN in
-- justice_funding, so funder attribution cannot be rebuilt from it at all.
--
-- The branch is therefore removed rather than repaired. link_method is kept so
-- existing consumers that filter on 'relationship' keep working; it is now
-- always 'relationship'.
--
-- Six materialized views inherit this data and are rebuilt unchanged below,
-- because DROP ... CASCADE removes them: mv_foundation_regranting,
-- mv_foundation_need_alignment, mv_trustee_grantee_chain,
-- mv_evidence_backed_funding, mv_foundation_scores, mv_foundation_readiness.

DROP MATERIALIZED VIEW IF EXISTS public.mv_foundation_grantees CASCADE;

CREATE MATERIALIZED VIEW public.mv_foundation_grantees AS
 SELECT f.id AS foundation_id,
    f.name AS foundation_name,
    f.acnc_abn AS foundation_abn,
    f.total_giving_annual,
    ge_grantee.id AS grantee_entity_id,
    ge_grantee.gs_id AS grantee_gs_id,
    ge_grantee.canonical_name AS grantee_name,
    ge_grantee.abn AS grantee_abn,
    ge_grantee.entity_type AS grantee_type,
    ge_grantee.state AS grantee_state,
    ge_grantee.is_community_controlled AS grantee_community_controlled,
    r.amount AS grant_amount,
    r.year::text AS grant_year,
    r.dataset AS source_dataset,
    'relationship'::text AS link_method
   FROM foundations f
     JOIN gs_entities ge_fdn ON ge_fdn.abn = f.acnc_abn
     JOIN gs_relationships r ON r.source_entity_id = ge_fdn.id
     JOIN gs_entities ge_grantee ON ge_grantee.id = r.target_entity_id
  WHERE (r.relationship_type = ANY (ARRAY['grant'::text, 'funds'::text, 'grants_to'::text, 'gave_grant_to'::text]))
    AND r.source_entity_id <> r.target_entity_id
    AND f.acnc_abn IS NOT NULL;

CREATE INDEX IF NOT EXISTS mv_foundation_grantees_foundation_abn_idx ON public.mv_foundation_grantees (foundation_abn);
CREATE INDEX IF NOT EXISTS mv_foundation_grantees_grantee_abn_idx ON public.mv_foundation_grantees (grantee_abn);
CREATE INDEX IF NOT EXISTS mv_foundation_grantees_grantee_entity_idx ON public.mv_foundation_grantees (grantee_entity_id);

COMMENT ON MATERIALIZED VIEW public.mv_foundation_grantees IS
  'Foundation to grantee links resolved by ABN through gs_relationships. Funder attribution is identity-based only; name-similarity attribution was removed 2026-08-03 after it produced 1,505 phantom funders.';

-- Column classification is unverified. There is no legal-form field in the ACNC
-- payload and abr_entity_type is null for every row, so the values were assigned
-- without an authoritative source: 6,607 rows read 'corporate_foundation' while
-- only 55 read 'private_ancillary_fund', against several thousand PAFs in
-- Australia. Do not filter grantmaker type on this column until it is enriched
-- from a real source.
COMMENT ON COLUMN public.foundations.type IS
  'UNVERIFIED classification. Not derived from an authoritative source (abr_entity_type is null for all rows; ACNC payload carries no legal form). Known to be wrong at scale. Do not use as a filter without verification.';

-- ── Dependents rebuilt ──
--
-- mv_evidence_backed_funding gains DISTINCT ON. Its unique index on
-- (foundation_abn, grantee_abn, intervention_name) could not be recreated:
-- alma_interventions holds "True Justice: Deep Listening on Country" twice for
-- Oonchiumpa (ABN 53658668627), so the join yields the key twice. That
-- duplicate predates this migration and is independent of it, which means the
-- view could not be rebuilt from scratch at all. The highest portfolio_score
-- row wins. The underlying duplicate is left alone: deduplicating ALMA content
-- is a decision about the record, not about this view.
--
-- Every other dependent is recreated verbatim.

-- mv_foundation_regranting
CREATE MATERIALIZED VIEW public.mv_foundation_regranting AS  WITH regranters AS (
         SELECT DISTINCT fg.grantee_abn AS regranter_abn,
            fg.grantee_name AS regranter_name,
            f2.id AS regranter_foundation_id,
            f2.total_giving_annual AS regranter_giving,
            f2.type AS regranter_type
           FROM mv_foundation_grantees fg
             JOIN foundations f2 ON f2.acnc_abn = fg.grantee_abn
          WHERE fg.grantee_abn IS NOT NULL
        ), chains AS (
         SELECT fg1.foundation_name AS source_foundation,
            fg1.foundation_abn AS source_abn,
            fg1.total_giving_annual AS source_giving,
            r.regranter_name,
            r.regranter_abn,
            r.regranter_giving,
            r.regranter_type,
            fg2.grantee_name AS ultimate_grantee,
            fg2.grantee_abn AS ultimate_grantee_abn,
            fg2.grant_amount AS downstream_amount,
            fg2.grant_year AS downstream_year
           FROM mv_foundation_grantees fg1
             JOIN regranters r ON r.regranter_abn = fg1.grantee_abn
             JOIN mv_foundation_grantees fg2 ON fg2.foundation_abn = r.regranter_abn
          WHERE fg1.foundation_abn <> fg2.grantee_abn
        )
 SELECT source_foundation,
    source_abn,
    source_giving::bigint AS source_giving,
    regranter_name,
    regranter_abn,
    regranter_giving::bigint AS regranter_giving,
    regranter_type,
    ultimate_grantee,
    ultimate_grantee_abn,
    downstream_amount::bigint AS downstream_amount,
    downstream_year,
    (((source_foundation || ' → '::text) || regranter_name) || ' → '::text) || ultimate_grantee AS chain_label
   FROM chains
  ORDER BY (source_giving::bigint) DESC NULLS LAST, (regranter_giving::bigint) DESC NULLS LAST;
CREATE INDEX mv_foundation_regranting_source_abn_idx ON public.mv_foundation_regranting USING btree (source_abn);
CREATE INDEX mv_foundation_regranting_regranter_abn_idx ON public.mv_foundation_regranting USING btree (regranter_abn);
CREATE INDEX mv_foundation_regranting_ultimate_grantee_abn_idx ON public.mv_foundation_regranting USING btree (ultimate_grantee_abn);

-- mv_foundation_need_alignment
CREATE MATERIALIZED VIEW public.mv_foundation_need_alignment AS  WITH grantee_locations AS (
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

-- mv_trustee_grantee_chain
CREATE MATERIALIZED VIEW public.mv_trustee_grantee_chain AS  WITH foundation_trustees AS (
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
CREATE UNIQUE INDEX mv_trustee_grantee_chain_trustee_name_foundation_abn_grante_idx ON public.mv_trustee_grantee_chain USING btree (trustee_name, foundation_abn, grantee_abn, grant_year);

-- mv_evidence_backed_funding
CREATE MATERIALIZED VIEW public.mv_evidence_backed_funding AS  WITH foundation_orgs AS (
         SELECT DISTINCT fg.foundation_name,
            fg.foundation_abn,
            fg.grantee_name,
            fg.grantee_abn
           FROM mv_foundation_grantees fg
        ), alma_orgs AS (
         SELECT DISTINCT ai.gs_entity_id,
            e.abn AS org_abn,
            e.canonical_name AS org_name,
            ai.name AS intervention_name,
            ai.type AS intervention_type,
            ai.evidence_level,
            ai.cultural_authority,
            ai.portfolio_score
           FROM alma_interventions ai
             JOIN gs_entities e ON e.id = ai.gs_entity_id
          WHERE ai.gs_entity_id IS NOT NULL AND e.abn IS NOT NULL
        )
 SELECT DISTINCT ON (fo.foundation_abn, fo.grantee_abn, ao.intervention_name)
    fo.foundation_name,
    fo.foundation_abn,
    fo.grantee_name,
    fo.grantee_abn,
    ao.intervention_name,
    ao.intervention_type,
    ao.evidence_level,
    ao.cultural_authority,
    ao.portfolio_score
   FROM foundation_orgs fo
     JOIN alma_orgs ao ON ao.org_abn = fo.grantee_abn
  ORDER BY fo.foundation_abn, fo.grantee_abn, ao.intervention_name, ao.portfolio_score DESC NULLS LAST;
CREATE UNIQUE INDEX mv_evidence_backed_funding_foundation_abn_grantee_abn_inter_idx ON public.mv_evidence_backed_funding USING btree (foundation_abn, grantee_abn, intervention_name);
CREATE INDEX mv_evidence_backed_funding_evidence_level_idx ON public.mv_evidence_backed_funding USING btree (evidence_level);

-- mv_foundation_scores
CREATE MATERIALIZED VIEW public.mv_foundation_scores AS  WITH foundation_base AS (
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

-- mv_foundation_readiness
CREATE MATERIALIZED VIEW public.mv_foundation_readiness AS  WITH foundation_base AS (
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

-- Restore the remaining indexes the original view carried, so query plans that
-- depended on them do not regress. idx_fdn_grantee_amount backs the ORDER BY on
-- the foundation profile page; the partial index backs community-controlled
-- filtering. mv_foundation_grantees_grantee_abn_idx above is new: the org
-- dashboard filters on grantee_abn and previously had no index for it.
CREATE INDEX IF NOT EXISTS idx_fdn_grantee_foundation ON public.mv_foundation_grantees USING btree (foundation_id);
CREATE INDEX IF NOT EXISTS idx_fdn_grantee_amount ON public.mv_foundation_grantees USING btree (grant_amount DESC NULLS LAST);
CREATE INDEX IF NOT EXISTS idx_fdn_grantee_community ON public.mv_foundation_grantees USING btree (grantee_community_controlled) WHERE (grantee_community_controlled = true);
