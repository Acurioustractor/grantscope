-- Written in JusticeHub (supabase/migrations/20260814060000_jr_site_support_requests.sql) in August 2026, never applied.
-- Applied 2026-09-24 on Ben's word; wrapped in a transaction so a failure rolls back whole.
BEGIN;

-- Private Justice Reinvestment site support queue and conversation history.
--
-- These records coordinate operational help. They are not review decisions,
-- community authority, publication instructions, story consent or withdrawal
-- authority. Those decisions remain in their existing governed systems.

create table public.jr_site_support_requests (
  id                        uuid primary key default gen_random_uuid(),
  jr_site_id                uuid not null references public.jr_sites(id) on delete restrict,
  requester_organization_id uuid references public.organizations(id) on delete set null,
  requested_by              uuid references auth.users(id) on delete set null,
  assigned_to               uuid references auth.users(id) on delete set null,
  request_kind              text not null check (
    request_kind in (
      'data_correction',
      'data_collection',
      'enrichment',
      'access',
      'technical',
      'publication_support',
      'story_relationship',
      'general'
    )
  ),
  source_channel            text not null check (
    source_channel in ('community_workspace', 'admin', 'inbox', 'agent', 'api', 'import')
  ),
  status                    text not null default 'open' check (
    status in ('open', 'triaged', 'in_progress', 'waiting_on_community', 'resolved', 'closed')
  ),
  priority                  text not null default 'normal' check (
    priority in ('low', 'normal', 'high', 'urgent')
  ),
  title                     text not null check (char_length(btrim(title)) between 3 and 180),
  request_summary           text not null check (char_length(btrim(request_summary)) between 3 and 5000),
  related_record_type       text,
  related_record_id         text,
  resolved_at               timestamptz,
  created_at                timestamptz not null default now(),
  updated_at                timestamptz not null default now(),
  constraint jr_site_support_requests_related_record_pair check (
    (related_record_type is null and related_record_id is null)
    or (nullif(btrim(related_record_type), '') is not null and nullif(btrim(related_record_id), '') is not null)
  ),
  constraint jr_site_support_requests_resolution check (
    (status in ('resolved', 'closed') and resolved_at is not null)
    or (status not in ('resolved', 'closed') and resolved_at is null)
  )
);

create index jr_site_support_requests_site_status_idx
  on public.jr_site_support_requests (jr_site_id, status, updated_at desc);

create index jr_site_support_requests_assignment_idx
  on public.jr_site_support_requests (assigned_to, status, priority, updated_at desc)
  where assigned_to is not null and status not in ('resolved', 'closed');

create index jr_site_support_requests_open_queue_idx
  on public.jr_site_support_requests (priority, updated_at desc)
  where status not in ('resolved', 'closed');

create table public.jr_site_support_request_events (
  id                uuid primary key default gen_random_uuid(),
  support_request_id uuid not null references public.jr_site_support_requests(id) on delete restrict,
  actor_id          uuid references auth.users(id) on delete restrict,
  event_kind        text not null check (
    event_kind in ('requester_message', 'admin_message', 'internal_note', 'status_change', 'assignment_change')
  ),
  visibility        text not null default 'community' check (visibility in ('community', 'internal')),
  message           text check (
    message is null or char_length(btrim(message)) between 1 and 5000
  ),
  previous_status   text check (
    previous_status is null or previous_status in ('open', 'triaged', 'in_progress', 'waiting_on_community', 'resolved', 'closed')
  ),
  next_status       text check (
    next_status is null or next_status in ('open', 'triaged', 'in_progress', 'waiting_on_community', 'resolved', 'closed')
  ),
  created_at        timestamptz not null default now(),
  supersedes_event_id uuid references public.jr_site_support_request_events(id) on delete restrict,
  constraint jr_site_support_request_events_status_pair check (
    (event_kind = 'status_change' and previous_status is not null and next_status is not null)
    or (event_kind <> 'status_change' and previous_status is null and next_status is null)
  ),
  constraint jr_site_support_request_events_content check (
    message is not null or event_kind in ('status_change', 'assignment_change')
  )
);

create index jr_site_support_request_events_request_idx
  on public.jr_site_support_request_events (support_request_id, created_at asc);

comment on table public.jr_site_support_requests is
  'Private operational help requested for a JR site. A support request never grants community approval, publication or withdrawal authority.';
comment on column public.jr_site_support_requests.requester_organization_id is
  'Requester affiliation only. It is not proof of site stewardship or community authority.';
comment on column public.jr_site_support_requests.request_kind is
  'publication_support means operational assistance only; the request cannot approve, publish or withdraw a community record.';
comment on column public.jr_site_support_requests.related_record_id is
  'A relationship pointer only. Do not copy story content, consent, cultural instructions or withdrawal authority into this table.';
comment on table public.jr_site_support_request_events is
  'Append-only support conversation and operational audit history. Internal events are never exposed to community members.';

create function public.jr_touch_site_support_request()
returns trigger
language plpgsql
set search_path = pg_catalog, public
as $$
begin
  if new.jr_site_id is distinct from old.jr_site_id
    or new.source_channel is distinct from old.source_channel
  then
    raise exception 'JR support request origin and site are immutable';
  end if;

  if new.status in ('resolved', 'closed') and old.status not in ('resolved', 'closed') then
    new.resolved_at := coalesce(new.resolved_at, now());
  elsif new.status not in ('resolved', 'closed') then
    new.resolved_at := null;
  end if;

  new.updated_at := now();
  return new;
end;
$$;

create trigger jr_site_support_requests_guard
  before update on public.jr_site_support_requests
  for each row execute function public.jr_touch_site_support_request();

create function public.jr_protect_site_support_request_event()
returns trigger
language plpgsql
set search_path = pg_catalog, public
as $$
begin
  raise exception 'JR support request events are append-only; add a superseding event';
end;
$$;

create function public.jr_validate_site_support_request_event()
returns trigger
language plpgsql
set search_path = pg_catalog, public
as $$
begin
  if new.supersedes_event_id is not null and not exists (
    select 1
    from public.jr_site_support_request_events prior
    where prior.id = new.supersedes_event_id
      and prior.support_request_id = new.support_request_id
  ) then
    raise exception 'A JR support event may supersede only an event on the same request';
  end if;
  return new;
end;
$$;

create trigger jr_site_support_request_events_validate
  before insert on public.jr_site_support_request_events
  for each row execute function public.jr_validate_site_support_request_event();

create trigger jr_site_support_request_events_immutable
  before update or delete on public.jr_site_support_request_events
  for each row execute function public.jr_protect_site_support_request_event();

create function public.jr_record_site_support_request_change()
returns trigger
language plpgsql
security definer
set search_path = pg_catalog, public
as $$
begin
  if new.status is distinct from old.status then
    insert into public.jr_site_support_request_events (
      support_request_id, actor_id, event_kind, visibility, previous_status, next_status
    ) values (
      new.id, auth.uid(), 'status_change', 'internal', old.status, new.status
    );
  end if;

  if new.assigned_to is distinct from old.assigned_to then
    insert into public.jr_site_support_request_events (
      support_request_id, actor_id, event_kind, visibility, message
    ) values (
      new.id,
      auth.uid(),
      'assignment_change',
      'internal',
      case
        when new.assigned_to is null then 'Request unassigned'
        when old.assigned_to is null then 'Request assigned'
        else 'Request reassigned'
      end
    );
  end if;
  return new;
end;
$$;

create trigger jr_site_support_requests_record_change
  after update of status, assigned_to on public.jr_site_support_requests
  for each row execute function public.jr_record_site_support_request_change();

alter table public.jr_site_support_requests enable row level security;
alter table public.jr_site_support_request_events enable row level security;

create policy "jr support requests admin read"
  on public.jr_site_support_requests for select to authenticated
  using ((select public.is_admin()));

create policy "jr support requests community read"
  on public.jr_site_support_requests for select to authenticated
  using (
    exists (
      select 1 from public.jr_sites site
      where site.id = jr_site_support_requests.jr_site_id
        and site.lead_organization_id is not null
        and public.is_org_member(site.lead_organization_id, 'viewer')
    )
  );

create policy "jr support requests admin insert"
  on public.jr_site_support_requests for insert to authenticated
  with check ((select public.is_admin()));

create policy "jr support requests community insert"
  on public.jr_site_support_requests for insert to authenticated
  with check (
    requested_by = (select auth.uid())
    and source_channel = 'community_workspace'
    and status = 'open'
    and priority = 'normal'
    and assigned_to is null
    and exists (
      select 1 from public.jr_sites site
      where site.id = jr_site_support_requests.jr_site_id
        and site.lead_organization_id is not null
        and (
          jr_site_support_requests.requester_organization_id is null
          or jr_site_support_requests.requester_organization_id = site.lead_organization_id
        )
        and public.is_org_member(site.lead_organization_id, 'viewer')
    )
  );

create policy "jr support requests admin update"
  on public.jr_site_support_requests for update to authenticated
  using ((select public.is_admin()))
  with check ((select public.is_admin()));

create policy "jr support events admin read"
  on public.jr_site_support_request_events for select to authenticated
  using ((select public.is_admin()));

create policy "jr support events community read"
  on public.jr_site_support_request_events for select to authenticated
  using (
    visibility = 'community'
    and exists (
      select 1
      from public.jr_site_support_requests request
      join public.jr_sites site on site.id = request.jr_site_id
      where request.id = jr_site_support_request_events.support_request_id
        and site.lead_organization_id is not null
        and public.is_org_member(site.lead_organization_id, 'viewer')
    )
  );

create policy "jr support events admin insert"
  on public.jr_site_support_request_events for insert to authenticated
  with check (
    (select public.is_admin())
    and actor_id = (select auth.uid())
    and event_kind in ('admin_message', 'internal_note')
  );

create policy "jr support events community insert"
  on public.jr_site_support_request_events for insert to authenticated
  with check (
    actor_id = (select auth.uid())
    and event_kind = 'requester_message'
    and visibility = 'community'
    and supersedes_event_id is null
    and exists (
      select 1
      from public.jr_site_support_requests request
      join public.jr_sites site on site.id = request.jr_site_id
      where request.id = jr_site_support_request_events.support_request_id
        and request.status not in ('resolved', 'closed')
        and site.lead_organization_id is not null
        and public.is_org_member(site.lead_organization_id, 'viewer')
    )
  );

revoke all on table public.jr_site_support_requests from anon, authenticated;
revoke all on table public.jr_site_support_request_events from anon, authenticated;

grant select, insert, update on table public.jr_site_support_requests to authenticated;
grant select, insert on table public.jr_site_support_request_events to authenticated;
grant all on table public.jr_site_support_requests to service_role;
grant all on table public.jr_site_support_request_events to service_role;

revoke execute on function public.jr_touch_site_support_request()
  from public, anon, authenticated;
revoke execute on function public.jr_protect_site_support_request_event()
  from public, anon, authenticated;
revoke execute on function public.jr_validate_site_support_request_event()
  from public, anon, authenticated;
revoke execute on function public.jr_record_site_support_request_change()
  from public, anon, authenticated;
grant execute on function public.jr_touch_site_support_request() to service_role;
grant execute on function public.jr_protect_site_support_request_event() to service_role;
grant execute on function public.jr_validate_site_support_request_event() to service_role;
grant execute on function public.jr_record_site_support_request_change() to service_role;

-- Rollback boundary: do not remove this migration after support conversations
-- exist. Corrections to event history must be additive through superseding rows.

COMMIT;
