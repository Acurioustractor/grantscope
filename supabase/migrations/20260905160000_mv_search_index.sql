-- 20260905160000_mv_search_index.sql
-- Phase 4 of the 2026-09-05 platform review: one search index over the spine.
--
-- One matview, one RPC. Every public noun the site knows (charity, company, Indigenous corporation, government body,
-- social enterprise, foundation, open grant round, person on boards, council area, published ALMA intervention) becomes
-- one row with its name, ABN, place, sector, the money already audited elsewhere, a tier, a one-line meta and the href
-- the app uses for it. Facets are pre-computed in the row (the RPC-generic-plan lesson: never compute per row at query
-- time). Money comes from mv_entity_total_funding, which applies the three mandatory justice_funding / donation filters,
-- and from foundations.total_giving_annual, which is a placeholder for most rows (tier carries profile_confidence so a
-- reader can see that). Refreshed nightly through mv_refresh_registry; mv_entity_total_funding is promoted from
-- on_demand to nightly because this index and the entity pages depend on it.
--
-- Private data is excluded by construction: no ACT, Goods, GHL, Xero or Empathy Ledger object is a source.
BEGIN;

CREATE MATERIALIZED VIEW public.mv_search_index AS
WITH ent AS (
  SELECT e.entity_type AS kind, e.gs_id AS id, e.canonical_name AS name, e.abn, e.state, e.lga_name AS place, e.sector,
         coalesce(f.grants_total, 0) + coalesce(f.contracts_total, 0) AS money_in, NULL::numeric AS money_out,
         CASE WHEN e.is_community_controlled THEN 'community-controlled' END AS tier,
         nullif(concat_ws(' · ', nullif(e.remoteness, ''), CASE WHEN f.grand_total_records > 0 THEN f.grand_total_records || ' funding records' END), '') AS meta,
         '/entity/' || e.gs_id AS href
  FROM gs_entities e
  LEFT JOIN mv_entity_total_funding f ON f.entity_id = e.id
  WHERE e.entity_type IN ('charity', 'company', 'indigenous_corp', 'government_body', 'program')
),
se AS (
  SELECT 'social_enterprise' AS kind, s.se_id::text AS id, s.name, s.abn, s.state, s.city AS place, s.sectors_text AS sector,
         coalesce(s.contract_value, 0) AS money_in, NULL::numeric AS money_out, s.verification_tier AS tier,
         nullif(concat_ws(' · ', CASE WHEN s.contract_count > 0 THEN s.contract_count || ' contracts' END, CASE WHEN s.buyer_count > 0 THEN s.buyer_count || ' buyers' END), '') AS meta,
         '/social-enterprises/' || s.se_id AS href
  FROM se_search_index s
),
fnd AS (
  SELECT 'foundation' AS kind, f.id::text AS id, f.name, f.acnc_abn AS abn, NULL::text AS state, NULL::text AS place,
         array_to_string(f.thematic_focus, ', ') AS sector, NULL::numeric AS money_in, f.total_giving_annual AS money_out,
         f.profile_confidence AS tier,
         nullif(concat_ws(' · ', f.type, CASE WHEN f.avg_grant_size > 0 THEN 'avg grant $' || round(f.avg_grant_size)::text END), '') AS meta,
         '/foundations/' || f.id AS href
  FROM foundations f
),
grants AS (
  SELECT 'grant_round' AS kind, g.id::text AS id, g.name, NULL::text AS abn, NULL::text AS state, NULL::text AS place,
         array_to_string(g.categories, ', ') AS sector, g.amount_max::numeric AS money_in, NULL::numeric AS money_out,
         g.application_status AS tier,
         nullif(concat_ws(' · ', g.provider, CASE WHEN g.closes_at IS NOT NULL THEN 'closes ' || to_char(g.closes_at, 'DD Mon YYYY') END), '') AS meta,
         '/grants/' || g.id AS href
  FROM grant_opportunities g
  WHERE g.closes_at IS NULL OR g.closes_at >= current_date
),
ppl AS (
  SELECT 'person' AS kind, b.person_name_normalised AS id, b.person_name_display AS name, NULL::text AS abn, NULL::text AS state, NULL::text AS place,
         array_to_string(b.organisations[1:3], ', ') AS sector,
         coalesce(b.total_procurement_dollars, 0) + coalesce(b.total_justice_dollars, 0) AS money_in, coalesce(b.total_donation_dollars, 0) AS money_out,
         CASE WHEN b.connects_community_controlled THEN 'connects community-controlled' END AS tier,
         b.board_count || ' boards' AS meta,
         '/person/' || regexp_replace(b.person_name_display, '\s', '%20', 'g') AS href
  FROM mv_board_interlocks b
),
plc AS (
  -- mv_funding_by_lga is not one row per council (1,725 rows, 1,030 distinct code+state on 2026-09-05): take the most
  -- complete row per council name and state rather than summing, which would double-count re-ingested rows.
  SELECT 'place' AS kind,
         trim(both '-' from regexp_replace(lower(l.lga_name), '[^a-z0-9]+', '-', 'g')) || '-' || lower(coalesce(l.state, 'xx')) AS id,
         trim(l.lga_name) AS name, NULL::text AS abn, upper(l.state) AS state, trim(l.lga_name) AS place, NULL::text AS sector,
         l.total_funding AS money_in, NULL::numeric AS money_out,
         CASE WHEN l.avg_seifa_decile IS NOT NULL THEN 'SEIFA decile ' || round(l.avg_seifa_decile)::text END AS tier,
         l.entity_count || ' organisations · ' || l.community_controlled_count || ' community-controlled' AS meta,
         '/place/council/' || trim(both '-' from regexp_replace(lower(l.lga_name), '[^a-z0-9]+', '-', 'g')) AS href
  FROM (
    -- keys normalised: the same council appears with case and whitespace variants ("Cardinia" x3 for VIC)
    SELECT DISTINCT ON (lower(trim(lga_name)), lower(coalesce(state, ''))) * FROM mv_funding_by_lga
    WHERE lga_name IS NOT NULL
    ORDER BY lower(trim(lga_name)), lower(coalesce(state, '')), entity_count DESC NULLS LAST, total_funding DESC NULLS LAST
  ) l
),
alma AS (
  SELECT 'intervention' AS kind, a.id::text AS id, a.name, NULL::text AS abn, NULL::text AS state, array_to_string(a.geography[1:2], ', ') AS place,
         a.type AS sector, NULL::numeric AS money_in, NULL::numeric AS money_out, a.evidence_level AS tier,
         nullif(concat_ws(' · ', a.operating_organization, CASE WHEN a.years_operating > 0 THEN a.years_operating || ' years' END), '') AS meta,
         CASE WHEN a.gs_entity_id IS NOT NULL THEN '/entity/' || e.gs_id END AS href
  FROM alma_interventions a LEFT JOIN gs_entities e ON e.id = a.gs_entity_id
  WHERE a.review_status = 'Published'
),
u AS (
  SELECT * FROM ent UNION ALL SELECT * FROM se UNION ALL SELECT * FROM fnd UNION ALL SELECT * FROM grants
  UNION ALL SELECT * FROM ppl UNION ALL SELECT * FROM plc UNION ALL SELECT * FROM alma
)
SELECT u.kind, u.id, u.name, u.abn, u.state, u.place, u.sector, u.money_in, u.money_out, u.tier, u.meta, u.href,
       to_tsvector('simple', concat_ws(' ', u.name, u.sector, u.place, u.abn, u.meta)) AS tsv,
       now() AS built_at
FROM u
WHERE u.name IS NOT NULL AND length(trim(u.name)) > 1;

CREATE UNIQUE INDEX mv_search_index_kind_id ON public.mv_search_index (kind, id);
CREATE INDEX mv_search_index_name_trgm ON public.mv_search_index USING gin (name extensions.gin_trgm_ops);
CREATE INDEX mv_search_index_tsv ON public.mv_search_index USING gin (tsv);
CREATE INDEX mv_search_index_kind_state ON public.mv_search_index (kind, state);
CREATE INDEX mv_search_index_abn ON public.mv_search_index (abn) WHERE abn IS NOT NULL;

REVOKE ALL ON public.mv_search_index FROM anon, authenticated;
GRANT SELECT ON public.mv_search_index TO service_role;

-- The one search RPC. Definer so the public key can search without a grant on the matview (public civic data only).
CREATE OR REPLACE FUNCTION public.search_index_query(q text, kinds text[] DEFAULT NULL, p_state text DEFAULT NULL, p_limit integer DEFAULT 20)
RETURNS TABLE (kind text, id text, name text, abn text, state text, place text, sector text, money_in numeric, money_out numeric, tier text, meta text, href text, score real)
LANGUAGE sql STABLE SECURITY DEFINER
SET search_path = public, extensions, pg_temp
AS $$
  WITH p AS (
    SELECT trim(q) AS raw, lower(trim(q)) AS lq, regexp_replace(q, '\s', '', 'g') AS digits,
           websearch_to_tsquery('simple', q) AS tsq
  )
  SELECT s.kind, s.id, s.name, s.abn, s.state, s.place, s.sector, s.money_in, s.money_out, s.tier, s.meta, s.href,
         (CASE WHEN lower(s.name) = p.lq THEN 3.0 WHEN lower(s.name) LIKE p.lq || '%' THEN 2.0 WHEN s.abn = p.digits THEN 3.0 ELSE 0.0 END
          + similarity(s.name, p.raw) + ts_rank(s.tsv, p.tsq))::real AS score
  FROM public.mv_search_index s, p
  WHERE length(p.raw) >= 2
    AND (kinds IS NULL OR s.kind = ANY (kinds))
    AND (p_state IS NULL OR s.state = p_state)
    AND (s.name % p.raw OR s.tsv @@ p.tsq OR (p.digits ~ '^\d{11}$' AND s.abn = p.digits))
  ORDER BY score DESC, s.money_in DESC NULLS LAST, s.name
  LIMIT greatest(1, least(coalesce(p_limit, 20), 100));
$$;
REVOKE ALL ON FUNCTION public.search_index_query(text, text[], text, integer) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.search_index_query(text, text[], text, integer) TO anon, authenticated, service_role;

-- Nightly refresh, ordered after the matviews it reads.
INSERT INTO public.mv_refresh_registry (mv_name, tier, enabled, force_non_concurrent, notes)
VALUES ('mv_search_index', 'nightly', true, false, 'Phase 4 search index over the spine; reads mv_entity_total_funding, mv_board_interlocks, mv_funding_by_lga, se_search_index; unique (kind,id) for concurrent refresh')
ON CONFLICT (mv_name) DO UPDATE SET tier = 'nightly', enabled = true, notes = EXCLUDED.notes;
UPDATE public.mv_refresh_registry SET tier = 'nightly',
  notes = coalesce(notes, '') || ' | promoted on_demand→nightly 2026-09-05: mv_search_index and the entity pages read it'
WHERE mv_name = 'mv_entity_total_funding' AND tier = 'on_demand';

INSERT INTO public.schema_ownership (object, owner, consumers, evidence, declared_on)
VALUES ('mv_search_index', 'grantscope', '{grantscope}', 'Phase 4 search index; RPC search_index_query is the public read path', current_date)
ON CONFLICT (object) DO NOTHING;

COMMIT;

-- Post-check:
--   SELECT kind, count(*) FROM mv_search_index GROUP BY 1 ORDER BY 2 DESC;
--   SELECT kind, name, score FROM search_index_query('mission australia') LIMIT 5;
