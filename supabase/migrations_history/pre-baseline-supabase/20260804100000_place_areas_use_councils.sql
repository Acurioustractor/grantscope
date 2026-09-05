-- Define place areas by council now that the councils exist.
--
-- The snapshot was written when remote NT had no council, so it grouped
-- organisations by postcode 0872. The ABS correspondence has since placed 75 of
-- them in MacDonnell, Central Desert, Barkly and APY. Under the old definition
-- those organisations counted twice: once in their real council and again in
-- the remote grouping. Double counting on a page people read about their own
-- community is worse than the gap it was covering.
--
-- Areas are now mutually exclusive. Council areas are defined by lga_name, and
-- the remote grouping is explicitly what is LEFT — organisations in 0872 that
-- still have no council because ORIC publishes no address for them. It keeps
-- its place on the page rather than disappearing into a rounding error.

DROP FUNCTION IF EXISTS public.rebuild_place_funding_snapshot();

CREATE FUNCTION public.rebuild_place_funding_snapshot()
RETURNS TABLE(areas bigint, entities_counted bigint)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public', 'pg_catalog'
AS $function$
BEGIN
  DELETE FROM place_funding_snapshot;

  WITH area_entity AS (
    SELECT e.id, e.abn, e.is_community_controlled, e.entity_type,
           CASE
             WHEN e.lga_name = 'Alice Springs' AND e.state = 'NT' THEN 'alice-springs'
             WHEN e.lga_name = 'Barkly' AND e.state = 'NT' THEN 'barkly'
             WHEN e.lga_name = 'MacDonnell' AND e.state = 'NT' THEN 'macdonnell'
             WHEN e.lga_name = 'Central Desert' AND e.state = 'NT' THEN 'central-desert'
             -- Explicitly the residue: still unplaced, so it cannot overlap above.
             WHEN e.postcode = '0872' AND e.state = 'NT' AND e.lga_name IS NULL THEN 'remote-unplaced'
           END AS area_key
      FROM gs_entities e
     WHERE e.state = 'NT'
  ), scoped AS (
    SELECT * FROM area_entity WHERE area_key IS NOT NULL
  ), orgs AS (
    SELECT area_key, count(*)::int AS org_count,
           count(*) FILTER (WHERE is_community_controlled OR entity_type = 'indigenous_corp')::int AS cc
      FROM scoped GROUP BY area_key
  ), contracts AS (
    SELECT s.area_key, count(*)::int AS n, coalesce(sum(c.contract_value), 0) AS val
      FROM scoped s JOIN austender_contracts c ON c.supplier_abn = s.abn
     WHERE s.abn IS NOT NULL GROUP BY s.area_key
  ), grants AS (
    SELECT s.area_key, count(*)::int AS n, coalesce(sum(jf.amount_dollars), 0) AS val
      FROM scoped s JOIN justice_funding jf ON jf.gs_entity_id = s.id
     GROUP BY s.area_key
  ), phil AS (
    SELECT s.area_key, count(DISTINCT fg.foundation_name)::int AS funders, count(*)::int AS n
      FROM scoped s JOIN mv_foundation_grantees fg ON fg.grantee_entity_id = s.id
     GROUP BY s.area_key
  )
  INSERT INTO place_funding_snapshot (
    area_key, area_label, area_note, state,
    org_count, community_controlled_count,
    contract_count, contract_value, govt_grant_count, govt_grant_value,
    philanthropic_funder_count, philanthropic_grant_count, lga_resolved, computed_at
  )
  SELECT o.area_key,
         CASE o.area_key
           WHEN 'alice-springs' THEN 'Mparntwe (Alice Springs)'
           WHEN 'barkly' THEN 'Barkly, including Tennant Creek'
           WHEN 'macdonnell' THEN 'MacDonnell'
           WHEN 'central-desert' THEN 'Central Desert'
           WHEN 'remote-unplaced' THEN 'Remote communities without a recorded council'
         END,
         CASE o.area_key
           WHEN 'macdonnell' THEN 'Includes Papunya, Hermannsburg and Areyonga.'
           WHEN 'central-desert' THEN 'Includes Yuendumu and Atitjere.'
           WHEN 'barkly' THEN 'Includes Tennant Creek, Ali Curung and Ampilatwatja in the Utopia homelands.'
           WHEN 'remote-unplaced' THEN 'These organisations are registered with ORIC, which publishes no address, so no council can be recorded for them. They are counted here rather than left out.'
           ELSE NULL
         END,
         'NT',
         o.org_count, o.cc,
         coalesce(c.n, 0), coalesce(c.val, 0),
         coalesce(g.n, 0), coalesce(g.val, 0),
         coalesce(ph.funders, 0), coalesce(ph.n, 0),
         o.area_key <> 'remote-unplaced',
         now()
    FROM orgs o
    LEFT JOIN contracts c ON c.area_key = o.area_key
    LEFT JOIN grants g ON g.area_key = o.area_key
    LEFT JOIN phil ph ON ph.area_key = o.area_key;

  RETURN QUERY SELECT count(*)::bigint, coalesce(sum(org_count), 0)::bigint FROM place_funding_snapshot;
END;
$function$;
