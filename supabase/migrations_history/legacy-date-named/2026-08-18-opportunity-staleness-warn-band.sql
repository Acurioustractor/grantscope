-- Opportunity feed: warn before quarantining on staleness alone. 2026-08-18.
-- Apply: source .env && PGPASSWORD="$DATABASE_PASSWORD" psql -h aws-0-ap-southeast-2.pooler.supabase.com -p 5432 -U "postgres.tednluwflfhxyucgwigh" -d postgres -f migrations/2026-08-18-opportunity-staleness-warn-band.sql
--
-- Admin audit A1. On 2026-08-14 every one of the 2,592 open_grant opportunities flipped to
-- `quarantined` in a single step, `act_grant_recommendations_current` emptied, and
-- /ops/grant-recommendations rendered a wall of zeros with 22,252 recommendations and 89 real
-- decisions hidden behind it. Nothing on the screen, and nothing anywhere else, said why.
--
-- The cause was one job: the nightly grant pipeline orchestrator last succeeded 2026-08-07 and has
-- timed out on every run since (3x daily). Its step 6 stamps verified_at. The 7-day freshness rule
-- then did exactly what it was written to do.
--
-- The rule is right — stale verification SHOULD stop us telling someone a grant is open when we
-- last checked a fortnight ago. What is wrong is that it is a cliff: fresh on day 6, quarantined on
-- day 8, with no signal in between and no way to tell "the source went bad" from "our own job
-- stopped". A missed job should degrade loudly and gradually, not silently and totally.
--
-- So staleness alone now produces `stale_warning` rather than `quarantined`, up to a hard limit:
--
--   verified within 7 days                  -> apply_now / rolling   (unchanged)
--   verified 7-21 days ago, nothing else wrong -> stale_warning      (NEW — still usable, flagged)
--   verified more than 21 days ago          -> quarantined           (hard limit, as before)
--   any OTHER requirement failed            -> quarantined           (unchanged, staleness is the
--                                                                     only forgiving one)
--
-- `days_since_verified` is exposed so the UI can say "verification is N days old" rather than
-- leaving the reader to guess. Consumers that want the strict old behaviour filter on
-- feed_status = 'apply_now' alone; the recommendations view below deliberately accepts the warning
-- band, because a 10-day-old check on a grant that closes next month is worth showing WITH the
-- caveat, and showing nothing is what caused this finding.

CREATE OR REPLACE VIEW act_funding_opportunity_current_status AS
  WITH assessed AS (
    SELECT
      opportunity.id AS opportunity_id,
      opportunity.verification_status,
      opportunity.verified_at,
      opportunity.deadline,
      opportunity.source_url,
      opportunity.application_url,
      -- Staleness is assessed separately from here on: it is the one failure we forgive for a while.
      (opportunity.verified_at IS NOT NULL
        AND opportunity.verified_at < (now() - '7 days'::interval)) AS is_stale,
      (opportunity.verified_at IS NOT NULL
        AND opportunity.verified_at < (now() - '21 days'::interval)) AS is_very_stale,
      CASE
        WHEN opportunity.verified_at IS NULL THEN NULL::int
        ELSE EXTRACT(day FROM now() - opportunity.verified_at)::int
      END AS days_since_verified,
      array_remove(ARRAY[
        CASE WHEN opportunity.verification_status IS DISTINCT FROM 'verified'
             THEN 'not_verified'::text END,
        CASE WHEN opportunity.verified_at IS NULL
             THEN 'missing_verification_timestamp'::text END,
        CASE WHEN NULLIF(btrim(opportunity.source_url), '') IS NULL
             THEN 'missing_official_source'::text END,
        CASE WHEN NULLIF(btrim(opportunity.application_url), '') IS NULL
             THEN 'missing_application_url'::text END,
        CASE WHEN opportunity.deadline < now()
             THEN 'past_deadline'::text END
      ], NULL::text) AS hard_failures
    FROM alma_funding_opportunities opportunity
    WHERE opportunity.opportunity_type = 'open_grant'::text
  )
  -- Column ORDER and NAMES 1-9 are unchanged: CREATE OR REPLACE VIEW may only append columns,
  -- and evidence_completeness is consumed elsewhere. days_since_verified and is_stale are new,
  -- appended at the end.
  SELECT
    opportunity_id,
    CASE
      WHEN cardinality(hard_failures) > 0 THEN 'quarantined'::text
      WHEN is_very_stale THEN 'quarantined'::text
      WHEN is_stale THEN 'stale_warning'::text
      WHEN deadline IS NULL THEN 'rolling'::text
      ELSE 'apply_now'::text
    END AS feed_status,
    CASE
      WHEN cardinality(hard_failures) > 0 THEN hard_failures
      WHEN is_very_stale THEN ARRAY['stale_verification'::text]
      ELSE '{}'::text[]
    END AS failed_requirements,
    -- Same 6-requirement denominator as before, so the score stays comparable across the change.
    GREATEST(0::numeric, round((6 - cardinality(
      CASE
        WHEN cardinality(hard_failures) > 0 THEN hard_failures
        WHEN is_very_stale THEN ARRAY['stale_verification'::text]
        ELSE '{}'::text[]
      END))::numeric / 6::numeric * 100::numeric))::integer AS evidence_completeness,
    verification_status,
    verified_at,
    deadline,
    source_url,
    application_url,
    days_since_verified,
    is_stale
  FROM assessed;

GRANT SELECT ON act_funding_opportunity_current_status TO anon, authenticated, service_role;

-- The recommendations view accepts the warning band. Without this the warn band changes nothing:
-- the screen reads THIS view, and it was filtering to apply_now/rolling only. Body below is the
-- existing definition reproduced verbatim; the ONLY change is adding 'stale_warning' to that filter.
CREATE OR REPLACE VIEW act_grant_recommendations_current AS
 WITH proj AS (
         SELECT act_grant_recommendation_projects.project_code,
            ARRAY( SELECT upper(s.s) AS upper
                   FROM unnest(COALESCE(act_grant_recommendation_projects.home_states, '{}'::text[]) || COALESCE(act_grant_recommendation_projects.secondary_states, '{}'::text[])) s(s)) AS ok_states
           FROM act_grant_recommendation_projects
        ), tagged AS (
         SELECT rec.project_code,
            rec.project_name,
            rec.opportunity_id,
            rec.opportunity_name,
            rec.funder_name,
            rec.deadline,
            rec.opens_at,
            rec.min_grant_amount,
            rec.max_grant_amount,
            rec.is_national,
            rec.jurisdictions,
            rec.eligible_org_types,
            rec.focus_areas,
            rec.keywords,
            rec.source_url,
            rec.application_url,
            rec.opportunity_type,
            rec.verification_status,
            rec.verified_at,
            rec.theme_score,
            rec.geography_score,
            rec.eligibility_score,
            rec.timing_score,
            rec.track_record_score,
            rec.won_funder,
            rec.fit_score,
            rec.is_strong_fit,
            rec.tag_density_penalised,
            rec.funder_avg_tags,
            rec.flags,
            rec.computed_at,
            cs.feed_status,
            p.ok_states,
                CASE
                    WHEN rec.funder_name ~* '(victorian government|government of victoria)'::text THEN 'VIC'::text
                    WHEN rec.funder_name ~* '(nsw government|government of new south wales)'::text THEN 'NSW'::text
                    WHEN rec.funder_name ~* '(queensland government|qld government)'::text THEN 'QLD'::text
                    WHEN rec.funder_name ~* '(south australian government|government of south australia)'::text THEN 'SA'::text
                    WHEN rec.funder_name ~* '(western australian government|government of western australia)'::text THEN 'WA'::text
                    WHEN rec.funder_name ~* '(tasmanian government|government of tasmania)'::text THEN 'TAS'::text
                    WHEN rec.funder_name ~* '(northern territory government|nt government)'::text THEN 'NT'::text
                    ELSE NULL::text
                END AS funder_state
           FROM act_grant_recommendations rec
             JOIN act_funding_opportunity_current_status cs ON cs.opportunity_id = rec.opportunity_id
             LEFT JOIN proj p ON p.project_code = rec.project_code
          WHERE (cs.feed_status = ANY (ARRAY['apply_now'::text, 'rolling'::text, 'stale_warning'::text])) AND (rec.max_grant_amount IS NULL OR rec.max_grant_amount >= 5000::numeric)
        ), eligible AS (
         SELECT tagged.project_code,
            tagged.project_name,
            tagged.opportunity_id,
            tagged.opportunity_name,
            tagged.funder_name,
            tagged.deadline,
            tagged.opens_at,
            tagged.min_grant_amount,
            tagged.max_grant_amount,
            tagged.is_national,
            tagged.jurisdictions,
            tagged.eligible_org_types,
            tagged.focus_areas,
            tagged.keywords,
            tagged.source_url,
            tagged.application_url,
            tagged.opportunity_type,
            tagged.verification_status,
            tagged.verified_at,
            tagged.theme_score,
            tagged.geography_score,
            tagged.eligibility_score,
            tagged.timing_score,
            tagged.track_record_score,
            tagged.won_funder,
            tagged.fit_score,
            tagged.is_strong_fit,
            tagged.tag_density_penalised,
            tagged.funder_avg_tags,
            tagged.flags,
            tagged.computed_at,
            tagged.feed_status,
            tagged.ok_states,
            tagged.funder_state
           FROM tagged
          WHERE tagged.ok_states IS NULL OR COALESCE(tagged.is_national, false) OR
                CASE
                    WHEN tagged.jurisdictions IS NOT NULL AND cardinality(tagged.jurisdictions) > 0 THEN (EXISTS ( SELECT 1
                       FROM unnest(tagged.jurisdictions) j(j)
                      WHERE (upper(replace(j.j, 'AU-'::text, ''::text)) = ANY (tagged.ok_states)) OR upper(replace(j.j, 'AU-'::text, ''::text)) = 'NATIONAL'::text))
                    WHEN tagged.funder_state IS NOT NULL THEN tagged.funder_state = ANY (tagged.ok_states)
                    ELSE true
                END
        ), stemmed AS (
         SELECT eligible.project_code,
            eligible.project_name,
            eligible.opportunity_id,
            eligible.opportunity_name,
            eligible.funder_name,
            eligible.deadline,
            eligible.opens_at,
            eligible.min_grant_amount,
            eligible.max_grant_amount,
            eligible.is_national,
            eligible.jurisdictions,
            eligible.eligible_org_types,
            eligible.focus_areas,
            eligible.keywords,
            eligible.source_url,
            eligible.application_url,
            eligible.opportunity_type,
            eligible.verification_status,
            eligible.verified_at,
            eligible.theme_score,
            eligible.geography_score,
            eligible.eligibility_score,
            eligible.timing_score,
            eligible.track_record_score,
            eligible.won_funder,
            eligible.fit_score,
            eligible.is_strong_fit,
            eligible.tag_density_penalised,
            eligible.funder_avg_tags,
            eligible.flags,
            eligible.computed_at,
            eligible.feed_status,
            eligible.ok_states,
            eligible.funder_state,
            row_number() OVER (PARTITION BY eligible.project_code, (lower(TRIM(BOTH FROM COALESCE(eligible.funder_name, ''::text)))), (TRIM(BOTH FROM regexp_replace(regexp_replace(lower(COALESCE(eligible.opportunity_name, ''::text)), '\s*\(.*?\)'::text, ''::text, 'g'::text), '\s*[:–—-]\s.*$'::text, ''::text))) ORDER BY eligible.fit_score DESC NULLS LAST, eligible.deadline, eligible.opportunity_id) AS program_rn
           FROM eligible
        ), deduped AS (
         SELECT stemmed.project_code,
            stemmed.project_name,
            stemmed.opportunity_id,
            stemmed.opportunity_name,
            stemmed.funder_name,
            stemmed.deadline,
            stemmed.opens_at,
            stemmed.min_grant_amount,
            stemmed.max_grant_amount,
            stemmed.is_national,
            stemmed.jurisdictions,
            stemmed.eligible_org_types,
            stemmed.focus_areas,
            stemmed.keywords,
            stemmed.source_url,
            stemmed.application_url,
            stemmed.opportunity_type,
            stemmed.verification_status,
            stemmed.verified_at,
            stemmed.theme_score,
            stemmed.geography_score,
            stemmed.eligibility_score,
            stemmed.timing_score,
            stemmed.track_record_score,
            stemmed.won_funder,
            stemmed.fit_score,
            stemmed.is_strong_fit,
            stemmed.tag_density_penalised,
            stemmed.funder_avg_tags,
            stemmed.flags,
            stemmed.computed_at,
            stemmed.feed_status,
            stemmed.ok_states,
            stemmed.funder_state,
            stemmed.program_rn
           FROM stemmed
          WHERE stemmed.program_rn = 1
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
    theme_score,
    geography_score,
    eligibility_score,
    timing_score,
    track_record_score,
    won_funder,
    fit_score,
    is_strong_fit AND (COALESCE(geography_score, 0) > 0 OR COALESCE(max_grant_amount, 0::numeric) >= 50000::numeric OR won_funder) AS is_strong_fit,
    tag_density_penalised,
    funder_avg_tags,
    flags,
    computed_at,
    feed_status,
    row_number() OVER (PARTITION BY project_code ORDER BY fit_score DESC NULLS LAST, max_grant_amount DESC NULLS LAST, deadline)::integer AS project_rank
   FROM deduped;

GRANT SELECT ON act_grant_recommendations_current TO anon, authenticated, service_role;
