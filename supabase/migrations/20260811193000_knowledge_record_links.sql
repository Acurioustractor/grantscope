-- Written in JusticeHub (supabase/migrations/20260811193000_knowledge_record_links.sql) in August 2026, never applied.
-- Applied 2026-09-24 on Ben's word; wrapped in a transaction so a failure rolls back whole.
BEGIN;

-- Governed relationships between records. This is an additive read-side graph,
-- never a replacement for the source tables or the append-only assertions ledger.

create table if not exists public.knowledge_record_links (
  id uuid primary key default gen_random_uuid(),
  subject_type text not null check (length(trim(subject_type)) between 1 and 120),
  subject_id text not null check (length(trim(subject_id)) between 1 and 200),
  predicate text not null check (length(trim(predicate)) between 1 and 120),
  object_type text not null check (length(trim(object_type)) between 1 and 120),
  object_id text not null check (length(trim(object_id)) between 1 and 200),
  asserted_by_user_id uuid references auth.users(id) on delete set null,
  asserted_by_name text check (asserted_by_name is null or length(trim(asserted_by_name)) between 1 and 200),
  asserted_by_organization_id uuid,
  assertion_basis text not null check (assertion_basis in ('statutory','certified','disclosed','stated','derived','inferred')),
  authority_state text not null default 'found' check (authority_state in ('found','source_grounded','human_confirmed','community_held','community_published')),
  source_url text,
  source_read_at timestamptz,
  permission_reference text,
  note text not null check (length(trim(note)) between 3 and 4000),
  audience text not null default 'private' check (audience in ('private','community','public')),
  asserted_at timestamptz not null default now(),
  superseded_by uuid references public.knowledge_record_links(id) on delete set null,
  superseded_at timestamptz,
  withdrawn_at timestamptz,
  created_at timestamptz not null default now(),
  constraint knowledge_record_links_not_reflexive check (
    subject_type <> object_type or subject_id <> object_id
  ),
  constraint knowledge_record_links_supersession_dated check (
    (superseded_by is null and superseded_at is null) or
    (superseded_by is not null and superseded_at is not null)
  ),
  constraint knowledge_record_links_named_human check (
    authority_state not in ('human_confirmed','community_held','community_published') or
    asserted_by_user_id is not null or asserted_by_name is not null
  ),
  constraint knowledge_record_links_community_authority check (
    authority_state not in ('community_held','community_published') or
    asserted_by_organization_id is not null
  ),
  constraint knowledge_record_links_public_authority check (
    audience <> 'public' or authority_state in ('source_grounded','human_confirmed','community_published')
  ),
  constraint knowledge_record_links_grounded_source check (
    authority_state <> 'source_grounded' or (source_url is not null and source_read_at is not null)
  )
);

create index if not exists knowledge_record_links_subject_idx
  on public.knowledge_record_links(subject_type, subject_id) where superseded_by is null and withdrawn_at is null;
create index if not exists knowledge_record_links_object_idx
  on public.knowledge_record_links(object_type, object_id) where superseded_by is null and withdrawn_at is null;
create unique index if not exists knowledge_record_links_live_unique_idx
  on public.knowledge_record_links(subject_type, subject_id, predicate, object_type, object_id)
  where superseded_by is null and withdrawn_at is null;

comment on table public.knowledge_record_links is
  'Governed, attributable relationships between canonical source records. Corrections supersede; source records are never copied here.';

alter table public.knowledge_record_links enable row level security;

create policy knowledge_record_links_public_read on public.knowledge_record_links
  for select using (audience = 'public' and superseded_by is null and withdrawn_at is null);

create policy knowledge_record_links_authenticated_read on public.knowledge_record_links
  for select to authenticated using (audience in ('community','public') and superseded_by is null and withdrawn_at is null);

create policy knowledge_record_links_owner_read on public.knowledge_record_links
  for select to authenticated using (
    asserted_by_user_id = (select auth.uid())
    and superseded_by is null
    and withdrawn_at is null
  );

create policy knowledge_record_links_admin_read on public.knowledge_record_links
  for select to authenticated using ((select public.is_admin()));

-- First contributions remain private and cannot self-award a high authority rung.
create policy knowledge_record_links_authenticated_insert on public.knowledge_record_links
  for insert to authenticated with check (
    asserted_by_user_id = auth.uid()
    and audience = 'private'
    and authority_state in ('found','source_grounded')
    and superseded_by is null
    and withdrawn_at is null
  );

grant select on public.knowledge_record_links to anon, authenticated;
grant insert on public.knowledge_record_links to authenticated;
grant all on public.knowledge_record_links to service_role;

-- Community publication is already governed by the JR owner/reviewer workflow.
-- This view exposes only the lineage of the current immutable public edition.
create or replace view public.jr_published_knowledge_links
with (security_invoker = true) as
select
  snapshot.id::text || ':' || outcome_id::text as id,
  'jr_site'::text as subject_type,
  snapshot.jr_site_id::text as subject_id,
  'publishes_outcome'::text as predicate,
  'jr_outcome'::text as object_type,
  outcome_id::text as object_id,
  snapshot.published_by as asserted_by_user_id,
  'stated'::text as assertion_basis,
  'community_published'::text as authority_state,
  snapshot.published_at as asserted_at,
  snapshot.id as permission_reference,
  coalesce(snapshot.publication_note, 'Published by the community through the governed Justice Reinvestment review pathway') as note
from public.jr_publication_snapshots snapshot
cross join lateral unnest(snapshot.source_outcome_ids) outcome_id
where snapshot.status = 'published' and snapshot.withdrawn_at is null;

grant select on public.jr_published_knowledge_links to anon, authenticated;

create table if not exists public.knowledge_link_reviews (
  id uuid primary key default gen_random_uuid(),
  proposal_id uuid not null references public.knowledge_record_links(id) on delete restrict,
  replacement_id uuid references public.knowledge_record_links(id) on delete restrict,
  decision text not null check (decision in ('approve_source','approve_human','reject')),
  reviewer_id uuid not null references auth.users(id) on delete restrict,
  note text not null check (length(trim(note)) between 3 and 4000),
  decided_at timestamptz not null default now()
);

alter table public.knowledge_link_reviews enable row level security;
create policy knowledge_link_reviews_admin_read on public.knowledge_link_reviews
  for select to authenticated using ((select public.is_admin()));
grant select on public.knowledge_link_reviews to authenticated;
grant all on public.knowledge_link_reviews to service_role;

create or replace function public.review_knowledge_record_link(
  p_proposal_id uuid,
  p_decision text,
  p_note text,
  p_audience text default 'private'
) returns uuid
language plpgsql
security definer
set search_path = public, pg_catalog
as $$
declare
  actor uuid := auth.uid();
  proposal public.knowledge_record_links%rowtype;
  replacement uuid;
  next_authority text;
begin
  if actor is null or not public.is_admin() then
    raise exception 'admin required' using errcode = '42501';
  end if;
  if p_decision is null or p_decision not in ('approve_source','approve_human','reject') then
    raise exception 'invalid decision' using errcode = '22023';
  end if;
  if p_audience is null or p_audience not in ('private','community','public') then
    raise exception 'invalid audience' using errcode = '22023';
  end if;
  if p_note is null or length(trim(p_note)) not between 3 and 4000 then
    raise exception 'review note required' using errcode = '22023';
  end if;

  select * into proposal from public.knowledge_record_links
  where id = p_proposal_id and superseded_by is null and withdrawn_at is null
  for update;
  if not found then raise exception 'live proposal not found' using errcode = 'P0002'; end if;
  if proposal.audience <> 'private' then
    raise exception 'only private proposals may be reviewed' using errcode = '22023';
  end if;

  if p_decision = 'reject' then
    update public.knowledge_record_links set withdrawn_at = now() where id = proposal.id;
  else
    next_authority := case when p_decision = 'approve_human' then 'human_confirmed' else 'source_grounded' end;
    if next_authority = 'source_grounded' and (proposal.source_url is null or proposal.source_read_at is null) then
      raise exception 'source approval requires a source that was read' using errcode = '22023';
    end if;
    -- Vacate the live-edge uniqueness slot inside this transaction. The row is
    -- then linked to its replacement below; no caller can observe the midpoint.
    update public.knowledge_record_links set withdrawn_at = now() where id = proposal.id;
    insert into public.knowledge_record_links (
      subject_type, subject_id, predicate, object_type, object_id,
      asserted_by_user_id, assertion_basis, authority_state,
      source_url, source_read_at, permission_reference, note, audience
    ) values (
      proposal.subject_type, proposal.subject_id, proposal.predicate, proposal.object_type, proposal.object_id,
      actor, proposal.assertion_basis, next_authority,
      proposal.source_url, proposal.source_read_at, proposal.permission_reference, proposal.note, p_audience
    ) returning id into replacement;
    update public.knowledge_record_links
      set superseded_by = replacement, superseded_at = now()
      where id = proposal.id;
  end if;

  insert into public.knowledge_link_reviews(proposal_id, replacement_id, decision, reviewer_id, note)
  values (proposal.id, replacement, p_decision, actor, trim(p_note));
  return replacement;
end;
$$;

revoke all on function public.review_knowledge_record_link(uuid, text, text, text) from public, anon;
grant execute on function public.review_knowledge_record_link(uuid, text, text, text) to authenticated, service_role;

COMMIT;
