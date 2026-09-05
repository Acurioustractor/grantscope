-- FUND-106: evidence-safe lexical + semantic project funding retrieval.

ALTER TABLE public.project_funding_profiles
  ADD COLUMN IF NOT EXISTS embedding extensions.vector(1536),
  ADD COLUMN IF NOT EXISTS embedding_text text,
  ADD COLUMN IF NOT EXISTS embedded_at timestamptz;

ALTER TABLE public.alma_funding_opportunities
  ADD COLUMN IF NOT EXISTS search_text text,
  ADD COLUMN IF NOT EXISTS embedding extensions.vector(1536),
  ADD COLUMN IF NOT EXISTS embedding_model text,
  ADD COLUMN IF NOT EXISTS embedded_at timestamptz;

UPDATE public.alma_funding_opportunities
SET search_text = concat_ws(' ',
  name,
  funder_name,
  category,
  description,
  array_to_string(focus_areas, ' '),
  array_to_string(keywords, ' '),
  array_to_string(eligible_org_types, ' '),
  eligibility_criteria::text
)
WHERE search_text IS NULL;

CREATE OR REPLACE FUNCTION public.set_alma_funding_search_text()
RETURNS trigger
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = public
AS $$
BEGIN
  NEW.search_text := concat_ws(' ',
    NEW.name,
    NEW.funder_name,
    NEW.category,
    NEW.description,
    array_to_string(NEW.focus_areas, ' '),
    array_to_string(NEW.keywords, ' '),
    array_to_string(NEW.eligible_org_types, ' '),
    NEW.eligibility_criteria::text
  );
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS alma_funding_search_text_trigger
  ON public.alma_funding_opportunities;
CREATE TRIGGER alma_funding_search_text_trigger
  BEFORE INSERT OR UPDATE OF name, funder_name, category, description, focus_areas, keywords, eligible_org_types, eligibility_criteria
  ON public.alma_funding_opportunities
  FOR EACH ROW EXECUTE FUNCTION public.set_alma_funding_search_text();

CREATE INDEX IF NOT EXISTS alma_funding_opportunities_search_idx
  ON public.alma_funding_opportunities
  USING gin (to_tsvector('english', coalesce(search_text, '')));

CREATE INDEX IF NOT EXISTS alma_funding_opportunities_embedding_idx
  ON public.alma_funding_opportunities
  USING hnsw (embedding extensions.vector_cosine_ops)
  WHERE embedding IS NOT NULL;

CREATE INDEX IF NOT EXISTS project_funding_profiles_embedding_idx
  ON public.project_funding_profiles
  USING hnsw (embedding extensions.vector_cosine_ops)
  WHERE embedding IS NOT NULL AND is_current;

CREATE OR REPLACE FUNCTION public.search_project_funding_hybrid(
  p_org_project_id uuid,
  p_query_embedding extensions.vector(1536) DEFAULT NULL,
  p_match_count integer DEFAULT 50
)
RETURNS TABLE (
  opportunity_id uuid,
  project_code text,
  opportunity_name text,
  funder_name text,
  deadline timestamptz,
  max_grant_amount numeric,
  source_url text,
  application_url text,
  lexical_score double precision,
  semantic_score double precision,
  recommendation_score integer,
  hybrid_score double precision,
  eligibility_decision text,
  eligibility_evidence jsonb,
  profile_version text,
  profile_completeness text
)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public, extensions, pg_catalog
AS $$
  WITH project AS (
    SELECT
      op.code AS project_code,
      profile.profile_version,
      profile.completeness_status,
      profile.profile,
      profile.embedding,
      coalesce(nullif(profile.embedding_text, ''), concat_ws(' ',
        op.name,
        op.description,
        profile.profile->'purpose'->>'publicSummary',
        array_to_string(ARRAY(SELECT jsonb_array_elements_text(coalesce(profile.profile->'geographies', '[]'::jsonb))), ' ')
      )) AS query_text
    FROM public.org_projects op
    JOIN public.project_funding_profiles profile
      ON profile.org_project_id = op.id AND profile.is_current
    WHERE op.id = p_org_project_id
  ),
  candidate AS (
    SELECT DISTINCT ON (opportunity.id, project.project_code)
      opportunity.*,
      current_status.deadline AS safe_deadline,
      current_status.source_url AS safe_source_url,
      current_status.application_url AS safe_application_url,
      project.project_code,
      project.profile_version,
      project.completeness_status,
      project.profile,
      ts_rank_cd(
        to_tsvector('english', coalesce(opportunity.search_text, '')),
        websearch_to_tsquery('english', project.query_text),
        32
      )::double precision AS lexical,
      CASE
        WHEN coalesce(p_query_embedding, project.embedding) IS NOT NULL AND opportunity.embedding IS NOT NULL
          THEN (1 - (opportunity.embedding <=> coalesce(p_query_embedding, project.embedding)))::double precision
        ELSE 0::double precision
      END AS semantic,
      coalesce(recommendation.fit_score, 0)::integer AS recommendation
    FROM project
    CROSS JOIN public.alma_funding_opportunities opportunity
    JOIN public.act_funding_opportunity_current_status current_status
      ON current_status.opportunity_id = opportunity.id
      AND current_status.feed_status = 'apply_now'
    LEFT JOIN public.act_grant_recommendations_current recommendation
      ON recommendation.opportunity_id = opportunity.id
      AND recommendation.project_code = project.project_code
    ORDER BY opportunity.id, project.project_code, coalesce(recommendation.fit_score, 0) DESC
  )
  SELECT
    candidate.id,
    candidate.project_code,
    candidate.name,
    candidate.funder_name,
    candidate.safe_deadline,
    candidate.max_grant_amount,
    candidate.safe_source_url,
    candidate.safe_application_url,
    candidate.lexical,
    candidate.semantic,
    candidate.recommendation,
    (
      least(candidate.lexical * 100, 100) * 0.35
      + candidate.semantic * 100 * 0.35
      + candidate.recommendation * 0.30
    )::double precision AS hybrid,
    CASE
      WHEN candidate.completeness_status <> 'decision_ready' THEN 'needs_verification'
      WHEN candidate.requires_deductible_gift_recipient = true
        AND NOT (candidate.profile->'entities' @> '[{"attributes":["dgr_item_1"]}]'::jsonb)
        THEN 'eligible_partner_led'
      WHEN coalesce(array_length(candidate.eligible_org_types, 1), 0) = 0 THEN 'needs_verification'
      ELSE 'eligible_direct'
    END AS eligibility_decision,
    jsonb_build_object(
      'profile_completeness', candidate.completeness_status,
      'unresolved_decisions', coalesce(candidate.profile->'unresolvedDecisions', '[]'::jsonb),
      'requires_dgr', candidate.requires_deductible_gift_recipient,
      'requires_abn', candidate.requires_abn,
      'eligible_org_types', coalesce(to_jsonb(candidate.eligible_org_types), '[]'::jsonb),
      'jurisdictions', coalesce(to_jsonb(candidate.jurisdictions), '[]'::jsonb),
      'evidence_status', 'apply_now',
      'official_source', candidate.safe_source_url,
      'application_url', candidate.safe_application_url,
      'deadline', candidate.safe_deadline
    ) AS eligibility_evidence,
    candidate.profile_version,
    candidate.completeness_status
  FROM candidate
  WHERE candidate.lexical > 0 OR candidate.semantic > 0 OR candidate.recommendation > 0
  ORDER BY hybrid DESC, candidate.safe_deadline ASC
  LIMIT greatest(1, least(p_match_count, 100));
$$;

REVOKE ALL ON FUNCTION public.search_project_funding_hybrid(uuid, extensions.vector, integer) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.search_project_funding_hybrid(uuid, extensions.vector, integer) TO authenticated, service_role;

COMMENT ON FUNCTION public.search_project_funding_hybrid(uuid, extensions.vector, integer) IS
  'Evidence-safe hybrid retrieval for one current project funding profile; emits deterministic eligibility evidence.';
