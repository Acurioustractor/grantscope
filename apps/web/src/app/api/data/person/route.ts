import { NextResponse } from 'next/server';
import { z } from 'zod';
import { getServiceSupabase } from '@/lib/supabase';
import { esc } from '@/lib/sql';
import { rateLimit } from '@/lib/rate-limit';

export const dynamic = 'force-dynamic';

const limiter = rateLimit();

// The ranked leaderboard reads mv_person_identity_influence_v2 (identity grain): trustee/nominee
// megamerges are collapsed into one identity and flagged is_nominee_block, so we exclude them with
// WHERE NOT is_nominee_block. Disambiguation now covers every name with >10 boards (2026-06-19,
// scripts/build-person-identities.mjs --min-boards=10), BUT the board-count cap stays: clustering
// leaves ~158 non-nominee identities with board_count>10 that the nominee test (size>=20 + dominant
// officer + dominant state) doesn't catch — incl. a 325-board cluster and ~$1B co-director blocks at
// board_count 12-18 that would dominate the leaderboard top if exposed. Dropping the cap needs the
// nominee detection tuned to flag those first. See docs/leverage-map.md "DATA-QUALITY GATE".
const MAX_PLAUSIBLE_BOARDS = 10;

// Every mode reads mv_person_identity_influence_v2's attributed columns: each organisation's money
// split evenly across its directors. v1 gave every co-director the organisation's whole total (eight
// people each "held" 7.57bn). Field names are kept for API consumers; `basis` says what they mean.
const V2_TOTAL_MONEY =
  '(coalesce(attributed_procurement, 0) + coalesce(attributed_justice, 0) + coalesce(attributed_donations, 0))';
const V2_PERSON_COLUMNS = `identity_key, person_name, person_name_normalised, board_count, entity_types,
                  attributed_procurement AS total_procurement, total_contracts,
                  attributed_justice AS total_justice, attributed_donations AS total_donations,
                  influence_score_attributed AS max_influence_score, financial_system_count, acco_boards,
                  ${V2_TOTAL_MONEY} AS total_money`;
const V2_BASIS =
  "Dollar fields are each organisation's total split evenly among its directors; not money the person received.";

const schema = z.object({
  q: z.string().max(200).optional(),
  name: z.string().max(200).optional(),
  limit: z.coerce.number().int().min(1).max(100).optional().default(20),
});

export async function GET(request: Request) {
  const limited = limiter(request);
  if (limited) return limited;

  const { searchParams } = new URL(request.url);
  const parsed = schema.safeParse(Object.fromEntries(searchParams));
  if (!parsed.success) return NextResponse.json({ error: 'Invalid parameters' }, { status: 400 });

  const { limit } = parsed.data;
  const name = parsed.data.name?.trim();
  const q = parsed.data.q?.trim();

  const supabase = getServiceSupabase();

  // Search mode: return top people matching query. Same view, columns and basis as the leaderboard
  // below, so typing a name never switches the table from "their share" to whole-organisation
  // totals (it did until 2026-09-24, and "Total $" went blank because v1 has no total_money).
  if (q && q.length >= 2) {
    try {
      const { data, error } = await supabase.rpc('exec_sql', {
        query: `SELECT ${V2_PERSON_COLUMNS}
           FROM mv_person_identity_influence_v2
           WHERE person_name_normalised LIKE '%${esc(q.toUpperCase())}%'
             AND NOT is_nominee_block
           ORDER BY financial_system_count DESC NULLS LAST, ${V2_TOTAL_MONEY} DESC NULLS LAST
           LIMIT ${limit}`,
      });
      if (error) throw error;
      const response = NextResponse.json({ results: data || [], basis: V2_BASIS });
      response.headers.set('Cache-Control', 'public, s-maxage=120, stale-while-revalidate=300');
      return response;
    } catch (error) {
      console.error('Person search error:', error);
      return NextResponse.json({ error: 'Search failed' }, { status: 500 });
    }
  }

  // Top people mode: return most influential people
  if (!name) {
    try {
      // Rank by cross-system reach then total dollars, NOT board count. financial_system_count (0-3
      // across procurement/justice/donations) is the breadth signal; total_money is the sum of the
      // three dollar columns (total_contracts is a COUNT, not $). Identity grain (see header):
      // NOT is_nominee_block drops trustee megamerges, board-count cap backstops un-split mid-size names.
      const { data, error } = await supabase.rpc('exec_sql', {
        query: `SELECT ${V2_PERSON_COLUMNS}
           FROM mv_person_identity_influence_v2
           WHERE NOT is_nominee_block
             AND (financial_system_count > 0 OR board_count > 3)
             AND coalesce(board_count, 0) <= ${MAX_PLAUSIBLE_BOARDS}
           ORDER BY financial_system_count DESC NULLS LAST, ${V2_TOTAL_MONEY} DESC NULLS LAST
           LIMIT ${limit}`,
      });
      if (error) throw error;
      const response = NextResponse.json({
        results: data || [],
        basis: V2_BASIS,
      });
      response.headers.set('Cache-Control', 'public, s-maxage=300, stale-while-revalidate=600');
      return response;
    } catch (error) {
      console.error('Top people error:', error);
      return NextResponse.json({ error: 'Failed to fetch' }, { status: 500 });
    }
  }

  // Profile mode: return full person details
  try {
    const normalised = esc(name.toUpperCase());

    // Influence summary, v2 like the list: a name can hold several identities, and the summary is
    // the widest-reaching one. The positions below carry each organisation's own totals.
    const { data: influence, error: infErr } = await supabase.rpc('exec_sql', {
      query: `SELECT ${V2_PERSON_COLUMNS}
         FROM mv_person_identity_influence_v2
         WHERE person_name_normalised = '${normalised}' AND NOT is_nominee_block
         ORDER BY financial_system_count DESC NULLS LAST, ${V2_TOTAL_MONEY} DESC NULLS LAST
         LIMIT 1`,
    });
    if (infErr) throw infErr;

    // Get all board positions with entity details
    const { data: positions, error: posErr } = await supabase.rpc('exec_sql', {
      query: `SELECT pen.person_name_display, pen.entity_name, pen.entity_abn, pen.entity_type,
                pen.is_community_controlled, pen.role_type, pen.source,
                pen.appointment_date, pen.board_count,
                pen.procurement_dollars, pen.contract_count,
                pen.justice_dollars, pen.justice_count,
                pen.donation_dollars, pen.donation_count,
                pen.influence_score,
                ge.gs_id
         FROM mv_person_entity_network pen
         JOIN gs_entities ge ON ge.id = pen.entity_id
         WHERE pen.person_name_normalised = '${normalised}'
         ORDER BY pen.influence_score DESC NULLS LAST`,
    });
    if (posErr) throw posErr;

    const response = NextResponse.json({
      influence: (influence as unknown[])?.[0] ?? null,
      basis: V2_BASIS,
      positions: positions || [],
    });
    response.headers.set('Cache-Control', 'public, s-maxage=300, stale-while-revalidate=600');
    return response;
  } catch (error) {
    console.error('Person profile error:', error);
    return NextResponse.json({ error: 'Profile failed' }, { status: 500 });
  }
}
