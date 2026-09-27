create table if not exists public.wa_aer_source_artifacts (
  id uuid primary key default gen_random_uuid(),
  reporting_period text not null,
  source_page_url text not null,
  source_file_url text not null,
  source_sha256 text not null unique check (source_sha256 ~ '^[0-9a-f]{64}$'),
  source_bytes bigint not null check (source_bytes > 0),
  fetched_at timestamptz not null,
  parser_version text not null,
  row_count integer not null check (row_count >= 0),
  profile jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

comment on table public.wa_aer_source_artifacts is
  'Immutable manifests for official WA Aboriginal Expenditure Review source files.';

create table if not exists public.wa_aer_programs (
  id uuid primary key default gen_random_uuid(),
  source_artifact_id uuid not null references public.wa_aer_source_artifacts(id) on delete restrict,
  source_row integer not null check (source_row >= 3),
  program_key text not null check (program_key ~ '^[0-9a-f]{24}$'),
  expenditure_type text not null,
  agency text not null,
  program_name text not null,
  funding_source text not null,
  statewide boolean not null default false,
  metro_perth_peel boolean not null default false,
  south_west_great_southern boolean not null default false,
  kimberley boolean not null default false,
  pilbara boolean not null default false,
  mid_west_gascoyne boolean not null default false,
  goldfields_esperance boolean not null default false,
  wheatbelt boolean not null default false,
  ctg_targets text,
  priority_reform_area text,
  wa_government_only boolean not null default false,
  wa_government_external_parties boolean not null default false,
  external_parties_only boolean not null default false,
  aboriginal_organisation_or_acco boolean not null default false,
  aboriginal_organisation_or_acco_only boolean not null default false,
  created_at timestamptz not null default now(),
  unique (source_artifact_id, source_row)
);

comment on table public.wa_aer_programs is
  'Program-level WA AER inventory. Rows are not contracts, awards, recipients, expenditure values, ACCO verification or transition-readiness findings.';

create index if not exists idx_wa_aer_programs_program_key on public.wa_aer_programs(program_key);
create index if not exists idx_wa_aer_programs_agency on public.wa_aer_programs(agency);
create index if not exists idx_wa_aer_programs_kimberley on public.wa_aer_programs(kimberley) where kimberley;
create index if not exists idx_wa_aer_programs_acco on public.wa_aer_programs(aboriginal_organisation_or_acco)
  where aboriginal_organisation_or_acco or aboriginal_organisation_or_acco_only;

alter table public.wa_aer_source_artifacts enable row level security;
alter table public.wa_aer_programs enable row level security;

grant select on public.wa_aer_source_artifacts to anon, authenticated;
grant select on public.wa_aer_programs to anon, authenticated;
grant all on public.wa_aer_source_artifacts to service_role;
grant all on public.wa_aer_programs to service_role;

create policy "WA AER artifacts are publicly readable"
  on public.wa_aer_source_artifacts for select
  using (true);

create policy "WA AER programs are publicly readable"
  on public.wa_aer_programs for select
  using (true);
