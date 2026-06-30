import { NextResponse } from 'next/server';
import { getServiceSupabase } from '@/lib/supabase';
import { safe } from '@/lib/sql';

// Cross-system PEOPLE leaderboard — the de-collided person→money rollup.
// Reads mv_person_identity_influence_v2 (move A4: each entity's dollars are
// split evenly across its directors, so co-directors are no longer each credited
// the entity's whole figure). Annotated with L16 "who funds this power holder" —
// the foundations backing the entities each person governs
// (mv_foundation_grantees WHERE link_method='relationship').
//
// HONESTY CONTRACT (do not break in the UI):
//   - attributed_* = personal share (even-split by director headcount). Show as spend.
//   - board_count <= 10 + NOT is_nominee_block filters the trustee-nominee blocks.
//   - even-split does NOT weight by role/tenure, and top names can still harbour
//     name-collision aggregates (separate disambiguation residual) — label accordingly.
export async function GET() {
  try {
    const supabase = getServiceSupabase();

    const [holders, totalRaw] = await Promise.all([
      safe(
        supabase.rpc('exec_sql', {
          query: `
            WITH top_holders AS (
              SELECT identity_key, person_name, board_count, financial_system_count,
                     attributed_procurement, attributed_justice, attributed_donations,
                     total_contracts, influence_score_attributed, shares_board_entities,
                     acco_boards, max_board_director_count
              FROM mv_person_identity_influence_v2
              WHERE NOT is_nominee_block
                AND board_count <= 10
                AND influence_score_attributed > 0
              ORDER BY influence_score_attributed DESC
              LIMIT 50
            ),
            person_entities AS (
              SELECT n.identity_key, n.entity_id, n.entity_name,
                     (COALESCE(n.procurement_dollars,0) + COALESCE(n.justice_dollars,0)
                      + COALESCE(n.donation_dollars,0)) AS entity_flow
              FROM mv_person_identity_network n
              WHERE n.identity_key IN (SELECT identity_key FROM top_holders)
            ),
            boards AS (
              SELECT identity_key,
                     (array_agg(entity_name ORDER BY entity_flow DESC NULLS LAST))[1:3] AS top_boards
              FROM person_entities
              GROUP BY identity_key
            ),
            funders AS (
              SELECT pe.identity_key,
                     count(DISTINCT fg.foundation_id) AS funder_count,
                     (array_agg(DISTINCT fg.foundation_name))[1:5] AS foundation_backers
              FROM person_entities pe
              JOIN mv_foundation_grantees fg
                ON fg.grantee_entity_id = pe.entity_id
               AND fg.link_method = 'relationship'
              GROUP BY pe.identity_key
            )
            SELECT
              th.person_name,
              th.board_count,
              th.financial_system_count,
              round(th.attributed_procurement)::bigint AS attributed_procurement,
              round(th.attributed_justice)::bigint     AS attributed_justice,
              round(th.attributed_donations)::bigint   AS attributed_donations,
              th.total_contracts,
              th.shares_board_entities,
              th.acco_boards,
              th.max_board_director_count,
              COALESCE(b.top_boards, ARRAY[]::text[]) AS top_boards,
              COALESCE(f.funder_count, 0) AS funder_count,
              COALESCE(f.foundation_backers, ARRAY[]::text[]) AS foundation_backers
            FROM top_holders th
            LEFT JOIN boards b ON b.identity_key = th.identity_key
            LEFT JOIN funders f ON f.identity_key = th.identity_key
            ORDER BY th.influence_score_attributed DESC
          `,
        })
      ),

      // How many cross-system power holders exist (present in 2+ money systems)
      safe(
        supabase.rpc('exec_sql', {
          query: `
            SELECT COUNT(*) AS total
            FROM mv_person_identity_influence_v2
            WHERE NOT is_nominee_block
              AND board_count <= 10
              AND financial_system_count >= 2
          `,
        })
      ),
    ]);

    const total = Array.isArray(totalRaw) && totalRaw[0] ? Number(totalRaw[0].total) || 0 : 0;

    return NextResponse.json({
      holders: holders || [],
      total,
    });
  } catch (error) {
    const msg = error instanceof Error ? error.message : 'Unknown error';
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
