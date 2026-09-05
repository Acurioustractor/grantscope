create table if not exists public.tracker_site_snapshots (
  id uuid primary key default gen_random_uuid(),
  run_id uuid references public.agent_runs(id) on delete set null,
  domain text not null,
  jurisdiction text not null,
  site_name text not null,
  tracker_count integer not null default 0,
  mirrored_count integer not null default 0,
  gap_count integer not null default 0,
  hot_score integer not null default 0,
  latest_event_date date,
  has_previous_snapshot boolean not null default false,
  hot_delta integer not null default 0,
  tracker_delta integer not null default 0,
  mirrored_delta integer not null default 0,
  gap_delta integer not null default 0,
  created_at timestamptz not null default now()
);

create unique index if not exists idx_tracker_site_snapshots_run_site
  on public.tracker_site_snapshots (coalesce(run_id, '00000000-0000-0000-0000-000000000000'::uuid), domain, jurisdiction, site_name);

create index if not exists idx_tracker_site_snapshots_lookup
  on public.tracker_site_snapshots (domain, jurisdiction, created_at desc, site_name);

create index if not exists idx_tracker_site_snapshots_run
  on public.tracker_site_snapshots (run_id, created_at desc);
