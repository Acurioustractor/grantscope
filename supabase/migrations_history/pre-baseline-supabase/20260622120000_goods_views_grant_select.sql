-- Goods Command Center — fix empty Power/Funding chips on buyer cards.
--
-- BUG: v_goods_relationship_power and v_goods_relationship_funding were created
-- (20260620120000 / 20260620120200) WITHOUT granting SELECT to the PostgREST
-- roles. Only agent_readonly + postgres could read them. The app loaders
-- (goods-relationship-power.ts / goods-relationship-funding.ts) connect via
-- getServiceSupabase() → service_role, which lacked SELECT, so every query
-- returned empty and PowerChip/FundingChip rendered blank on /org/[slug]/goods/buyers.
--
-- FIX: grant SELECT to anon, authenticated, service_role (matching how the
-- rest of the public read surface is exposed to PostgREST). Idempotent —
-- safe to re-run.

GRANT SELECT ON public.v_goods_relationship_power   TO anon, authenticated, service_role;
GRANT SELECT ON public.v_goods_relationship_funding TO anon, authenticated, service_role;
