-- The GOODS workspace is server-rendered and mutated through the service-role
-- client. RLS policies define which role may act; explicit table privileges
-- are still required because these tables are not exposed to public roles.

begin;

grant select, insert, update, delete
  on table public.goods_capital_blocks
  to service_role;

grant select, insert, update, delete
  on table public.goods_funding_matters
  to service_role;

grant select, insert, update, delete
  on table public.goods_funding_routes
  to service_role;

grant select, insert, update, delete
  on table public.goods_route_allocations
  to service_role;

commit;
