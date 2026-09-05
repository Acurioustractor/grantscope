ALTER TABLE public.org_pipeline
  DROP CONSTRAINT IF EXISTS org_pipeline_status_check;

ALTER TABLE public.org_pipeline
  ADD CONSTRAINT org_pipeline_status_check
  CHECK (status = ANY (ARRAY[
    'prospect',
    'upcoming',
    'researching',
    'pursuing',
    'applied',
    'submitted',
    'waiting',
    'won',
    'lost',
    'passed',
    'parked',
    'declined',
    'archived',
    'drafting',
    'awarded',
    'rejected',
    'expired',
    'watching',
    'discovered'
  ]));
