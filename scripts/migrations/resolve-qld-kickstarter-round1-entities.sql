begin;

create temp table _resolved_kickstarter_entities (
  funded_name text primary key,
  canonical_name text not null,
  abn text not null,
  entity_type text not null,
  state text,
  postcode text,
  confidence text not null,
  source_url text not null,
  description text
) on commit drop;

insert into _resolved_kickstarter_entities (
  funded_name,
  canonical_name,
  abn,
  entity_type,
  state,
  postcode,
  confidence,
  source_url,
  description
) values
('Accer Care Pty Ltd', 'ACCER CARE PTY LTD', '69679139381', 'company', 'QLD', '4035', 'registry', 'https://abr.business.gov.au/ABN/View?id=69679139381', 'Queensland private company resolved from ABN Lookup for the Kickstarter Round 1 YD Project.'),
('ARC Parenting', 'ARC Parenting', '72159364473', 'unknown', 'QLD', null, 'reported', 'https://www.arcparenting.com.au/about', 'ARC Parenting publishes this ABN on its website and is listed as a Queensland Youth Justice Kickstarter Round 1 provider.'),
('Legacy Connect (Cultural Wellbeing Services)', 'The Trustee for LC Trust', '76595226474', 'trust', 'QLD', '4300', 'registry', 'https://abr.business.gov.au/ABN/View?id=76595226474', 'ABN Lookup lists the current business name Legacy Connect for The Trustee for LC Trust.'),
('Redcliffe Area Youth Space Incorporated', 'Your Space Australia Incorporated', '17724640741', 'charity', 'QLD', '4020', 'registry', 'https://abr.business.gov.au/ABN/View/17724640741', 'Current legal name for the historical Redcliffe Area Youth Space Incorporated ABN.'),
('Thrive and Connect', 'THRIVE & CONNECT PTY LTD', '69677779029', 'company', 'QLD', '4870', 'registry', 'https://abr.business.gov.au/ABN/View?id=69677779029', 'Queensland private company resolved from ABN Lookup for the Kickstarter Round 1 Thrive Guiding project.');

insert into gs_entities (
  entity_type,
  canonical_name,
  abn,
  gs_id,
  description,
  state,
  postcode,
  sector,
  sub_sector,
  tags,
  source_datasets,
  source_count,
  confidence
)
select
  r.entity_type,
  r.canonical_name,
  r.abn,
  'AU-ABN-' || r.abn,
  r.description,
  r.state,
  r.postcode,
  'youth_justice',
  'early_intervention',
  array['youth-justice', 'kickstarter', 'early-intervention']::text[],
  array['abr', 'qld_youth_justice_kickstarter_round1']::text[],
  2,
  r.confidence
from _resolved_kickstarter_entities r
where not exists (
  select 1
  from gs_entities e
  where e.abn = r.abn
);

with entity_match as (
  select distinct on (r.funded_name)
    r.funded_name,
    r.abn,
    e.id as entity_id
  from _resolved_kickstarter_entities r
  join gs_entities e
    on e.abn = r.abn
  order by r.funded_name,
    case when lower(e.canonical_name) = lower(r.canonical_name) then 0 else 1 end,
    e.updated_at desc nulls last
)
update justice_funding jf
set
  recipient_abn = em.abn,
  gs_entity_id = em.entity_id,
  updated_at = now()
from entity_match em
where jf.source = 'qld_youth_justice_kickstarter_round1'
  and jf.program_name = 'Kickstarter Grants'
  and jf.program_round = 'Round 1 2024-25'
  and lower(jf.recipient_name) = lower(em.funded_name);

with entity_match as (
  select distinct on (r.funded_name)
    r.funded_name,
    r.canonical_name,
    r.abn,
    e.id as entity_id
  from _resolved_kickstarter_entities r
  join gs_entities e
    on e.abn = r.abn
  order by r.funded_name,
    case when lower(e.canonical_name) = lower(r.canonical_name) then 0 else 1 end,
    e.updated_at desc nulls last
),
aliases(alias_type, alias_value, entity_id, source, is_primary) as (
  select 'funded_name', funded_name, entity_id, 'qld_youth_justice_kickstarter_round1', false from entity_match
  union all
  select 'legal_name', canonical_name, entity_id, 'abr', true from entity_match
  union all
  select 'business_name', 'Legacy Connect', entity_id, 'abr', false from entity_match where abn = '76595226474'
  union all
  select 'historical_name', 'Redcliffe Area Youth Space Incorporated', entity_id, 'abr', false from entity_match where abn = '17724640741'
)
insert into gs_entity_aliases (
  entity_id,
  alias_type,
  alias_value,
  source,
  is_primary
)
select
  a.entity_id,
  a.alias_type,
  a.alias_value,
  a.source,
  a.is_primary
from aliases a
where not exists (
  select 1
  from gs_entity_aliases existing
  where existing.entity_id = a.entity_id
    and lower(existing.alias_value) = lower(a.alias_value)
    and existing.alias_type = a.alias_type
);

commit;
