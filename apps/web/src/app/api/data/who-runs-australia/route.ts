import { NextResponse } from 'next/server';
import { getServiceSupabase } from '@/lib/supabase';
import { safe } from '@/lib/services/utils';

/**
 * Who Runs Australia API -- cross-system influence network data.
 *
 * GET /api/data/who-runs-australia
 *   Returns combined data from:
 *   - mv_revolving_door (entities with 2+ influence vectors)
 *   - mv_board_interlocks (shared board members between organisations)
 *   - mv_person_cross_system (people on charity boards who also donate politically)
 *   - mv_person_influence (top influencers by cross-system presence)
 */

export async function GET() {
  try {
    const supabase = getServiceSupabase();

    const [
      revolvingDoorResult,
      boardInterlocksResult,
      politicalCrossoverResult,
      statsResult,
    ] = await Promise.all([
      // Top revolving door entities by score
      safe(supabase
        .from('mv_revolving_door')
        .select('gs_id, canonical_name, entity_type, abn, state, lga_name, is_community_controlled, lobbies, donates, contracts, receives_funding, influence_vectors, revolving_door_score, total_donated, total_contracts, total_funded, parties_funded, distinct_buyers')
        .order('revolving_door_score', { ascending: false })
        .limit(20)),

      // Top board interlocks by interlock_score
      safe(supabase
        .from('mv_board_interlocks')
        .select('person_name_normalised, person_name_display, board_count, organisations, role_types, total_procurement_dollars, total_justice_dollars, total_donation_dollars, max_entity_system_count, total_power_score, connects_community_controlled, interlock_score')
        .gte('board_count', 2)
        .order('interlock_score', { ascending: false })
        .limit(20)),

      // People who sit on charity boards AND donate politically
      safe(supabase
        .from('mv_person_cross_system')
        .select('person_name_normalised, display_name, board_count, board_entities, total_donated, parties_funded, parties_funded_list, donation_years, influence_score')
        .eq('on_charity_boards', true)
        .eq('is_political_donor', true)
        .order('influence_score', { ascending: false })
        .limit(20)),

      // Aggregate stats
      safe(supabase.rpc('exec_sql', {
        query: `SELECT
          (SELECT COUNT(*)::int FROM mv_revolving_door) as revolving_door_total,
          (SELECT COUNT(*)::int FROM mv_revolving_door WHERE influence_vectors >= 3) as three_vector_plus,
          (SELECT COUNT(*)::int FROM mv_board_interlocks WHERE board_count >= 2) as multi_board_people,
          (SELECT COUNT(*)::int FROM mv_person_cross_system WHERE on_charity_boards AND is_political_donor) as board_donors`,
      })),
    ]);

    const stats = (statsResult as Record<string, string>[] | null)?.[0];

    const response = NextResponse.json({
      revolving_door: revolvingDoorResult || [],
      board_interlocks: boardInterlocksResult || [],
      political_crossover: politicalCrossoverResult || [],
      stats: {
        revolving_door_total: Number(stats?.revolving_door_total) || 0,
        three_vector_plus: Number(stats?.three_vector_plus) || 0,
        multi_board_people: Number(stats?.multi_board_people) || 0,
        board_donors: Number(stats?.board_donors) || 0,
      },
      meta: {
        generated_at: new Date().toISOString(),
        data_sources: [
          'mv_revolving_door',
          'mv_board_interlocks',
          'mv_person_cross_system',
        ],
      },
    });

    response.headers.set('Cache-Control', 'public, s-maxage=300, stale-while-revalidate=600');
    return response;
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Unknown error';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
