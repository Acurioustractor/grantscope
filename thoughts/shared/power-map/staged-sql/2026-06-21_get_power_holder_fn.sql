-- ============================================================================
-- Move B (runbook) — get_power_holder() convenience function.
-- Consolidates the scattered cross-system lookups into ONE call returning a
-- power holder's full footprint: org power-index row + board people +
-- foundation backers (L16) + revolving-door / donate-then-win signal.
--
-- READ-ONLY (queries MVs only). Non-breaking: pure additive CREATE FUNCTION.
-- Resolution priority: abn > gs_id > name (name = highest-power ILIKE match).
-- Returns NULL when nothing resolves (caller checks for null).
--
-- APPLY (Tier 3, day-shift):
--   source .env && PGPASSWORD="$DATABASE_PASSWORD" psql -h aws-0-ap-southeast-2.pooler.supabase.com \
--     -p 5432 -U postgres.tednluwflfhxyucgwigh -d postgres \
--     -f thoughts/shared/power-map/staged-sql/2026-06-21_get_power_holder_fn.sql
-- ============================================================================

CREATE OR REPLACE FUNCTION get_power_holder(
  p_abn   text DEFAULT NULL,
  p_gs_id text DEFAULT NULL,
  p_name  text DEFAULT NULL
)
RETURNS jsonb
LANGUAGE sql
STABLE
AS $$
  WITH e AS (
    SELECT *
    FROM mv_entity_power_index
    WHERE (p_abn   IS NOT NULL AND abn = p_abn)
       OR (p_abn   IS NULL AND p_gs_id IS NOT NULL AND gs_id = p_gs_id)
       OR (p_abn   IS NULL AND p_gs_id IS NULL AND p_name IS NOT NULL
           AND canonical_name ILIKE '%' || p_name || '%')
    ORDER BY power_score DESC NULLS LAST
    LIMIT 1
  )
  SELECT jsonb_build_object(
    'entity', jsonb_build_object(
      'gs_id', e.gs_id,
      'name', e.canonical_name,
      'abn', e.abn,
      'entity_type', e.entity_type,
      'state', e.state,
      'lga_name', e.lga_name,
      'is_community_controlled', e.is_community_controlled,
      'power_score', round(e.power_score)::int,
      'system_count', e.system_count,
      'total_dollar_flow', e.total_dollar_flow,
      'procurement_dollars', e.procurement_dollars,
      'justice_dollars', e.justice_dollars,
      'donation_dollars', e.donation_dollars,
      'foundation_giving', e.foundation_giving,
      'contract_count', e.contract_count,
      'distinct_govt_buyers', e.distinct_govt_buyers,
      'distinct_parties_funded', e.distinct_parties_funded,
      'systems', jsonb_build_object(
        'procurement', e.in_procurement,
        'justice', e.in_justice_funding,
        'donations', e.in_political_donations,
        'charity', e.in_charity_registry,
        'foundation', e.in_foundation,
        'ato', e.in_ato_transparency,
        'ndis', e.in_ndis_provider
      )
    ),
    'board_people', COALESCE((
      SELECT jsonb_agg(x) FROM (
        SELECT jsonb_build_object(
                 'name', n.person_name_display,
                 'identity_key', n.identity_key,
                 'is_nominee_block', n.is_nominee_block
               ) AS x
        FROM mv_person_identity_network n
        WHERE n.entity_id = e.id
        ORDER BY n.is_nominee_block, n.person_name_display
        LIMIT 50
      ) s
    ), '[]'::jsonb),
    'foundation_backers', COALESCE((
      SELECT jsonb_agg(jsonb_build_object('foundation', f.foundation_name, 'total', f.total) ORDER BY f.total DESC)
      FROM (
        SELECT foundation_name, sum(grant_amount) AS total
        FROM mv_foundation_grantees
        WHERE grantee_entity_id = e.id AND link_method = 'relationship'
        GROUP BY foundation_name
      ) f
    ), '[]'::jsonb),
    'revolving_door', (
      SELECT jsonb_build_object(
               'score', round(rd.revolving_door_score)::int,
               'influence_vectors', rd.influence_vectors,
               'lobbies', rd.lobbies,
               'donates', rd.donates,
               'contracts', rd.contracts,
               'receives_funding', rd.receives_funding,
               'donate_then_win', (rd.donates AND rd.contracts),
               'parties_funded', rd.parties_funded,
               'distinct_buyers', rd.distinct_buyers
             )
      FROM mv_revolving_door rd
      WHERE rd.id = e.id
    )
  )
  FROM e;
$$;

-- ---- smoke tests (run after CREATE; the function returns one jsonb per call) ----
\echo '== by name (highest-power ILIKE match) =='
SELECT jsonb_pretty(get_power_holder(p_name => 'serco')) AS by_name;
\echo '== not-found returns NULL =='
SELECT get_power_holder(p_abn => '00000000000') AS not_found;
\echo '== top entity by power, looked up by its gs_id =='
SELECT jsonb_pretty(get_power_holder(p_gs_id => (SELECT gs_id FROM mv_entity_power_index ORDER BY power_score DESC NULLS LAST LIMIT 1))) AS top_entity;
