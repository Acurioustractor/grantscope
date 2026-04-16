CREATE TABLE IF NOT EXISTS public.pilot_participants (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_at timestamp with time zone NOT NULL DEFAULT now(),
  owner_user_id uuid REFERENCES public.profiles(id) ON DELETE SET NULL,
  linked_user_id uuid REFERENCES public.profiles(id) ON DELETE SET NULL,
  linked_org_profile_id uuid REFERENCES public.org_profiles(id) ON DELETE SET NULL,
  participant_name text NOT NULL,
  email text NOT NULL,
  organization_name text,
  role_title text,
  cohort text NOT NULL DEFAULT 'consultant' CHECK (cohort IN ('consultant', 'nonprofit', 'other')),
  stage text NOT NULL DEFAULT 'lead' CHECK (stage IN ('lead', 'invited', 'scheduled', 'onboarded', 'active', 'completed', 'paid', 'declined')),
  payment_intent text NOT NULL DEFAULT 'unknown' CHECK (payment_intent IN ('unknown', 'strong_yes', 'conditional_yes', 'not_now', 'no_budget', 'no_fit')),
  sean_ellis_response text NOT NULL DEFAULT 'unknown' CHECK (sean_ellis_response IN ('unknown', 'very_disappointed', 'somewhat_disappointed', 'not_disappointed')),
  pilot_source text,
  funding_task text,
  notes text,
  last_contact_at timestamp with time zone,
  onboarding_at timestamp with time zone,
  observed_session_at timestamp with time zone,
  closeout_at timestamp with time zone
);

CREATE UNIQUE INDEX IF NOT EXISTS pilot_participants_email_lower_idx
  ON public.pilot_participants (lower(email));

CREATE INDEX IF NOT EXISTS pilot_participants_stage_idx
  ON public.pilot_participants (stage);

CREATE INDEX IF NOT EXISTS pilot_participants_cohort_idx
  ON public.pilot_participants (cohort);

CREATE INDEX IF NOT EXISTS pilot_participants_linked_user_idx
  ON public.pilot_participants (linked_user_id);

ALTER TABLE public.pilot_participants ENABLE ROW LEVEL SECURITY;
