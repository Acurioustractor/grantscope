import { NextResponse } from 'next/server';
import { getServiceSupabase } from '@/lib/supabase';
import { safe } from '@/lib/sql';

export async function GET() {
  try {
    const supabase = getServiceSupabase();

    const [topEntities, boardConnectors, revolvingDoor, statsRaw] = await Promise.all([
      // Top 50 by power score
      safe(
        supabase
          .from('mv_entity_power_index')
          .select(
            'gs_id, canonical_name, entity_type, state, is_community_controlled, power_score, system_count, total_dollar_flow, procurement_dollars, recorded_grants_dollars, donation_dollars, contract_count, distinct_govt_buyers, distinct_parties_funded, charity_size'
          )
          .order('power_score', { ascending: false })
          .limit(50)
      ),

      // Board connectors: people on 3+ top-entity boards
      safe(
        supabase.rpc('exec_sql', {
          query: `
            WITH top_abns AS (
              SELECT ge.abn
              FROM mv_entity_power_index pi
              JOIN gs_entities ge ON ge.id = pi.id
              WHERE ge.abn IS NOT NULL
              ORDER BY pi.power_score DESC
              LIMIT 100
            )
            SELECT
              pr.person_name,
              COUNT(DISTINCT pr.company_abn) AS board_count,
              json_agg(DISTINCT jsonb_build_object(
                'name', COALESCE(ge.canonical_name, pr.company_name),
                'gs_id', ge.gs_id
              )) AS boards
            FROM person_roles pr
            LEFT JOIN gs_entities ge ON ge.abn = pr.company_abn
            WHERE pr.company_abn IN (SELECT abn FROM top_abns)
              AND pr.cessation_date IS NULL
            GROUP BY pr.person_name
            HAVING COUNT(DISTINCT pr.company_abn) >= 2
            ORDER BY COUNT(DISTINCT pr.company_abn) DESC
            LIMIT 25
          `,
        })
      ),

      // Revolving door: entities in 2+ influence systems
      safe(
        supabase
          // system_count, procurement_dollars, donation_dollars, distinct_govt_buyers,
          // distinct_parties_funded and total_dollar_flow are NOT on mv_revolving_door — they are
          // on mv_entity_power_index. This select errored and the endpoint returned nothing.
          // Base on mv_revolving_door (the subject: entities with 2+ influence vectors, and the
          // only home of revolving_door_score) and join the power index for the measurements.
          .rpc('exec_sql', {
            query: `SELECT rd.gs_id, rd.canonical_name, rd.entity_type, rd.state,
                      rd.is_community_controlled,
                      COALESCE(p.system_count, 0)            AS system_count,
                      COALESCE(p.procurement_dollars, 0)     AS procurement_dollars,
                      COALESCE(p.donation_dollars, 0)        AS donation_dollars,
                      COALESCE(p.contract_count, 0)          AS contract_count,
                      COALESCE(p.distinct_govt_buyers, 0)    AS distinct_govt_buyers,
                      COALESCE(p.distinct_parties_funded, 0) AS distinct_parties_funded,
                      COALESCE(p.total_dollar_flow, 0)       AS total_dollar_flow,
                      rd.revolving_door_score
                 FROM mv_revolving_door rd
                 LEFT JOIN mv_entity_power_index p ON p.gs_id = rd.gs_id
                ORDER BY rd.revolving_door_score DESC NULLS LAST
                LIMIT 20`,
          })
      ),

      // Summary stats
      safe(
        supabase.rpc('exec_sql', {
          query: `
            SELECT
              (SELECT COUNT(*) FROM gs_entities) AS total_entities,
              (SELECT COUNT(*) FROM gs_relationships) AS total_relationships,
              (SELECT COALESCE(ROUND(SUM(total_dollar_flow)), 0) FROM mv_entity_power_index) AS total_dollar_flow,
              (SELECT COUNT(*) FROM mv_entity_power_index WHERE system_count >= 3) AS multi_system_entities
          `,
        })
      ),
    ]);

    const s = Array.isArray(statsRaw) && statsRaw[0] ? statsRaw[0] : {};
    const stats = {
      totalEntities: Number(s.total_entities) || 0,
      totalRelationships: Number(s.total_relationships) || 0,
      totalDollarFlow: Number(s.total_dollar_flow) || 0,
      multiSystemEntities: Number(s.multi_system_entities) || 0,
    };

    return NextResponse.json({
      topEntities: topEntities || [],
      boardConnectors: boardConnectors || [],
      revolvingDoor: revolvingDoor || [],
      stats,
    });
  } catch (error) {
    const msg = error instanceof Error ? error.message : 'Unknown error';
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
