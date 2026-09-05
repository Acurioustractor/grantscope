-- Obligations: work ACT owes because of a commitment (CONTEXT.md; ADR 0003).
-- Supabase-native state — the first Supabase-owned truth, no GHL involvement.
-- Human-minted only: a Won Ask prompts minting, never auto-creates (#147).

create table if not exists act_obligations (
  id uuid primary key default gen_random_uuid(),
  org_profile_id uuid not null references org_profiles(id),
  project_code text not null,
  title text not null,
  owed_to text not null check (owed_to in ('funder', 'community')),
  state text not null default 'open' check (state in ('open', 'done', 'dropped')),
  next_action text,
  due_date date,
  owner text,
  -- Provenance: the Won Ask this was minted from (GHL opportunity), or null
  -- for community promises recorded directly.
  source_ask_ghl_id text,
  source_ask_name text,
  -- Community promises: who the promise was made to (free text; optionally a
  -- Person link once the People mirror ships).
  promised_to text,
  -- The Notion doc this Obligation discharges into (Notion owns artefacts).
  artefact_url text,
  -- Dropped = consciously released, recorded, never silently deleted.
  -- Required when owed_to = 'community' (enforced in the API, not here —
  -- historical funder drops may arrive reasonless from the triage sitting).
  drop_reason text,
  minted_by text,
  minted_at timestamptz not null default now(),
  discharged_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists act_obligations_pool_idx
  on act_obligations (org_profile_id, project_code, state, due_date);

-- Explicit "nothing owed" flag on a Won Ask — clears the Won-without-
-- Obligations mismatch without minting. Reversible (delete the row).
create table if not exists act_ask_none_owed (
  ghl_opportunity_id text primary key,
  org_profile_id uuid not null references org_profiles(id),
  flagged_by text,
  flagged_at timestamptz not null default now()
);

alter table act_obligations enable row level security;
alter table act_ask_none_owed enable row level security;
-- No anon/authenticated policies: all access goes through the app's service
-- role (same posture as the other org-workspace tables).
