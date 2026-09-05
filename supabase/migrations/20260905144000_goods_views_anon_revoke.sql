-- 20260905144000_goods_views_anon_revoke.sql
-- Phase 1 security sweep, 2026-09-05. The seven v_goods_* views expose Goods' relationship intelligence (warmth,
-- warm-intro persons and roles, power scores, foundation targets) and were readable with the public key:
--   v_goods_warm_intros 459 rows · v_goods_foundation_targets 2,085 · v_goods_community_priority 1,543 ·
--   v_goods_central_channels 475 · v_goods_life_events 141 · v_goods_relationship_power 104 · v_goods_relationship_funding 102
-- Every reader is grantscope lib/services/goods-*.ts on getServiceSupabase (verified 2026-09-05; JusticeHub, Empathy
-- Ledger, Harvest and act-global have no reader). The 2026-06 note that these views "need GRANT SELECT to anon/
-- authenticated/service_role or chips render empty" was about service_role, which a postgres-created view does not get
-- by default; service_role keeps its grant here. Definer semantics are also dropped: service_role bypasses RLS anyway.
BEGIN;
ALTER VIEW public.v_goods_central_channels     SET (security_invoker = true);
ALTER VIEW public.v_goods_community_priority   SET (security_invoker = true);
ALTER VIEW public.v_goods_foundation_targets   SET (security_invoker = true);
ALTER VIEW public.v_goods_life_events          SET (security_invoker = true);
ALTER VIEW public.v_goods_relationship_funding SET (security_invoker = true);
ALTER VIEW public.v_goods_relationship_power   SET (security_invoker = true);
ALTER VIEW public.v_goods_warm_intros          SET (security_invoker = true);
REVOKE ALL ON public.v_goods_central_channels, public.v_goods_community_priority, public.v_goods_foundation_targets,
  public.v_goods_life_events, public.v_goods_relationship_funding, public.v_goods_relationship_power, public.v_goods_warm_intros
FROM anon, authenticated;
GRANT SELECT ON public.v_goods_central_channels, public.v_goods_community_priority, public.v_goods_foundation_targets,
  public.v_goods_life_events, public.v_goods_relationship_funding, public.v_goods_relationship_power, public.v_goods_warm_intros
TO service_role;
COMMIT;
