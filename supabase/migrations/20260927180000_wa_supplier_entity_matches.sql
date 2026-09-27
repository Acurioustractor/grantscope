create or replace function public.wa_normalize_supplier_name(p_name text)
returns text
language sql
immutable
parallel safe
set search_path = public, extensions, pg_temp
as $$
  select nullif(
    btrim(
      regexp_replace(
        regexp_replace(
          regexp_replace(
            lower(coalesce(p_name, '')),
            E'\\m(pty\\.?[[:space:]]*(ltd\\.?|limited)|proprietary[[:space:]]+limited|limited|ltd\\.?|incorporated|inc\\.?|corporation|corp\\.?)\\M',
            ' ',
            'g'
          ),
          '[^a-z0-9]+',
          ' ',
          'g'
        ),
        E'\\s+',
        ' ',
        'g'
      )
    ),
    ''
  );
$$;

comment on function public.wa_normalize_supplier_name(text) is
  'Conservative WA procurement identity key. Removes punctuation and legal suffixes using PostgreSQL word boundaries; does not remove substantive organisation words.';

create table if not exists public.wa_supplier_entity_matches (
  id uuid primary key default gen_random_uuid(),
  state_tender_id uuid not null references public.state_tenders(id) on delete cascade,
  supplier_ordinal integer not null,
  supplier_name text not null,
  supplier_address text,
  normalized_supplier_name text,
  matched_entity_id uuid references public.gs_entities(id) on delete set null,
  match_status text not null default 'unmatched',
  match_method text,
  match_confidence numeric(4, 3),
  candidate_entity_ids uuid[] not null default '{}',
  evidence jsonb not null default '{}'::jsonb,
  resolver_version text not null,
  review_status text not null default 'pending',
  review_notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (state_tender_id, supplier_ordinal),
  constraint wa_supplier_entity_matches_status_check check (
    match_status in ('matched', 'ambiguous', 'unmatched')
  ),
  constraint wa_supplier_entity_matches_review_status_check check (
    review_status in ('pending', 'confirmed', 'rejected', 'disputed')
  ),
  constraint wa_supplier_entity_matches_confidence_check check (
    match_confidence is null or match_confidence between 0 and 1
  )
);

comment on table public.wa_supplier_entity_matches is
  'Auditable entity-resolution ledger for each supplier component in WA state tender records. A match is identity evidence only and does not establish ACCO status, readiness, authority or permission to engage.';
comment on column public.wa_supplier_entity_matches.evidence is
  'Machine-readable sources and comparison values supporting the match. Registry names are linked through stable ABN, ACN or ORIC ICN identifiers where available.';

create index if not exists idx_wa_supplier_matches_tender
  on public.wa_supplier_entity_matches(state_tender_id);
create index if not exists idx_wa_supplier_matches_entity
  on public.wa_supplier_entity_matches(matched_entity_id);
create index if not exists idx_wa_supplier_matches_status
  on public.wa_supplier_entity_matches(match_status, review_status);
create index if not exists idx_wa_supplier_matches_normalized_name
  on public.wa_supplier_entity_matches(normalized_supplier_name);

grant all on public.wa_supplier_entity_matches to service_role;

create or replace function public.refresh_wa_supplier_entity_matches()
returns jsonb
language plpgsql
security definer
set search_path = public, extensions, pg_temp
as $$
declare
  v_version constant text := 'wa-supplier-entity-v1';
  v_result jsonb;
begin
  create temporary table tmp_wa_suppliers on commit drop as
  with supplier_rows as (
    select
      t.id as state_tender_id,
      s.ordinality::integer as supplier_ordinal,
      nullif(btrim(s.item->>'name'), '') as supplier_name,
      nullif(btrim(s.item->>'address'), '') as supplier_address
    from state_tenders t
    cross join lateral jsonb_array_elements(
      case
        when jsonb_typeof(t.suppliers) = 'array' and jsonb_array_length(t.suppliers) > 0 then t.suppliers
        else jsonb_build_array(jsonb_build_object('name', t.supplier_name))
      end
    ) with ordinality as s(item, ordinality)
    where t.state = 'WA'
      and t.source in ('tenders-wa', 'data-wa-tenders')
  )
  select
    state_tender_id,
    supplier_ordinal,
    supplier_name,
    supplier_address,
    wa_normalize_supplier_name(supplier_name) as normalized_supplier_name
  from supplier_rows
  where supplier_name is not null;

  create unique index on tmp_wa_suppliers(state_tender_id, supplier_ordinal);

  insert into wa_supplier_entity_matches (
    state_tender_id, supplier_ordinal, supplier_name, supplier_address,
    normalized_supplier_name, resolver_version, updated_at
  )
  select state_tender_id, supplier_ordinal, supplier_name, supplier_address,
         normalized_supplier_name, v_version, now()
  from tmp_wa_suppliers
  on conflict (state_tender_id, supplier_ordinal) do update set
    supplier_name = excluded.supplier_name,
    supplier_address = excluded.supplier_address,
    normalized_supplier_name = excluded.normalized_supplier_name,
    resolver_version = excluded.resolver_version,
    matched_entity_id = case when wa_supplier_entity_matches.review_status = 'confirmed' then wa_supplier_entity_matches.matched_entity_id else null end,
    match_status = case when wa_supplier_entity_matches.review_status = 'confirmed' then wa_supplier_entity_matches.match_status else 'unmatched' end,
    match_method = case when wa_supplier_entity_matches.review_status = 'confirmed' then wa_supplier_entity_matches.match_method else null end,
    match_confidence = case when wa_supplier_entity_matches.review_status = 'confirmed' then wa_supplier_entity_matches.match_confidence else null end,
    candidate_entity_ids = case when wa_supplier_entity_matches.review_status = 'confirmed' then wa_supplier_entity_matches.candidate_entity_ids else '{}'::uuid[] end,
    evidence = case when wa_supplier_entity_matches.review_status = 'confirmed' then wa_supplier_entity_matches.evidence else '{}'::jsonb end,
    updated_at = now();

  delete from wa_supplier_entity_matches m
  where m.review_status = 'pending'
    and not exists (
      select 1 from tmp_wa_suppliers s
      where s.state_tender_id = m.state_tender_id
        and s.supplier_ordinal = m.supplier_ordinal
    );

  create temporary table tmp_wa_supplier_aliases on commit drop as
  select distinct
    s.state_tender_id,
    s.supplier_ordinal,
    alias_kind,
    alias_name,
    wa_normalize_supplier_name(alias_name) as normalized_alias
  from tmp_wa_suppliers s
  cross join lateral (
    values
      ('published_name'::text, s.supplier_name),
      ('trading_name'::text, nullif(btrim(regexp_replace(s.supplier_name, E'\\s*\\([^)]*\\)\\s*$', '')), '')),
      ('legal_name'::text, nullif(btrim(substring(s.supplier_name from E'\\(([^()]*)\\)\\s*$')), ''))
  ) aliases(alias_kind, alias_name)
  where alias_name is not null;

  create index on tmp_wa_supplier_aliases(normalized_alias);

  create temporary table tmp_wa_registry_names on commit drop as
  with registry_names as (
    select e.id as entity_id, e.canonical_name as source_name, 'gs_canonical_name'::text as source_method
    from gs_entities e
    where e.canonical_name is not null

    union all

    select a.entity_id, a.alias_value, 'gs_entity_alias'
    from gs_entity_aliases a
    where a.alias_value is not null

    union all

    select e.id, a.name, 'acnc_name'
    from acnc_charities a
    join gs_entities e on e.abn is not null and e.abn = a.abn
    where a.name is not null

    union all

    select e.id, btrim(alias_name), 'acnc_alias'
    from acnc_charities a
    join gs_entities e on e.abn is not null and e.abn = a.abn
    cross join lateral regexp_split_to_table(coalesce(a.other_names, ''), '[,;|]') alias_name
    where btrim(alias_name) <> ''

    union all

    select e.id, o.name, 'oric_name'
    from oric_corporations o
    join gs_entities e on e.abn is not null and e.abn = o.abn
    where o.name is not null

    union all

    select e.id, o.name, 'oric_name'
    from oric_corporations o
    join gs_entities e on e.oric_icn is not null and e.oric_icn = o.icn
    where o.name is not null

    union all

    select e.id, se.name, 'social_enterprise_name'
    from social_enterprises se
    join gs_entities e on e.abn is not null and e.abn = se.abn
    where se.name is not null

    union all

    select e.id, se.name, 'social_enterprise_name'
    from social_enterprises se
    join gs_entities e on e.acn is not null and e.acn = se.acn
    where se.name is not null

    union all

    select e.id, se.name, 'social_enterprise_name'
    from social_enterprises se
    join gs_entities e on e.oric_icn is not null and e.oric_icn = se.icn
    where se.name is not null
  )
  select distinct entity_id, source_name, source_method,
         wa_normalize_supplier_name(source_name) as normalized_name
  from registry_names
  where wa_normalize_supplier_name(source_name) is not null;

  create index on tmp_wa_registry_names(normalized_name);

  create temporary table tmp_wa_exact_candidates on commit drop as
  select
    a.state_tender_id,
    a.supplier_ordinal,
    r.entity_id,
    array_agg(distinct r.source_method order by r.source_method) as methods,
    jsonb_agg(distinct jsonb_build_object(
      'supplier_alias_kind', a.alias_kind,
      'supplier_alias', a.alias_name,
      'registry_name', r.source_name,
      'registry_source', r.source_method
    )) as evidence_items
  from tmp_wa_supplier_aliases a
  join tmp_wa_registry_names r on r.normalized_name = a.normalized_alias
  where length(a.normalized_alias) >= 4
  group by a.state_tender_id, a.supplier_ordinal, r.entity_id;

  with resolved as (
    select
      state_tender_id,
      supplier_ordinal,
      count(*) as candidate_count,
      min(entity_id::text)::uuid as sole_entity_id,
      array_agg(entity_id order by entity_id) as candidate_ids,
      jsonb_agg(jsonb_build_object('entity_id', entity_id, 'methods', methods, 'items', evidence_items)) as candidate_evidence,
      bool_or(methods && array['acnc_name', 'acnc_alias', 'oric_name', 'social_enterprise_name']) as registry_backed,
      bool_or(methods && array['gs_entity_alias']) as alias_backed
    from tmp_wa_exact_candidates
    group by state_tender_id, supplier_ordinal
  )
  update wa_supplier_entity_matches m set
    matched_entity_id = case when r.candidate_count = 1 then r.sole_entity_id else null end,
    match_status = case when r.candidate_count = 1 then 'matched' else 'ambiguous' end,
    match_method = case
      when r.candidate_count = 1 and r.registry_backed then 'exact_registry_name'
      when r.candidate_count = 1 and r.alias_backed then 'exact_sourced_alias'
      when r.candidate_count = 1 then 'exact_canonical_name'
      else 'ambiguous_exact_name'
    end,
    match_confidence = case when r.candidate_count = 1 and (r.registry_backed or r.alias_backed) then 0.990 when r.candidate_count = 1 then 0.970 else null end,
    candidate_entity_ids = r.candidate_ids,
    evidence = jsonb_build_object('candidate_count', r.candidate_count, 'candidates', r.candidate_evidence),
    updated_at = now()
  from resolved r
  where m.state_tender_id = r.state_tender_id
    and m.supplier_ordinal = r.supplier_ordinal
    and m.review_status <> 'confirmed';

  update state_tenders t set
    gs_entity_id = resolved.entity_id,
    updated_at = now()
  from (
    select state_tender_id, min(matched_entity_id::text)::uuid as entity_id
    from wa_supplier_entity_matches
    where match_status = 'matched' and matched_entity_id is not null
    group by state_tender_id
    having count(*) = 1
  ) resolved
  where t.id = resolved.state_tender_id
    and t.gs_entity_id is distinct from resolved.entity_id;

  update state_tenders t set gs_entity_id = null, updated_at = now()
  where t.state = 'WA'
    and t.source in ('tenders-wa', 'data-wa-tenders')
    and t.gs_entity_id is not null
    and not exists (
      select 1
      from wa_supplier_entity_matches m
      where m.state_tender_id = t.id
      group by m.state_tender_id
      having count(*) = 1
        and count(*) filter (where m.match_status = 'matched' and m.matched_entity_id is not null) = 1
    );

  update wa_transition_candidates c set
    matched_entity_id = t.gs_entity_id,
    entity_match_status = case
      when t.gs_entity_id is not null then 'matched'
      when exists (select 1 from wa_supplier_entity_matches m where m.state_tender_id = c.state_tender_id and m.match_status = 'ambiguous') then 'ambiguous'
      when (select count(*) from wa_supplier_entity_matches m where m.state_tender_id = c.state_tender_id) > 1 then 'panel'
      else 'unmatched'
    end,
    entity_match_method = m.match_method,
    entity_match_confidence = m.match_confidence,
    supplier_is_community_controlled = e.is_community_controlled,
    entity_match_evidence = coalesce(m.evidence, '{}'::jsonb),
    updated_at = now()
  from state_tenders t
  left join wa_supplier_entity_matches m
    on m.state_tender_id = t.id
   and t.gs_entity_id is not null
   and m.matched_entity_id = t.gs_entity_id
  left join gs_entities e on e.id = t.gs_entity_id
  where c.state_tender_id = t.id;

  select jsonb_build_object(
    'resolver_version', v_version,
    'supplier_components', count(*),
    'matched', count(*) filter (where match_status = 'matched'),
    'ambiguous', count(*) filter (where match_status = 'ambiguous'),
    'unmatched', count(*) filter (where match_status = 'unmatched'),
    'registry_backed', count(*) filter (where match_method = 'exact_registry_name'),
    'sourced_alias', count(*) filter (where match_method = 'exact_sourced_alias'),
    'canonical_exact', count(*) filter (where match_method = 'exact_canonical_name'),
    'high_confidence_fuzzy', count(*) filter (where match_method = 'high_confidence_fuzzy_name'),
    'fuzzy_status', 'deferred_review_only'
  ) into v_result
  from wa_supplier_entity_matches;

  return v_result;
end;
$$;

revoke all on function public.refresh_wa_supplier_entity_matches() from public, anon, authenticated;
grant execute on function public.refresh_wa_supplier_entity_matches() to service_role;
