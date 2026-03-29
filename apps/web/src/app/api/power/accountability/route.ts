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
            'gs_id, canonical_name, entity_type, state, is_community_controlled, power_score, system_count, total_dollar_flow, procurement_dollars, justice_dollars, donation_dollars, contract_count, distinct_govt_buyers, distinct_parties_funded, charity_size'
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
          .from('mv_revolving_door')
          .select(
            'gs_id, canonical_name, entity_type, state, is_community_controlled, system_count, procurement_dollars, donation_dollars, contract_count, distinct_govt_buyers, distinct_parties_funded, total_dollar_flow, revolving_door_score'
          )
          .order('revolving_door_score', { ascending: false })
          .limit(20)
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
