-- FUND-106 safe embedding reuse: no project or opportunity text leaves GrantScope.

WITH reusable AS (
  SELECT DISTINCT ON (alma.id)
    alma.id,
    coalesce(grant_by_id.embedding, grant_by_url.embedding) AS embedding,
    coalesce(grant_by_id.embedding_model, grant_by_url.embedding_model, 'text-embedding-3-small') AS embedding_model,
    coalesce(grant_by_id.embedded_at, grant_by_url.embedded_at, now()) AS embedded_at
  FROM public.act_funding_opportunity_current_status status
  JOIN public.alma_funding_opportunities alma
    ON alma.id = status.opportunity_id
  LEFT JOIN public.grant_opportunities grant_by_id
    ON grant_by_id.id = CASE
      WHEN alma.raw_data->>'grant_opportunity_id' ~ '^[0-9a-f-]{36}$'
        THEN (alma.raw_data->>'grant_opportunity_id')::uuid
      ELSE NULL
    END
  LEFT JOIN public.grant_opportunities grant_by_url
    ON grant_by_url.url = alma.source_url OR grant_by_url.url = alma.application_url
  WHERE status.feed_status = 'apply_now'
    AND coalesce(grant_by_id.embedding, grant_by_url.embedding) IS NOT NULL
  ORDER BY alma.id, grant_by_id.embedded_at DESC NULLS LAST, grant_by_url.embedded_at DESC NULLS LAST
)
UPDATE public.alma_funding_opportunities opportunity
SET
  embedding = reusable.embedding,
  embedding_model = 'reused:' || reusable.embedding_model,
  embedded_at = reusable.embedded_at
FROM reusable
WHERE opportunity.id = reusable.id;

WITH project_vectors AS (
  SELECT
    profile.id AS profile_id,
    avg(coalesce(grant_by_id.embedding, grant_by_url.embedding)) AS embedding,
    string_agg(DISTINCT recommendation.opportunity_name, E'\n') AS embedding_text
  FROM public.project_funding_profiles profile
  JOIN public.org_projects project
    ON project.id = profile.org_project_id
  JOIN public.act_grant_recommendations_current recommendation
    ON recommendation.project_code = project.code
  JOIN public.alma_funding_opportunities alma
    ON alma.id = recommendation.opportunity_id
  LEFT JOIN public.grant_opportunities grant_by_id
    ON grant_by_id.id = CASE
      WHEN alma.raw_data->>'grant_opportunity_id' ~ '^[0-9a-f-]{36}$'
        THEN (alma.raw_data->>'grant_opportunity_id')::uuid
      ELSE NULL
    END
  LEFT JOIN public.grant_opportunities grant_by_url
    ON grant_by_url.url = alma.source_url OR grant_by_url.url = alma.application_url
  WHERE profile.is_current
    AND coalesce(grant_by_id.embedding, grant_by_url.embedding) IS NOT NULL
  GROUP BY profile.id
)
UPDATE public.project_funding_profiles profile
SET
  embedding = project_vectors.embedding,
  embedding_text = coalesce(profile.embedding_text, project_vectors.embedding_text),
  embedded_at = now(),
  updated_at = now()
FROM project_vectors
WHERE profile.id = project_vectors.profile_id;

COMMENT ON COLUMN public.project_funding_profiles.embedding IS
  'Internal centroid of existing evidence-safe recommended-opportunity embeddings; no project profile text is sent externally.';
