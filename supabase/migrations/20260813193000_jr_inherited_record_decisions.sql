-- Written in JusticeHub (supabase/migrations/20260813193000_jr_inherited_record_decisions.sql) in August 2026, never applied.
-- Applied 2026-09-24 on Ben's word; wrapped in a transaction so a failure rolls back whole.
BEGIN;

-- Private, append-only community review of inherited JR source records.
-- This does not alter the source record and cannot publish anything.

create table if not exists public.jr_inherited_record_decisions (
  id uuid primary key default gen_random_uuid(),
  jr_site_id uuid not null references public.jr_sites(id) on delete cascade,
  source_record_id text not null check (char_length(btrim(source_record_id)) between 1 and 300),
  source_kind text not null check (source_kind in (
    'history', 'outcome', 'measure', 'organization', 'program', 'funding_claim', 'system_context'
  )),
  decision text not null check (decision in ('keep', 'correct', 'contextualise', 'hold', 'exclude')),
  note text not null check (char_length(btrim(note)) between 3 and 2000),
  actor_id uuid not null references auth.users(id) on delete restrict,
  actor_role text not null check (actor_role in ('editor', 'owner', 'platform_admin', 'community_steward')),
  audience text not null default 'private' check (audience = 'private'),
  decided_at timestamptz not null default now(),
  created_at timestamptz not null default now()
);

create index if not exists jr_inherited_record_decisions_latest_idx
  on public.jr_inherited_record_decisions (jr_site_id, source_record_id, decided_at desc);

comment on table public.jr_inherited_record_decisions is
  'Append-only private community review of inherited source records. Decisions do not mutate sources or authorize publication.';

create or replace function public.jr_keep_inherited_record_decisions_immutable()
returns trigger language plpgsql set search_path = public as $$
begin
  raise exception 'Inherited record review decisions are append-only';
end;
$$;

drop trigger if exists jr_inherited_record_decisions_immutable on public.jr_inherited_record_decisions;
create trigger jr_inherited_record_decisions_immutable
  before update or delete on public.jr_inherited_record_decisions
  for each row execute function public.jr_keep_inherited_record_decisions_immutable();

alter table public.jr_inherited_record_decisions enable row level security;
revoke all on public.jr_inherited_record_decisions from anon, authenticated;
grant all on public.jr_inherited_record_decisions to service_role;
revoke execute on function public.jr_keep_inherited_record_decisions_immutable() from public, anon, authenticated;
grant execute on function public.jr_keep_inherited_record_decisions_immutable() to service_role;

COMMIT;
