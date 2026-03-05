-- Foundation bookmarking: saved foundations with ratings, relationship stages, and notes
create table saved_foundations (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  foundation_id uuid not null references foundations(id) on delete cascade,
  stars smallint not null default 0 check (stars >= 0 and stars <= 3),
  stage text not null default 'discovered' check (stage in (
    'discovered','researching','connected','active_relationship'
  )),
  notes text,
  last_contact_date date,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique(user_id, foundation_id)
);

-- RLS: users only see/edit their own
alter table saved_foundations enable row level security;
create policy "select own" on saved_foundations for select using (auth.uid() = user_id);
create policy "insert own" on saved_foundations for insert with check (auth.uid() = user_id);
create policy "update own" on saved_foundations for update using (auth.uid() = user_id);
create policy "delete own" on saved_foundations for delete using (auth.uid() = user_id);

create index idx_saved_foundations_user on saved_foundations(user_id, updated_at desc);
