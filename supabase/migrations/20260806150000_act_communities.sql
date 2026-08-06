-- Community records: places ACT is deliberately engaged with (CONTEXT.md;
-- docs/specs/community-records-spec.md; ADR 0004). Supabase-native, human-
-- minted, name-as-identity. Geo codes and goods_communities rows attach as
-- annotations in `geo`, never as the key.

create table if not exists act_communities (
  id uuid primary key default gen_random_uuid(),
  org_profile_id uuid not null references org_profiles(id),
  name text not null,
  slug text not null,
  notes text,
  -- Annotations only: { lga_codes: [], postcodes: [], goods_community_ids: [] }
  geo jsonb not null default '{}',
  minted_by text,
  minted_at timestamptz not null default now(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (org_profile_id, slug)
);

-- Typed edges: hub, not hierarchy (nothing is required to have a Community).
create table if not exists act_community_links (
  id uuid primary key default gen_random_uuid(),
  community_id uuid not null references act_communities(id) on delete cascade,
  subject_type text not null check (subject_type in ('org', 'person')),
  -- Org name (goods_relationships key) or Person GHL contact id.
  subject_ref text not null,
  link_type text not null check (link_type in ('in', 'distributes-into', 'anchored-in')),
  created_at timestamptz not null default now(),
  unique (community_id, subject_type, subject_ref, link_type)
);

-- "What do we owe Barkly" — the highest-value join (#159).
alter table act_obligations add column if not exists community_id uuid references act_communities(id);

create index if not exists act_obligations_community_idx on act_obligations (community_id) where community_id is not null;

alter table act_communities enable row level security;
alter table act_community_links enable row level security;
-- Service-role only, same posture as act_obligations.
