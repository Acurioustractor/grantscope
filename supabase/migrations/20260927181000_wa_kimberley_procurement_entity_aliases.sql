with verified_aliases(abn, alias_value, source) as (
  values
    (
      '62910270592',
      'Ord Valley Aboriginal Health Services Inc. (Ord Valley Aboriginal Health Service Inc.)',
      'tenders-wa+ovahs-annual-report-2022-23'
    ),
    (
      '23750533168',
      'Broome Regional Aboriginal Medical Service (BRAMS) (Broome Regional Aboriginal Medical Service (Aboriginal Corporation))',
      'tenders-wa+brams-annual-report-2018-19'
    ),
    (
      '67169851861',
      'KAMS Ltd. (Kimberley Aboriginal Medical Services Limited)',
      'data-wa-tenders+acnc'
    ),
    (
      '20265298798',
      'Marnin Bowa Dumbara Family Healing Centre (Marnin Bowa Dumbara Aboriginal Corporation)',
      'data-wa-tenders+mbdfhc-privacy-policy'
    ),
    (
      '42543118157',
      'Fitzroy Valley Men''s Shed (Gurama Yani U Inc)',
      'data-wa-tenders+acnc-other-name'
    )
)
insert into public.gs_entity_aliases (
  entity_id, alias_type, alias_value, source, is_primary
)
select
  e.id,
  'procurement_name',
  v.alias_value,
  v.source,
  false
from verified_aliases v
join public.gs_entities e on e.abn = v.abn
where not exists (
  select 1
  from public.gs_entity_aliases existing
  where existing.entity_id = e.id
    and lower(existing.alias_value) = lower(v.alias_value)
    and existing.source = v.source
);

comment on table public.gs_entity_aliases is
  'Multiple names per entity for resolution. Procurement aliases must retain a source that independently supports the legal identity; an alias does not establish current authority, readiness or permission to engage.';
