-- Digest (#160) + GHL tasks bridge (#161) state. Both are projections of the
-- desk — nothing here is a source of truth about the work itself.

-- One row per SENT digest (delta checks compare against the latest row;
-- quiet days record nothing). row_keys are desk row ids namespaced by
-- section, e.g. 'decision:g-123', 'due:obligation:<uuid>'.
create table if not exists digest_log (
  id uuid primary key default gen_random_uuid(),
  org_profile_id uuid not null references org_profiles(id),
  sent_at timestamptz not null default now(),
  subject text not null,
  row_keys text[] not null default '{}',
  counts jsonb not null default '{}',
  channel text not null default 'email',
  -- Monday heartbeats send even with no delta; flagged for cadence debugging.
  heartbeat boolean not null default false
);

create index if not exists digest_log_latest_idx
  on digest_log (org_profile_id, sent_at desc);

-- The bridge only creates/updates/deletes tasks it created, tracked here
-- (spec #161: strictly one-way, never read back, never touches hand-made
-- tasks). source_key identifies the desk row ('obligation:<id>',
-- 'person:<id>', 'ask:<desk-record-id>').
create table if not exists ghl_task_bridge (
  source_key text primary key,
  org_profile_id uuid not null references org_profiles(id),
  ghl_task_id text not null,
  ghl_contact_id text not null,
  title text not null,
  due_date date,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table digest_log enable row level security;
alter table ghl_task_bridge enable row level security;
-- Service-role only, same posture as the other org-workspace tables.
-- psql-created objects don't inherit Supabase's default grants (same gotcha
-- as the Goods relationship views) — grant explicitly or reads 403.
grant all on table digest_log, ghl_task_bridge to service_role;
