-- Opportunity context events
--
-- Small normalized memory table for read-only source sweeps such as Gmail,
-- GHL, Notion, and public opportunity feeds. Store summaries and source refs,
-- not full private message bodies.

create table if not exists public.opportunity_context_events (
  id uuid primary key default gen_random_uuid(),
  org_profile_id uuid references public.org_profiles(id) on delete cascade,
  source_system text not null,
  source_type text not null,
  source_ref text not null,
  source_thread_id text,
  source_url text,
  title text not null,
  summary text not null,
  actor_name text,
  actor_email text,
  organisation text,
  lane text not null default 'relationship',
  signal_kind text not null default 'context',
  confidence numeric not null default 0.7,
  happened_at timestamptz,
  search_query text,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (org_profile_id, source_system, source_ref, signal_kind)
);

create index if not exists opportunity_context_events_org_happened_idx
  on public.opportunity_context_events (org_profile_id, happened_at desc);

create index if not exists opportunity_context_events_source_idx
  on public.opportunity_context_events (source_system, source_type, source_ref);

create index if not exists opportunity_context_events_lane_idx
  on public.opportunity_context_events (org_profile_id, lane, signal_kind);

create index if not exists opportunity_context_events_metadata_idx
  on public.opportunity_context_events using gin (metadata);

alter table public.opportunity_context_events enable row level security;

do $$
begin
  if not exists (
    select 1
    from pg_policies
    where schemaname = 'public'
      and tablename = 'opportunity_context_events'
      and policyname = 'Service role full access'
  ) then
    create policy "Service role full access"
    on public.opportunity_context_events
    for all to service_role
    using (true)
    with check (true);
  end if;
end $$;
