-- People follow-ups (Ben, 2026-08-06, PR #166 review):
--   1. project_codes on act_people — project ties are set at mint (and edited
--      in the detail pane), not derived; lights up the spec §3 project chips
--      + rail filter.
--   2. act_ask_warmers — the Ask↔Person warm-via link ("warms N Asks →",
--      spec §4.5). Human-minted links only, never name-matched. The Ask side
--      is a GHL opportunity id (ADR 0001: Asks live in GHL); ask_name is a
--      display cache, refreshed opportunistically on write.

alter table act_people
  add column if not exists project_codes text[] not null default '{}';

create table if not exists act_ask_warmers (
  ghl_opportunity_id text not null,
  person_id uuid not null references act_people(id) on delete cascade,
  org_profile_id uuid not null references org_profiles(id),
  ask_name text,
  created_by text,
  created_at timestamptz not null default now(),
  primary key (ghl_opportunity_id, person_id)
);

create index if not exists act_ask_warmers_person_idx
  on act_ask_warmers (person_id);

alter table act_ask_warmers enable row level security;
-- No anon/authenticated policies: service-role only, same posture as act_people.
