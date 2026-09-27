alter table public.state_tenders
  add column if not exists dcsp_policy_applicable boolean,
  add column if not exists aboriginal_participation_requirements text;

comment on column public.state_tenders.dcsp_policy_applicable is
  'True only when the Tenders WA contract detail page explicitly displays DCSP Policy as Applicable. Null means the field was not published on the captured detail page.';
comment on column public.state_tenders.aboriginal_participation_requirements is
  'Source-published Aboriginal Participation Requirements value. This is a procurement requirement, not evidence that the supplier is Aboriginal owned or community controlled.';

create index if not exists idx_state_tenders_dcsp_policy
  on public.state_tenders(dcsp_policy_applicable)
  where dcsp_policy_applicable is true;
create index if not exists idx_state_tenders_aboriginal_participation
  on public.state_tenders(aboriginal_participation_requirements)
  where aboriginal_participation_requirements is not null;

