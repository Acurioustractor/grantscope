-- place_funding_snapshot — what money reaches a place, precomputed.
--
-- Built for publication rather than for analysts, so it carries its own
-- caveats. Two of them matter enough to travel with every number:
--
--   Contracts are matched on the supplier's REGISTERED address, not where the
--   work happens. Many Alice Springs organisations deliver into the homelands,
--   so this measures where money is contracted, not where it lands. Read as
--   "captured by organisations based here", never as "spent here".
--
--   Philanthropic figures are floors, not totals. Only 26 funders have
--   ABN-resolved grant records, so a low number means our coverage is thin, not
--   that philanthropy is absent.
--
-- Remote NT is included as its own area despite having no LGA, because postcode
-- 0872 cannot currently be resolved to councils (see geo_resolution_gaps).
-- Leaving it out would repeat the erasure the geocoding bug caused.

CREATE TABLE IF NOT EXISTS public.place_funding_snapshot (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  area_key text NOT NULL UNIQUE,
  area_label text NOT NULL,
  area_note text,
  state text NOT NULL,

  org_count integer NOT NULL DEFAULT 0,
  community_controlled_count integer NOT NULL DEFAULT 0,

  contract_count integer NOT NULL DEFAULT 0,
  contract_value numeric NOT NULL DEFAULT 0,
  govt_grant_count integer NOT NULL DEFAULT 0,
  govt_grant_value numeric NOT NULL DEFAULT 0,
  philanthropic_funder_count integer NOT NULL DEFAULT 0,
  philanthropic_grant_count integer NOT NULL DEFAULT 0,

  lga_resolved boolean NOT NULL DEFAULT true,
  computed_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.place_funding_snapshot ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Public read place snapshot" ON public.place_funding_snapshot;
CREATE POLICY "Public read place snapshot"
  ON public.place_funding_snapshot FOR SELECT TO anon, authenticated USING (true);
DROP POLICY IF EXISTS "Service role manages place snapshot" ON public.place_funding_snapshot;
CREATE POLICY "Service role manages place snapshot"
  ON public.place_funding_snapshot FOR ALL TO service_role USING (true) WITH CHECK (true);
GRANT SELECT ON public.place_funding_snapshot TO anon, authenticated;
GRANT ALL ON public.place_funding_snapshot TO service_role;

COMMENT ON TABLE public.place_funding_snapshot IS
  'Precomputed per-place funding totals for publication. Contract value is by supplier registered address, not delivery location. Philanthropic counts are floors limited by grant-link coverage.';

CREATE OR REPLACE FUNCTION public.rebuild_place_funding_snapshot()
RETURNS TABLE(areas bigint)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public', 'pg_catalog'
AS $function$
BEGIN
  WITH area_entity AS (
    SELECT e.id, e.abn, e.is_community_controlled, e.entity_type,
           CASE
             WHEN e.postcode = '0872' AND e.state = 'NT' THEN 'remote-nt'
             WHEN e.lga_name = 'Alice Springs' AND e.state = 'NT' THEN 'alice-springs'
             WHEN e.lga_name = 'Barkly' AND e.state = 'NT' THEN 'barkly'
             WHEN e.lga_name = 'MacDonnell' AND e.state = 'NT' THEN 'macdonnell'
           END AS area_key
      FROM gs_entities e
     WHERE e.state = 'NT'
  ), scoped AS (
    SELECT * FROM area_entity WHERE area_key IS NOT NULL
  ), orgs AS (
    SELECT area_key,
           count(*)::int AS org_count,
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
    SELECT s.area_key,
           count(DISTINCT fg.foundation_name)::int AS funders,
           count(*)::int AS n
      FROM scoped s JOIN mv_foundation_grantees fg ON fg.grantee_entity_id = s.id
     GROUP BY s.area_key
  )
  INSERT INTO place_funding_snapshot AS p (
    area_key, area_label, area_note, state,
    org_count, community_controlled_count,
    contract_count, contract_value, govt_grant_count, govt_grant_value,
    philanthropic_funder_count, philanthropic_grant_count,
    lga_resolved, computed_at
  )
  SELECT o.area_key,
         CASE o.area_key
           WHEN 'alice-springs' THEN 'Mparntwe (Alice Springs)'
           WHEN 'barkly' THEN 'Tennant Creek and the Barkly'
           WHEN 'remote-nt' THEN 'Remote Central Australia'
           WHEN 'macdonnell' THEN 'MacDonnell'
         END,
         CASE o.area_key
           WHEN 'remote-nt' THEN 'Includes the Utopia homelands. These organisations cannot yet be placed in a council area, because postcode 0872 has no usable locality-to-LGA reference.'
           ELSE NULL
         END,
         'NT',
         o.org_count, o.cc,
         coalesce(c.n, 0), coalesce(c.val, 0),
         coalesce(g.n, 0), coalesce(g.val, 0),
         coalesce(ph.funders, 0), coalesce(ph.n, 0),
         o.area_key <> 'remote-nt',
         now()
    FROM orgs o
    LEFT JOIN contracts c ON c.area_key = o.area_key
    LEFT JOIN grants g ON g.area_key = o.area_key
    LEFT JOIN phil ph ON ph.area_key = o.area_key
  ON CONFLICT (area_key) DO UPDATE SET
    area_label = EXCLUDED.area_label,
    area_note = EXCLUDED.area_note,
    org_count = EXCLUDED.org_count,
    community_controlled_count = EXCLUDED.community_controlled_count,
    contract_count = EXCLUDED.contract_count,
    contract_value = EXCLUDED.contract_value,
    govt_grant_count = EXCLUDED.govt_grant_count,
    govt_grant_value = EXCLUDED.govt_grant_value,
    philanthropic_funder_count = EXCLUDED.philanthropic_funder_count,
    philanthropic_grant_count = EXCLUDED.philanthropic_grant_count,
    lga_resolved = EXCLUDED.lga_resolved,
    computed_at = EXCLUDED.computed_at;

  RETURN QUERY SELECT count(*)::bigint FROM place_funding_snapshot;
END;
$function$;
