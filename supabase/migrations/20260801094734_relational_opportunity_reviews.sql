-- Minimal, append-only human review memory for opportunity and relationship work.
--
-- A review records the human read in opportunity_decisions.judgment. When that
-- review includes a commitment or return, the RPC also appends a linked
-- opportunity_context_events row in the same transaction.

alter table public.opportunity_decisions
  add column if not exists judgment jsonb not null default '{}'::jsonb,
  add column if not exists supersedes_id uuid;

alter table public.opportunity_decisions
  drop constraint if exists opportunity_decisions_decision_check;

alter table public.opportunity_decisions
  add constraint opportunity_decisions_decision_check
  check (
    decision in (
      'no',
      'later',
      'research',
      'partner',
      'apply',
      'send_to_ghl',
      'won',
      'lost',
      'more_info',
      'review'
    )
  );

do $$
begin
  if not exists (
    select 1
    from pg_constraint
    where conrelid = 'public.opportunity_decisions'::regclass
      and conname = 'opportunity_decisions_judgment_object_check'
  ) then
    alter table public.opportunity_decisions
      add constraint opportunity_decisions_judgment_object_check
      check (jsonb_typeof(judgment) = 'object');
  end if;

  if not exists (
    select 1
    from pg_constraint
    where conrelid = 'public.opportunity_decisions'::regclass
      and conname = 'opportunity_decisions_supersedes_id_fkey'
  ) then
    alter table public.opportunity_decisions
      add constraint opportunity_decisions_supersedes_id_fkey
      foreign key (supersedes_id)
      references public.opportunity_decisions(id)
      on delete set null;
  end if;
end $$;

create index if not exists idx_opportunity_decisions_supersedes
  on public.opportunity_decisions (supersedes_id)
  where supersedes_id is not null;

alter table public.opportunity_context_events
  add column if not exists decision_id uuid;

do $$
begin
  if not exists (
    select 1
    from pg_constraint
    where conrelid = 'public.opportunity_context_events'::regclass
      and conname = 'opportunity_context_events_decision_id_fkey'
  ) then
    alter table public.opportunity_context_events
      add constraint opportunity_context_events_decision_id_fkey
      foreign key (decision_id)
      references public.opportunity_decisions(id)
      on delete set null;
  end if;
end $$;

create index if not exists opportunity_context_events_decision_idx
  on public.opportunity_context_events (decision_id)
  where decision_id is not null;

create or replace function public.record_opportunity_review(
  p_user_id uuid,
  p_org_profile_id uuid,
  p_source_type text,
  p_source_ref text,
  p_project_code text default null,
  p_pathway text default null,
  p_reason text default null,
  p_notes text default null,
  p_evidence_gaps text[] default '{}',
  p_outcome text default null,
  p_judgment jsonb default '{}'::jsonb,
  p_supersedes_id uuid default null
)
returns table (
  decision_id uuid,
  action_event_id uuid
)
language plpgsql
security invoker
set search_path = public, pg_temp
as $$
declare
  v_decision_id uuid;
  v_action_event_id uuid;
  v_action jsonb;
  v_action_kind text;
  v_action_owner text;
  v_action_beneficiary text;
  v_action_text text;
  v_action_due_at text;
begin
  if btrim(coalesce(p_source_type, '')) = '' or btrim(coalesce(p_source_ref, '')) = '' then
    raise exception 'source_type and source_ref are required';
  end if;

  if jsonb_typeof(coalesce(p_judgment, '{}'::jsonb)) <> 'object' then
    raise exception 'judgment must be a JSON object';
  end if;

  if btrim(coalesce(p_judgment ->> 'whatChanged', '')) = '' then
    raise exception 'judgment.whatChanged is required';
  end if;

  if p_supersedes_id is not null then
    perform 1
    from public.opportunity_decisions prior
    where prior.id = p_supersedes_id
      and prior.org_profile_id is not distinct from p_org_profile_id
      and prior.source_type = p_source_type
      and prior.source_ref = p_source_ref;

    if not found then
      raise exception 'supersedes_id must reference an earlier review for the same organisation and source';
    end if;
  end if;

  insert into public.opportunity_decisions (
    user_id,
    org_profile_id,
    source_type,
    source_ref,
    project_code,
    pathway,
    decision,
    reason,
    notes,
    evidence_gaps,
    outcome,
    judgment,
    supersedes_id
  )
  values (
    p_user_id,
    p_org_profile_id,
    p_source_type,
    p_source_ref,
    p_project_code,
    p_pathway,
    'review',
    p_reason,
    p_notes,
    coalesce(p_evidence_gaps, '{}'),
    p_outcome,
    coalesce(p_judgment, '{}'::jsonb),
    p_supersedes_id
  )
  returning id into v_decision_id;

  v_action := p_judgment -> 'commitment';

  if v_action is not null and v_action <> 'null'::jsonb then
    if jsonb_typeof(v_action) <> 'object' then
      raise exception 'judgment commitment/return must be a JSON object';
    end if;

    v_action_kind := lower(coalesce(v_action ->> 'kind', v_action ->> 'type', 'commitment'));
    v_action_owner := btrim(coalesce(v_action ->> 'owner', ''));
    v_action_beneficiary := nullif(btrim(coalesce(v_action ->> 'beneficiary', '')), '');
    v_action_text := btrim(coalesce(v_action ->> 'action', ''));
    v_action_due_at := nullif(btrim(coalesce(v_action ->> 'dueAt', '')), '');

    if v_action_kind not in ('commitment', 'return') then
      raise exception 'judgment commitment kind must be commitment or return';
    end if;

    if v_action_owner = '' or v_action_text = '' then
      raise exception 'judgment commitment/return requires an owner and action';
    end if;

    insert into public.opportunity_context_events (
      org_profile_id,
      source_system,
      source_type,
      source_ref,
      title,
      summary,
      actor_name,
      organisation,
      lane,
      signal_kind,
      confidence,
      happened_at,
      metadata,
      decision_id
    )
    values (
      p_org_profile_id,
      'human_review',
      'decision_action',
      v_decision_id::text,
      case
        when v_action_kind = 'return' then 'Return: ' || v_action_text
        else 'Commitment: ' || v_action_text
      end,
      v_action_text,
      v_action_owner,
      v_action_beneficiary,
      'relationship',
      'relationship_' || v_action_kind,
      1,
      now(),
      jsonb_strip_nulls(
        jsonb_build_object(
          'kind', v_action_kind,
          'owner', v_action_owner,
          'beneficiary', v_action_beneficiary,
          'action', v_action_text,
          'dueAt', v_action_due_at
        )
      ),
      v_decision_id
    )
    returning id into v_action_event_id;
  end if;

  return query select v_decision_id, v_action_event_id;
end;
$$;

revoke all on function public.record_opportunity_review(
  uuid,
  uuid,
  text,
  text,
  text,
  text,
  text,
  text,
  text[],
  text,
  jsonb,
  uuid
) from public, anon, authenticated;

grant execute on function public.record_opportunity_review(
  uuid,
  uuid,
  text,
  text,
  text,
  text,
  text,
  text,
  text[],
  text,
  jsonb,
  uuid
) to service_role;
