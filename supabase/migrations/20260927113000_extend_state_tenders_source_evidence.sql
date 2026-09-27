alter table public.state_tenders
  add column if not exists source_reference text,
  add column if not exists regions text[] not null default '{}',
  add column if not exists procurement_method text,
  add column if not exists commencement_date timestamptz,
  add column if not exists expiry_date timestamptz,
  add column if not exists number_of_submissions integer,
  add column if not exists is_panel_contract boolean,
  add column if not exists suppliers jsonb not null default '[]'::jsonb;

comment on column public.state_tenders.source_reference is
  'Human-facing reference number published by the source portal. source_id remains the stable source-system identifier.';
comment on column public.state_tenders.regions is
  'Source-published delivery regions. These are not inferred from buyer or supplier addresses.';
comment on column public.state_tenders.suppliers is
  'All source-published contractors. supplier_name remains a searchable flattened representation.';

create index if not exists idx_state_tenders_source_reference
  on public.state_tenders(source, source_reference);
create index if not exists idx_state_tenders_regions
  on public.state_tenders using gin(regions);
create index if not exists idx_state_tenders_expiry_date
  on public.state_tenders(expiry_date);
