-- Grant tracker: saved grants with ratings, color labels, pipeline stages
create table saved_grants (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  grant_id uuid not null references grant_opportunities(id) on delete cascade,
  stars smallint not null default 0 check (stars >= 0 and stars <= 3),
  color text check (color in ('red','blue','green','yellow','orange','purple','none')),
  stage text not null default 'discovered' check (stage in (
    'discovered','researching','pursuing','submitted',
    'negotiating','approved','realized','lost','expired'
  )),
  notes text,
  ghl_opportunity_id text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique(user_id, grant_id)
);

-- RLS: users only see/edit their own
alter table saved_grants enable row level security;
create policy "select own" on saved_grants for select using (auth.uid() = user_id);
create policy "insert own" on saved_grants for insert with check (auth.uid() = user_id);
create policy "update own" on saved_grants for update using (auth.uid() = user_id);
create policy "delete own" on saved_grants for delete using (auth.uid() = user_id);

create index idx_saved_grants_user_stage on saved_grants(user_id, stage);
