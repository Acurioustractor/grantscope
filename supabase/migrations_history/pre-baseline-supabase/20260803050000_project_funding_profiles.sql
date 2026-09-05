-- FUND-104: canonical, versioned funding profiles for every ACT project.

CREATE TABLE IF NOT EXISTS public.project_funding_profiles (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  org_project_id uuid NOT NULL REFERENCES public.org_projects(id) ON DELETE CASCADE,
  org_profile_id uuid NOT NULL REFERENCES public.org_profiles(id) ON DELETE CASCADE,
  schema_version text NOT NULL DEFAULT 'project-funding-profile-v1',
  profile_version text NOT NULL,
  effective_at timestamptz NOT NULL DEFAULT now(),
  is_current boolean NOT NULL DEFAULT true,
  completeness_status text NOT NULL DEFAULT 'baseline'
    CHECK (completeness_status IN ('baseline', 'partial', 'decision_ready')),
  profile jsonb NOT NULL,
  provenance jsonb NOT NULL DEFAULT '[]'::jsonb,
  created_by text NOT NULL DEFAULT 'system',
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (org_project_id, profile_version)
);

CREATE UNIQUE INDEX IF NOT EXISTS project_funding_profiles_one_current_idx
  ON public.project_funding_profiles (org_project_id)
  WHERE is_current;

CREATE INDEX IF NOT EXISTS project_funding_profiles_org_idx
  ON public.project_funding_profiles (org_profile_id, is_current, updated_at DESC);

CREATE OR REPLACE FUNCTION public.set_project_funding_profile_current()
RETURNS trigger
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = public
AS $$
BEGIN
  IF NEW.is_current THEN
    UPDATE public.project_funding_profiles
    SET is_current = false, updated_at = now()
    WHERE org_project_id = NEW.org_project_id
      AND id <> NEW.id
      AND profile_version <> NEW.profile_version
      AND is_current;
  END IF;
  NEW.updated_at := now();
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS project_funding_profiles_current_trigger
  ON public.project_funding_profiles;
CREATE TRIGGER project_funding_profiles_current_trigger
  BEFORE INSERT OR UPDATE OF is_current, profile
  ON public.project_funding_profiles
  FOR EACH ROW
  EXECUTE FUNCTION public.set_project_funding_profile_current();

ALTER TABLE public.project_funding_profiles ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Org members read project funding profiles"
  ON public.project_funding_profiles;
CREATE POLICY "Org members read project funding profiles"
  ON public.project_funding_profiles
  FOR SELECT TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.org_members member
      WHERE member.org_profile_id = project_funding_profiles.org_profile_id
        AND member.user_id = auth.uid()
    )
  );

DROP POLICY IF EXISTS "Service role manages project funding profiles"
  ON public.project_funding_profiles;
CREATE POLICY "Service role manages project funding profiles"
  ON public.project_funding_profiles
  FOR ALL TO service_role
  USING (true)
  WITH CHECK (true);

GRANT SELECT ON public.project_funding_profiles TO authenticated;
GRANT ALL ON public.project_funding_profiles TO service_role;

COMMENT ON TABLE public.project_funding_profiles IS
  'Versioned funding eligibility, needs, evidence and unresolved decisions for canonical org projects.';
