-- Ask artefact links (wayfinder #162, docs/specs/grants-notion-handoff-spec.md):
-- the one new piece of state closing the desk → GHL → Notion loop. Keyed on
-- the GHL opportunity id (ADR 0001: Asks live in GHL); Supabase-side only,
-- never a GHL field. /make-the-ask sets it when it parks the Notion page.
-- Absence is NOT a mismatch — plenty of Asks need no document.

create table if not exists act_ask_artefacts (
  ghl_opportunity_id text primary key,
  org_profile_id uuid not null references org_profiles(id),
  artefact_url text not null,
  ask_name text,
  set_by text,
  set_at timestamptz not null default now()
);

create index if not exists act_ask_artefacts_org_idx
  on act_ask_artefacts (org_profile_id);

alter table act_ask_artefacts enable row level security;
-- No anon/authenticated policies: service-role only, same posture as act_people.

-- psql-created tables don't inherit Supabase default grants (2026-08-06 gotcha);
-- without this the service-role client silently reads an empty table.
grant all on act_ask_artefacts to service_role;
