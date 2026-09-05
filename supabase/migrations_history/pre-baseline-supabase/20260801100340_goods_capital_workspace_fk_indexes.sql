-- Cover nullable foreign keys used for organisation and source-scoped cleanup.

begin;

create index if not exists idx_goods_capital_blocks_org_profile
  on public.goods_capital_blocks (org_profile_id)
  where org_profile_id is not null;

create index if not exists idx_goods_funding_matters_org_profile
  on public.goods_funding_matters (org_profile_id)
  where org_profile_id is not null;

create index if not exists idx_goods_funding_matters_source_opportunity
  on public.goods_funding_matters (source_opportunity_id)
  where source_opportunity_id is not null;

commit;
