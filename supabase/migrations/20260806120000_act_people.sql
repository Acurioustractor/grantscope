-- People: humans ACT deliberately cultivates (CONTEXT.md; ADR 0002).
-- GHL owns existence + relationship state (warmth, next action, owner,
-- last touch); this table is the READ MIRROR the desk and /people surface
-- query — never GHL live. Synced by scripts/reconcile-act-people-ghl.mjs;
-- on any disagreement GHL wins silently.
--
-- Not a Person without a GHL contact: minting = creating/claiming the
-- contact, and ghl_contact_id is therefore NOT NULL + unique.

create table if not exists act_people (
  id uuid primary key default gen_random_uuid(),
  org_profile_id uuid not null references org_profiles(id),
  ghl_contact_id text not null unique,
  name text not null,
  -- One warmth value per Person (ADR 0002). Mirrors the single GHL warmth
  -- tag (goods-hot..goods-cold) minus the prefix.
  warmth text check (warmth in ('hot', 'warm', 'steady', 'cooling', 'cold')),
  -- The holder when warmth is indirect ("warm via Nic"); null = direct.
  -- Written into the GHL task body for phone visibility, but the mirror is
  -- authoritative for this one field (GHL has no native home for it).
  warm_via text,
  owner text,
  -- The next action / watch (#148). Minting always sets both; a dateless
  -- Person exists only pre-backfill or after an explicit Release.
  next_action text,
  review_by date,
  -- The GHL contact task holding the next action (write path + reconcile).
  ghl_task_id text,
  last_touch_at timestamptz,
  last_synced_at timestamptz not null default now(),
  minted_by text,
  minted_at timestamptz not null default now(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists act_people_pool_idx
  on act_people (org_profile_id, review_by);

-- Person↔Org roles are Supabase-owned, NOT mirrored (ADR 0002 deviation 2):
-- ACT's structural knowledge, changed by human decision in the workspace.
create table if not exists act_person_roles (
  id uuid primary key default gen_random_uuid(),
  person_id uuid not null references act_people(id) on delete cascade,
  role_type text not null check (role_type in ('works_at', 'board_of', 'decides_for', 'opens_into')),
  org_name text not null,
  -- Optional link into CivicGraph (gs_id) or an org workspace slug.
  org_ref text,
  created_by text,
  created_at timestamptz not null default now()
);

create index if not exists act_person_roles_person_idx
  on act_person_roles (person_id);

alter table act_people enable row level security;
alter table act_person_roles enable row level security;
-- No anon/authenticated policies: all access goes through the app's service
-- role (same posture as act_obligations / the other org-workspace tables).
