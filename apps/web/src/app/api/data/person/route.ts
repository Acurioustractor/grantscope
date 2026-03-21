import { NextResponse } from 'next/server';
import { z } from 'zod';
import { getServiceSupabase } from '@/lib/supabase';
import { esc } from '@/lib/sql';
import { rateLimit } from '@/lib/rate-limit';

export const dynamic = 'force-dynamic';

const limiter = rateLimit();

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

  // Search mode: return top people matching query
  if (q && q.length >= 2) {
    try {
      const { data, error } = await supabase.rpc('exec_sql', {
        query: `SELECT person_name, person_name_normalised, board_count, entity_types, data_sources,
                  total_procurement, total_contracts, total_justice, total_donations,
                  max_influence_score, financial_system_count
           FROM mv_person_influence
           WHERE person_name_normalised LIKE '%${esc(q.toUpperCase())}%'
           ORDER BY max_influence_score DESC NULLS LAST
           LIMIT ${limit}`,
      });
      if (error) throw error;
      const response = NextResponse.json({ results: data || [] });
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
      const { data, error } = await supabase.rpc('exec_sql', {
        query: `SELECT person_name, person_name_normalised, board_count, entity_types, data_sources,
                  total_procurement, total_contracts, total_justice, total_donations,
                  max_influence_score, financial_system_count, acco_boards
           FROM mv_person_influence
           WHERE financial_system_count > 0 OR board_count > 3
           ORDER BY max_influence_score DESC NULLS LAST
           LIMIT ${limit}`,
      });
      if (error) throw error;
      const response = NextResponse.json({ results: data || [] });
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

    // Get influence summary
    const { data: influence, error: infErr } = await supabase.rpc('exec_sql', {
      query: `SELECT * FROM mv_person_influence WHERE person_name_normalised = '${normalised}'`,
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
      positions: positions || [],
    });
    response.headers.set('Cache-Control', 'public, s-maxage=300, stale-while-revalidate=600');
    return response;
  } catch (error) {
    console.error('Person profile error:', error);
    return NextResponse.json({ error: 'Profile failed' }, { status: 500 });
  }
}
