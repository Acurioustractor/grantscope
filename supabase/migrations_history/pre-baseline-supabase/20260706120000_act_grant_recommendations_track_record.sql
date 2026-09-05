-- Phase 7 · Brick 5 — outcome feedback into the per-project grant engine.
--
-- Feeds ACT's actual grant decisions (act_grant_recommendation_decisions) back
-- into the act_grant_recommendations scorer, so the engine that /find-grants now
-- reads learns from won/lost:
--
--   * won_funder_boost (+15): ACT has WON money from this funder before (any
--     project). Funder relationships are org-level, so a win anywhere is a strong
--     "this funder actually funds us" signal for every project's feed.
--   * passed_penalty (-10): ACT has PASSED on this funder >=2 times FOR THIS
--     PROJECT — a repeated project-level misfit, so it's project-scoped.
--   * exclude terminally-decided opps (won / passed / pursuing) for a project so
--     the feed stays fresh; 'watching' rows are kept (still live candidates).
--
-- track_record_score = won_funder_boost + passed_penalty is added into fit_score
-- (it can lift a proven funder over the is_strong_fit >=55 bar, but theme_score>0
-- is still required so a proven funder with no thematic overlap never surfaces).
--
-- The MV is a full rebuild (materialized views can't be REPLACEd). The dependent
-- view v_act_pipeline_unified is dropped and recreated verbatim; indexes + grants
-- are restored. All new columns are additive (track_record_score, won_funder),
-- so existing readers (v_act_pipeline_unified, app SELECTs) are unaffected.

BEGIN;

DROP VIEW IF EXISTS v_act_pipeline_unified;
DROP MATERIALIZED VIEW IF EXISTS act_grant_recommendations;

CREATE MATERIALIZED VIEW act_grant_recommendations AS
 WITH project_themes AS (
         SELECT arp.project_code,
            p.name AS project_name,
            arp.theme_keywords,
            arp.home_states,
            arp.secondary_states
           FROM act_grant_recommendation_projects arp
             JOIN projects p ON p.code = arp.project_code
          WHERE arp.in_scope = true
        ), opps AS (
         SELECT a.id,
            a.name,
            a.funder_name,
            a.min_grant_amount,
            a.max_grant_amount,
            a.opens_at,
            a.deadline,
            a.jurisdictions,
            a.is_national,
            a.eligible_org_types,
            a.requires_deductible_gift_recipient,
            a.focus_areas,
            a.keywords,
            a.source_url,
            a.application_url,
            a.opportunity_type,
            a.verification_status,
            a.verified_at
           FROM alma_funding_opportunities a
          WHERE (COALESCE(a.status, 'open'::text) <> ALL (ARRAY['archived'::text, 'closed'::text, 'cancelled'::text, 'rejected'::text])) AND (a.deadline IS NULL OR a.deadline >= now()) AND a.opportunity_type = 'open_grant'::text AND a.verification_status = 'verified'::text AND NOT (EXISTS ( SELECT 1
                   FROM funder_blocklist b
                  WHERE b.active = true AND lower(b.funder_name) = lower(a.funder_name)))
        ),
        -- ── Brick 5: outcome-feedback CTEs, derived from ACT's real decisions ──
        tr_decisions AS (
         SELECT d.project_code,
            d.opportunity_id,
            d.decision,
            lower(a.funder_name) AS funder_lc
           FROM act_grant_recommendation_decisions d
             JOIN alma_funding_opportunities a ON a.id = d.opportunity_id
        ), tr_won_funders AS (
         SELECT DISTINCT funder_lc
           FROM tr_decisions
          WHERE decision = 'won' AND funder_lc IS NOT NULL
        ), tr_passed AS (
         SELECT project_code, funder_lc
           FROM tr_decisions
          WHERE decision = 'passed' AND funder_lc IS NOT NULL
          GROUP BY project_code, funder_lc
         HAVING count(*) >= 2
        ), tr_decided_opps AS (
         SELECT DISTINCT project_code, opportunity_id
           FROM act_grant_recommendation_decisions
          WHERE decision = ANY (ARRAY['won'::text, 'passed'::text, 'pursuing'::text])
        ), scored AS (
         SELECT pt.project_code,
            pt.project_name,
            o.id AS opportunity_id,
            o.name AS opportunity_name,
            o.funder_name,
            o.deadline,
            o.opens_at,
            o.min_grant_amount,
            o.max_grant_amount,
            o.is_national,
            o.jurisdictions,
            o.eligible_org_types,
            o.focus_areas,
            o.keywords,
            o.source_url,
            o.application_url,
            o.opportunity_type,
            o.verification_status,
            o.verified_at,
            LEAST(50::bigint, ( SELECT count(DISTINCT pk.pk) * 10
                   FROM unnest(pt.theme_keywords) pk(pk)
                  WHERE length(pk.pk) >= 4 AND (EXISTS ( SELECT 1
                           FROM unnest(COALESCE(o.focus_areas, '{}'::text[]) || COALESCE(o.keywords, '{}'::text[])) okw(okw)
                          WHERE length(okw.okw) >= 4 AND (lower(okw.okw) ~~ (('%'::text || lower(pk.pk)) || '%'::text) OR lower(pk.pk) ~~ (('%'::text || lower(okw.okw)) || '%'::text))))))::numeric AS theme_score_raw,
            COALESCE(tdp.theme_multiplier, 1.0) AS theme_multiplier,
            COALESCE(tdp.avg_tag_count, 0::numeric) AS funder_avg_tags,
                CASE
                    WHEN o.is_national THEN 15
                    WHEN o.jurisdictions && pt.home_states THEN 15
                    WHEN o.jurisdictions && pt.secondary_states THEN 9
                    ELSE 0
                END AS geography_score,
                CASE
                    WHEN o.eligible_org_types && ARRAY['charity'::text, 'company'::text, 'community_organisation'::text, 'social_enterprise'::text, 'arts_organisation'::text, 'collective'::text] THEN 20
                    WHEN o.eligible_org_types && ARRAY['aboriginal_corporation'::text, 'indigenous_charity'::text, 'indigenous_org'::text, 'community_org'::text] THEN 10
                    ELSE 5
                END AS eligibility_score,
                CASE
                    WHEN o.deadline IS NULL THEN 8
                    WHEN o.deadline >= (now() + '30 days'::interval) THEN 15
                    WHEN o.deadline >= (now() + '7 days'::interval) THEN 8
                    WHEN o.deadline >= now() THEN 4
                    ELSE 0
                END AS timing_score,
                -- Brick 5 track-record components
                CASE WHEN wf.funder_lc IS NOT NULL THEN 15 ELSE 0 END AS won_funder_boost,
                CASE WHEN pp.funder_lc IS NOT NULL THEN -10 ELSE 0 END AS passed_penalty,
                (wf.funder_lc IS NOT NULL) AS won_funder,
            array_remove(ARRAY[
                CASE
                    WHEN o.requires_deductible_gift_recipient THEN 'requires_dgr'::text
                    ELSE NULL::text
                END,
                CASE
                    WHEN o.eligible_org_types && ARRAY['aboriginal_corporation'::text, 'indigenous_charity'::text, 'indigenous_org'::text] AND NOT o.eligible_org_types && ARRAY['charity'::text, 'company'::text, 'community_organisation'::text] THEN 'partner_required'::text
                    ELSE NULL::text
                END,
                CASE
                    WHEN o.deadline IS NOT NULL AND o.deadline < (now() + '14 days'::interval) THEN 'tight_deadline'::text
                    ELSE NULL::text
                END,
                CASE
                    WHEN o.is_national THEN 'national'::text
                    ELSE NULL::text
                END,
                CASE
                    WHEN o.max_grant_amount IS NOT NULL AND o.max_grant_amount >= 500000::numeric THEN 'large_grant'::text
                    ELSE NULL::text
                END,
                CASE
                    WHEN o.max_grant_amount IS NOT NULL AND o.max_grant_amount < 50000::numeric THEN 'small_grant'::text
                    ELSE NULL::text
                END,
                CASE
                    WHEN COALESCE(tdp.theme_multiplier, 1.0) < 1.0 THEN 'tag_stuffed'::text
                    ELSE NULL::text
                END,
                CASE
                    WHEN wf.funder_lc IS NOT NULL THEN 'won_funder'::text
                    ELSE NULL::text
                END,
                CASE
                    WHEN pp.funder_lc IS NOT NULL THEN 'repeatedly_passed'::text
                    ELSE NULL::text
                END], NULL::text) AS flags
           FROM project_themes pt
             CROSS JOIN opps o
             LEFT JOIN v_funder_tag_density tdp ON tdp.funder_name = o.funder_name
             LEFT JOIN tr_won_funders wf ON wf.funder_lc = lower(o.funder_name)
             LEFT JOIN tr_passed pp ON pp.funder_lc = lower(o.funder_name) AND pp.project_code = pt.project_code
          -- keep the feed fresh: drop opps ACT has already terminally decided on
          WHERE NOT (EXISTS ( SELECT 1
                   FROM tr_decided_opps td
                  WHERE td.project_code = pt.project_code AND td.opportunity_id = o.id))
        )
 SELECT project_code,
    project_name,
    opportunity_id,
    opportunity_name,
    funder_name,
    deadline,
    opens_at,
    min_grant_amount,
    max_grant_amount,
    is_national,
    jurisdictions,
    eligible_org_types,
    focus_areas,
    keywords,
    source_url,
    application_url,
    opportunity_type,
    verification_status,
    verified_at,
    round(theme_score_raw * theme_multiplier)::integer AS theme_score,
    geography_score,
    eligibility_score,
    timing_score,
    won_funder_boost + passed_penalty AS track_record_score,
    won_funder,
    round(theme_score_raw * theme_multiplier)::integer + geography_score + eligibility_score + timing_score + won_funder_boost + passed_penalty AS fit_score,
    round(theme_score_raw * theme_multiplier)::integer > 0 AND (round(theme_score_raw * theme_multiplier)::integer + geography_score + eligibility_score + timing_score + won_funder_boost + passed_penalty) >= 55 AS is_strong_fit,
    theme_multiplier < 1.0 AS tag_density_penalised,
    funder_avg_tags,
    flags,
    now() AS computed_at
   FROM scored;

-- Restore indexes (unique pk index is required for REFRESH ... CONCURRENTLY)
CREATE UNIQUE INDEX act_grant_recommendations_pk_idx ON public.act_grant_recommendations USING btree (project_code, opportunity_id);
CREATE INDEX act_grant_recommendations_strong_idx ON public.act_grant_recommendations USING btree (is_strong_fit) WHERE is_strong_fit;

-- Restore the dependent unified-pipeline view verbatim
CREATE VIEW v_act_pipeline_unified AS
 SELECT op.id AS pipeline_id,
    op.project_code,
    op.name AS opportunity_name,
    op.funder,
    op.amount_display,
    op.amount_numeric,
    op.deadline,
    op.status AS pipeline_status,
    op.opportunity_type,
    op.qbe_stage,
    op.qbe_outcome,
    op.qbe_bid_amount,
    op.pathway,
    op.recommended_role,
    agr.fit_score,
    agr.is_strong_fit,
    agr.flags AS recommendation_flags,
    agrd.decision AS last_decision,
    agrd.decided_at,
    agrd.notes AS decision_notes,
    arp.project_label,
    arp.layer AS project_layer,
    arp.readiness AS project_readiness,
    arp.dgr_required AS project_dgr_required,
    arp.entity_preference AS project_entity_preference,
    op.created_at,
    op.updated_at
   FROM org_pipeline op
     LEFT JOIN act_grant_recommendation_projects arp ON arp.project_code = op.project_code
     LEFT JOIN act_grant_recommendations agr ON agr.project_code = op.project_code AND agr.opportunity_id = op.grant_opportunity_id
     LEFT JOIN LATERAL ( SELECT act_grant_recommendation_decisions.decision,
            act_grant_recommendation_decisions.decided_at,
            act_grant_recommendation_decisions.notes
           FROM act_grant_recommendation_decisions
          WHERE act_grant_recommendation_decisions.project_code = op.project_code AND act_grant_recommendation_decisions.opportunity_id = op.grant_opportunity_id
          ORDER BY act_grant_recommendation_decisions.decided_at DESC
         LIMIT 1) agrd ON true;

GRANT ALL ON v_act_pipeline_unified TO anon, authenticated, service_role;

COMMIT;
