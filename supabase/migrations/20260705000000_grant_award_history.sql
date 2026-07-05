-- Phase 6 — Award-history join (the differentiator)
-- "Here's a grant, and here's who's won this kind of money before + your realistic odds."
--
-- Data reality (probed live 2026-07-05, see thoughts/shared/handoffs/grant-finder-phase6-2026-07-05.md):
--   * justice_funding is the clean $-source: 155K non-aggregate rows, 97% have amount_dollars,
--     82% resolve to a gs_entity_id, 99.7% have a real recipient name.
--   * gs_relationships $ lives on self-loops (funder repeated), NOT on recipient edges — unusable for $.
--   * austender_contracts.category is opaque UNSPSC codes → needs a crosswalk (deferred, separate project).
--   * The top raw "winners" are GOVERNMENT DEPARTMENTS (Dept of Justice $10B, etc.) — funders/administrators
--     appearing as recipients. Showing those as "past winners" is misleading, so they are GATED OUT here.
--
-- The interoperable join axis is a small canonical THEME vocabulary that both grants
-- (categories / classie_subjects / focus_areas) and awards (justice_funding sector / topics[]) map into,
-- via award_theme_map(). Everything is keyed per-theme so a grant spanning two themes does not
-- double-count awards — the reader displays each theme's history separately.

begin;

-- ---------------------------------------------------------------------------
-- 1. award_theme_map — the single source of truth for the join axis.
--    Maps ANY raw token (JF sector, JF topic, grant category, classie subject) to a
--    canonical theme, or NULL if it does not map. IMMUTABLE so it can index/aggregate.
-- ---------------------------------------------------------------------------
create or replace function award_theme_map(raw text)
returns text
language sql
immutable
as $$
  select case lower(regexp_replace(coalesce(raw, ''), '[_\s]+', '-', 'g'))
    -- youth justice
    when 'youth-justice'   then 'youth-justice'
    when 'youth-services'  then 'youth-justice'
    when 'diversion'       then 'youth-justice'
    -- child protection / family
    when 'child-protection' then 'child-protection'
    when 'family-services'  then 'family-services'
    -- legal
    when 'legal-services'  then 'legal-services'
    -- corrections / community safety
    when 'corrections'      then 'corrections'
    when 'community-safety' then 'corrections'
    -- community (broadest social bucket)
    when 'community-services'            then 'community'
    when 'community'                     then 'community'
    when 'community-led'                 then 'community'
    when 'community-economic-development' then 'community'
    when 'human-services'                then 'community'
    -- education
    when 'education' then 'education'
    -- health
    when 'health' then 'health'
    -- disability
    when 'disability' then 'disability'
    when 'ndis'       then 'disability'
    -- housing
    when 'housing' then 'housing'
    -- indigenous
    when 'indigenous' then 'indigenous'
    when 'aboriginal' then 'indigenous'
    -- prevention (maps into youth-justice program space)
    when 'prevention' then 'youth-justice'
    else null
  end;
$$;

comment on function award_theme_map(text) is
  'Phase 6: maps a raw sector/topic/category/classie token to a canonical award-history theme, or NULL. The interoperable join axis between grants and historical awards.';

-- ---------------------------------------------------------------------------
-- 2. grant_award_themes — derive a grant''s themes from its taxonomy arrays.
--    Same award_theme_map() so both sides of the join speak one vocabulary.
-- ---------------------------------------------------------------------------
create or replace function grant_award_themes(p_grant_id uuid)
returns text[]
language sql
stable
as $$
  select coalesce(array_agg(distinct theme order by theme), '{}')
  from (
    select award_theme_map(tok) as theme
    from grant_opportunities g
    cross join lateral unnest(
      coalesce(g.classie_subjects, '{}') ||
      coalesce(g.categories, '{}') ||
      coalesce(g.focus_areas, '{}')
    ) as tok
    where g.id = p_grant_id
  ) s
  where theme is not null;
$$;

comment on function grant_award_themes(uuid) is
  'Phase 6: canonical award-history themes for a grant, derived from classie_subjects/categories/focus_areas.';

-- ---------------------------------------------------------------------------
-- 3. Base gated award rows — the ONE place the data-quality gate lives.
--    A non-materialised view so both MVs read identical, gated rows.
--    Gate: non-aggregate, has amount, real recipient name, NOT a government body.
-- ---------------------------------------------------------------------------
create or replace view v_award_rows as
select
  award_theme_map(j.sector)                                            as sector_theme,
  j.sector,
  j.topics,
  j.recipient_name,
  j.recipient_abn,
  j.gs_entity_id,
  e.entity_type,
  e.is_community_controlled,
  j.amount_dollars,
  -- financial_year is messy ('2025-26', '2023-24', '2026-2030', '2020-ongoing', blank) — take first 4-digit year
  nullif(substring(j.financial_year from '(\d{4})'), '')::int          as award_year,
  -- peer = a community-sector recipient (the "orgs like you" cohort the card leads with).
  -- Companies (incl. state-owned corps like QUEENSLAND RAIL) + TAFEs + unresolved are gated but non-peer.
  (coalesce(e.entity_type, '') in ('charity', 'indigenous_corp', 'social_enterprise', 'foundation')) as is_peer
from justice_funding j
left join gs_entities e on e.id = j.gs_entity_id
where coalesce(j.is_aggregate, false) = false
  and j.amount_dollars > 0
  and j.recipient_name is not null
  and length(trim(regexp_replace(j.recipient_name, '[^a-zA-Z0-9]', '', 'g'))) >= 2
  -- data-quality gate: exclude government departments/administrators appearing as recipients
  and coalesce(e.entity_type, '') <> 'government_body'
  and j.recipient_name !~* '(department|directorate|ministry|commonwealth of|treasury|the state of|government of|councils?$|city of|shire of|attorney[- ]general)';

comment on view v_award_rows is
  'Phase 6: gated historical award rows from justice_funding — non-aggregate, has amount, real named recipient, government administrators excluded. Base for the award-history MVs.';

-- ---------------------------------------------------------------------------
-- 4. mv_award_history_by_theme — per-theme aggregate stats (drives "N similar
--    awards · typical amount" + the scorer''s competitiveness signal). ~14 rows.
--    A row can contribute to its sector_theme AND to each theme its topics[] map to
--    (an award tagged both is genuinely relevant to both); we DISTINCT the theme set
--    per row so it is counted at most once per theme.
-- ---------------------------------------------------------------------------
drop materialized view if exists mv_award_history_by_theme cascade;
create materialized view mv_award_history_by_theme as
with themed as (
  select r.*, t.theme
  from v_award_rows r
  cross join lateral (
    select distinct th from (
      select r.sector_theme as th
      union all
      select award_theme_map(tp) from unnest(coalesce(r.topics, '{}')) tp
    ) u where th is not null
  ) t(theme)
)
select
  theme,
  count(*)                                              as n_awards,
  count(distinct coalesce(recipient_abn, recipient_name)) as distinct_recipients,
  round(sum(amount_dollars))                            as total_awarded,
  round(percentile_cont(0.5) within group (order by amount_dollars))  as median_award,
  round(percentile_cont(0.25) within group (order by amount_dollars)) as p25_award,
  round(percentile_cont(0.75) within group (order by amount_dollars)) as p75_award,
  min(award_year)                                       as earliest_year,
  max(award_year)                                       as latest_year,
  -- peer cohort (community-sector) — the "orgs like you" the card leads with
  count(distinct coalesce(recipient_abn, recipient_name)) filter (where is_peer) as n_peer_recipients,
  round(sum(amount_dollars) filter (where is_peer))     as peer_total_awarded,
  round(percentile_cont(0.5) within group (order by amount_dollars) filter (where is_peer)) as peer_median_award,
  count(*) filter (where is_community_controlled)       as n_community_controlled,
  count(*) filter (where entity_type = 'charity')       as n_charity,
  count(*) filter (where entity_type = 'social_enterprise') as n_social_enterprise
from themed
group by theme;

create unique index mv_award_history_by_theme_pk on mv_award_history_by_theme (theme);

comment on materialized view mv_award_history_by_theme is
  'Phase 6: per-theme historical award aggregates (n_awards, totals, percentiles, recipient mix). Refresh nightly via refresh-views-v2.mjs.';

-- ---------------------------------------------------------------------------
-- 5. mv_award_winner_by_theme — top 25 recipients per theme by total won.
--    Drives the "who''s won this before" winners list. Small + fast.
-- ---------------------------------------------------------------------------
drop materialized view if exists mv_award_winner_by_theme cascade;
create materialized view mv_award_winner_by_theme as
with themed as (
  select r.*, t.theme
  from v_award_rows r
  cross join lateral (
    select distinct th from (
      select r.sector_theme as th
      union all
      select award_theme_map(tp) from unnest(coalesce(r.topics, '{}')) tp
    ) u where th is not null
  ) t(theme)
),
agg as (
  select
    theme,
    coalesce(recipient_abn, recipient_name)          as recipient_key,
    max(recipient_name)                              as recipient_name,
    max(recipient_abn)                               as recipient_abn,
    max(gs_entity_id::text)                          as gs_entity_id,
    max(entity_type)                                 as entity_type,
    bool_or(is_community_controlled)                 as is_community_controlled,
    count(*)                                         as n_awards,
    round(sum(amount_dollars))                       as total_awarded,
    max(award_year)                                  as latest_year
  from themed
  where is_peer   -- card leads with community-sector peers; non-peers counted only in the aggregate MV
  group by theme, coalesce(recipient_abn, recipient_name)
),
ranked as (
  select *, row_number() over (partition by theme order by total_awarded desc) as rn
  from agg
)
select theme, rn, recipient_name, recipient_abn, gs_entity_id, entity_type,
       is_community_controlled, n_awards, total_awarded, latest_year
from ranked
where rn <= 25;

create unique index mv_award_winner_by_theme_pk on mv_award_winner_by_theme (theme, rn);

comment on materialized view mv_award_winner_by_theme is
  'Phase 6: top 25 historical award recipients per theme (name, abn, entity_type, n_awards, total). Refresh nightly.';

-- ---------------------------------------------------------------------------
-- 6. get_grant_award_history — one call for the detail card. Returns, per theme
--    the grant maps to, the aggregate stats + top winners. Empty [] if no themes match.
-- ---------------------------------------------------------------------------
create or replace function get_grant_award_history(p_grant_id uuid, p_winner_limit int default 8)
returns jsonb
language sql
stable
as $$
  with themes as (
    select unnest(grant_award_themes(p_grant_id)) as theme
  )
  select coalesce(jsonb_agg(
    jsonb_build_object(
      'theme', h.theme,
      'n_awards', h.n_awards,
      'distinct_recipients', h.distinct_recipients,
      'total_awarded', h.total_awarded,
      'median_award', h.median_award,
      'p25_award', h.p25_award,
      'p75_award', h.p75_award,
      'earliest_year', h.earliest_year,
      'latest_year', h.latest_year,
      'n_peer_recipients', h.n_peer_recipients,
      'peer_total_awarded', h.peer_total_awarded,
      'peer_median_award', h.peer_median_award,
      'n_community_controlled', h.n_community_controlled,
      'n_charity', h.n_charity,
      'n_social_enterprise', h.n_social_enterprise,
      'winners', (
        select coalesce(jsonb_agg(jsonb_build_object(
          'recipient_name', w.recipient_name,
          'recipient_abn', w.recipient_abn,
          'gs_entity_id', w.gs_entity_id,
          'entity_type', w.entity_type,
          'is_community_controlled', w.is_community_controlled,
          'n_awards', w.n_awards,
          'total_awarded', w.total_awarded,
          'latest_year', w.latest_year
        ) order by w.rn), '[]'::jsonb)
        from mv_award_winner_by_theme w
        where w.theme = h.theme and w.rn <= p_winner_limit
      )
    ) order by h.total_awarded desc
  ), '[]'::jsonb)
  from themes t
  join mv_award_history_by_theme h on h.theme = t.theme;
$$;

comment on function get_grant_award_history(uuid, int) is
  'Phase 6: award-history payload for a grant detail page — per-theme aggregates + top winners. Empty [] when the grant maps to no themes with historical awards.';

-- ---------------------------------------------------------------------------
-- 7. Grants — PostgREST needs SELECT on the views/MVs and EXECUTE on the fns.
--    (Learned via the Goods PowerChip empty-render gotcha: MVs/views render empty
--     unless granted to anon/authenticated/service_role.)
-- ---------------------------------------------------------------------------
grant select on mv_award_history_by_theme to anon, authenticated, service_role;
grant select on mv_award_winner_by_theme  to anon, authenticated, service_role;
grant select on v_award_rows              to anon, authenticated, service_role;
grant execute on function award_theme_map(text)              to anon, authenticated, service_role;
grant execute on function grant_award_themes(uuid)           to anon, authenticated, service_role;
grant execute on function get_grant_award_history(uuid, int) to anon, authenticated, service_role;

commit;
