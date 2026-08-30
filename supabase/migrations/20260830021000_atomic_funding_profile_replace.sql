-- Enforce one current funding profile per project and replace portfolio profile
-- versions atomically. This prevents a compiler-version change from leaving
-- multiple rows marked current or a failed write from leaving none current.

CREATE UNIQUE INDEX IF NOT EXISTS project_funding_profiles_one_current_idx
  ON public.project_funding_profiles (org_project_id)
  WHERE is_current;

CREATE OR REPLACE FUNCTION public.replace_current_project_funding_profiles(p_rows jsonb)
RETURNS TABLE(id uuid)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  written integer := 0;
BEGIN
  IF jsonb_typeof(p_rows) <> 'array' OR jsonb_array_length(p_rows) = 0 THEN
    RETURN;
  END IF;

  IF EXISTS (
    SELECT 1
    FROM jsonb_to_recordset(p_rows) AS incoming(
      org_project_id uuid,
      org_profile_id uuid,
      schema_version text,
      profile_version text,
      completeness_status text,
      profile jsonb,
      provenance jsonb,
      created_by text,
      embedding_text text
    )
    LEFT JOIN public.org_projects project
      ON project.id = incoming.org_project_id
     AND project.org_profile_id = incoming.org_profile_id
    WHERE project.id IS NULL
  ) THEN
    RAISE EXCEPTION 'Funding profile project/org mismatch';
  END IF;

  UPDATE public.project_funding_profiles profile
  SET is_current = false, updated_at = now()
  WHERE profile.is_current
    AND profile.org_project_id IN (
      SELECT incoming.org_project_id
      FROM jsonb_to_recordset(p_rows) AS incoming(org_project_id uuid)
    );

  RETURN QUERY
  INSERT INTO public.project_funding_profiles (
    org_project_id,
    org_profile_id,
    schema_version,
    profile_version,
    effective_at,
    is_current,
    completeness_status,
    profile,
    provenance,
    created_by,
    embedding_text,
    updated_at
  )
  SELECT
    incoming.org_project_id,
    incoming.org_profile_id,
    incoming.schema_version,
    incoming.profile_version,
    now(),
    true,
    incoming.completeness_status,
    incoming.profile,
    incoming.provenance,
    incoming.created_by,
    incoming.embedding_text,
    now()
  FROM jsonb_to_recordset(p_rows) AS incoming(
    org_project_id uuid,
    org_profile_id uuid,
    schema_version text,
    profile_version text,
    completeness_status text,
    profile jsonb,
    provenance jsonb,
    created_by text,
    embedding_text text
  )
  ON CONFLICT (org_project_id, profile_version) DO UPDATE
  SET
    org_profile_id = EXCLUDED.org_profile_id,
    schema_version = EXCLUDED.schema_version,
    effective_at = EXCLUDED.effective_at,
    is_current = true,
    completeness_status = EXCLUDED.completeness_status,
    profile = EXCLUDED.profile,
    provenance = EXCLUDED.provenance,
    created_by = EXCLUDED.created_by,
    embedding_text = EXCLUDED.embedding_text,
    updated_at = EXCLUDED.updated_at
  RETURNING project_funding_profiles.id;

  GET DIAGNOSTICS written = ROW_COUNT;
  IF written <> jsonb_array_length(p_rows) THEN
    RAISE EXCEPTION 'Attempted % profiles but wrote %', jsonb_array_length(p_rows), written;
  END IF;
END;
$$;

REVOKE ALL ON FUNCTION public.replace_current_project_funding_profiles(jsonb) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.replace_current_project_funding_profiles(jsonb) FROM authenticated;
GRANT EXECUTE ON FUNCTION public.replace_current_project_funding_profiles(jsonb) TO service_role;

COMMENT ON FUNCTION public.replace_current_project_funding_profiles(jsonb) IS
  'Atomically retires current project funding profiles and promotes exactly one compiled version per incoming project.';
