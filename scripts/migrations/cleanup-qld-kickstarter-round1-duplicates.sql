begin;

create temp table _qld_kickstarter_cleanup_aliases (
  alias_name text primary key,
  recipient_name text not null
) on commit drop;

insert into _qld_kickstarter_cleanup_aliases (alias_name, recipient_name) values
('Adapt Mentorship Indigenous Corporation', 'Adapt Mentorship Indigenous Corporation'),
('Desert Pea Association Inc', 'Desert Pea Association Inc'),
('Downs Industry Schools Co-op', 'Downs Industry Schools Co-operation Incorporate'),
('Dynamic Community Care', 'Dynamic Community Care Pty Ltd'),
('Family and Children''s Emerging Support Services', 'Family and Childrens Emerging Support Services'),
('Fight 4 Youth', 'Fight 4 Youth'),
('Gunya Meta', 'Gunya Meta'),
('Mudth-Niyleta ATSI Corporation', 'Mudth-Niyleta Aboriginal and Torres Strait Islander Corporation'),
('V.I.T.A.L. Projex', 'V.I.T.A.L. Projex'),
('Youth Retreat Centre', 'Youth Retreat Centre');

with old_rows as (
  select distinct on (a.recipient_name)
    a.recipient_name,
    jf.amount_dollars,
    jf.recipient_abn,
    jf.gs_entity_id
  from justice_funding jf
  join _qld_kickstarter_cleanup_aliases a
    on lower(a.alias_name) = lower(jf.recipient_name)
  where jf.source = 'qld_ministerial_statement'
    and jf.program_name = 'Kickstarter Grants'
    and coalesce(jf.is_aggregate, false) = false
    and ('youth-justice' = any(coalesce(jf.topics, array[]::text[]))
      or jf.sector in ('civic_intelligence', 'youth_justice'))
  order by a.recipient_name, jf.amount_dollars desc nulls last, jf.recipient_abn nulls last, jf.updated_at desc nulls last
)
update justice_funding jf
set
  amount_dollars = coalesce(jf.amount_dollars, old_rows.amount_dollars),
  recipient_abn = coalesce(jf.recipient_abn, old_rows.recipient_abn),
  gs_entity_id = coalesce(jf.gs_entity_id, old_rows.gs_entity_id),
  updated_at = now()
from old_rows
where jf.source = 'qld_youth_justice_kickstarter_round1'
  and jf.program_name = 'Kickstarter Grants'
  and jf.program_round = 'Round 1 2024-25'
  and lower(jf.recipient_name) = lower(old_rows.recipient_name);

delete from justice_funding jf
using _qld_kickstarter_cleanup_aliases a
where jf.source = 'qld_ministerial_statement'
  and jf.program_name = 'Kickstarter Grants'
  and coalesce(jf.is_aggregate, false) = false
  and lower(jf.recipient_name) = lower(a.alias_name)
  and ('youth-justice' = any(coalesce(jf.topics, array[]::text[]))
    or jf.sector in ('civic_intelligence', 'youth_justice'));

commit;
