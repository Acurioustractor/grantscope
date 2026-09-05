-- 20260905164000_mv_search_index_postcode_rows_and_rank.sql
-- Fourth and final build for the day. Postcode rows: one per postcode, ABS-style locality label. Ranking: greatest
-- applicable bonus instead of first-branch-wins. Same RPC return type as 20260905162000, so CREATE OR REPLACE.
BEGIN;
DROP MATERIALIZED VIEW IF EXISTS public.mv_search_index;
CREATE MATERIALIZED VIEW public.mv_search_index AS
WITH ent AS (
  SELECT e.entity_type AS kind, e.gs_id AS id, e.canonical_name AS name, e.abn, e.state, e.lga_name AS place, e.sector,
         coalesce(f.grants_total, 0) + coalesce(f.contracts_total, 0) AS money_in, NULL::numeric AS money_out,
         CASE WHEN e.is_community_controlled THEN 'community-controlled' END AS tier,
         nullif(concat_ws(' · ', nullif(e.remoteness, ''), CASE WHEN f.grand_total_records > 0 THEN f.grand_total_records || ' funding records' END), '') AS meta,
         '/entity/' || e.gs_id AS href,
         st.source_count::integer AS source_count, NULL::date AS closes_at, NULL::numeric AS amount_min, NULL::text AS postcode
  FROM gs_entities e
  LEFT JOIN mv_entity_total_funding f ON f.entity_id = e.id
  -- mv_gs_entity_stats carries 412k rows for 609k entities and is not guaranteed one row per id; take the max per id
  LEFT JOIN (SELECT id, max(source_count) AS source_count FROM mv_gs_entity_stats GROUP BY id) st ON st.id = e.id
  WHERE e.entity_type IN ('charity', 'company', 'indigenous_corp', 'government_body', 'program')
),
se AS (
  SELECT 'social_enterprise' AS kind, s.se_id::text AS id, s.name, s.abn, s.state, s.city AS place, s.sectors_text AS sector,
         coalesce(s.contract_value, 0) AS money_in, NULL::numeric AS money_out, s.verification_tier AS tier,
         nullif(concat_ws(' · ', CASE WHEN s.contract_count > 0 THEN s.contract_count || ' contracts' END, CASE WHEN s.buyer_count > 0 THEN s.buyer_count || ' buyers' END), '') AS meta,
         '/social-enterprises/' || s.se_id AS href,
         NULL::integer AS source_count, NULL::date AS closes_at, NULL::numeric AS amount_min, s.postcode
  FROM se_search_index s
),
fnd AS (
  SELECT 'foundation' AS kind, f.id::text AS id, f.name, f.acnc_abn AS abn, NULL::text AS state, NULL::text AS place,
         array_to_string(f.thematic_focus, ', ') AS sector, NULL::numeric AS money_in, f.total_giving_annual AS money_out,
         f.profile_confidence AS tier,
         nullif(concat_ws(' · ', f.type, CASE WHEN f.avg_grant_size > 0 THEN 'avg grant $' || round(f.avg_grant_size)::text END), '') AS meta,
         '/foundations/' || f.id AS href,
         NULL::integer AS source_count, NULL::date AS closes_at, NULL::numeric AS amount_min, NULL::text AS postcode
  FROM foundations f
),
grants AS (
  SELECT 'grant_round' AS kind, g.id::text AS id, g.name, NULL::text AS abn, NULL::text AS state, NULL::text AS place,
         array_to_string(g.categories, ', ') AS sector, g.amount_max::numeric AS money_in, NULL::numeric AS money_out,
         g.application_status AS tier,
         nullif(concat_ws(' · ', g.provider, CASE WHEN g.closes_at IS NOT NULL THEN 'closes ' || to_char(g.closes_at, 'DD Mon YYYY') END), '') AS meta,
         '/grants/' || g.id AS href,
         NULL::integer AS source_count, g.closes_at, g.amount_min::numeric AS amount_min, NULL::text AS postcode
  FROM grant_opportunities g
  WHERE g.closes_at IS NULL OR g.closes_at >= current_date
),
ppl AS (
  SELECT 'person' AS kind, b.person_name_normalised AS id, b.person_name_display AS name, NULL::text AS abn, NULL::text AS state, NULL::text AS place,
         array_to_string(b.organisations[1:3], ', ') AS sector,
         coalesce(b.total_procurement_dollars, 0) + coalesce(b.total_justice_dollars, 0) AS money_in, coalesce(b.total_donation_dollars, 0) AS money_out,
         CASE WHEN b.connects_community_controlled THEN 'connects community-controlled' END AS tier,
         b.board_count || ' boards' AS meta,
         '/person/' || regexp_replace(b.person_name_display, '\s', '%20', 'g') AS href,
         b.board_count::integer AS source_count, NULL::date AS closes_at, NULL::numeric AS amount_min, NULL::text AS postcode
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
         '/place/council/' || trim(both '-' from regexp_replace(lower(l.lga_name), '[^a-z0-9]+', '-', 'g')) AS href,
         l.entity_count::integer AS source_count, NULL::date AS closes_at, NULL::numeric AS amount_min, NULL::text AS postcode
  FROM (
    -- keys normalised: the same council appears with case and whitespace variants ("Cardinia" x3 for VIC)
    SELECT DISTINCT ON (lower(trim(lga_name)), lower(coalesce(state, ''))) * FROM mv_funding_by_lga l0
    WHERE lga_name IS NOT NULL
      -- a council row with no state is a duplicate whenever the same name exists with a state (430 of 432 on 2026-09-05)
      AND (state IS NOT NULL OR NOT EXISTS (SELECT 1 FROM mv_funding_by_lga l1 WHERE l1.state IS NOT NULL AND lower(trim(l1.lga_name)) = lower(trim(l0.lga_name))))
    ORDER BY lower(trim(lga_name)), lower(coalesce(state, '')), entity_count DESC NULLS LAST, total_funding DESC NULLS LAST
  ) l
),
alma AS (
  SELECT 'intervention' AS kind, a.id::text AS id, a.name, NULL::text AS abn, NULL::text AS state, array_to_string(a.geography[1:2], ', ') AS place,
         a.type AS sector, NULL::numeric AS money_in, NULL::numeric AS money_out, a.evidence_level AS tier,
         nullif(concat_ws(' · ', a.operating_organization, CASE WHEN a.years_operating > 0 THEN a.years_operating || ' years' END), '') AS meta,
         CASE WHEN a.gs_entity_id IS NOT NULL THEN '/entity/' || e.gs_id END AS href,
         NULL::integer AS source_count, NULL::date AS closes_at, NULL::numeric AS amount_min, NULL::text AS postcode
  FROM alma_interventions a LEFT JOIN gs_entities e ON e.id = a.gs_entity_id
  WHERE a.review_status = 'Published'
),
pcd AS (
  -- One row per postcode (postcodes are national; a second state on the same postcode is a placement error, keep the fullest
  -- row). Label with the ABS-style locality from postcode_geo (upper-case, alphabetic, first alphabetically) rather than the
  -- matview's own locality column, which carries mixed-case junk ("Charles" for 0870).
  SELECT 'postcode' AS kind, p.postcode || '-au' AS id,
         p.postcode || CASE WHEN loc.locality IS NOT NULL THEN ' ' || initcap(loc.locality) ELSE '' END AS name,
         NULL::text AS abn, upper(p.state) AS state, initcap(coalesce(loc.locality, nullif(p.locality, ''))) AS place, NULL::text AS sector,
         p.total_funding AS money_in, NULL::numeric AS money_out,
         CASE WHEN p.seifa_irsd_decile IS NOT NULL THEN 'SEIFA decile ' || p.seifa_irsd_decile END AS tier,
         nullif(concat_ws(' · ', nullif(p.remoteness, ''), p.entity_count || ' organisations'), '') AS meta,
         '/places/' || p.postcode AS href,
         p.entity_count::integer AS source_count, NULL::date AS closes_at, NULL::numeric AS amount_min, p.postcode
  FROM (
    SELECT DISTINCT ON (postcode) * FROM mv_funding_by_postcode
    WHERE postcode ~ '^\d{4}$'
    ORDER BY postcode, entity_count DESC NULLS LAST
  ) p
  LEFT JOIN LATERAL (
    SELECT g.locality FROM postcode_geo g
    WHERE g.postcode = p.postcode AND g.locality ~ '^[A-Z][A-Z ''-]+$'
    ORDER BY g.locality LIMIT 1
  ) loc ON true
),
u AS (
  SELECT * FROM ent UNION ALL SELECT * FROM se UNION ALL SELECT * FROM fnd UNION ALL SELECT * FROM grants
  UNION ALL SELECT * FROM ppl UNION ALL SELECT * FROM plc UNION ALL SELECT * FROM alma UNION ALL SELECT * FROM pcd
)
SELECT u.kind, u.id, u.name, u.abn, u.state, u.place, u.sector, u.money_in, u.money_out, u.tier, u.meta, u.href,
       u.source_count, u.closes_at, u.amount_min, u.postcode,
       to_tsvector('simple', concat_ws(' ', u.name, u.sector, u.place, u.abn, u.meta, u.postcode)) AS tsv,
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

CREATE OR REPLACE FUNCTION public.search_index_query(q text, kinds text[] DEFAULT NULL, p_state text DEFAULT NULL, p_limit integer DEFAULT 20)
RETURNS TABLE (kind text, id text, name text, abn text, state text, place text, sector text, money_in numeric, money_out numeric, tier text, meta text, href text,
               source_count integer, closes_at date, amount_min numeric, postcode text, score real)
LANGUAGE sql STABLE SECURITY DEFINER
SET search_path = public, extensions, pg_temp
AS $$
  WITH p AS (
    SELECT trim(q) AS raw, lower(trim(q)) AS lq, regexp_replace(q, '\s', '', 'g') AS digits,
           websearch_to_tsquery('simple', q) AS tsq
  )
  SELECT s.kind, s.id, s.name, s.abn, s.state, s.place, s.sector, s.money_in, s.money_out, s.tier, s.meta, s.href,
         s.source_count, s.closes_at, s.amount_min, s.postcode,
         -- the largest applicable bonus, not the first branch that happens to match ("0870 Charles" starts with "0870"
         -- and used to take the prefix bonus instead of the postcode-row bonus)
         (greatest(
            CASE WHEN lower(s.name) = p.lq THEN 3.0 ELSE 0.0 END,
            CASE WHEN lower(s.name) LIKE p.lq || '%' THEN 2.0 ELSE 0.0 END,
            CASE WHEN s.abn = p.digits THEN 3.0 ELSE 0.0 END,
            CASE WHEN s.postcode = p.digits AND s.kind = 'postcode' THEN 3.5 ELSE 0.0 END,
            CASE WHEN s.postcode = p.digits THEN 2.5 ELSE 0.0 END)
          + similarity(s.name, p.raw) + ts_rank(s.tsv, p.tsq))::real AS score
  FROM public.mv_search_index s, p
  WHERE length(p.raw) >= 2
    AND (kinds IS NULL OR s.kind = ANY (kinds))
    AND (p_state IS NULL OR s.state = p_state OR s.state IS NULL)
    AND (s.name % p.raw OR s.tsv @@ p.tsq OR (p.digits ~ '^\d{11}$' AND s.abn = p.digits) OR (p.digits ~ '^\d{4}$' AND s.postcode = p.digits))
  ORDER BY score DESC, s.money_in DESC NULLS LAST, s.name
  LIMIT greatest(1, least(coalesce(p_limit, 20), 100));
$$;
COMMIT;
