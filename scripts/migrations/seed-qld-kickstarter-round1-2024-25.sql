begin;

create temp table _qld_kickstarter_round1 (
  recipient_name text primary key,
  recipient_abn text,
  region text not null,
  project_name text not null,
  location text not null,
  project_description text not null
) on commit drop;

insert into _qld_kickstarter_round1 (
  recipient_name,
  recipient_abn,
  region,
  project_name,
  location,
  project_description
) values
('Accer Care Pty Ltd', null, 'Brisbane and Moreton Bay', 'YD Project', 'Brisbane', 'Project: YD Project

A 12-week early intervention initiative aimed at empowering Indigenous youth aged 8-17 years through individualised case management, mentoring, and cultural activities aimed at fostering positive life choices.'),
('ARC Parenting', '72159364473', 'Brisbane and Moreton Bay', 'Parenting on the ARC Workshop', 'Brisbane', 'Project: Parenting on the ARC Workshop

This is a 12-month trauma-informed, psychoeducational initiative designed to support parents and caregivers of at-risk children and youth aged 8-17. It provides evidence-based tools to enhance emotional regulation, reduce family conflict, and strengthen relationships.'),
('Indigenous Mana Limited', '82679578977', 'Brisbane and Moreton Bay', 'Indigenous Mana Academy', 'Moreton Bay', 'Project: Indigenous Mana Academy

Indigenous Mana Academy is a 12-month program for youths aged 10-17 in the Moreton Bay Region using rugby league, mentorship, and cultural activities to re-engage at-risk youth back into education, reduce anti-social behaviour, and strengthen family and community connections. Delivered in partnership with First Nations businesses and Elders, the program will offer a range of supports including rugby training sessions, mentoring, cultural camps, and family engagement sessions.'),
('Inspiring Brighter Futures Foundation', '67165142861', 'Brisbane and Moreton Bay', 'Onwards & Upwards Wellbeing Mentoring program', 'Brisbane', 'Project: Onwards & Upwards Wellbeing Mentoring program

Supporting youths aged 12-17 years, this 12-month initiative focuses on Indigenous participants through personalised mentoring, run coaching, and education in well-being, leadership, and vocational skills.'),
('Lutheran Church of Queensland', '37293060173', 'Brisbane and Moreton Bay', 'Compass - Moreton Bay', 'Moreton Bay', 'Project: Compass - Moreton Bay

Compass provides support for 10-17-year-old youths and their families through tailored case coordination and community engagement over a 12-month period to address underlying needs, strengthen emotional regulation and social-emotional wellbeing.'),
('Redcliffe Area Youth Space Incorporated', null, 'Brisbane and Moreton Bay', 'PIVOT (Prevention and InterVention for Offending Teens)', 'Moreton Bay', 'Project: PIVOT (Prevention and InterVention for Offending Teens)

This program offers trauma-informed case management, mentoring, education support, pathways to employment, and pro-social activities to help reduce youth crime and antisocial behaviour.'),
('Queensland Blue Light Association Incorporated', '67047589753', 'Brisbane and Moreton Bay', 'Blue Edge Brisbane and Moreton Bay', 'Brisbane', 'Project: Blue Edge Brisbane and Moreton Bay

This eight-week program enhances mental and physical wellbeing, building leadership and resilience, and reducing low-level crime through positive behaviours and community connections.'),
('Fight 4 Youth', '62672971162', 'South East', 'Positive Pathways Toolkit', 'Gold Coast', 'Project: Positive Pathways Toolkit

An early intervention program for 8-17-year-old youths, teaching emotional regulation, decision-making skills and resilience, addressing peer pressure, substance use, and fostering positive community engagement.'),
('Gunya Meta', '56389629420', 'South East', 'Strong Warriors, Strong Future', 'Logan', 'Project: Strong Warriors, Strong Future

This culturally-led project provides an opportunity for 20 First Nations youths aged 10-17 to strengthen cultural identity, kinship, and family inclusion over an 18-month program.'),
('Kirrawe Indigenous Corporation', '23983548310', 'South East', 'Walama Ngurra Bangaba: Returning home building futures', 'Brisbane, Logan, and Gold Coast', 'Project: Walama Ngurra Bangaba: Returning home building futures

This is a 12-month trauma-informed program for First Nations youth aged 8-17, focusing on re-engaging them with education, training, or employment while strengthening cultural and community connections.'),
('Royal Society for the Prevention of Cruelty to Animals (Queensland) Limited', '74851544037', 'South East', 'Tails of Change', 'Brisbane and Logan', 'Project: Tails of Change

A two-year early intervention program using hands-on animal care to help disengaged youth aged 11-17 years to build empathy, emotional regulation, and pro-social behaviours, reducing the risk of offending.'),
('Adapt Mentorship Indigenous Corporation', '76524714688', 'South West', 'Adapt Youth Mentorship Program', 'Toowoomba', 'Project: Adapt Youth Mentorship Program

This 12-month program will deliver culturally responsive mentoring, creative activities, and tailored support to reduce crime and promote positive behaviour for First Nations youth aged 8-17.'),
('Downs Industry Schools Co-operation Incorporate', '39841878209', 'South West', 'Step Up Now (SUN)', 'Toowoomba', 'Project: Step Up Now (SUN)

SUN is a 5-month program that will support at-risk youth to develop life skills, resilience, and to transition into education, employment, or training.'),
('Dynamic Community Care Pty Ltd', '29652088803', 'South West', 'The Durungal Program', 'Ipswich and Toowoomba', 'Project: The Durungal Program

An eight-week intervention for youths aged 10-17 years, focusing on non-violent conflict resolution, aggression reduction, and social skills development through weekly or fortnightly face-to-face sessions delivered by a qualified facilitator in a confidential setting.'),
('Legacy Connect (Cultural Wellbeing Services)', null, 'South West', 'Legacy Cultural Youth Program (Springfield Lakes)', 'Ipswich', 'Project: Legacy Cultural Youth Program (Springfield Lakes)

This two-year, trauma-informed initiative supports at-risk Pasifika, culturally and linguistically diverse (CALD), and Indigenous youths aged 10-17 years in Ipswich and West Moreton through culturally grounded workshops and one-on-one mentoring.'),
('Village Support Limited', '30682255643', 'South West', 'Where We All Belong', 'Toowoomba', 'Project: Where We All Belong

This program will support youth and their families, working in partnership with schools to deliver tailored supports, combining sports, cultural programs, career workshops, and family forums to reduce offending behaviour.'),
('V.I.T.A.L. Projex', '33156130648', 'South West', 'STRONG Futures (Strength, Trust, Respect, Opportunity, New Ground)', 'Ipswich', 'Project: STRONG Futures (Strength, Trust, Respect, Opportunity, New Ground)

STRONG Futures is a 12-month, trauma-informed early intervention program delivered in four 10-week cohorts to provide youths aged 10-17 years the opportunity to improve anti-social behaviour and reduce reoffending.'),
('Youth Retreat Centre', null, 'South West', 'Reconnect with Culture and Community', 'Ipswich', 'Project: Reconnect with Culture and Community

An outreach program in Ipswich offering intensive case management over 12-months, including mentoring, and tailored referrals to support First Nations and general youth aged 14-17 years.'),
('Central Queensland Indigenous Development', '60110812489', 'Sunshine Coast and Central Queensland', 'Deadly Futures - Ready for Work program', 'Bundaberg, Rockhampton, Woorabinda', 'Project: Deadly Futures - Ready for Work program

Deadly Futures is a 12-week employment readiness initiative for First Nations youth aged 13-17 years, including cultural mentorship and skills development activities to promote positive behaviour and a pathway to education, training, or employment.'),
('Lookout 07', '87666455661', 'Sunshine Coast and Central Queensland', 'The Youth Leadership Program', 'Sunshine Coast', 'Project: The Youth Leadership Program

This program provides support for 12-17-year-olds through mentoring, mindset coaching, and job-readiness training over a period of 10 weeks.'),
('South Burnett CTC Incorporated', '85399349965', 'Sunshine Coast and Central Queensland', 'Safer Pathways', 'South Burnett', 'Project: Safer Pathways

This initiative provides support over 15 months for disengaged, homeless, or at-risk youth aged 8-17 years, offering individualised support plans, structured peer group activities, emotional regulation and community re-engagement sessions to help get them back on track.'),
('Brodie Germaine Fitness Aboriginal Corporation', '57591914579', 'North Queensland', 'CAMPFIRE - Cultural Advancement and Mentoring Program', 'Bouila, Doomadgee, Mount Isa', 'Project: CAMPFIRE - Cultural Advancement and Mentoring Program

This 18-month program is led by Elders, cultural leaders, and trained mentors to strengthen cultural identity, emotional regulation, and positive relationships while re-engaging youth with education and employment.'),
('Family and Childrens Emerging Support Services', '47410115747', 'North Queensland', 'The Youth Leadership program', 'Mackay', 'Project: The Youth Leadership program

The Youth Leadership program provides support for 12-17-year-olds through cultural mentoring, mental health and housing support, as well as life skills education, including literacy, hygiene, and budgeting.'),
('NQ Ummah Care', '95636275075', 'North Queensland', 'Pathways to Engagement (PE) for Culturally Diverse Youth', 'Townsville', 'Project: Pathways to Engagement (PE) for Culturally Diverse Youth

This program provides 16 months of support to youth from migrant backgrounds, empowering at-risk youth to make positive life choices through soccer-based activities, life skill workshops and mentorship, preventing youth offending, and improving education and employment outcomes.'),
('Mudth-Niyleta Aboriginal and Torres Strait Islander Corporation', '75038997115', 'North Queensland', 'Youth Wellbeing', 'Mackay', 'Project: Youth Wellbeing

This program offers support to disengaged, homeless, or at-risk youth aged 8-17 years to re-engage with education, employment, and the community through case management care plans, referrals to allied health services, mentorship and networking opportunities.'),
('Silver Lining Foundation', '92625056108', 'North Queensland', 'Out of Hours Support program', 'Townsville', 'Project: Out of Hours Support program

Delivered by First Nations mentors, the Out of Hours Support program provides activity-based mentoring for 8-17-year-olds over 16 months, offering structured support during weekends, afternoons, and school holidays to reduce criminal behaviour by engaging youth in positive, culturally appropriate activities and fostering pro-social connections.'),
('Townsville Fire Limited', '77152027300', 'North Queensland', 'Pathways to Empowerment - Building Brighter Futures for at-risk youth', 'Townsville', 'Project: Pathways to Empowerment - Building Brighter Futures for at-risk youth

Participants will undertake a 10-week program, including weekly basketball training and mentoring sessions with Townsville Fire athletes. This program offers a range of supports to young people aged 10-17 years in the Townsville region, combining sport-based activities, mentoring, life skills workshops, and cultural interventions to re-engage at-risk youth back into education, the community, and future pathways.'),
('Aspire Cairns Community Limited', '15651164082', 'Far North Queensland', 'Learn, Lead, Play and Thrive - Where Sport Fuels Success', 'Cairns', 'Project: Learn, Lead, Play and Thrive - Where Sport Fuels Success

A sport-for-development model that prioritises Aboriginal and Torres Strait Islander youth, girls, and underrepresented groups aged 8-17 years, focusing on physical activity, cultural connection, education support, and mentoring to build resilience, foster community connections, and improve outcomes.'),
('Australian Training Works Group Pty Ltd', '14646861449', 'Far North Queensland', 'The Rebuild Project', 'Cairns', 'Project: The Rebuild Project

The Rebuild project supports youth aged 15-17 years to build skills and contribute to community through a structured program including daily mechanical training and free repair services for residents in need, fostering positive pathways, community connection, and a sense of purpose for participants.'),
('Bori Muy Limited', '43682387300', 'Far North Queensland', 'Connecting The Dots Youth Program', 'Cairns', 'Project: Connecting The Dots Youth Program

This is a 12-week initiative supports Aboriginal and Torres Strait Islander youth aged 8-17 years through one-on-one mentoring, culturally safe health workshops, and pro-social community activities, including "On Country" cultural camps.'),
('Desert Pea Association Inc', '38854047029', 'Far North Queensland', 'CROSSROADS - Kuranda', 'Mareeba', 'Project: CROSSROADS - Kuranda

A 12-month program targeting at-risk Indigenous youth aged 12-17, using digital media and cultural frameworks to address anti-social behaviour and disconnection.'),
('Jabalbina Yalanji Aboriginal Corporation', '79611886178', 'Far North Queensland', 'Jabalbina On Country Cultural Workshops', 'Cairns', 'Project: Jabalbina On Country Cultural Workshops

This workshop provides a 12-week program of cultural activities for at-risk 10-17-year-olds, including storytelling, bush skills, and artifact making.'),
('Prosocial Skills Development', '26635173635', 'Far North Queensland', 'Mastering Me', 'Cairns', 'Project: Mastering Me

Master Me is a one year long early intervention program supporting youths aged 8-17 years with emerging antisocial behaviours by combining mentoring, activity-based learning, and prosocial skills development to foster emotional regulation, build relationships, and create a supportive therapeutic community.'),
('Thrive and Connect', '69677779029', 'Far North Queensland', 'Thrive Guiding', 'Cairns', 'Project: Thrive Guiding

Thrive Guiding will support youth aged 10-14 years in the Cairns region over 13 months. With four 10-week intensive sessions, the program provides one-on-one mentoring and team building exercises to build cultural identity, belonging, and pathways to education, training, and community.');

create temp table _qld_kickstarter_aliases (
  alias_name text primary key,
  recipient_name text not null references _qld_kickstarter_round1(recipient_name)
) on commit drop;

insert into _qld_kickstarter_aliases (alias_name, recipient_name) values
('Aspire Cairns Community Limited', 'Aspire Cairns Community Limited'),
('Bori Muy LTD', 'Bori Muy Limited'),
('Bori Muy Limited', 'Bori Muy Limited'),
('Brodie Germaine Fitness Aboriginal Corporation', 'Brodie Germaine Fitness Aboriginal Corporation'),
('Central Queensland Indigenous Development', 'Central Queensland Indigenous Development'),
('Indigenous Mana Academy', 'Indigenous Mana Limited'),
('Indigenous Mana Limited', 'Indigenous Mana Limited'),
('Jabalbina Yalanji Aboriginal Corporation', 'Jabalbina Yalanji Aboriginal Corporation'),
('Lookout 07', 'Lookout 07'),
('NQ Ummah Care', 'NQ Ummah Care'),
('Prosocial Skills Development', 'Prosocial Skills Development'),
('The Silver Lining Foundation', 'Silver Lining Foundation'),
('Silver Lining Foundation', 'Silver Lining Foundation'),
('Thrive and Connect', 'Thrive and Connect');

create temp table _qld_kickstarter_existing_amounts as
select distinct on (a.recipient_name)
  a.recipient_name,
  jf.amount_dollars
from justice_funding jf
join _qld_kickstarter_aliases a
  on lower(a.alias_name) = lower(jf.recipient_name)
where jf.program_name = 'Kickstarter Grants'
  and coalesce(jf.is_aggregate, false) = false
  and ('youth-justice' = any(coalesce(jf.topics, array[]::text[]))
    or jf.sector in ('civic_intelligence', 'youth_justice'))
order by a.recipient_name, jf.amount_dollars desc nulls last, jf.updated_at desc nulls last;

with entity_match as (
  select distinct on (r.recipient_name)
    r.recipient_name,
    e.id as gs_entity_id
  from _qld_kickstarter_round1 r
  join gs_entities e
    on e.abn = r.recipient_abn
  order by r.recipient_name,
    case when e.entity_type = 'program' then 1 else 0 end,
    e.source_count desc nulls last,
    e.updated_at desc nulls last
),
updated as (
  update justice_funding jf
  set
    source = 'qld_youth_justice_kickstarter_round1',
    source_url = 'https://www.youthjustice.qld.gov.au/partnerships/kickstarter-grants',
    source_statement_id = 'kickstarter-round1-2024-25-' || lower(regexp_replace(r.recipient_name, '[^a-zA-Z0-9]+', '-', 'g')),
    recipient_name = r.recipient_name,
    recipient_abn = coalesce(r.recipient_abn, jf.recipient_abn),
    program_name = 'Kickstarter Grants',
    program_round = 'Round 1 2024-25',
    state = 'QLD',
    location = r.location,
    funding_type = 'grant',
    sector = 'youth_justice',
    project_description = r.project_description,
    announcement_date = '2026-03-11',
    financial_year = '2024-25',
    gs_entity_id = coalesce(em.gs_entity_id, jf.gs_entity_id),
    topics = array(select distinct unnest(coalesce(jf.topics, array[]::text[]) || array['youth-justice', 'kickstarter', 'early-intervention']::text[])),
    is_aggregate = false,
    updated_at = now()
  from _qld_kickstarter_aliases a
  join _qld_kickstarter_round1 r
    on r.recipient_name = a.recipient_name
  left join entity_match em
    on em.recipient_name = r.recipient_name
  where lower(jf.recipient_name) = lower(a.alias_name)
    and jf.program_name = 'Kickstarter Grants'
    and coalesce(jf.is_aggregate, false) = false
    and ('youth-justice' = any(coalesce(jf.topics, array[]::text[]))
      or jf.sector in ('civic_intelligence', 'youth_justice'))
  returning jf.id, r.recipient_name
)
insert into justice_funding (
  source,
  source_url,
  source_statement_id,
  recipient_name,
  recipient_abn,
  program_name,
  program_round,
  amount_dollars,
  state,
  location,
  funding_type,
  sector,
  project_description,
  announcement_date,
  financial_year,
  gs_entity_id,
  topics,
  is_aggregate
)
select
  'qld_youth_justice_kickstarter_round1',
  'https://www.youthjustice.qld.gov.au/partnerships/kickstarter-grants',
  'kickstarter-round1-2024-25-' || lower(regexp_replace(r.recipient_name, '[^a-zA-Z0-9]+', '-', 'g')),
  r.recipient_name,
  r.recipient_abn,
  'Kickstarter Grants',
  'Round 1 2024-25',
  ea.amount_dollars,
  'QLD',
  r.location,
  'grant',
  'youth_justice',
  r.project_description,
  '2026-03-11',
  '2024-25',
  em.gs_entity_id,
  array['youth-justice', 'kickstarter', 'early-intervention']::text[],
  false
from _qld_kickstarter_round1 r
left join _qld_kickstarter_existing_amounts ea
  on ea.recipient_name = r.recipient_name
left join entity_match em
  on em.recipient_name = r.recipient_name
where not exists (
  select 1
  from justice_funding jf
  where lower(jf.recipient_name) = lower(r.recipient_name)
    and jf.program_name = 'Kickstarter Grants'
    and jf.program_round = 'Round 1 2024-25'
    and coalesce(jf.is_aggregate, false) = false
    and ('youth-justice' = any(coalesce(jf.topics, array[]::text[]))
      or jf.sector = 'youth_justice')
)
and not exists (
  select 1
  from updated u
  where u.recipient_name = r.recipient_name
);

with ranked as (
  select
    id,
    row_number() over (
      partition by lower(recipient_name), program_name, program_round
      order by amount_dollars desc nulls last, updated_at desc nulls last, created_at desc nulls last, id
    ) as rn
  from justice_funding
  where program_name = 'Kickstarter Grants'
    and program_round = 'Round 1 2024-25'
    and coalesce(is_aggregate, false) = false
    and ('youth-justice' = any(coalesce(topics, array[]::text[]))
      or sector = 'youth_justice')
)
delete from justice_funding jf
using ranked r
where jf.id = r.id
  and r.rn > 1;

commit;
